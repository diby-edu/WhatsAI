// Configuration from environment (MUST BE FIRST)
require('dotenv').config({ path: '.env.local' })

// ═══════════════════════════════════════════════════════════
// 🚨 GESTIONNAIRES D'ERREURS GLOBAUX (DÉBUG VPS)
// ═══════════════════════════════════════════════════════════
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err.message)
    console.error(err.stack)
    process.exit(1) // Force exit to let PM2 restart with clean state
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason)
})

const { createClient } = require('@supabase/supabase-js')
const { Agent, fetch: undiciFetch } = require('undici')
const WebSocket = require('ws')
const pino = require('pino')
const OpenAI = require('openai')
const CinetPay = require('./src/lib/whatsapp/utils/cinetpay')
const path = require('path')
const http = require('http')
const { initSession } = require('./src/lib/whatsapp/handlers/session')
const { checkPendingPayments, cancelExpiredOrders, cancelExpiredBookingDeposits, requestFeedback } = require('./src/lib/whatsapp/cron/jobs')
const { checkPendingHistoryMessages, checkOutboundMessages } = require('./src/lib/whatsapp/cron/outgoing')
const { setupRealtimeListeners, cleanupRealtimeListeners } = require('./src/lib/whatsapp/realtime/listeners')

// Configuration des logs
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

// Helper pour nettoyer les variables d'environnement (enlève les quotes si présentes)
const cleanEnv = (val) => val ? val.replace(/^["']|["']$/g, '').trim() : val

// Configuration des constantes
const SUPABASE_URL = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
const SUPABASE_SERVICE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
const SUPABASE_ANON_KEY = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)  // Pour Realtime
const OPENAI_API_KEY = cleanEnv(process.env.OPENAI_API_KEY)
const SESSION_BASE_DIR = cleanEnv(process.env.WHATSAPP_SESSION_PATH) || './.whatsapp-sessions'
const CHECK_INTERVAL = 5000 // Check every 5 seconds

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
}

// ═══════════════════════════════════════════════════════════
// 🛠️ CONFIGURATION SUPABASE (Mode Expert Hostinger)
// ═══════════════════════════════════════════════════════════
const dispatcher = new Agent({
    connectTimeout: 30000, // ⭐ AUGMENTÉ : 30s pour éviter les ConnectTimeoutError sur VPS
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
    scheduling: 'fifo',
    headersTimeout: 0,
    bodyTimeout: 0
})

// Driver WebSocket avec compression désactivée (pour éviter les blocages de sync sur Hostinger)
const WSWrapper = class extends WebSocket {
    constructor(address, protocols, options) {
        super(address, protocols, {
            ...(options || {}),
            perMessageDeflate: false
        })
    }
}

// ═══════════════════════════════════════════════════════════
// CLIENT 1: supabaseAdmin - Pour opérations REST/RPC (service_role_key)
// ═══════════════════════════════════════════════════════════
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        fetch: (url, opts = {}) => undiciFetch(url, { ...opts, dispatcher })
    }
    // PAS de config realtime ici
})

// ═══════════════════════════════════════════════════════════
// CLIENT 2: supabaseRealtime - Pour subscriptions (anon_key)
// ⚠️ service_role_key est REJETÉE par Realtime postgres_changes
// ═══════════════════════════════════════════════════════════
const supabaseRealtime = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    realtime: {
        transport: WebSocket,
        params: {
            eventsPerSecond: 10
        }
    }
})

// Alias pour compatibilité (code existant utilise 'supabase')
const supabase = supabaseAdmin

console.log(`🔑 Supabase Dual-Client Config:`)
console.log(`   URL: ${SUPABASE_URL}`)
console.log(`   Admin (REST): service_role_key (...${SUPABASE_SERVICE_KEY.slice(-8)})`)
console.log(`   Realtime: anon_key (...${SUPABASE_ANON_KEY.slice(-8)})`)

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

