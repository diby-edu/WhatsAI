import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import {
    initWhatsAppSession,
    getSessionStatus,
    closeWhatsAppSession,
    logoutWhatsApp,
    hasStoredSession
} from '@/lib/whatsapp/baileys'

// POST /api/whatsapp/connect - Initialize WhatsApp connection
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { agentId, useLinkingCode, phoneNumber } = body

        if (!agentId) {
            return errorResponse('agentId is required', 400)
        }

        // Verify agent belongs to user
        const { data: agent, error } = await supabase
            .from('agents')
            .select('id, name')
            .eq('id', agentId)
            .eq('user_id', user!.id)
            .single()

        if (error || !agent) {
            return errorResponse('Agent non trouvé', 404)
        }

        // If using linking code, phone number is required
        if (useLinkingCode && !phoneNumber) {
            return errorResponse('phoneNumber is required for linking code', 400)
        }

        // Initialize WhatsApp session
        const result = await initWhatsAppSession(agentId, {
            useLinkingCode,
            phoneNumber,
        })

        // Update agent status in database
        await supabase
            .from('agents')
            .update({
                whatsapp_connected: result.status === 'connected',
                whatsapp_session_id: agentId,
            })
            .eq('id', agentId)

        return successResponse({
            status: result.status,
            qrCode: result.qrCode,
            linkingCode: result.linkingCode,
            message: result.status === 'qr_ready'
                ? 'Scannez le QR code ou utilisez le code de liaison'
                : result.status === 'connected'
                    ? 'WhatsApp connecté avec succès'
                    : 'Connexion en cours...',
        })
    } catch (err) {
        console.error('WhatsApp connect error:', err)
        return errorResponse('Erreur de connexion WhatsApp', 500)
    }
}

// GET /api/whatsapp/connect - Get connection status
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

    const session = getSessionStatus(agentId)
    const hasStored = hasStoredSession(agentId)

    return successResponse({
        status: session?.status || 'disconnected',
        phoneNumber: session?.phoneNumber,
        qrCode: session?.qrCode,
        linkingCode: session?.linkingCode,
        hasStoredSession: hasStored,
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
    const logout = searchParams.get('logout') === 'true'

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

    if (logout) {
        await logoutWhatsApp(agentId)
    } else {
        await closeWhatsAppSession(agentId)
    }

    // Update agent status
    await supabase
        .from('agents')
        .update({
            whatsapp_connected: false,
            whatsapp_phone: null,
        })
        .eq('id', agentId)

    return successResponse({
        success: true,
        message: logout ? 'Déconnecté et session supprimée' : 'Déconnecté',
    })
}
