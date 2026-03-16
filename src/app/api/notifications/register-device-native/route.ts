import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
    try {
        const { token, platform } = await request.json()

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Token required' }, { status: 400 })
        }

        const sessionSupabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(sessionSupabase)
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const authenticatedUserId = user.id

        const adminSupabase = createAdminClient()

        const { data: existing, error: fetchError } = await adminSupabase
            .from('device_tokens')
            .select('id, user_id')
            .eq('token', token)
            .maybeSingle()

        if (fetchError) {
            console.error('[Native FCM] Error fetching token:', fetchError)
            return NextResponse.json({ error: 'Failed to register token' }, { status: 500 })
        }

        if (existing) {
            const updateData: Record<string, unknown> = {
                user_id: authenticatedUserId,
                platform: platform || 'android',
                updated_at: new Date().toISOString(),
            }

            const { error: updateError } = await adminSupabase
                .from('device_tokens')
                .update(updateData)
                .eq('id', existing.id)

            if (updateError) {
                console.error('[Native FCM] Error updating token:', updateError)
                return NextResponse.json({ error: 'Failed to update token' }, { status: 500 })
            }

            return NextResponse.json({
                success: true,
                action: existing.user_id && existing.user_id !== authenticatedUserId ? 'reassigned' : 'updated',
                claimed: true,
            })
        }

        const { error: insertError } = await adminSupabase
            .from('device_tokens')
            .insert({
                token,
                platform: platform || 'android',
                user_id: authenticatedUserId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })

        if (insertError) {
            console.error('[Native FCM] Error saving token:', insertError)
            if (insertError.code === '23505') {
                return NextResponse.json({ success: true, action: 'already_exists' })
            }
            return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            action: 'created',
            claimed: true,
        })
    } catch (error) {
        console.error('[Native FCM] Register device error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
