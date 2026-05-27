import { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { normalizeStoredPhone } from '@/lib/profile-phone'

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
    if (!parsed.bypass && parsed.code !== code.trim()) return errorResponse('Code incorrect', 400)

    // Sauvegarder le numéro vérifié et marquer comme vérifié
    const normalizedPhone = normalizeStoredPhone(phone) || phone
    await supabase.from('profiles').update({ phone_verified: true, phone: normalizedPhone }).eq('id', user!.id)

    // Supprimer le code OTP
    await redis.del(`otp:${phone}`)

    return successResponse({ verified: true })
}
