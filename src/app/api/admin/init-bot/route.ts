import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

/**
 * ⚠️ initializeMessageHandler() RETIRÉ
 *
 * Cette route appelait la stack TypeScript legacy (baileys.ts + message-handler.ts).
 * La stack prod est whatsapp-service.js géré par PM2 — appeler l'ancienne stack
 * créait un double traitement des messages et une double déduction de crédits.
 *
 * Pour redémarrer le bot : `pm2 restart whatsai-bot` sur le VPS.
 */
export async function GET(request: NextRequest) {
    return POST(request)
}

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Accès refusé', 403)
    }

    return successResponse({
        success: false,
        message: 'Cette action est désactivée. Le bot WhatsApp est géré par PM2 (whatsai-bot). Utilisez `pm2 restart whatsai-bot` sur le VPS pour redémarrer.',
    })
}
