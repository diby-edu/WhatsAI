import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { getInternalBotBaseUrl } from '@/lib/whatsapp/internal-bot'

// Endpoint léger : proxy pur vers localhost:3001/sessions, sans requête DB.
// Utilisé pour le polling fréquent côté dashboard — le mapping agent/bot se fait côté client.
export async function GET(_request: NextRequest) {
    const { response } = await requireAdminAccess()
    if (response) return response

    try {
        const res = await fetch(`${getInternalBotBaseUrl()}/sessions`, {
            signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) return errorResponse('Bot non joignable', 503)
        const data = await res.json().catch(() => null)
        if (!data) return errorResponse('Réponse bot invalide', 502)
        return successResponse(data)
    } catch {
        return errorResponse('Bot non joignable', 503)
    }
}
