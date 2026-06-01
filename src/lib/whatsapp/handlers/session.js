const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const useSupabaseAuthState = require('../supabase-auth')
const { handleMessage } = require('./message')
const {
    shouldProcessUpsertMessage,
    extractInboundMessagePayload,
    describeInboundMessage,
    isIgnorableIncomingMessage,
    isDirectUserChatJid,
} = require('../upsert-helpers')
const logger = pino({ level: 'warn' })
const VERBOSE_WHATSAPP_TRACE = process.env.WHATSAPP_TRACE_VERBOSE === 'true'

function traceWhatsApp(...args) {
    if (VERBOSE_WHATSAPP_TRACE) {
        console.log(...args)
    }
}

function normalizePairingPhone(value) {
    if (!value || typeof value !== 'string') return null
    let digits = value.trim().replace(/[^\d+]/g, '')
    if (digits.startsWith('+')) digits = digits.slice(1)
    if (digits.startsWith('00')) digits = digits.slice(2)
    digits = digits.replace(/\D/g, '')
    if (!digits) return null
    if (digits.length < 8 || digits.length > 15) return null
    return digits
}

function formatPairingCode(rawCode) {
    if (!rawCode || typeof rawCode !== 'string') return null
    const compact = rawCode.replace(/\s+/g, '').trim()
    if (!compact) return null
    if (compact.includes('-')) return compact
    return compact.match(/.{1,4}/g)?.join('-') || compact
}

