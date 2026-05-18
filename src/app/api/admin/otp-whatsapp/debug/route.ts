import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { withAdminAuth, successResponse, errorResponse } from '@/lib/api-utils'
import { NextRequest } from 'next/server'

export const GET = withAdminAuth(async (req: NextRequest) => {
    const HEALTH_PORT = process.env.HEALTH_PORT || 3001
    const trace: string[] = []

    // 1. DB state
    trace.push('1. Lecture agent OTP en DB...')
    let dbAgent: any = null
    try {
        const serviceClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data, error } = await serviceClient
            .from('agents')
            .select('id, name, whatsapp_connected, whatsapp_status, whatsapp_phone')
            .eq('name', '__otp_sender__')
            .single()
        if (error) trace.push('  ERREUR DB: ' + error.message)
        else { dbAgent = data; trace.push(`  OK: id=${data?.id}, connected=${data?.whatsapp_connected}, status=${data?.whatsapp_status}`) }
    } catch (err: any) { trace.push('  EXCEPTION: ' + err.message) }

    // 2. Sessions en mémoire
    trace.push(`2. Appel service interne http://127.0.0.1:${HEALTH_PORT}/sessions ...`)
    let internalSessions: any = null
    let internalError: string | null = null
    try {
        const res = await fetch(`http://127.0.0.1:${HEALTH_PORT}/sessions`, { signal: AbortSignal.timeout(3000) })
        internalSessions = await res.json()
        trace.push(`  OK: ${internalSessions?.activeSessions?.length ?? 0} session(s) active(s)`)
        internalSessions?.activeSessions?.forEach((s: any) => trace.push(`  - session: id=${s.id} status=${s.status}`))
    } catch (err: any) {
        internalError = err?.message || 'unreachable'
        trace.push('  ERREUR: ' + internalError)
    }

    const otpInMemory = dbAgent && internalSessions?.activeSessions
        ? internalSessions.activeSessions.find((s: any) => s.id === dbAgent.id)
        : null

    // 3. Test d'envoi si ?testsend=NUMERO fourni
    const testPhone = new URL(req.url).searchParams.get('testsend')
    let sendResult: any = null
    if (testPhone && dbAgent) {
        trace.push(`3. Test envoi vers ${testPhone} via service interne...`)
        const recipient = testPhone.replace(/^\+/, '')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (process.env.WHATSAPP_INTERNAL_API_TOKEN) headers['x-internal-token'] = process.env.WHATSAPP_INTERNAL_API_TOKEN
        try {
            const res = await fetch(`http://127.0.0.1:${HEALTH_PORT}/send`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ agentId: dbAgent.id, to: recipient, message: '[TEST OTP DEBUG] Si vous recevez ce message, le système fonctionne.' }),
                signal: AbortSignal.timeout(15000),
            })
            const raw = await res.text()
            trace.push(`  HTTP ${res.status}: ${raw}`)
            try { sendResult = JSON.parse(raw) } catch { sendResult = { raw } }
        } catch (err: any) {
            trace.push('  EXCEPTION envoi: ' + err.message)
            sendResult = { error: err.message }
        }
    }

    return successResponse({
        trace,
        db: dbAgent,
        inMemory: otpInMemory,
        diagnosis: !dbAgent ? 'Agent non trouvé en DB'
            : internalError ? `Service interne inaccessible (port ${HEALTH_PORT}): ${internalError}`
            : !otpInMemory ? 'Agent non chargé en mémoire du service'
            : otpInMemory.status !== 'connected' ? 'Session en mémoire mais status=' + otpInMemory.status
            : 'OK',
        sendResult: sendResult || 'Ajouter ?testsend=225XXXXXXXXX pour tester l\'envoi',
    })
})

// POST — réinitialiser le rate limit OTP pour un numéro
export const POST = withAdminAuth(async (req: NextRequest) => {
    const { phone } = await req.json().catch(() => ({}))
    if (!phone) return errorResponse('phone requis', 400)

    try {
        const redis = Redis.fromEnv()
        const cleaned = phone.replace(/^\+/, '')
        const keys = [`otp_limit:+${cleaned}`, `otp_limit:${cleaned}`]
        await Promise.all(keys.map((k: string) => redis.del(k)))
        return successResponse({ reset: true, phone })
    } catch (err: any) {
        return errorResponse(err.message, 500)
    }
})
