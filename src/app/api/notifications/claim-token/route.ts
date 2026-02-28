import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser } from '@/lib/api-utils'

/**
 * POST /api/notifications/claim-token
 * Claim a single token for the authenticated user.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(supabase)

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { token } = await request.json()

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'token required' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()

        const { data: existingToken, error: fetchError } = await adminSupabase
            .from('device_tokens')
            .select('id, user_id')
            .eq('token', token)
            .maybeSingle()

        if (fetchError) {
            console.error('[Claim Token] Fetch error:', fetchError)
            return NextResponse.json({ error: 'Failed to claim token' }, { status: 500 })
        }

        if (!existingToken) {
            return NextResponse.json({ success: true, claimed: 0, reason: 'token_not_found' })
        }

        if (existingToken.user_id === user.id) {
            return NextResponse.json({ success: true, claimed: 0, reason: 'already_owned' })
        }

        if (existingToken.user_id && existingToken.user_id !== user.id) {
            return NextResponse.json({ error: 'Token already assigned to another user' }, { status: 409 })
        }

        const { error: updateError } = await adminSupabase
            .from('device_tokens')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', existingToken.id)
            .is('user_id', null)

        if (updateError) {
            console.error('[Claim Token] Update error:', updateError)
            return NextResponse.json({ error: 'Failed to claim token' }, { status: 500 })
        }

        return NextResponse.json({ success: true, claimed: 1 })
    } catch (error) {
        console.error('[Claim Token] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
