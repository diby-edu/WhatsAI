import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function restoreAllSessions() {
    console.log('🔄 Starting WhatsApp session restore...')

    try {
        // Get all agents that were previously connected
        const { data: agents, error } = await supabase
            .from('agents')
            .select('id, name, whatsapp_phone, whatsapp_session_data')
            .eq('whatsapp_connected', true)
            .not('whatsapp_session_data', 'is', null)

        if (error) {
            console.error('❌ Error fetching agents for restore:', error)
            return
        }

        if (!agents || agents.length === 0) {
            console.log('ℹ️ No sessions to restore')
            return
        }

        console.log(`📱 Found ${agents.length} sessions to restore`)

        for (const agent of agents) {
            try {
                console.log(`🔄 Restoring session for agent: ${agent.name}`)

                // Call the init endpoint internally
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
                const response = await fetch(`${baseUrl}/api/whatsapp/init`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: agent.id,
                        autoRestore: true
                    })
                })

                if (response.ok) {
                    console.log(`✅ Session restore initiated for: ${agent.name}`)
                } else {
                    console.log(`⚠️ Could not restore session for: ${agent.name}`)
                }

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
