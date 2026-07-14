import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { Redis } from '@upstash/redis'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { normalizeStoredPhone } from '@/lib/profile-phone'

const MAX_OTP_ATTEMPTS = 5
const OTP_TTL = 180 // doit rester aligné avec le TTL d'envoi (send/route.ts)

// Comparaison à temps constant, tolérante aux longueurs différentes.
function timingSafeEqualStr(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return crypto.timingSafeEqual(ba, bb)
}

export async function POST(req: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError) return errorResponse(authError, 401)

    const { phone, code } = await req.json()
    if (!phone || !code) return errorResponse('Numéro et code requis', 400)

    let redis: Redis
    try {
        redis = Redis.fromEnv()
    } catch {
        return errorResponse('Erreur de configuration Redis', 503)
    }

    const stored = await redis.get<string>(`otp:${phone}`)
    if (!stored) return errorResponse('Code expiré. Demandez un nouveau code.', 400)

    let parsed: { code: string; userId: string; bypass?: boolean }
    try {
        parsed = typeof stored === 'string' ? JSON.parse(stored) : stored as any
    } catch {
        return errorResponse('Code invalide', 400)
    }

    if (parsed.userId !== user!.id) return errorResponse('Non autorisé', 401)

    // Anti-brute-force : limiter les tentatives de vérification du code (hors bypass).
    if (!parsed.bypass) {
        const attemptsKey = `otp_try:${phone}`
        const attempts = await redis.incr(attemptsKey)
        if (attempts === 1) await redis.expire(attemptsKey, OTP_TTL)
        if (attempts > MAX_OTP_ATTEMPTS) {
            // Invalider l'OTP au dépassement : force la demande d'un nouveau code.
            await redis.del(`otp:${phone}`)
            await redis.del(attemptsKey)
            return errorResponse('Trop de tentatives. Demandez un nouveau code.', 429)
        }

        if (!timingSafeEqualStr(parsed.code, String(code).trim())) {
            return errorResponse('Code incorrect', 400)
        }
    }

    // Sauvegarder le numéro vérifié et marquer comme vérifié.
    // LM-7 : phone_verified est protégé par un trigger Postgres qui n'autorise
    // que le service_role — createApiClient() (clé anon + session) s'exécute en
    // rôle 'authenticated' et se ferait silencieusement ignorer par le trigger.
    const normalizedPhone = normalizeStoredPhone(phone) || phone
    const adminSupabase = createAdminClient()
    const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ phone_verified: true, phone: normalizedPhone })
        .eq('id', user!.id)

    if (updateError) {
        console.error('[phone-verify/confirm] Failed to persist phone_verified:', updateError)
        return errorResponse('Échec de l\'enregistrement de la vérification', 500)
    }

    // Supprimer le code OTP et le compteur de tentatives
    await redis.del(`otp:${phone}`)
    await redis.del(`otp_try:${phone}`)

    return successResponse({ verified: true })
}
