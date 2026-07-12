import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

const SendOtpSchema = z.object({
    phone: z.string().regex(/^\+\d{7,15}$/, 'Numéro invalide — format international requis (ex: +22507000000)'),
})

const OTP_TTL = 180 // 3 minutes
const OTP_AGENT_NAME = '__otp_sender__'
const INTERNAL_WS_URL = `http://127.0.0.1:${process.env.HEALTH_PORT || 3001}/send`

function generateOtp(): string {
    // PRNG cryptographique (au lieu de Math.random, prévisible) — code à 6 chiffres.
    return crypto.randomInt(100000, 1000000).toString()
}

async function sendViaInternalService(agentId: string, jid: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (process.env.WHATSAPP_INTERNAL_API_TOKEN) {
            headers['x-internal-token'] = process.env.WHATSAPP_INTERNAL_API_TOKEN
        }
        const res = await fetch(INTERNAL_WS_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentId, to: jid, message }),
            signal: AbortSignal.timeout(15000),
        })
        const data = await res.json() as { success: boolean; error?: string }
        return data
    } catch (err: any) {
        return { success: false, error: err?.message || 'Internal service unreachable' }
    }
}

export async function POST(req: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError) return errorResponse(authError, 401)

    const rawBody = await req.json()
    const parsed = SendOtpSchema.safeParse(rawBody)
    if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 400)
    }
    const { phone } = parsed.data

    // Récupérer l'agent OTP via client service role direct (bypass RLS garanti)
    const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Vérifier le flag otp_bypass_enabled
    const { data: bypassFlag } = await serviceClient
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'otp_bypass_enabled')
        .maybeSingle()
    const otpBypass = bypassFlag?.enabled === true

    // LM-6 : le bypass court-circuite l'OTP — tracer chaque usage bruyamment
    // (visible en logs/Sentry) pour qu'il ne reste jamais actif silencieusement.
    // Non bloqué en dur par NODE_ENV : au 2026-07-10 ce flag est le seul chemin
    // d'inscription tant que l'agent WhatsApp OTP (__otp_sender__) est déconnecté.
    // À restreindre au non-prod dès que l'agent est réappairé.
    if (otpBypass) {
        console.warn('[SECURITY][OTP_BYPASS_USED]', {
            userId: user!.id,
            phoneLast4: phone.slice(-4),
            env: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
        })
    }

    let redis: Redis | null = null
    try {
        redis = Redis.fromEnv()
    } catch {
        return errorResponse('Erreur de configuration Redis', 503)
    }

    // LM-12 : rate limit par utilisateur (pas seulement par numéro, qui peut
    // être partagé/réutilisé pour contourner la limite) : max 3 envois/heure.
    const consumeRateLimit = async () => {
        const rateLimitKey = `otp_limit:${user!.id}`
        const attempts = await redis!.incr(rateLimitKey)
        if (attempts === 1) await redis!.expire(rateLimitKey, 3600)
        return attempts <= 3
    }

    // Mode bypass : stocker marqueur et retourner succès sans envoyer de message
    if (otpBypass) {
        if (!(await consumeRateLimit())) {
            return errorResponse('Trop de tentatives. Réessayez dans 1 heure.', 429)
        }
        await redis.set(`otp:${phone}`, JSON.stringify({ code: 'BYPASS', userId: user!.id, bypass: true }), { ex: OTP_TTL })
        await redis.del(`otp_try:${phone}`) // réinitialiser le compteur d'essais pour ce nouveau code
        return successResponse({ sent: true, expiresIn: OTP_TTL, bypass: true })
    }

    const { data: otpAgent } = await serviceClient
        .from('agents')
        .select('id, whatsapp_connected, whatsapp_status')
        .eq('name', OTP_AGENT_NAME)
        .single()

    const isReady = otpAgent?.whatsapp_connected || otpAgent?.whatsapp_status === 'connected'
    if (!isReady) {
        // Service indisponible : ne consomme pas le quota de tentatives de l'utilisateur.
        return errorResponse('Service de vérification WhatsApp non disponible', 503)
    }
    const agentId = otpAgent.id

    if (!(await consumeRateLimit())) {
        return errorResponse('Trop de tentatives. Réessayez dans 1 heure.', 429)
    }

    const code = generateOtp()

    // Stocker en Redis avec TTL
    await redis!.set(`otp:${phone}`, JSON.stringify({ code, userId: user!.id }), { ex: OTP_TTL })
    await redis!.del(`otp_try:${phone}`) // réinitialiser le compteur d'essais pour ce nouveau code

    // Envoyer via WhatsApp — passer le numéro brut (sans @) pour que le service fasse le lookup WA
    const recipient = phone.replace(/^\+/, '') // ex: 225747094746
    const message = `🔐 *Votre code WazzapAI : ${code}*\n\nCe code est valable 3 minutes.\n\n⚠️ Ne répondez pas à ce message, il n'est pas surveillé.`
    const result = await sendViaInternalService(agentId, recipient, message)

    if (!result.success) {
        if (result.error === 'WhatsApp not connected') {
            return errorResponse('Le service WhatsApp OTP n\'est pas connecté. Contactez l\'administrateur.', 503)
        }
        return errorResponse('Échec de l\'envoi. Vérifiez que votre numéro WhatsApp est correct.', 500)
    }

    return successResponse({ sent: true, expiresIn: OTP_TTL })
}
