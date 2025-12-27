import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SESSION_BASE_DIR = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-sessions'

export async function restoreAllSessions() {
    console.log('🔄 Starting WhatsApp session restore...')

    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ Missing Supabase credentials for session restore')
            return
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get all agents that were previously connected
        const { data: agents, error } = await supabase
            .from('agents')
            .select('id, name')
            .eq('is_active', true)
            .eq('whatsapp_connected', true)

        if (error) {
            console.error('❌ Error fetching agents for restore:', error)
            return
        }

        if (!agents || agents.length === 0) {
            console.log('ℹ️ No agents marked as connected in database')
            return
        }

        console.log(`📱 Found ${agents.length} agents marked as connected`)

        // Filter to only agents that have stored session files
        const agentsWithSessions = agents.filter(agent => {
            const sessionDir = path.join(SESSION_BASE_DIR, agent.id)
            const credsFile = path.join(sessionDir, 'creds.json')
            return fs.existsSync(credsFile)
        })

        if (agentsWithSessions.length === 0) {
            console.log('ℹ️ No stored session files found')
            return
        }

        console.log(`📂 Found ${agentsWithSessions.length} agents with stored session files`)

        for (const agent of agentsWithSessions) {
            try {
                console.log(`🔄 Restoring session for agent: ${agent.name}`)

                // Import and call initWhatsAppSession directly
                const { initWhatsAppSession } = await import('./baileys')
                await initWhatsAppSession(agent.id)

                console.log(`✅ Session restore initiated for: ${agent.name}`)

                // Small delay between restores to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 2000))
            } catch (err) {
                console.error(`❌ Error restoring session for ${agent.name}:`, err)
            }
        }

        console.log('✅ Session restore process completed')
    } catch (err) {
        console.error('❌ Session restore failed:', err)
    }
}
