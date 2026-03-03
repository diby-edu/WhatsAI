import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

// POST /api/whatsapp/connect - Request WhatsApp connection
// The standalone whatsapp-service.js will pick this up and generate QR
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
            .select('id, name, whatsapp_connected, whatsapp_status, whatsapp_qr_code')
            .eq('id', agentId)
            .eq('user_id', user!.id)
            .single()

        if (error || !agent) {
            return errorResponse('Agent non trouvé', 404)
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
                    .in('whatsapp_status', ['connected', 'connecting'])

                if ((activeConnections || 0) >= limit) {
                    return errorResponse(`Limite de numéros WhatsApp atteinte pour votre plan (${limit} max)`, 403)
                }
            }
        }

        // If already connected, return status
        if (agent.whatsapp_connected) {
            return successResponse({
                status: 'connected',
                message: 'WhatsApp déjà connecté'
            })
        }

        // Clear stale session credentials to force a fresh QR-based authentication.
        // Without this, Baileys loads partial creds from a previous failed scan
        // and tries to restore the session silently — no QR is ever generated.
        const adminClient = createAdminClient()
        await adminClient
            .from('whatsapp_sessions')
            .delete()
            .eq('session_id', agentId)

        const { error: agentUpdateError } = await adminClient
            .from('agents')
            .update({
                whatsapp_status: 'connecting',
                whatsapp_qr_code: null
            })
            .eq('id', agentId)

        if (agentUpdateError) {
            return errorResponse('Erreur lors de l\'initiation de la connexion', 500)
        }

        return successResponse({
            status: 'connecting',
            message: 'Demande de connexion envoyée. Le QR code sera généré sous peu...'
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
        .select('id, whatsapp_connected, whatsapp_phone, whatsapp_status, whatsapp_qr_code')
        .eq('id', agentId)
        .eq('user_id', user!.id)
        .single()

    if (error || !agent) {
        return errorResponse('Agent non trouvé', 404)
    }

    return successResponse({
        status: agent.whatsapp_connected ? 'connected' : (agent.whatsapp_status || 'disconnected'),
        phoneNumber: agent.whatsapp_phone,
        qrCode: agent.whatsapp_qr_code,
        connected: agent.whatsapp_connected
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
        return errorResponse('Agent non trouvé', 404)
    }

    // Set status to 'disconnecting' - the standalone service will handle cleanup
    const adminClient = createAdminClient()
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
        return errorResponse('Erreur lors de la déconnexion', 500)
    }

    return successResponse({
        success: true,
        message: 'Demande de déconnexion envoyée'
    })
}
