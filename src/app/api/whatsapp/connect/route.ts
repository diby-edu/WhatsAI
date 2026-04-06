import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'
import { hasAgentConnectedBefore } from '@/lib/admin/agent-status'

// POST /api/whatsapp/connect - Request WhatsApp connection
// The standalone whatsapp-service.js will pick this up and generate QR or restore a saved session.
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { agentId } = body

        if (!agentId) {
            return errorResponse('agentId is required', 400)
        }

        // Verify agent belongs to user
        const { data: agent, error } = await supabase
            .from('agents')
            .select('id, name, is_active, whatsapp_connected, whatsapp_status, whatsapp_qr_code, whatsapp_phone, whatsapp_ever_connected')
            .eq('id', agentId)
            .eq('user_id', user!.id)
            .single()

        if (error || !agent) {
            return errorResponse('Agent non trouve', 404)
        }

        if (!agent.is_active) {
            return errorResponse('Activez d abord l agent avant de connecter WhatsApp', 409)
        }

        // Check WhatsApp connection limit based on plan
        if (!agent.whatsapp_connected) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan')
                .eq('id', user!.id)
                .single()

            const { data: planData } = await supabase
                .from('subscription_plans')
                .select('max_whatsapp_numbers')
                .ilike('name', profile?.plan || 'free')
                .single()

            const { PLANS } = await import('@/lib/plans')
            const fallbackLimit = (PLANS as any)[profile?.plan || 'free']?.whatsapp_connections ?? 1
            const limit: number = planData?.max_whatsapp_numbers ?? fallbackLimit

            if (limit !== -1) {
                const { count: activeConnections } = await supabase
                    .from('agents')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user!.id)
                    .in('whatsapp_status', ['connected', 'connecting', 'qr_ready'])

                if ((activeConnections || 0) >= limit) {
                    return errorResponse(`Limite de numeros WhatsApp atteinte pour votre plan (${limit} max)`, 403)
                }
            }
        }

        // If already connected, return status
        if (agent.whatsapp_connected) {
            return successResponse({
                status: 'connected',
                message: 'WhatsApp deja connecte'
            })
        }

        const adminClient = createAdminClient()
        const forceFreshQr = body?.forceFreshQr === true
        const hasConnectedBefore = hasAgentConnectedBefore(agent)
        const shouldForceFreshQr = forceFreshQr || !hasConnectedBefore

        if (shouldForceFreshQr) {
            // Fresh setup or explicit reset: clear stored credentials to force a new QR flow.
            await adminClient
                .from('whatsapp_sessions')
                .delete()
                .eq('session_id', agentId)
        }

        const { error: agentUpdateError } = await adminClient
            .from('agents')
            .update({
                whatsapp_status: 'connecting',
                whatsapp_qr_code: null
            })
            .eq('id', agentId)

        if (agentUpdateError) {
            return errorResponse('Erreur lors de l initiation de la connexion', 500)
        }

        return successResponse({
            status: 'connecting',
            message: shouldForceFreshQr
                ? 'Demande de connexion envoyee. Le QR code sera genere sous peu...'
                : 'Demande de reconnexion envoyee. Restauration de session en cours...'
        })
    } catch (err) {
        console.error('WhatsApp connect error:', err)
        return errorResponse('Erreur de connexion WhatsApp', 500)
    }
}

// GET /api/whatsapp/connect - Get connection status and QR code
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
        return errorResponse('agentId is required', 400)
    }

    // Get agent with WhatsApp status
    const { data: agent, error } = await supabase
        .from('agents')
        .select('id, is_active, whatsapp_connected, whatsapp_phone, whatsapp_status, whatsapp_qr_code')
        .eq('id', agentId)
        .eq('user_id', user!.id)
        .single()

    if (error || !agent) {
        return errorResponse('Agent non trouve', 404)
    }

    const isPaused = agent.is_active === false

    return successResponse({
        status: isPaused ? 'paused' : (agent.whatsapp_connected ? 'connected' : (agent.whatsapp_status || 'disconnected')),
        phoneNumber: agent.whatsapp_phone,
        qrCode: agent.whatsapp_qr_code,
        connected: !isPaused && agent.whatsapp_connected,
        paused: isPaused
    })
}

// DELETE /api/whatsapp/connect - Disconnect WhatsApp
export async function DELETE(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
        return errorResponse('agentId is required', 400)
    }

    // Verify agent belongs to user
    const { data: agent, error } = await supabase
        .from('agents')
        .select('id')
        .eq('id', agentId)
        .eq('user_id', user!.id)
        .single()

    if (error || !agent) {
        return errorResponse('Agent non trouve', 404)
    }

    const adminClient = createAdminClient()

    // Supprimer les credentials pour forcer un nouveau QR à la prochaine connexion
    await adminClient
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', agentId)

    const { error: disconnectError } = await adminClient
        .from('agents')
        .update({
            whatsapp_connected: false,
            whatsapp_phone: null,
            whatsapp_status: 'disconnected',
            whatsapp_qr_code: null
        })
        .eq('id', agentId)

    if (disconnectError) {
        return errorResponse('Erreur lors de la deconnexion', 500)
    }

    return successResponse({
        success: true,
        message: 'Demande de deconnexion envoyee'
    })
}
