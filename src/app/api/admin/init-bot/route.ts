import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

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
    const { response } = await requireAdminAccess()
    if (response) return response

    return successResponse({
        success: false,
        message: 'Cette action est désactivée. Le bot WhatsApp est géré par PM2 (whatsai-bot). Utilisez `pm2 restart whatsai-bot` sur le VPS pour redémarrer.',
    })
}
