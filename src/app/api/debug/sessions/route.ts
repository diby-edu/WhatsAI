import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, isAdminRole } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(supabase)

        if (authError || !user) {
            return NextResponse.json({
                success: false,
                error: 'Unauthorized',
            }, { status: 401 })
        }

        const adminSupabase = createAdminClient()
        const { data: profile } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!isAdminRole(profile?.role)) {
            return NextResponse.json({
                success: false,
                error: 'Forbidden',
            }, { status: 403 })
        }

        const { data: sessions, error } = await adminSupabase
            .from('whatsapp_sessions')
            .select('agent_id, phone_number, status, last_connected_at, updated_at')
            .order('updated_at', { ascending: false })

        if (error) {
            throw error
        }

        const rows = sessions || []

        return NextResponse.json({
            success: true,
            active_sessions_count: rows.filter((session) => session.status === 'connected').length,
            active_sessions_ids: rows.map((session) => session.agent_id),
            details: rows.map((session) => ({
                id: session.agent_id,
                has_socket: session.status === 'connected',
                phoneNumber: session.phone_number,
                status: session.status,
                lastConnectedAt: session.last_connected_at,
                updatedAt: session.updated_at,
            })),
        })
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