// Store active sessions
const activeSessions = new Map()
const pendingConnections = new Set()
const scheduledConnections = new Set()
// Cooldown map: évite que checkAgents re-déclenche un agent récemment initialisé
// pendant le gap entre disconnect et reconnect (race condition → boucle infinie QR)
const recentlyProcessed = new Map() // agentId -> lastInitTimestamp
const AGENT_INIT_COOLDOWN = 3 * 60 * 1000 // 3 minutes entre deux initSession pour le même agent
const INIT_STAGGER_MS = 3000
const SETUP_PHASE_STALE_MS = 60 * 1000
let nextInitSlotAt = 0
const setupPhaseObservedAt = new Map() // agentId -> firstSeenInSetupPhase

// Référence au channel Realtime pour cleanup au shutdown
let _realtimeChannel = null

function scheduleSessionInit(context, agent, reconnectAttempt = 0) {
    if (activeSessions.has(agent.id) || pendingConnections.has(agent.id) || scheduledConnections.has(agent.id)) return

    recentlyProcessed.set(agent.id, Date.now())
    const startAt = Math.max(Date.now(), nextInitSlotAt)
    const delay = Math.max(0, startAt - Date.now())
    nextInitSlotAt = startAt + INIT_STAGGER_MS
    scheduledConnections.add(agent.id)

    const run = async () => {
        scheduledConnections.delete(agent.id)
        if (activeSessions.has(agent.id) || pendingConnections.has(agent.id)) return

        const delaySuffix = delay > 0 ? ` in ${Math.round(delay / 1000)}s` : ''
        console.log(`⚡ triggering initSession for ${agent.name}${delaySuffix}`)
        await initSession(context, agent.id, agent.name, reconnectAttempt)
    }

    if (delay === 0) {
        void run()
    } else {
        setTimeout(() => {
            void run()
        }, delay)
    }
}

