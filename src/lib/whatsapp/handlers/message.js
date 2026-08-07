/**
 * ═══════════════════════════════════════════════════════════════
 * MESSAGE HANDLER (REFACTORÉ v2.0)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : ORCHESTRATION UNIQUEMENT
 * 
 * Cette version refactorée délègue toute la logique métier aux services.
 * Le handler coordonne simplement le flux sans exécuter de logique complexe.
 * 
 * Taille : ~150 lignes (vs 742 lignes avant)
 * Services utilisés : 6
 * Testabilité : 80%+
 */

const { ConversationService } = require('../services/conversation.service')
const { CreditsService } = require('../services/credits.service')
const { MediaService } = require('../services/media.service')
const { MessagingService } = require('../services/messaging.service')
const { AIService } = require('../services/ai.service')
const { AnalyticsService } = require('../services/analytics.service')
const { ErrorHandler } = require('../services/errors')
const { analyzeSentiment } = require('../ai/sentiment')
const { handleToolCall } = require('../ai/tools')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { buildInboundTextVariants } = require('./message-text')
const { recoverInterruptedCheckoutFromHistory } = require('./interrupted-checkout-recovery')
const {
    buildPendingPaymentCancellationFailedMessage,
    findPendingOnlineOrder,
    resolvePendingPaymentFollowUp,
} = require('./pending-payment-guard')
const {
    resolveActiveTunnelCancellation,
} = require('./tunnel-cancel-guard')
const {
    shouldBypassTransactionalFlow,
    shouldPersistTransactionalMetadataAfterResponse,
} = require('./transactional-state-guard')
const { normalizeWhatsAppContact } = require('../ai/tools/tool-helpers')
const {
    clearCheckoutState,
    getCheckoutState,
    mergeCheckoutStateIntoToolArgs,
    prepareCheckoutStateForCartEdit,
    setCheckoutState,
    updateCheckoutStateFromUserMessage,
} = require('../services/checkout-state.service')
const {
    CART_STAGE,
    clearCartState,
    getCartState,
    inferCartStateFromAssistantMessage,
    mergeCartStateIntoToolArgs,
    resetCartToRecap,
    setCartState,
    updateCartStateFromUserMessage,
} = require('../services/cart-state.service')
const {
    clearBookingState,
    getBookingState,
    inferBookingStateFromAssistantMessage,
    setBookingState,
    updateBookingStateFromUserMessage,
} = require('../services/booking-state.service')
const {
    clearRestaurantState,
    getRestaurantState,
    hasRestaurantStateData,
    inferRestaurantStateFromAssistantMessage,
    setRestaurantState,
    updateRestaurantStateFromUserMessage,
} = require('../services/restaurant-state.service')
const {
    sortRestaurantProducts,
    hasCartStateData,
    hasCheckoutStateData,
    formatDirectToolResponse,
    buildRecentCustomerProfile,
    resetTransactionalCycleMetadata,
} = require('./message-helpers')

async function cancelPendingOnlineOrder(supabase, orderId) {
    if (!orderId) return false

    const now = new Date().toISOString()
    const { data, error } = await supabase
        .from('orders')
        .update({
            status: 'cancelled',
            cancelled_at: now,
            updated_at: now,
        })
        .eq('id', orderId)
        .eq('status', 'pending')
        .select('id')

    if (error) {
        console.error(`Failed to cancel pending order ${orderId}:`, error)
        return false
    }

    return Array.isArray(data) && data.length > 0
}

async function submitStructuredOrder({
    agentId,
    customerPhone,
    products,
    conversationId,
    supabase,
    activeSessions,
    CinetPay,
    cartState,
    checkoutState,
}) {
    const mergedCheckoutArgs = mergeCheckoutStateIntoToolArgs('create_order', { items: [] }, checkoutState)
    const orderArgs = mergeCartStateIntoToolArgs('create_order', mergedCheckoutArgs, cartState)
    const toolCall = {
        id: `structured-checkout-${Date.now()}`,
        function: {
            name: 'create_order',
            arguments: JSON.stringify(orderArgs),
        }
    }

    const toolResult = await handleToolCall(
        toolCall,
        agentId,
        customerPhone,
        products,
        conversationId,
        supabase,
        activeSessions,
        CinetPay
    )

    try {
        const parsed = JSON.parse(toolResult)
        return {
            success: parsed.success === true,
            content: formatDirectToolResponse(parsed) || toolResult,
        }
    } catch {
        return {
            success: false,
            content: toolResult,
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING - Protection contre les abus
// ═══════════════════════════════════════════════════════════════
const rateLimitMap = new Map()
const RATE_LIMIT = {
    maxMessages: 10,      // Max 10 messages
    windowMs: 60000,      // Par minute
    cleanupInterval: 300000  // Nettoyage toutes les 5 minutes
}

// Nettoyage périodique pour éviter fuite mémoire
setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitMap.entries()) {
        if (now - record.windowStart > RATE_LIMIT.windowMs * 2) {
            rateLimitMap.delete(key)
        }
    }
}, RATE_LIMIT.cleanupInterval)

/**
 * Vérifie si un contact est rate-limited
 * @param {string} contactId - ID du contact WhatsApp
 * @returns {boolean} - true si limité
 */
