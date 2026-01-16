/**
 * WhatsApp Service - Standalone Process
 * This runs independently from the Next.js app
 * It should NEVER be restarted during deployments
 */

const { createClient } = require('@supabase/supabase-js')
const pino = require('pino')
const OpenAI = require('openai')
const CinetPay = require('./src/lib/whatsapp/utils/cinetpay')
const path = require('path')
const http = require('http')
const { initSession } = require('./src/lib/whatsapp/handlers/session')
const { checkPendingPayments, cancelExpiredOrders, requestFeedback } = require('./src/lib/whatsapp/cron/jobs')
const { checkPendingHistoryMessages, checkOutboundMessages } = require('./src/lib/whatsapp/cron/outgoing')


// Configuration from environment
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SESSION_BASE_DIR = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-sessions'
const CHECK_INTERVAL = 5000 // Check every 5 seconds

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

// Store active sessions
const activeSessions = new Map()
const pendingConnections = new Set()

// Check for new agents that need connection
async function checkAgents() {
    try {
        console.log('🔄 Checking for agents...')

        // 1. Check for agents requesting connection (whatsapp_status = 'connecting')
        const { data: connectingAgents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('whatsapp_status', 'connecting')

        if (connectingAgents && connectingAgents.length > 0) {
            console.log(`🚀 Found ${connectingAgents.length} agents wanting to connect!`)
        }

        const context = { supabase, activeSessions, pendingConnections, openai, CinetPay }

        for (const agent of connectingAgents || []) {
            if (!activeSessions.has(agent.id) && !pendingConnections.has(agent.id)) {
                console.log(`⚡ triggering initSession for ${agent.name}`)
                initSession(context, agent.id, agent.name)
            }
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
            if (!activeSessions.has(agent.id) && !pendingConnections.has(agent.id)) {
                console.log(`🔄 Restoring session for ${agent.name} (DB Status: Connected)`)
                initSession(context, agent.id, agent.name)
            }
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
    await checkAgents()

    // Context for cron jobs
    const context = { supabase, activeSessions }

    // ✅ Periodic check for new agents
    setInterval(checkAgents, CHECK_INTERVAL) // 5 seconds

    // ✅ Periodic check for pending messages IN CONVERSATIONS (Hybrid solution)
    setInterval(() => checkPendingHistoryMessages(context), 2000) // 2 seconds - RAPIDE pour confirmations

    // ✅ Periodic check for outbound messages (notifications standalone)
    setInterval(() => checkOutboundMessages(context), 5000) // 5 seconds - Moins urgent

    // ✅ Payment reminders (10 min)
    setInterval(() => checkPendingPayments(supabase), 10 * 60 * 1000)

    // ✅ Cancel expired orders (30 min)
    setInterval(() => cancelExpiredOrders(supabase), 30 * 60 * 1000)

    // ✅ Request feedback (24h)
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

    console.log('✅ WhatsApp Service running')
    console.log('   📊 Checking history messages every 2 seconds')
    console.log('   📨 Checking outbound messages every 5 seconds')
    console.log(`   🏥 Healthcheck: http://localhost:${HEALTH_PORT}/health`)
    console.log('⚠️  DO NOT restart this service during deployments!')
}

main()

