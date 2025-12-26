import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugAgents() {
    console.log('🔍 Debugging Agents table...')

    // Get all agents
    const { data: agents, error } = await supabase
        .from('agents')
        .select('id, name, user_id, whatsapp_connected')

    if (error) {
        console.error('❌ Error fetching agents:', error)
        return
    }

    console.log(`Found ${agents.length} agents:`)
    console.table(agents)

    // Get all users to compare IDs
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
        console.error('Error fetching users:', usersError)
    } else {
        console.log('\n👥 Users:')
        users.forEach(u => {
            console.log(`- ${u.email} (ID: ${u.id})`)
        })
    }
}

debugAgents()