// Check for new agents that need connection
async function checkAgents() {
    try {
        console.log('🔄 Checking for agents...')

        // 1. Check for agents requesting connection or awaiting QR scan
        const { data: connectingAgents } = await supabase
            .from('agents')
            .select('id, name, whatsapp_status')
            .eq('is_active', true)
            .in('whatsapp_status', ['connecting', 'qr_ready'])

        if (connectingAgents && connectingAgents.length > 0) {
            const names = connectingAgents.map(a => `${a.name}(${a.whatsapp_status})`).join(', ')
            console.log(`🚀 Found ${connectingAgents.length} agents in setup phase: ${names}`)
        }

        const connectingAgentIds = new Set((connectingAgents || []).map(agent => agent.id))
        for (const trackedAgentId of Array.from(setupPhaseObservedAt.keys())) {
            if (!connectingAgentIds.has(trackedAgentId)) {
                setupPhaseObservedAt.delete(trackedAgentId)
            }
        }

        const context = { supabase, supabaseRealtime, activeSessions, pendingConnections, openai, CinetPay, scheduleSessionInit }

        for (const agent of connectingAgents || []) {
            const now = Date.now()
            if (!setupPhaseObservedAt.has(agent.id)) {
                setupPhaseObservedAt.set(agent.id, now)
            }

            const setupSince = setupPhaseObservedAt.get(agent.id) || now
            const setupAgeMs = now - setupSince
            const hasActiveSession = activeSessions.has(agent.id)
            const hasPendingConnection = pendingConnections.has(agent.id)
            const hasScheduledConnection = scheduledConnections.has(agent.id)
            const session = activeSessions.get(agent.id)

            // The database explicitly asks for a reconnect. If memory still holds a "connected"
            // socket, recycle it now instead of silently preferring the stale in-memory state.
            if (agent.whatsapp_status === 'connecting' && session?.status === 'connected') {
                console.log(`♻️ [CHECK] ${agent.name} is marked connecting in DB but still connected in memory — recycling stale socket`)
                try { session.socket?.end() } catch (_) { }
                activeSessions.delete(agent.id)
                pendingConnections.delete(agent.id)
                scheduledConnections.delete(agent.id)
                recentlyProcessed.delete(agent.id)
            } else if ((hasActiveSession || hasPendingConnection || hasScheduledConnection) && setupAgeMs >= SETUP_PHASE_STALE_MS) {
                console.log(`🧯 [CHECK] ${agent.name} stuck in setup for ${Math.round(setupAgeMs / 1000)}s — clearing locks (active=${hasActiveSession}, pending=${hasPendingConnection}, scheduled=${hasScheduledConnection})`)
                try { session?.socket?.end() } catch (_) { }
                activeSessions.delete(agent.id)
                pendingConnections.delete(agent.id)
                scheduledConnections.delete(agent.id)
                recentlyProcessed.delete(agent.id)
            }

            const hasBlockingState = activeSessions.has(agent.id) || pendingConnections.has(agent.id) || scheduledConnections.has(agent.id)

            // Skip si en cours de connexion
            if (hasBlockingState) {
                console.log(`⏸️ [CHECK] Waiting on in-memory setup state for ${agent.name} (active=${activeSessions.has(agent.id)}, pending=${pendingConnections.has(agent.id)}, scheduled=${scheduledConnections.has(agent.id)})`)
                continue
            }
            // Skip si initSession déclenché récemment (laisse le backoff interne gérer les retries)
            const lastInit = recentlyProcessed.get(agent.id)
            if (lastInit && Date.now() - lastInit < AGENT_INIT_COOLDOWN) {
                console.log(`⏳ [CHECK] Cooldown active for ${agent.name} (${Math.round((AGENT_INIT_COOLDOWN - (Date.now() - lastInit)) / 1000)}s remaining)`)
                continue
            }

            scheduleSessionInit(context, agent)
        }

        // 2. Check for agents that should be connected and have session files
        const { data: connectedAgents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('is_active', true)
            .eq('whatsapp_connected', true)

        for (const agent of connectedAgents || []) {
            // STATELESS UPDATE: Rely on DB status, not local files
            // Only restore if not already active
            if (!activeSessions.has(agent.id) && !pendingConnections.has(agent.id) && !scheduledConnections.has(agent.id)) {
                const lastInit = recentlyProcessed.get(agent.id)
                if (lastInit && Date.now() - lastInit < AGENT_INIT_COOLDOWN) continue
                console.log(`🔄 Restoring session for ${agent.name} (DB Status: Connected)`)
                // Passer reconnectAttempt=99 → restauration silencieuse (pas de notification push)
                // Une notification "connecté" au démarrage du bot serait du spam pour l'utilisateur
                scheduleSessionInit(context, agent, 99)
            }

            setupPhaseObservedAt.delete(agent.id)
        }
    } catch (error) {
        console.error('Error checking agents:', error)
    }
}

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`📴 Received ${signal}. Shutting down WhatsApp Service gracefully...`)

    // Close all sockets
    for (const [agentId, session] of activeSessions) {
        if (session.socket) {
            console.log(`PLEASE WAIT: Closing session for agent ${agentId}...`)
            session.socket.end(undefined) // Close connection
        }
    }

    // Cleanup Realtime subscriptions pour éviter les connexions orphelines sur Supabase
    if (_realtimeChannel && supabaseRealtime) {
        try {
            await cleanupRealtimeListeners(_realtimeChannel, supabaseRealtime)
            console.log('✅ Realtime subscriptions cleaned up.')
        } catch (e) {
            console.error('⚠️ Realtime cleanup error (non-blocking):', e.message)
        }
    }

    // Give 2 seconds for file I/O to finish (saving creds)
    setTimeout(() => {
        console.log('✅ Shutdown complete.')
        process.exit(0)
    }, 2000)
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

