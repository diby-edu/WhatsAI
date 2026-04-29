import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_EVENTS = [
    'message.received',
    'message.sent',
    'conversation.started',
    'conversation.ended',
    'lead.collected',
    'order.created',
    'payment.received',
    'booking.created',
]

// GET — liste des webhooks de l'utilisateur
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const { data: webhooks, error } = await supabaseAdmin
        .from('api_webhooks')
        .select('id, url, events, is_active, created_at, description')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) return errorResponse('Erreur serveur', 500)

    return successResponse({ data: webhooks || [] })
}

// POST — créer un webhook
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    let body: any
    try { body = await request.json() } catch { return errorResponse('JSON invalide', 400) }

    const { url, events, description } = body

    if (!url) return errorResponse('url est requis', 422)
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        return errorResponse('url doit commencer par http:// ou https://', 422)
    }

    const normalizedEvents: string[] = Array.isArray(events)
        ? events.filter((e: string) => ALLOWED_EVENTS.includes(e))
        : ALLOWED_EVENTS

    if (normalizedEvents.length === 0) {
        return errorResponse(`events invalides. Valeurs acceptées : ${ALLOWED_EVENTS.join(', ')}`, 422)
    }

    // Vérifier la limite (max 10 webhooks par utilisateur)
    const { count } = await supabaseAdmin
        .from('api_webhooks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    if ((count || 0) >= 10) return errorResponse('Maximum 10 webhooks par compte', 400)

    // Générer un secret HMAC
    const secret = `whsec_${randomBytes(24).toString('hex')}`

    const { data: webhook, error } = await supabaseAdmin
        .from('api_webhooks')
        .insert({
            user_id: user.id,
            url,
            events: normalizedEvents,
            secret,
            is_active: true,
            description: description || null,
        })
        .select('id, url, events, is_active, created_at, description, secret')
        .single()

    if (error) return errorResponse('Erreur serveur', 500)

    return successResponse({
        data: webhook,
        notice: 'Copiez le secret maintenant — il ne sera plus affiché.'
    }, 201)
}