function isRateLimited(contactId) {
    const now = Date.now()
    const record = rateLimitMap.get(contactId) || { count: 0, windowStart: now }

    if (now - record.windowStart > RATE_LIMIT.windowMs) {
        // Nouvelle fenêtre
        record.count = 1
        record.windowStart = now
    } else {
        record.count++
    }

    rateLimitMap.set(contactId, record)

    // 🔒 SECURITÉ DOS MEMOIRE : Max 5000 entrées - supprimer les plus anciennes
    if (rateLimitMap.size > 5000) {
        const entries = Array.from(rateLimitMap.entries())
        entries.sort((a, b) => a[1].windowStart - b[1].windowStart)
        // Remove oldest 1000 entries
        entries.slice(0, 1000).forEach(([key]) => rateLimitMap.delete(key))
    }

    if (record.count > RATE_LIMIT.maxMessages) {
        console.log(`⚠️ Rate limited: ${contactId} (${record.count} msgs in window)`)
        return true
    }
    return false
}

/**
 * Point d'entrée principal pour traiter un message entrant
 * 
 * @param {Object} context - Contexte global (openai, supabase, etc.)
 * @param {string} agentId - ID de l'agent
 * @param {Object} message - Message WhatsApp
 * @param {boolean} isVoiceMessage - Si message vocal
 */
