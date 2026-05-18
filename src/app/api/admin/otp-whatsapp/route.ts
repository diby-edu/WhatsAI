import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, withAdminAuth, errorResponse, successResponse } from '@/lib/api-utils'

const OTP_AGENT_KEY = 'otp_whatsapp_agent_id'
const OTP_AGENT_NAME = '__otp_sender__'

async function getOrCreateOtpAgent(adminClient: ReturnType<typeof createAdminClient>) {
    // Chercher l'agent OTP existant par nom système
    const { data: existing } = await adminClient
        .from('agents')
        .select('id, whatsapp_connected, whatsapp_status, whatsapp_qr_code, whatsapp_phone')
        .eq('name', OTP_AGENT_NAME)
        .single()

    if (existing) return existing

    // Récupérer le premier admin pour associer l'agent
    const { data: adminProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single()

    if (!adminProfile) throw new Error('Aucun admin trouvé')

    // Créer l'agent OTP système
    const { data: created, error } = await adminClient
        .from('agents')
        .insert({
            user_id: adminProfile.id,
            name: OTP_AGENT_NAME,
            description: 'Agent système dédié à l\'envoi des codes OTP. Ne pas modifier.',
            system_prompt: '',
            personality: 'professional',
            model: 'gpt-4o-mini',
            temperature: 0,
            max_tokens: 100,
            is_active: true,
            whatsapp_connected: false,
            whatsapp_ever_connected: false,
            language: 'fr',
        })
        .select('id, whatsapp_connected, whatsapp_status, whatsapp_qr_code, whatsapp_phone')
        .single()

    if (error || !created) throw new Error('Impossible de créer l\'agent OTP')
    return created
}

// GET — statut de la connexion OTP WhatsApp
export const GET = withAdminAuth(async (_req: NextRequest) => {
    const adminClient = createAdminClient()

    try {
        const { data: agent } = await adminClient
            .from('agents')
            .select('id, whatsapp_connected, whatsapp_status, whatsapp_qr_code, whatsapp_phone')
            .eq('name', OTP_AGENT_NAME)
            .single()

        if (!agent) {
            return successResponse({ configured: false, status: 'not_configured' })
        }

        return successResponse({
            configured: true,
            agentId: agent.id,
            status: agent.whatsapp_status || 'disconnected',
            connected: agent.whatsapp_connected,
            phone: agent.whatsapp_phone,
            qrCode: agent.whatsapp_qr_code,
        })
    } catch {
        return successResponse({ configured: false, status: 'not_configured' })
    }
})

// POST — initialiser / reconnecter
export const POST = withAdminAuth(async (_req: NextRequest) => {
    const adminClient = createAdminClient()

    try {
        const agent = await getOrCreateOtpAgent(adminClient)

        // Supprimer session existante pour forcer un nouveau QR
        await adminClient.from('whatsapp_sessions').delete().eq('session_id', agent.id)

        await adminClient
            .from('agents')
            .update({
                whatsapp_connected: false,
                whatsapp_status: 'connecting',
                whatsapp_qr_code: null,
                whatsapp_disconnected_by: null,
            })
            .eq('id', agent.id)

        return successResponse({ agentId: agent.id, status: 'connecting' })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur initialisation', 500)
    }
})

// DELETE — déconnecter
export const DELETE = withAdminAuth(async (_req: NextRequest) => {
    const adminClient = createAdminClient()

    const { data: agent } = await adminClient
        .from('agents')
        .select('id')
        .eq('name', OTP_AGENT_NAME)
        .single()

    if (!agent) return errorResponse('Agent OTP non configuré', 404)

    await adminClient.from('whatsapp_sessions').delete().eq('session_id', agent.id)
    await adminClient.from('agents').update({
        whatsapp_connected: false,
        whatsapp_phone: null,
        whatsapp_status: 'disconnected',
        whatsapp_qr_code: null,
        whatsapp_disconnected_by: 'user',
    }).eq('id', agent.id)

    return successResponse({ disconnected: true })
})
