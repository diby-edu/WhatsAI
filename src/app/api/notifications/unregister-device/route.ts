import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
    try {
        const sessionSupabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(sessionSupabase)
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { token } = await request.json()

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()
        const { error } = await adminSupabase
            .from('device_tokens')
            .update({
                user_id: null,
                updated_at: new Date().toISOString(),
            })
            .match({ user_id: user.id, token })

        if (error) {
            console.error('Error unlinking device token:', error)
            return NextResponse.json({ error: 'Failed to unlink token' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Unregister device error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