async function handleMessage(context, agentId, message, isVoiceMessage = false) {
    const { openai, supabase, activeSessions, CinetPay } = context

    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // RATE LIMITING - Protection contre les abus
    // ═══════════════════════════════════════════════════════════

    // 🔒 FIX CRASH : Validation input
    if (!message || !message.from) {
        console.error('❌ Malformed message received (no sender)', message)
        return
    }

    if (isRateLimited(message.from)) {
        // Informer le client du rate limit
        const session = activeSessions.get(agentId)
        if (session) {
            await MessagingService.sendText(
                session,
                message.from,
                "⏳ Vous envoyez trop de messages. Merci de patienter quelques instants avant de réessayer."
            ).catch(() => { }) // Ignorer les erreurs d'envoi
        }
        return
    }

    try {

        // ═══════════════════════════════════════════════════════════
        // PHASE 1 : VÉRIFICATIONS INITIALES
        // ═══════════════════════════════════════════════════════════

        // 1.1 Récupérer l'agent
        const { data: agent } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single()

        if (!agent) {
            console.error(`🔍 [handleMessage] BLOCKED: agent not found agentId=${agentId}`)
            return
        }

        if (!agent.is_active) {
            console.log(`🔍 [handleMessage] BLOCKED: agent inactive agentId=${agentId}`)
            return
        }

        if (!agent.whatsapp_connected) {
            console.log(`🔍 [handleMessage] BLOCKED: whatsapp disconnected agentId=${agentId}`)
            return
        }

        // external_sync : canal notification uniquement — répondre avec le message de redirection et stopper
        if (agent.ecommerce_mode === 'external_sync') {
            const replyMsg = agent.external_sync_reply_message
                ? agent.external_sync_reply_message.replace(/\{\{escalation_phone\}\}/g, agent.escalation_phone || '')
                : null
            if (replyMsg && replyMsg.trim()) {
                const extSession = activeSessions.get(agentId)
                if (extSession) {
                    await MessagingService.sendText(extSession, message.from, replyMsg.trim()).catch(() => { })
                }
            }
            console.log(`🔍 [handleMessage] BLOCKED (external_sync): reply sent agentId=${agentId}`)
            return
        }

        console.log(`🔍 [handleMessage] agent OK: ${agent.name} user_id=${agent.user_id}`)

        // 1.2 Vérifier les crédits
        const hasCredits = await CreditsService.check(supabase, agent.user_id)
        if (!hasCredits) {
            console.log(`🔍 [handleMessage] BLOCKED: no credits user_id=${agent.user_id}`)
            console.log(`⚠️ Insufficient credits for user ${agent.user_id}`)
            // Informer le client que le service est indisponible
            const session = activeSessions.get(agentId)
            if (session) {
                await MessagingService.sendText(
                    session,
                    message.from,
                    "🔧 Notre service est temporairement indisponible. Veuillez réessayer plus tard."
                ).catch(() => { })
            }
            return
        }

        // 1.2b Récupérer la devise du compte (pour l'affichage des prix dans l'IA)
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('currency')
            .eq('id', agent.user_id)
            .single()
        const agentCurrency = userProfile?.currency || 'XOF'

        // 1.2c Charger les feature flags globaux (une seule requête par message)
        const { data: flagsData } = await supabase
            .from('feature_flags')
            .select('key, enabled')
        const featureFlags = {}
        for (const f of flagsData || []) featureFlags[f.key] = f.enabled
        const getFlag = (key) => featureFlags[key] !== false

        // 1.3 Récupérer ou créer la conversation
        const conversation = await ConversationService.getOrCreate(
            supabase,
            agentId,
            agent.user_id,
            message.from,
            { wa_name: message.pushName }
        )

        if (conversation.status === 'closed') {
            const reopenedConversation = await ConversationService.reopenClosedCycle(supabase, conversation.id)
            if (reopenedConversation) {
                Object.assign(conversation, reopenedConversation)
                console.log(`🔄 [${agentId}] Conversation ${conversation.id} reopened for a new cycle`)
            }
        }

        // 1.4 Vérifier si conversation active
        if (!conversation.isActive()) {
            console.log(`🔍 [handleMessage] BLOCKED: conversation not active id=${conversation.id} status=${conversation.status} bot_paused=${conversation.bot_paused}`)
            return
        }

        console.log(`🔍 [handleMessage] conversation OK id=${conversation.id}`)

        // 1.5 Read receipt — uniquement si l'agent est actif et la conversation active
        // (évite les doubles ticks bleus sur agents en pause ou conversations bot_paused)
        const activeSession = activeSessions.get(agentId)
        if (activeSession?.socket && message.key) {
            setTimeout(async () => {
                try { await activeSession.socket.readMessages([message.key]) } catch { /* silencieux */ }
            }, 1500)
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 2 : TRAITEMENT DU MESSAGE ENTRANT
        // ═══════════════════════════════════════════════════════════

        // Helper : téléchargement média avec timeout (évite blocage réseau)
        const MEDIA_TIMEOUT_MS = 15000
        const withMediaTimeout = (promise) => Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Media download timeout (15s)')), MEDIA_TIMEOUT_MS)
            )
        ])

        // 2.2 Traiter message vocal (transcription)
        if (isVoiceMessage && message.audioMessage) {
            console.log('🎤 Transcribing voice message...')
            try {
                const buffer = await withMediaTimeout(downloadMediaMessage(
                    {
                        key: message.key,
                        message: { audioMessage: message.audioMessage }
                    },
                    'buffer',
                    { logger: console }
                ))
                const transcription = await MediaService.transcribeAudio(openai, buffer)
                message.text = transcription
                console.log(`📝 Transcription: ${transcription}`)
            } catch (mediaErr) {
                console.error('❌ Audio download/transcription failed:', mediaErr.message)
                message.text = '[Message vocal non disponible]'
            }
        }

        // 2.3 Traiter image
        if (message.imageMessage && getFlag('vision_enabled')) {
            console.log('📸 Processing image...')
            try {
                const imageBase64 = await withMediaTimeout(
                    MediaService.processImage(message, downloadMediaMessage)
                )
                message.imageBase64 = imageBase64
                message.text = message.text || message.caption || "Que penses-tu de cette image ?"
            } catch (mediaErr) {
                console.error('❌ Image download failed:', mediaErr.message)
                message.text = message.text || '[Image non disponible]'
            }
        }

        const { structuredText: structuredMessageText, aiText: aiMessageText } = buildInboundTextVariants(
            message.text,
            message.quotedText
        )
        message.text = aiMessageText

        // Injecter le contexte métier externe (panier abandonné, commande, etc.)
        // Stocké dans conversation.metadata.external_context par /trigger ou /send
        // Guard strict : si absent ou en erreur → aucun impact sur le flux existant
        try {
            const ec = conversation.metadata?.external_context
            if (ec) {
                const lines = []
                if (ec.event) lines.push(`[Événement: ${String(ec.event).replace(/_/g, ' ')}]`)
                if (ec.cart?.items?.length > 0) {
                    const items = ec.cart.items.map(i => `${i.name}${i.variant ? ' ' + i.variant : ''} ×${i.qty || 1}`).join(', ')
                    lines.push(`[Panier: ${items} — Total: ${(ec.cart.total || 0).toLocaleString('fr-FR')} FCFA]`)
                }
                if (ec.order?.reference || ec.order?.id) lines.push(`[Commande: #${ec.order.reference || ec.order.id}]`)
                if (ec.customer?.name) lines.push(`[Client: ${ec.customer.name}]`)
                if (ec.data && typeof ec.data === 'object') {
                    const extra = Object.entries(ec.data).map(([k, v]) => `${k}: ${v}`).join(', ')
                    if (extra) lines.push(`[Données: ${extra}]`)
                }
                if (lines.length > 0) {
                    message.text = lines.join('\n') + '\n' + message.text
                }
            }
        } catch (_) {
            // Silencieux — l'agent continue normalement sans ce contexte
        }

        const incomingMessageId = message.key?.id || null

        if (incomingMessageId) {
            const { data: existingMessage } = await supabase
                .from('messages')
                .select('id')
                .eq('agent_id', agentId)
                .eq('whatsapp_message_id', incomingMessageId)
                .maybeSingle()

            if (existingMessage?.id) {
                console.log(`⏭️ Duplicate inbound message skipped: ${incomingMessageId}`)
                return
            }
        }

        // 2.1 Sauvegarder le vrai contenu utilisateur après transcription/traitement image
        await supabase.from('messages').insert({
            conversation_id: conversation.id,
            agent_id: agentId,
            role: 'user',
            content: message.text || (isVoiceMessage ? '[Message vocal non disponible]' : '[Message sans texte]'),
            whatsapp_message_id: incomingMessageId,
            status: 'received',
            metadata: {
                is_voice: isVoiceMessage,
                has_media: !!message.imageMessage,
                was_transcribed: isVoiceMessage && !!message.audioMessage,
                has_image_context: !!message.imageBase64
            }
        })

        // ═══════════════════════════════════════════════════════════
        // PHASE 3 : CHARGEMENT DU CONTEXTE
        // ═══════════════════════════════════════════════════════════

        // 3.1 Historique de conversation
        const conversationHistory = await conversation.getHistory(50, {
            since: conversation.metadata?.session_anchor_at || null,
        })
        const historyForAI =
            conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1]?.role === 'user'
                ? conversationHistory.slice(0, -1)
                : conversationHistory

        const normalizedContactPhone = normalizeWhatsAppContact(message.from)
        const previousAssistantMessage = [...historyForAI]
            .reverse()
            .find(entry => entry.role === 'assistant')?.content || ''

        let recentOrdersForContext = []
        if (conversation?.id) {
            const { data: recentOrders } = await supabase
                .from('orders')
                .select(`
                    id, status, total_fcfa, created_at, conversation_id,
                    customer_name, customer_phone, delivery_address,
                    customer_email,
                    payment_method, provider_payment_url,
                    items:order_items(product_name, quantity)
                `)
                .eq('user_id', agent.user_id)
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: false })
                .limit(20)

            recentOrdersForContext = recentOrders || []
        }

        // 3.2 Produits de l'agent (Isolation stricte par agent_id)
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('agent_id', agentId)
            .eq('is_available', true)
            .order('menu_sort_order', { ascending: true, nullsFirst: false })
            .order('name', { ascending: true })

        const sortedProducts = [...(products || [])]
        const orderableProducts = sortedProducts.filter(product => product.product_type !== 'service')
        const serviceProducts = sortedProducts.filter(product => product.product_type === 'service')
        const restaurantProducts = sortRestaurantProducts(
            serviceProducts.filter(product => product.service_subtype === 'restaurant')
        )
        const standardServiceProducts = serviceProducts.filter(product => product.service_subtype !== 'restaurant')
        const hasRestaurantCatalog = restaurantProducts.length > 0

        // hasKnowledgeBase : COUNT serveur (pas déduit de relevantDocs qui peut retourner 0 sur "Bonjour")
        const { count: kbCount } = await supabase
            .from('knowledge_base')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agentId)
        const hasKnowledgeBase = (kbCount || 0) > 0

        // Mode Support Client : pas de produits + KB → bypass total des flux transactionnels
        // external_sync : produits dans agent_external_data (pas dans products) → jamais support client
        const isSupportClientMode = (products || []).length === 0 && hasKnowledgeBase && agent.ecommerce_mode !== 'external_sync'

        // Mode Lead Only : agent avec catalogue (produits, images, variantes) mais SANS moteur
        // panier/checkout déterministe — la conversation reste libre côté IA, qui capture un
        // lead (capture_lead) au lieu de construire une commande structurée (create_order).
        // Ne remplace isSupportClientMode nulle part ailleurs : uniquement pour sauter les
        // mises à jour des moteurs panier/restaurant/booking ci-dessous.
        const isLeadOnlyMode = agent.conversation_mode === 'lead_only'
        const skipStructuredFlows = isSupportClientMode || isLeadOnlyMode

        // Mémorise le lien de localisation brut (position GPS native ou lien collé, déjà
        // résolu par session.js sous la forme "Ma position : <lieu> (<lien>)") pour que
        // capture_lead puisse le joindre au lead — sans dépendre de l'IA pour le reporter.
        if (isLeadOnlyMode && message.text) {
            const locationLinkMatch = message.text.match(/^Ma position\s*:.*\((https?:\/\/[^\s)]+)\)/)
            if (locationLinkMatch) {
                await conversation.updateMetadata({ last_location_link: locationLinkMatch[1] })
            }
        }

        const previousCartState = getCartState(conversation.metadata)
        const previousCheckoutState = getCheckoutState(conversation.metadata)
        const previousBookingState = getBookingState(conversation.metadata)
        const previousRestaurantState = hasRestaurantCatalog
            ? getRestaurantState(conversation.metadata)
            : getRestaurantState(clearRestaurantState(conversation.metadata))

        const noopCartUpdate = { state: previousCartState, capturedFields: [], stateChanged: false, shouldBypassAI: false, directReply: null, questionDetected: false }
        const noopCheckoutUpdate = { state: previousCheckoutState, stateChanged: false, shouldBypassAI: false, directReply: null, shouldSubmitOrder: false, questionDetected: false }
        const noopBookingUpdate = { state: previousBookingState, stateChanged: false, shouldBypassAI: false, directReply: null }
        const noopRestaurantUpdate = { state: previousRestaurantState, stateChanged: false, shouldBypassAI: false, directReply: null }

        const pendingOnlineOrder = findPendingOnlineOrder(recentOrdersForContext, {
            conversationId: conversation.id,
        })
        const recentCustomerProfile = buildRecentCustomerProfile(recentOrdersForContext)

        let pendingPaymentResolution = resolvePendingPaymentFollowUp({
            text: structuredMessageText,
            lastAssistantMessage: previousAssistantMessage,
            pendingOrder: pendingOnlineOrder,
            productNames: orderableProducts.map(product => product.name),
            escalationPhone: agent.escalation_phone,
        })

        if (pendingPaymentResolution?.type === 'cancel_pending_order') {
            const cancelled = await cancelPendingOnlineOrder(supabase, pendingOnlineOrder?.id)
            pendingPaymentResolution = {
                ...pendingPaymentResolution,
                type: cancelled ? 'cancelled' : 'cancel_failed',
                content: cancelled
                    ? pendingPaymentResolution.content
                    : buildPendingPaymentCancellationFailedMessage(pendingOnlineOrder),
            }
        }

        const activeTunnelCancellation = pendingPaymentResolution
            ? null
            : resolveActiveTunnelCancellation({
                text: structuredMessageText,
                hasCartState: hasCartStateData(previousCartState),
                hasCheckoutState: hasCheckoutStateData(previousCheckoutState),
            })
        const transactionalGuardOwnsReply = shouldBypassTransactionalFlow({
            pendingPaymentResolution,
            activeTunnelCancellation,
        })

        let restaurantUpdate = noopRestaurantUpdate
        let restaurantFlowActive = false
        let bookingUpdate = noopBookingUpdate
        let bookingFlowActive = false
        let cartUpdate = noopCartUpdate
        let checkoutUpdate = noopCheckoutUpdate

        if (!transactionalGuardOwnsReply) {
            restaurantUpdate = (skipStructuredFlows || !hasRestaurantCatalog)
                ? noopRestaurantUpdate
                : updateRestaurantStateFromUserMessage(previousRestaurantState, structuredMessageText, restaurantProducts)
            restaurantFlowActive = !skipStructuredFlows && hasRestaurantCatalog && hasRestaurantStateData(restaurantUpdate.state)

            bookingUpdate = (skipStructuredFlows || restaurantFlowActive)
                ? noopBookingUpdate
                : updateBookingStateFromUserMessage(previousBookingState, structuredMessageText, standardServiceProducts)
            bookingFlowActive = !skipStructuredFlows && !!(previousBookingState.current_booking || bookingUpdate.state.current_booking)

            cartUpdate = (skipStructuredFlows || restaurantFlowActive || bookingFlowActive)
                ? noopCartUpdate
                : updateCartStateFromUserMessage(previousCartState, structuredMessageText, orderableProducts, agentCurrency, {
                    allowKnowledgeInterrupt: hasKnowledgeBase,
                })

            const cartJustEnteredCheckout =
                !skipStructuredFlows &&
                !restaurantFlowActive &&
                !bookingFlowActive &&
                previousCartState.stage !== CART_STAGE.CHECKOUT &&
                cartUpdate.state.stage === CART_STAGE.CHECKOUT

            checkoutUpdate = (skipStructuredFlows || restaurantFlowActive || bookingFlowActive)
                ? noopCheckoutUpdate
                : updateCheckoutStateFromUserMessage(previousCheckoutState, structuredMessageText, {
                    cartState: cartUpdate.state,
                    products: orderableProducts,
                    activateCheckout: cartJustEnteredCheckout,
                    allowKnowledgeInterrupt: hasKnowledgeBase,
                    recentCustomerProfile,
                })
        }

        if (
            !transactionalGuardOwnsReply &&
            !skipStructuredFlows &&
            !restaurantFlowActive &&
            !bookingFlowActive &&
            !hasCartStateData(previousCartState) &&
            !hasCheckoutStateData(previousCheckoutState) &&
            !cartUpdate.shouldBypassAI &&
            !checkoutUpdate.shouldBypassAI &&
            !checkoutUpdate.stateChanged &&
            structuredMessageText
        ) {
            const fullConversationHistory = await conversation.getHistory(12)
            const recoveredFlow = recoverInterruptedCheckoutFromHistory(
                fullConversationHistory,
                structuredMessageText,
                orderableProducts,
                agentCurrency
            )

            if (recoveredFlow) {
                console.log(`♻️ [${agentId}] Recovered interrupted checkout flow from recent history`)
                cartUpdate = {
                    ...noopCartUpdate,
                    state: recoveredFlow.cartState,
                    stateChanged: true,
                }
                checkoutUpdate = recoveredFlow.checkoutUpdate
            }
        }

        const checkoutState = checkoutUpdate.state

        if (
            !transactionalGuardOwnsReply &&
            !skipStructuredFlows && (
                JSON.stringify(previousCartState) !== JSON.stringify(cartUpdate.state) ||
                JSON.stringify(previousCheckoutState) !== JSON.stringify(checkoutState) ||
                JSON.stringify(previousBookingState) !== JSON.stringify(bookingUpdate.state) ||
                JSON.stringify(previousRestaurantState) !== JSON.stringify(restaurantUpdate.state) ||
                conversation.metadata?.cart ||
                conversation.metadata?.checkout ||
                conversation.metadata?.booking ||
                conversation.metadata?.restaurant
            )
        ) {
            const mergedMetadata = setRestaurantState(
                setBookingState(
                    setCheckoutState(
                        setCartState(conversation.metadata, cartUpdate.state),
                        checkoutState
                    ),
                    bookingUpdate.state
                ),
                restaurantUpdate.state
            )
            const metadataToPersist = hasRestaurantCatalog
                ? mergedMetadata
                : clearRestaurantState(mergedMetadata)
            await conversation.updateMetadata(metadataToPersist)
        }

        // 3.3 Commandes récentes du client
        let orders = []
        if (normalizedContactPhone) {
            const { data: recentOrders } = await supabase
                .from('orders')
                .select(`
                    id, status, total_fcfa, created_at,
                    customer_name, customer_phone, delivery_address,
                    items:order_items(product_name, quantity)
                `)
                .eq('user_id', agent.user_id)
                .eq('customer_phone', normalizedContactPhone)
                .order('created_at', { ascending: false })
                .limit(20) // Augmenté pour couvrir l'historique de 15 jours

            orders = recentOrders || []
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 4 : ANALYSE SENTIMENT & ESCALADE
        // ═══════════════════════════════════════════════════════════

        // Demande explicite de transfert humain (priorité sur sentiment)
        const humanKeywords = [
            'parler à un humain', 'parler a un humain',
            'parler à une personne', 'parler a une personne',
            'agent humain', 'conseiller humain',
            'je veux un humain', 'je veux parler à quelqu\'un', 'je veux parler a quelqu\'un',
            'transfert humain', 'mettre en relation',
            'parler à un agent', 'parler a un agent',
        ]
        const lowerText = (structuredMessageText || '').normalize('NFC').toLowerCase()
        const isExplicitHumanRequest = humanKeywords.some(kw => lowerText.includes(kw.normalize('NFC')))

        if (isExplicitHumanRequest) {
            console.log(`🤝 [${agentId}] Demande explicite de transfert humain`)
            await conversation.escalate('Demande explicite de transfert humain')

            let handoverMessage = "Bien sûr ! 🙏\n\n"
            handoverMessage += "Je transfère votre conversation à un conseiller qui vous contactera très bientôt."
            if (agent.escalation_phone) {
                handoverMessage += `\n\n📞 Vous pouvez aussi appeler directement : ${agent.escalation_phone}`
            }

            await MessagingService.sendText(activeSessions.get(agentId), message.from, handoverMessage)
            return
        }

        const sentimentAnalysis = await analyzeSentiment(openai, structuredMessageText)
        console.log(`❤️ Sentiment: ${sentimentAnalysis.sentiment}`)

        if (conversation.shouldEscalate(sentimentAnalysis)) {
            console.log('🚨 Escalating angry customer...')

            await conversation.escalate('Client en colère détecté')

            // Message de transfert
            let handoverMessage = "Je comprends votre frustration et je m'en excuse sincèrement. 🙏\n\n"
            handoverMessage += "Je transfère immédiatement votre dossier à un conseiller humain qui va vous contacter très rapidement."

            if (agent.escalation_phone) {
                handoverMessage += `\n\n📞 Vous pouvez aussi appeler directement : ${agent.escalation_phone}`
            }

            await MessagingService.sendText(
                activeSessions.get(agentId),
                message.from,
                handoverMessage
            )

            return // Stop AI
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 4.5 : PRÉ-EXTRACTION DES DEMANDES D'IMAGE (KB)
        // Garantit l'envoi d'images même quand l'IA ignore les outils
        // ═══════════════════════════════════════════════════════════
        let preImageActions = []
        if (hasKnowledgeBase && structuredMessageText) {
            const imgRegex = /\b(?:image|photo|montrez?(?:\s+moi)?|voir)\s+(?:(?:du|de\s+la|des|le|la|l[''])\s+)?([^?!,\n]{3,50}?)(?=\s*(?:[?!,\n]|$))/gi
            const imgMatches = []
            let imgM
            while ((imgM = imgRegex.exec(structuredMessageText)) !== null) {
                imgMatches.push({ full: imgM[0], name: imgM[1].trim() })
            }
            if (imgMatches.length > 0) {
                const { data: kbDocs } = await supabase
                    .from('knowledge_base')
                    .select('id, title, content, image_url')
                    .eq('agent_id', agentId)
                    .not('image_url', 'is', null)
                for (const { full, name } of imgMatches) {
                    const searchName = name.toLowerCase()
                    const kbDoc = (kbDocs || []).find(d =>
                        d.content?.toLowerCase().includes(searchName) ||
                        d.title?.toLowerCase().includes(searchName)
                    )
                    if (kbDoc) {
                        // Ne pré-extraire que si le message contient d'autres questions
                        // (sinon l'IA reçoit un texte vide → laisser l'IA gérer via tool call)
                        const remainingText = structuredMessageText.replace(full, '').replace(/[?!\s]+$/, '').trim()
                        if (remainingText.length >= 5) {
                            preImageActions.push({ image_url: kbDoc.image_url, caption: `Voici ${name} !`, product_name: name })
                            message.text = remainingText
                            console.log(`🖼️ Pre-extracted image: "${name}"`)
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 5 : GÉNÉRATION RÉPONSE IA
        // ═══════════════════════════════════════════════════════════

        console.log('🧠 Generating AI response...')

        let aiResponse
        let nextCartState = cartUpdate.state
        let nextCheckoutState = checkoutState
        let nextBookingState = bookingUpdate.state
        let nextRestaurantState = restaurantUpdate.state
        let clearCartAfterResponse = false
        let clearCheckoutAfterResponse = false
        let resetTransactionalCycleAfterResponse = false
        const structuredReply = restaurantUpdate.shouldBypassAI && restaurantFlowActive
            ? restaurantUpdate.directReply
            : bookingUpdate.shouldBypassAI && bookingFlowActive
                ? bookingUpdate.directReply
                : (cartUpdate.directReply || checkoutUpdate.directReply)

        if (pendingPaymentResolution) {
            console.log(`⏳ [${agentId}] Pending payment reminder sent instead of reopening a new cart flow`)
            aiResponse = {
                content: pendingPaymentResolution.content,
                tokensUsed: 0,
                imageActions: []
            }
            if (pendingPaymentResolution.type === 'cancelled') {
                clearCartAfterResponse = true
                clearCheckoutAfterResponse = true
                nextBookingState = {}
                nextRestaurantState = {}
                resetTransactionalCycleAfterResponse = true
            }
        } else if (activeTunnelCancellation) {
            console.log(`🛑 [${agentId}] Active cart/checkout tunnel cancelled by customer request`)
            aiResponse = {
                content: activeTunnelCancellation.content,
                tokensUsed: 0,
                imageActions: []
            }
            clearCartAfterResponse = true
            clearCheckoutAfterResponse = true
            nextBookingState = {}
            nextRestaurantState = {}
            resetTransactionalCycleAfterResponse = true
        } else if (structuredReply) {
            console.log('Structured flow reply generated')
            aiResponse = {
                content: structuredReply,
                tokensUsed: 0,
                imageActions: []
            }
            // Si le cart handler a produit le reply (shouldBypassAI), son état est déjà correct — ne pas réinférer
            nextCartState = (cartUpdate.shouldBypassAI && cartUpdate.directReply)
                ? cartUpdate.state
                : inferCartStateFromAssistantMessage(aiResponse.content, cartUpdate.state, orderableProducts, agentCurrency)
            nextBookingState = inferBookingStateFromAssistantMessage(aiResponse.content, bookingUpdate.state, standardServiceProducts)
            nextRestaurantState = hasRestaurantCatalog
                ? inferRestaurantStateFromAssistantMessage(aiResponse.content, restaurantUpdate.state)
                : previousRestaurantState
        } else if (checkoutUpdate.shouldReturnToCart) {
            const cartReset = resetCartToRecap(cartUpdate.state, agentCurrency)
            nextCartState = cartReset.state
            nextCheckoutState = prepareCheckoutStateForCartEdit(
                checkoutState,
                cartReset.state,
                orderableProducts
            )
            aiResponse = {
                content: cartReset.directReply,
                tokensUsed: 0,
                imageActions: []
            }
        } else if (checkoutUpdate.shouldSubmitOrder) {
            console.log('Structured checkout confirmed - creating order directly')

            const directOrderResult = await submitStructuredOrder({
                agentId: agent.id,
                customerPhone: message.from,
                products,
                conversationId: conversation.id,
                supabase,
                activeSessions,
                CinetPay,
                cartState: cartUpdate.state,
                checkoutState,
            })

            aiResponse = {
                content: directOrderResult.content,
                tokensUsed: 0,
                imageActions: []
            }

            if (directOrderResult.success) {
                clearCartAfterResponse = true
                clearCheckoutAfterResponse = true
            }
        } else {
            aiResponse = await AIService.generate({
                agent,
                message,
                context: {
                    history: historyForAI,
                    products: restaurantFlowActive ? restaurantProducts : sortedProducts,
                    orders: orders || [],
                    currency: agentCurrency,
                    conversationId: conversation.id,
                    checkoutState,
                    cartState: cartUpdate.state,
                    cartQuestionDetected: cartUpdate.questionDetected || false,
                    checkoutQuestionDetected: checkoutUpdate.questionDetected || false,
                    bookingState: bookingUpdate.state,
                    restaurantState: restaurantUpdate.state,
                    restaurantQuestionDetected: restaurantUpdate.questionDetected || false,
                    hasKnowledgeBase,
                    featureFlags,
                    supabase,
                    activeSessions,
                    CinetPay
                },
                openai
            })

            nextCartState = inferCartStateFromAssistantMessage(aiResponse.content, cartUpdate.state, orderableProducts, agentCurrency)
            nextBookingState = inferBookingStateFromAssistantMessage(aiResponse.content, bookingUpdate.state, standardServiceProducts)
            nextRestaurantState = hasRestaurantCatalog
                ? inferRestaurantStateFromAssistantMessage(aiResponse.content, restaurantUpdate.state)
                : previousRestaurantState
        }

        // Merger les images pré-extraites avec celles de l'IA (Phase 4.5)
        if (preImageActions.length > 0) {
            aiResponse.imageActions = [...preImageActions, ...(aiResponse.imageActions || [])]
        }

        // Ajouter l'image produit si l'IA mentionne UN SEUL produit avec image (écommerce uniquement).
        // Limité à 1 volontairement : quand le bot liste le catalogue par nom (ex: message
        // d'accueil "Voici notre carte : 1. X 2. Y"), plusieurs noms de produits apparaissent
        // dans le même texte — sans cette limite, ce filet de sécurité renvoyait les images de
        // TOUS les produits mentionnés, y compris lors d'un simple listing non sollicité.
        // Exclut aussi les réponses du flux déterministe (structuredReply, ex: "Pour Gourde
        // pour enfant, quelle quantité ?") : le nom du produit y apparaît systématiquement sans
        // rapport avec une demande de photo, ce qui envoyait une image à chaque question.
        // Exclut aussi le mode lead_only : il n'a PAS de flux déterministe (structuredReply est
        // toujours false ici), donc chaque question naturelle mentionnant un produit ("quelle
        // couleur pour la goube ?", "quelle quantité ?"...) déclenchait ce filet et envoyait une
        // image non sollicitée. Ce mode a déjà des règles explicites et fiables (context-rules.js)
        // qui disent à l'IA d'appeler send_image elle-même quand une photo est vraiment demandée.
        if (!isSupportClientMode && !isLeadOnlyMode && !structuredReply && orderableProducts.length > 0 && aiResponse.content) {
            const responseTextLower = aiResponse.content.toLowerCase()
            // Produits déjà illustrés par un appel explicite à send_image (ex: une image par
            // variante demandée) — ne pas ajouter une 5e image générique par-dessus, ça produit
            // un doublon (3 images de couleur + 1 image "standard" non désirée par le client).
            const alreadyIllustratedNames = new Set(
                (aiResponse.imageActions || [])
                    .map(a => (a.product_name || '').toLowerCase())
                    .filter(Boolean)
            )
            const mentionedProductImages = orderableProducts
                .filter(p => p.image_url && p.name
                    && responseTextLower.includes(p.name.toLowerCase())
                    && !alreadyIllustratedNames.has(p.name.toLowerCase()))
                .map(p => ({
                    image_url: p.image_url,
                    caption: `${p.name}${p.price ? ` — ${Number(p.price).toLocaleString('fr-FR')} FCFA` : ''}`,
                    product_name: p.name
                }))
            if (mentionedProductImages.length === 1) {
                aiResponse.imageActions = [...(aiResponse.imageActions || []), ...mentionedProductImages]
                console.log(`🛍️ Product image auto-attached: ${mentionedProductImages[0].product_name}`)
            }
        }

        const shouldPersistTransactionalMetadata = shouldPersistTransactionalMetadataAfterResponse({
            pendingPaymentResolution,
            activeTunnelCancellation,
        })

        if (!skipStructuredFlows && shouldPersistTransactionalMetadata) {
            let nextMetadata = conversation.metadata
            nextMetadata = clearCartAfterResponse
                ? clearCartState(nextMetadata)
                : setCartState(nextMetadata, nextCartState)
            nextMetadata = clearCheckoutAfterResponse
                ? clearCheckoutState(nextMetadata)
                : setCheckoutState(nextMetadata, nextCheckoutState)
            nextMetadata = resetTransactionalCycleAfterResponse
                ? clearBookingState(nextMetadata)
                : setBookingState(nextMetadata, nextBookingState)
            nextMetadata = hasRestaurantCatalog
                ? (resetTransactionalCycleAfterResponse
                    ? clearRestaurantState(nextMetadata)
                    : setRestaurantState(nextMetadata, nextRestaurantState))
                : clearRestaurantState(nextMetadata)
            if (resetTransactionalCycleAfterResponse) {
                nextMetadata = resetTransactionalCycleMetadata(nextMetadata)
            }
            await conversation.updateMetadata(nextMetadata)
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 6 : ENVOI RÉPONSE
        // ═══════════════════════════════════════════════════════════

        // 6.pre-check — Re-vérifier l'état de la conversation juste avant l'envoi.
        // Un humain peut avoir pris la main pendant les ~1-3s de traitement IA ci-dessus.
        const { data: freshConvState } = await supabase
            .from('conversations')
            .select('bot_paused, status')
            .eq('id', conversation.id)
            .single()
        if (freshConvState?.bot_paused || freshConvState?.status === 'escalated' || freshConvState?.status === 'spam') {
            console.log(`🚫 [${agentId}] Conversation ${conversation.id} devenue inactive pendant le traitement IA (status=${freshConvState?.status}, bot_paused=${freshConvState?.bot_paused}) — envoi annulé`)
            return
        }

        // 6.pre — Déduire 1 crédit de base AVANT tout envoi (poka-yoke)
        // Si la déduction échoue (crédits épuisés, RPC indispo), on n'envoie pas.
        try {
            await CreditsService.deduct(supabase, agent.user_id, 1)
            console.log(`💰 1 crédit déduit (base)`)
        } catch (creditError) {
            console.error('❌ Déduction crédit impossible, envoi annulé:', creditError.message)
            return
        }

        const session = activeSessions.get(agentId)
        let voiceSent = false
        const hasImages = aiResponse.imageActions && aiResponse.imageActions.length > 0

        // 6.0 Texte en premier (salutation visible avant l'image)
        if (!voiceSent) {
            let finalContent = aiResponse.content

            if (hasImages) {
                finalContent = finalContent.replace(/!\[.*?\]\(.*?\)/g, '')
                finalContent = finalContent.replace(/\[.*?\]\(.*?https?:\/\/.*\.(?:jpg|jpeg|png|webp).*\)/gi, '')
                finalContent = finalContent.trim()
            }

            if (finalContent) {
                await MessagingService.sendText(session, message.from, finalContent)
                console.log('💬 Text message sent (cleaned)')
                voiceSent = true // flag pour éviter le double envoi texte plus bas
            }
        }

        // 6.0b Envoyer les images après le texte
        if (hasImages) {
            for (const imgAction of aiResponse.imageActions) {
                try {
                    await MessagingService.sendImage(
                        session,
                        message.from,
                        imgAction.image_url,
                        imgAction.caption
                    )
                    console.log(`📸 Image sent: ${imgAction.product_name}`)
                } catch (imgError) {
                    console.error('Image send failed:', imgError.message)
                }
            }
        }

        // 6.1 Synthèse vocale (si activée)
        // Déduire les 4 crédits voix AVANT d'envoyer. Si insuffisants → fallback texte.
        if (agent.voice_enabled && getFlag('voice_responses') && aiResponse.content.length <= 500) {
            let voiceCreditsOk = false
            try {
                await CreditsService.deduct(supabase, agent.user_id, 4)
                voiceCreditsOk = true
            } catch {
                console.warn('⚠️ Crédits voix insuffisants, fallback texte')
            }

            if (voiceCreditsOk) {
                try {
                    await MessagingService.sendVoice(
                        openai,
                        session,
                        message.from,
                        aiResponse.content
                    )
                    voiceSent = true
                    console.log('🔊 Voice message sent')
                } catch (voiceError) {
                    console.warn('Voice failed, falling back to text:', voiceError.message)
                    // Les 4 crédits voix sont perdus si sendVoice échoue côté réseau — acceptable
                }
            }
        }

        // 6.2 Fallback texte si voix échouée et texte pas encore envoyé
        if (!voiceSent) {
            await MessagingService.sendText(session, message.from, aiResponse.content)
            console.log('💬 Text message sent (fallback)')
        }


        // 6.3 Sauvegarder la réponse
        await supabase.from('messages').insert({
            conversation_id: conversation.id,
            agent_id: agentId,
            role: 'assistant',
            content: aiResponse.content,
            tokens_used: aiResponse.tokensUsed,
            status: 'sent'
        })

        // ═══════════════════════════════════════════════════════════
        // PHASE 7 : MISE À JOUR STATS & CRÉDITS
        // ═══════════════════════════════════════════════════════════

        // 7.1 Crédits déjà déduits en phase 6.pre (base) et 6.1 (voix)

        // 7.2 Stats agent
        await AnalyticsService.trackInteraction(supabase, agentId, 2)

        // 7.3 Analyse qualité lead (tous les 5 messages)
        if ((conversationHistory.length + 1) % 5 === 0) {
            const leadAnalysis = await AnalyticsService.analyzeLeadQuality(
                openai,
                conversationHistory
            )

            if (leadAnalysis) {
                await supabase.from('conversations').update({
                    lead_status: leadAnalysis.status,
                    lead_score: leadAnalysis.score,
                    lead_notes: leadAnalysis.reasoning
                }).eq('id', conversation.id)
            }
        }

        console.log(`✅ Message handled successfully for conversation ${conversation.id}`)

    } catch (error) {
        // ═══════════════════════════════════════════════════════════
        // GESTION D'ERREUR CENTRALISÉE
        // ═══════════════════════════════════════════════════════════

        await ErrorHandler.handle(error, {
            agentId,
            message,
            activeSessions
        })
    }
}

module.exports = { handleMessage }
