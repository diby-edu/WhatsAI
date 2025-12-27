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

        // If already connected, return status
        if (agent.whatsapp_connected) {
            return successResponse({
                status: 'connected',
                message: 'WhatsApp déjà connecté'
            })
        }

        // Set status to 'connecting' - the standalone service will detect this
        const adminClient = createAdminClient()
        await adminClient
            .from('agents')
            .update({
                whatsapp_status: 'connecting',
                whatsapp_qr_code: null
            })
            .eq('id', agentId)

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
        .select('id, whatsapp_connected, whatsapp_phone_number, whatsapp_status, whatsapp_qr_code')
        .eq('id', agentId)
        .eq('user_id', user!.id)
        .single()

    if (error || !agent) {
        return errorResponse('Agent non trouvé', 404)
    }

    return successResponse({
        status: agent.whatsapp_connected ? 'connected' : (agent.whatsapp_status || 'disconnected'),
        phoneNumber: agent.whatsapp_phone_number,
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
    await adminClient
        .from('agents')
        .update({
            whatsapp_connected: false,
            whatsapp_phone_number: null,
            whatsapp_status: 'disconnected',
            whatsapp_qr_code: null
        })
        .eq('id', agentId)

    return successResponse({
        success: true,
        message: 'Demande de déconnexion envoyée'
    })
}