async function initSession(context, agentId, agentName, reconnectAttempt = 0) {
    const { supabase, activeSessions, pendingConnections, openai, CinetPay, markSetupPhaseActivity, clearSetupPhaseActivity } = context
    const isSilentRestore = reconnectAttempt === 99
    const effectiveReconnectAttempt = isSilentRestore ? 0 : reconnectAttempt


    if (activeSessions.has(agentId) && activeSessions.get(agentId).status === 'connected') {
        console.log(`Session already active for ${agentName}`)
        return
    }

    if (pendingConnections.has(agentId)) {
        if (reconnectAttempt > 0) {
            // Auto-reconnect already queued — let it finish
            console.log(`Connection already pending for ${agentName}`)
            return
        }
        // reconnectAttempt === 0: explicit user request — release the stuck state and restart fresh
        console.log(`⚠️ [${agentName}] Releasing stuck pending connection for fresh retry`)
        const staleSession = activeSessions.get(agentId)
        if (staleSession?.socket) {
            try { staleSession.socket.end() } catch (_) { }
        }
        pendingConnections.delete(agentId)
        activeSessions.delete(agentId)
    }

    pendingConnections.add(agentId)
    console.log(`🔌 Initializing WhatsApp for ${agentName}...`)

    // Safety net: if no QR/connection after 5 minutes, release the lock so retries work
    let pendingTimeout = setTimeout(async () => {
        if (pendingConnections.has(agentId)) {
            console.warn(`⏰ [TIMEOUT] Session init timed out for ${agentName} — releasing lock`)
            pendingConnections.delete(agentId)
            activeSessions.delete(agentId)
            await supabase.from('agents').update({
                whatsapp_status: 'disconnected',
                whatsapp_qr_code: null
            }).eq('id', agentId)
        }
    }, 5 * 60 * 1000)

    try {
        // const sessionDir = ensureSessionDir(agentId) // Legacy: No longer needed
        // const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
        const { state, saveCreds } = await useSupabaseAuthState(supabase, agentId)
        let pairingMode = 'qr'
        let pairingPhone = null

        try {
            const { data: pairingSettings } = await supabase
                .from('agents')
                .select('whatsapp_pairing_mode, whatsapp_pairing_phone')
                .eq('id', agentId)
                .single()

            if (pairingSettings?.whatsapp_pairing_mode === 'pairing_code') {
                const normalizedPhone = normalizePairingPhone(pairingSettings?.whatsapp_pairing_phone || '')
                if (normalizedPhone) {
                    pairingMode = 'pairing_code'
                    pairingPhone = normalizedPhone
                }
            }
        } catch (pairingSettingsError) {
            console.warn(`[${agentName}] Failed to load pairing settings:`, pairingSettingsError?.message || pairingSettingsError)
        }

        // Fetch latest WhatsApp version with a fallback in case the network call fails on VPS
        let version
        try {
            const result = await fetchLatestBaileysVersion()
            version = result.version
        } catch (versionErr) {
            version = [2, 3000, 1015901307] // Known stable fallback
            console.warn(`[${agentName}] fetchLatestBaileysVersion failed, using fallback version`)
        }

        const socket = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            // Identify as Chrome on Ubuntu — without this WhatsApp may silently reject the connection
            browser: Browsers.ubuntu('Chrome'),
            // Increase timeouts for VPS with higher latency to WhatsApp servers
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: undefined,
            // Avoid a heavy initial history sync during fresh QR pairing on the VPS.
            syncFullHistory: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            generateHighQualityLinkPreview: false
        })

        const session = {
            socket,
            status: 'connecting',
            agentName,
            reconnectAttempts: effectiveReconnectAttempt,
            isSilentRestore,
            pairingSucceeded: false,
            persistedCredsClearedForQr: false,
            pairingMode,
            pairingPhone,
            pairingCodeRequested: false,
            pairingCode: null,
        }
        activeSessions.set(agentId, session)

        // 💓 KEEPALIVE: Envoie un ping toutes les 14 minutes pour éviter la déconnexion
        // WhatsApp ferme les connexions inactives après ~30 minutes sans activité
        let keepAliveInterval = null

        // Handle connection updates
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications, isOnline } = update

            if (typeof receivedPendingNotifications !== 'undefined' && (VERBOSE_WHATSAPP_TRACE || receivedPendingNotifications === true)) {
                console.log(`📬 [${agentName}] receivedPendingNotifications=${receivedPendingNotifications}`)
            }

            if (typeof isOnline !== 'undefined' && (VERBOSE_WHATSAPP_TRACE || isOnline === false)) {
                console.log(`🟢 [${agentName}] isOnline=${isOnline}`)
            }

            if (qr) {
                session.status = 'qr_waiting'
                session.pairingSucceeded = false
                markSetupPhaseActivity?.(agentId)

                // Limite QR pour les reconnexions (agent déjà connecté avant)
                const isReconnection = isSilentRestore || effectiveReconnectAttempt > 0
                if (isReconnection && !session.persistedCredsClearedForQr) {
                    try {
                        await supabase.from('whatsapp_sessions').delete().eq('session_id', agentId)
                        session.persistedCredsClearedForQr = true
                        console.log(`🧹 [${agentName}] QR requis pendant une reconnexion — anciens credentials purges pour repartir sur un pairing propre`)
                    } catch (cleanupErr) {
                        console.warn(`⚠️ [${agentName}] Impossible de purger les anciens credentials avant le nouveau QR:`, cleanupErr.message || cleanupErr)
                    }
                }

                if (isReconnection && context?.qrAttemptCounts) {
                    const count = (context.qrAttemptCounts.get(agentId) || 0) + 1
                    context.qrAttemptCounts.set(agentId, count)
                    const MAX_QR_RECONNECT = 5
                    if (count > MAX_QR_RECONNECT) {
                        console.warn(`⛔ [${agentName}] Limite QR atteinte (${count}/${MAX_QR_RECONNECT}) en reconnexion — arrêt et mise en disconnected`)
                        context.qrAttemptCounts.delete(agentId)
                        pendingConnections.delete(agentId)
                        clearTimeout(pendingTimeout)
                        try { socket.end() } catch (_) {}
                        await supabase.from('agents').update({
                            whatsapp_connected: false,
                            whatsapp_status: 'disconnected',
                            whatsapp_qr_code: null,
                            whatsapp_disconnected_by: 'system'
                        }).eq('id', agentId)
                        return
                    }
                    console.log(`📱 [${agentName}] Pairing update generated (reconnexion ${count}/${MAX_QR_RECONNECT}), saving to DB...`)
                } else {
                    console.log(`📱 [${agentName}] Pairing update generated, saving to DB...`)
                }

                try {
                    const QR_SAVE_TIMEOUT_MS = 5000
                    let updatePayload = null

                    if (session.pairingMode === 'pairing_code' && session.pairingPhone) {
                        if (!session.pairingCodeRequested) {
                            try {
                                const rawCode = await socket.requestPairingCode(session.pairingPhone)
                                const formattedCode = formatPairingCode(rawCode)
                                if (formattedCode) {
                                    session.pairingCodeRequested = true
                                    session.pairingCode = formattedCode
                                    console.log(`🔐 [${agentName}] Pairing code generated for mobile linking`)
                                } else {
                                    console.warn(`⚠️ [${agentName}] Pairing code request returned empty payload`)
                                }
                            } catch (pairingCodeError) {
                                console.warn(`⚠️ [${agentName}] Failed to request pairing code:`, pairingCodeError?.message || pairingCodeError)
                            }
                        }

                        if (session.pairingCode) {
                            updatePayload = {
                                whatsapp_qr_code: null,
                                whatsapp_status: 'qr_ready',
                                whatsapp_connected: false,
                                whatsapp_pairing_code: session.pairingCode
                            }
                        } else {
                            // Fallback: if pairing code cannot be generated, keep QR flow available.
                            const qrDataUrl = await QRCode.toDataURL(qr)
                            updatePayload = {
                                whatsapp_qr_code: qrDataUrl,
                                whatsapp_status: 'qr_ready',
                                whatsapp_connected: false
                            }
                            console.warn(`⚠️ [${agentName}] Pairing-code fallback to QR mode for this attempt`)
                        }
                    } else {
                        // Convert QR to data URL and store in database
                        const qrDataUrl = await QRCode.toDataURL(qr)
                        updatePayload = {
                            whatsapp_qr_code: qrDataUrl,
                            whatsapp_status: 'qr_ready',
                            whatsapp_connected: false
                        }
                    }

                    const saveQR = supabase.from('agents').update(updatePayload).eq('id', agentId)

                    const { error: qrError } = await Promise.race([
                        saveQR,
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('QR save timeout (5s)')), QR_SAVE_TIMEOUT_MS)
                        )
                    ])

                    if (qrError) {
                        console.warn(`⚠️ [${agentName}] Failed to save pairing payload to DB:`, qrError.message)
                    } else {
                        if (session.pairingMode === 'pairing_code') {
                            console.log(`✅ [${agentName}] Pairing code state saved to DB`)
                        } else {
                            console.log(`✅ [${agentName}] QR code saved to DB and ready for scan`)
                        }
                    }
                } catch (qrErr) {
                    // Non-bloquant : save échoue silencieusement (timeout réseau ou erreur DB)
                    // Le socket reste actif et un nouveau payload sera généré au prochain cycle
                    console.warn(`⚠️ [${agentName}] Pairing payload save failed (non-blocking):`, qrErr.message)
                }
            }

            if (isNewLogin) {
                session.pairingSucceeded = true
                session.status = 'pairing_waiting_open'
                markSetupPhaseActivity?.(agentId)
                console.log(`[${agentName}] QR scan confirmed by WhatsApp - waiting for final session open...`)

                try {
                    await supabase.from('agents').update({
                        whatsapp_status: 'connecting',
                        whatsapp_qr_code: null
                    }).eq('id', agentId)
                } catch (pairingDbErr) {
                    console.warn(`[${agentName}] Failed to clear QR after scan confirmation:`, pairingDbErr.message)
                }
            }

            if (connection === 'open') {
                // Réinitialiser le compteur QR sur connexion réussie
                if (context?.qrAttemptCounts) {
                    context.qrAttemptCounts.delete(agentId)
                }
                clearTimeout(pendingTimeout)
                session.status = 'connected'
                session.connectedAt = Date.now()
                pendingConnections.delete(agentId)
                clearSetupPhaseActivity?.(agentId)
                const phoneNumber = socket.user?.id.split(':')[0] || null
                console.log(`✅ ${agentName} connected: ${phoneNumber}`)

                // Ne pas écraser whatsapp_phone avec null si socket.user n'est pas encore disponible
                // (cas du restart PM2 où socket.user peut être null à l'instant de l'événement)
                const updateData = {
                    whatsapp_connected: true,
                    whatsapp_qr_code: null,
                    whatsapp_status: 'connected',
                    whatsapp_ever_connected: true,
                    whatsapp_disconnected_by: null
                }
                if (phoneNumber) updateData.whatsapp_phone = phoneNumber

                const { error: dbError } = await supabase.from('agents').update(updateData).eq('id', agentId)
                if (dbError) {
                    console.error(`❌ [${agentName}] Failed to mark connected in DB:`, dbError.message)
                    session.status = 'error'
                    if (keepAliveInterval) clearInterval(keepAliveInterval)
                    try { socket.end() } catch (_) { }
                    return
                }

                let agentOwnerUserId = null
                try {
                    const { data: agentRecord, error: agentLookupError } = await supabase
                        .from('agents')
                        .select('user_id')
                        .eq('id', agentId)
                        .single()

                    if (agentLookupError) {
                        throw agentLookupError
                    }

                    agentOwnerUserId = agentRecord?.user_id || null

                    // test-account deadline intentionally NOT cleared here — only a payment qualifies a user
                } catch (agentLookupError) {
                    console.warn(`⚠️ [${agentName}] Failed to fetch owner user after connection:`, agentLookupError.message || agentLookupError)
                }

                try {
                    await socket.sendPresenceUpdate('available')
                    console.log(`🟢 [${agentName}] Presence set to available after open`)
                } catch (presenceErr) {
                    console.warn(`⚠️ [${agentName}] Failed to set presence to available:`, presenceErr.message)
                }

                // 💓 Démarrer le keepalive (ping toutes les 14 min)
                if (keepAliveInterval) clearInterval(keepAliveInterval)
                keepAliveInterval = setInterval(async () => {
                    if (session.status === 'connected') {
                        try {
                            await socket.sendPresenceUpdate('available')
                            console.log(`💓 Keepalive [${agentName}]`)
                        } catch (e) { /* Ignorer les erreurs keepalive */ }
                    }
                }, 14 * 60 * 1000)

                // 🔔 NOTIFICATION: Uniquement à la première connexion (pas sur reconnexion auto)
                // reconnectAttempt === 0 = première connexion réelle (scan QR ou démarrage initial)
                // reconnectAttempt > 0  = reconnexion automatique après coupure → pas de notification
                if (!session.isSilentRestore && effectiveReconnectAttempt === 0) {
                    try {
                        if (agentOwnerUserId) {
                            const { notify } = require('../../notifications/notify')
                            notify(agentOwnerUserId, 'agent_status_change', { agentName, agentStatus: 'connected' })
                            // Notify admins too
                            const { notifyAdmins } = require('../../notifications/admin-notify')
                            notifyAdmins('agent_connected', { agentName, agentId })
                        }
                    } catch (notifError) {
                        console.error('🔔 Notification error (non-blocking):', notifError)
                    }
                } else {
                    const reason = session.isSilentRestore ? 'restauration au démarrage' : `tentative ${effectiveReconnectAttempt}`
                    console.log(`🔄 Reconnexion silencieuse [${agentName}] (${reason}) — pas de notification`)
                }
            }

            if (connection === 'close') {
                clearTimeout(pendingTimeout)
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut
                const isServiceShuttingDown = context?.serviceState?.shuttingDown === true

                console.log(`❌ ${agentName} disconnected, code: ${statusCode}, reconnect: ${shouldReconnect}`)
                pendingConnections.delete(agentId)

                // Arrêter le keepalive lors de la déconnexion
                if (keepAliveInterval) {
                    clearInterval(keepAliveInterval)
                    keepAliveInterval = null
                }

                if (isServiceShuttingDown) {
                    activeSessions.delete(agentId)
                    clearSetupPhaseActivity?.(agentId)
                    console.log(`[${agentName}] Service shutdown in progress - skipping disconnect side effects`)
                    return
                }

                if (shouldReconnect) {
                    const sessionStatus = session.status // capture before activeSessions.delete
                    const pairingSucceededBeforeClose = session.pairingSucceeded === true
                    const restartRequiredAfterPairing =
                        sessionStatus === 'pairing_waiting_open' &&
                        pairingSucceededBeforeClose &&
                        statusCode === DisconnectReason.restartRequired
                    activeSessions.delete(agentId)

                    if (restartRequiredAfterPairing) {
                        const restartAttempt = session.isSilentRestore ? 99 : (session.reconnectAttempts || 0)
                        console.log(`🔁 [${agentName}] Pairing valide, redemarrage Baileys requis (515) — conservation des credentials et reprise immediate`)

                        await supabase.from('agents').update({
                            whatsapp_connected: false,
                            whatsapp_status: 'connecting',
                            whatsapp_qr_code: null,
                            whatsapp_disconnected_by: null
                        }).eq('id', agentId)

                        if (typeof context.scheduleSessionInit === 'function') {
                            context.scheduleSessionInit(context, { id: agentId, name: agentName, whatsapp_status: 'connecting' }, restartAttempt)
                        } else {
                            initSession(context, agentId, agentName, restartAttempt)
                        }
                        return
                    }

                    if (sessionStatus === 'pairing_waiting_open') {
                        console.warn(`⚠️ [${agentName}] QR scanne mais ouverture de session impossible - reinitialisation pour forcer un nouveau QR`)
                        if (context?.qrAttemptCounts) {
                            context.qrAttemptCounts.delete(agentId)
                        }
                        clearSetupPhaseActivity?.(agentId)
                        await supabase.from('whatsapp_sessions').delete().eq('session_id', agentId)
                        await supabase.from('agents').update({
                            whatsapp_connected: false,
                            whatsapp_status: 'disconnected',
                            whatsapp_qr_code: null,
                            whatsapp_disconnected_by: 'system'
                        }).eq('id', agentId)
                        return
                    }

                    // ⭐ EXPONENTIAL BACKOFF avec plafond (poka-yoke)
                    const MAX_RECONNECT_ATTEMPTS = 10
                    const attempt = (session.reconnectAttempts || 0) + 1

                    if (attempt > MAX_RECONNECT_ATTEMPTS) {
                        console.error(`🛑 [${agentName}] Reconnexion abandonnée après ${MAX_RECONNECT_ATTEMPTS} tentatives. Intervention manuelle requise.`)
                        // ⭐ Purger les credentials : après 10 échecs, la session est considérée
                        // invalide. Sans cette purge, l'utilisateur ne recevrait jamais de nouveau
                        // QR car notre route /connect détecte des credentials existants et ne force
                        // pas de fresh QR — laissant l'agent bloqué indéfiniment.
                        try {
                            await supabase.from('whatsapp_sessions').delete().eq('session_id', agentId)
                            console.log(`🧹 [${agentName}] Credentials purgés après ${MAX_RECONNECT_ATTEMPTS} échecs — prochain /connect génèrera un nouveau QR`)
                        } catch (cleanupErr) {
                            console.warn(`⚠️ [${agentName}] Impossible de purger les credentials:`, cleanupErr.message)
                        }
                        if (context?.qrAttemptCounts) context.qrAttemptCounts.delete(agentId)
                        await supabase.from('agents').update({
                            whatsapp_connected: false,
                            whatsapp_status: 'disconnected',
                            whatsapp_disconnected_by: 'system'
                        }).eq('id', agentId)
                        return
                    }

                    const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000) // Max 1 minute
                    console.log(`📡 Reconnecting in ${delay / 1000}s (Attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})...`)

                    setTimeout(async () => {
                        // ⭐ FIX: Vérifier si l'agent veut toujours être connecté avant de reconnecter
                        // Évite que la reconnexion auto remette whatsapp_connected=true après une déco volontaire
                        const { data: agentCheck } = await supabase
                            .from('agents')
                            .select('is_active, whatsapp_connected, whatsapp_status')
                            .eq('id', agentId)
                            .single()

                        if (!agentCheck?.is_active) {
                            console.log(`🚫 [${agentName}] Agent inactif (is_active=false), reconnexion annulée`)
                            return
                        }
                        if (agentCheck?.whatsapp_connected === false && !['connecting', 'qr_ready'].includes(agentCheck?.whatsapp_status)) {
                            console.log(`🚫 [${agentName}] Déconnexion volontaire détectée (offline/disconnected), reconnexion annulée`)
                            return
                        }

                        // ⭐ FIX: Si la connexion a échoué AVANT d'atteindre 'connected' (ex: QR scanné
                        // mais handshake échoué), supprimer les credentials partiels pour forcer un
                        // nouveau QR. Sans ça, Baileys recharge des creds corrompus → pas de QR → boucle.
                        let hasPersistedCreds = false
                        try {
                            const { data: storedCreds } = await supabase
                                .from('whatsapp_sessions')
                                .select('key_id')
                                .eq('session_id', agentId)
                                .eq('key_id', 'creds')
                                .maybeSingle()
                            hasPersistedCreds = !!storedCreds
                        } catch (_) { }

                        if (!pairingSucceededBeforeClose && !hasPersistedCreds && (sessionStatus === 'qr_waiting' || sessionStatus === 'connecting')) {
                            console.log(`🧹 [${agentName}] Connexion échouée avant 'open' — suppression des creds partiels pour nouveau QR`)
                            await supabase.from('whatsapp_sessions').delete().eq('session_id', agentId)
                        } else if (sessionStatus === 'qr_waiting' || sessionStatus === 'pairing_waiting_open' || sessionStatus === 'connecting') {
                            console.log(`[${agentName}] Pairing deja confirme ou creds persistes - conservation de la session pour reprise`)
                        }

                        if (typeof context.scheduleSessionInit === 'function') {
                            context.scheduleSessionInit(context, { id: agentId, name: agentName }, attempt)
                        } else {
                            initSession(context, agentId, agentName, attempt)
                        }
                    }, delay)
                } else {
                    activeSessions.delete(agentId)

                    // ⭐ ROBUST CLEANUP (Sécurité Expert)
                    // Supprime toutes les clés de session dans Supabase si déconnexion définitive
                    console.log(`🧹 Cleaning up session data for ${agentName}...`)

                    try {
                        await supabase.from('whatsapp_sessions').delete().eq('session_id', agentId)
                        console.log(`✅ Session data cleared from DB for ${agentName}`)
                    } catch (cleanupErr) {
                        console.error(`⚠️ Failed to cleanup session for ${agentName}:`, cleanupErr.message)
                    }

                    // Réinitialiser le compteur QR pour cet agent — sans ça, un compteur
                    // accumulé lors de sessions précédentes empêcherait la génération d'un
                    // nouveau QR lors de la prochaine tentative de reconnexion manuelle.
                    if (context?.qrAttemptCounts) {
                        context.qrAttemptCounts.delete(agentId)
                    }

                    await supabase.from('agents').update({
                        whatsapp_connected: false,
                        whatsapp_qr_code: null,
                        whatsapp_status: 'disconnected',
                        whatsapp_disconnected_by: 'system'
                        // whatsapp_phone conservé intentionnellement pour affichage dashboard
                    }).eq('id', agentId)

                    // 🔔 NOTIFICATION: Agent déconnecté (définitivement)
                    try {
                        const { data: agent } = await supabase.from('agents').select('user_id').eq('id', agentId).single()
                        if (agent?.user_id) {
                            const { notify } = require('../../notifications/notify')
                            notify(agent.user_id, 'agent_status_change', { agentName, agentStatus: 'disconnected' })
                            // Notify admins too
                            const { notifyAdmins } = require('../../notifications/admin-notify')
                            notifyAdmins('agent_disconnected', { agentName, agentId })
                        }
                    } catch (notifError) {
                        console.error('🔔 Notification error (non-blocking):', notifError)
                    }
                }
            }
        })

        // Handle credentials update
        socket.ev.on('creds.update', saveCreds)

        // Handle incoming messages
        socket.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest, syncType, progress }) => {
            traceWhatsApp(`🗂️ [${agentName}] messaging-history.set chats=${chats?.length || 0} contacts=${contacts?.length || 0} messages=${messages?.length || 0} syncType=${syncType || 'unknown'} progress=${progress ?? 'n/a'} latest=${Boolean(isLatest)}`)
        })

        socket.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
            const actionableMessages = msgs.filter(msg => shouldProcessUpsertMessage(type, msg))

            const processableMessages = actionableMessages.filter(msg => !isIgnorableIncomingMessage(msg))
            const directInboundCandidates = processableMessages.filter(msg => {
                const remoteJid = msg?.key?.remoteJid || ''
                return !msg?.key?.fromMe && isDirectUserChatJid(remoteJid)
            })

            if (directInboundCandidates.length > 0) {
                const sample = describeInboundMessage(directInboundCandidates[0])
                console.log(
                    `📨 [${agentName}] messages.upsert type=${type} raw=${msgs.length} actionable=${actionableMessages.length} direct_inbound=${directInboundCandidates.length} sample_jid=${sample.remoteJid} wrappers=${sample.wrappers.join('>') || 'none'} keys=${sample.topLevelKeys.join(',') || 'none'}`
                )
            } else if (processableMessages.length > 0 && msgs.length > 0 && type !== 'notify') {
                console.log(`📭 [${agentName}] messages.upsert type=${type} raw=${msgs.length} actionable=${actionableMessages.length} direct_inbound=0`)
            }

            if (actionableMessages.length === 0) {
                const sample = describeInboundMessage(msgs[0] || {})
                traceWhatsApp(`⏭️ [${agentName}] Ignoring messages.upsert type=${type} raw=${msgs.length} actionable=0 sample_jid=${sample.remoteJid || 'none'} wrappers=${sample.wrappers.join('>') || 'none'} keys=${sample.topLevelKeys.join(',') || 'none'}`)
                return
            }

            if (processableMessages.length === 0) {
                traceWhatsApp(`⏭️ [${agentName}] Ignoring system-only ${type} batch raw=${msgs.length} actionable=${actionableMessages.length}`)
                return
            }

            if (type !== 'notify') {
                console.log(`📨 [${agentName}] Processing ${processableMessages.length}/${msgs.length} ${type} message(s) after sync/reconnect`)
            }

            for (const msg of processableMessages) {
                if (msg.key.fromMe) continue
                if (!isDirectUserChatJid(msg.key.remoteJid)) continue

                const inboundPayload = extractInboundMessagePayload(msg)
                if (!inboundPayload) {
                    const sample = describeInboundMessage(msg)
                    console.log(`⏭️ [${agentName}] Skipping unsupported incoming message inside ${type} batch jid=${sample.remoteJid || 'none'} wrappers=${sample.wrappers.join('>') || 'none'} keys=${sample.topLevelKeys.join(',') || 'none'}`)
                    continue
                }

                // Construct simplified message object or pass full msg?
                // handleMessage expects { text, from, pushName, audioMessage?, imageMessage?, key }
                const messagePayload = {
                    text: inboundPayload.text,
                    from: msg.key.remoteJid,
                    pushName: msg.pushName,
                    key: msg.key,
                    audioMessage: inboundPayload.audioMessage,
                    imageMessage: inboundPayload.imageMessage,
                    caption: inboundPayload.caption,
                    quotedText: inboundPayload.quotedText || null,
                }

                // Le read receipt est géré dans handleMessage après vérification is_active / bot_paused
                // (évite les doubles ticks bleus sur agents en pause ou conversations bot_paused)
                await handleMessage(context, agentId, messagePayload, inboundPayload.isVoiceMessage)
            }
        })

        if (typeof socket.ws?.on === 'function') {
            socket.ws.on('CB:message', (node) => {
                const from = node?.attrs?.from || ''
                if (!isDirectUserChatJid(from)) {
                    return
                }

                traceWhatsApp(`📡 [${agentName}] raw CB:message from=${from} participant=${node?.attrs?.participant || 'none'} id=${node?.attrs?.id || 'none'} notify=${node?.attrs?.notify || 'none'}`)
            })
        }

    } catch (error) {
        clearTimeout(pendingTimeout)
        console.error(`Failed to initialize session for ${agentName}:`, error)
        pendingConnections.delete(agentId)
    }
}

module.exports = { initSession }
