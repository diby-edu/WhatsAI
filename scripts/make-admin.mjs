import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase URL or Service Role Key in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const email = process.argv[2]

if (!email) {
    console.error('❌ Please provide an email address')
    console.log('Usage: node scripts/make-admin.mjs user@example.com')
    process.exit(1)
}

async function makeAdmin() {
    console.log(`🔍 Searching for user: ${email}...`)

    // 1. Get user by email from Auth
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
        console.error('❌ Error fetching users:', userError.message)
        process.exit(1)
    }

    const user = users.find(u => u.email === email)

    if (!user) {
        console.error('❌ User not found! Please sign up first.')
        process.exit(1)
    }

    console.log(`✅ User found: ${user.id}`)

    // 2. Update Auth Metadata (Robust way)
    const { error: metaError } = await supabase.auth.admin.updateUserById(
        user.id,
        { user_metadata: { ...user.user_metadata, role: 'admin' } }
    )

    if (metaError) {
        console.error('❌ Error updating user metadata:', metaError.message)
    }

    // 3. Update profile role (Database way)
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id)

    if (updateError) {
        console.error('❌ Error updating profile:', updateError.message)
        process.exit(1)
    }

    console.log(`🎉 SUCCESS! ${email} is now an ADMIN.`)
    console.log('You can now access /admin')
}

makeAdmin()