// Main loop
async function main() {
    console.log('🚀 WhatsApp Service starting...')
    console.log('📁 Session directory:', path.resolve(SESSION_BASE_DIR))

    // Initial check
    try {
        await checkAgents()
        console.log('✅ Initial agent check complete')
    } catch (err) {
        console.error('❌ Failed during initial agent check:', err.message)
    }

    // Context for cron jobs and Realtime
    // - supabase (alias supabaseAdmin): pour les opérations DB
    // - supabaseRealtime: pour les subscriptions Realtime
    const context = { supabase, supabaseRealtime, activeSessions, pendingConnections, openai, CinetPay, scheduleSessionInit }

    // ═══════════════════════════════════════════════════════════
    // ⚡ REALTIME & ADAPTIVE POLLING
    // ═══════════════════════════════════════════════════════════
    context.realtimeConnected = false
    _realtimeChannel = setupRealtimeListeners(context)

    // ✅ Agent check dédié toutes les 5s
    // Séparé du message polling pour ne pas être ralenti à 5 min quand Realtime est actif
    // Realtime attrape les nouveaux agents immédiatement, ce loop est le filet de sécurité
    setInterval(() => checkAgents().catch(err => console.error('❌ [checkAgents]', err)), 5000)

    // ✅ Polling Adaptatif (Filet de sécurité intelligent) — messages seulement
    async function adaptivePollingLoop() {
        try {
            // Vérifier les messages (IA & Outbound)
            // Si Realtime est OK -> Polling lent (5 min)
            // Si Realtime est KO -> Polling rapide (15 sec)
            await checkPendingHistoryMessages(context)
            await checkOutboundMessages(context)

            const nextCheck = context.realtimeConnected ? 5 * 60 * 1000 : 15 * 1000
            if (!context.realtimeConnected) {
                console.log(`🛡️ [BACKUP] Realtime offline, next check in 15s...`)
            }
            setTimeout(adaptivePollingLoop, nextCheck)
        } catch (err) {
            console.error('❌ [ADAPTIVE] Loop error:', err)
            setTimeout(adaptivePollingLoop, 30000) // Retry in 30s
        }
    }

    // Lancer la boucle adaptative
    adaptivePollingLoop()

    // ✅ Jobs de maintenance (longue durée)
    setInterval(() => checkPendingPayments(supabase), 10 * 60 * 1000)
    setInterval(() => cancelExpiredOrders(supabase), 30 * 60 * 1000)
    setInterval(() => cancelExpiredBookingDeposits(supabase), 60 * 60 * 1000)
    setInterval(() => requestFeedback(supabase), 24 * 60 * 60 * 1000)

    // ═══════════════════════════════════════════════════════════
    // 🏥 HEALTHCHECK SERVER (pour PM2/Docker/Kubernetes)
    // ═══════════════════════════════════════════════════════════
    const HEALTH_PORT = process.env.HEALTH_PORT || 3001

    const healthServer = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'whatsapp-service',
                activeSessions: activeSessions.size,
                pendingConnections: pendingConnections.size,
                uptime: Math.floor(process.uptime()),
                timestamp: new Date().toISOString()
            }))
        } else {
            res.writeHead(404)
            res.end('Not Found')
        }
    })

    healthServer.listen(HEALTH_PORT, () => {
        console.log(`🏥 Healthcheck server running on port ${HEALTH_PORT}`)
    })

    console.log('✅ WhatsApp Service running with Realtime')
    console.log('   ⚡ Realtime: Instant message delivery (~100ms)')
    console.log('   🛡️ Backup: Polling every 5 minutes')
    console.log(`   🏥 Healthcheck: http://localhost:${HEALTH_PORT}/health`)
    console.log('✅ Sessions WhatsApp préservées — restart safe (pas de re-scan QR)')
    console.log('📉 CPU optimisé: ~55% → ~5-10% au repos')
}

main().catch(err => {
    console.error('❌ FATAL ERROR IN MAIN LOOP:', err)
    process.exit(1)
})

