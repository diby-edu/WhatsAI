import { NextRequest, NextResponse } from 'next/server'

/**
 * ⚠️ ROUTE DE DEBUG DÉSACTIVÉE
 *
 * Cette route utilisait la stack TypeScript legacy (baileys.ts + message-handler.ts)
 * qui n'est plus la stack de production.
 *
 * Stack prod : whatsapp-service.js géré par PM2 (whatsai-bot)
 * Pour redémarrer un agent : utiliser le dashboard ou `pm2 restart whatsai-bot`
 *
 * La route est désactivée pour éviter :
 * - Double traitement des messages (stack TS + stack JS simultanées)
 * - Double déduction de crédits
 * - Absence de contrôle d'authentification (faille sécurité)
 */
export async function GET(
    _request: NextRequest,
    _context: { params: Promise<{ id: string }> }
) {
    return NextResponse.json({
        success: false,
        error: 'Route désactivée. Le bot est géré par PM2 (whatsai-bot). Utilisez le dashboard pour gérer les agents.'
    }, { status: 410 })
}
