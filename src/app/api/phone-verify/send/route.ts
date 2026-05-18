import { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { sendWhatsAppMessage } from '@/lib/whatsapp/baileys'

const OTP_TTL = 180 // 3 minutes

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError) return errorResponse(authError, 401)

    const { phone } = await req.json()
    if (!phone) return errorResponse('Numéro requis', 400)

    const agentId = process.env.OTP_WHATSAPP_AGENT_ID
    if (!agentId) return errorResponse('Service de vérification non configuré', 503)

    // Rate limit : max 3 envois par numéro par heure
    let redis: Redis | null = null
    try {
        redis = Redis.fromEnv()
        const rateLimitKey = `otp_limit:${phone}`
        const attempts = await redis.incr(rateLimitKey)
        if (attempts === 1) await redis.expire(rateLimitKey, 3600)
        if (attempts > 3) return errorResponse('Trop de tentatives. Réessayez dans 1 heure.', 429)
    } catch {
        return errorResponse('Erreur de configuration Redis', 503)
    }

    const code = generateOtp()

    // Stocker en Redis avec TTL
    await redis.set(`otp:${phone}`, JSON.stringify({ code, userId: user!.id }), { ex: OTP_TTL })

    // Envoyer via WhatsApp
    const message = `🔐 *Votre code WazzapAI : ${code}*\n\nCe code est valable 3 minutes.\n\n⚠️ Ne répondez pas à ce message, il n'est pas surveillé.`
    const result = await sendWhatsAppMessage(agentId, phone, message)

    if (!result.success) {
        return errorResponse('Échec de l\'envoi WhatsApp. Vérifiez votre numéro.', 500)
    }

    return successResponse({ sent: true, expiresIn: OTP_TTL })
}
