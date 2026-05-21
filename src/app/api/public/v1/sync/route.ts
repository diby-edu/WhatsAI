import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api-utils'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { logApiUsage } from '@/lib/api/log-usage'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdminClient()

const VALID_TYPES = ['product', 'customer', 'catalog', 'faq', 'custom'] as const
type DataType = typeof VALID_TYPES[number]

/**
 * POST /api/public/v1/sync
 *
 * Synchronise des données métier (produits, clients, catalogue, FAQ)
 * pour les rendre accessibles à l'agent lors de ses réponses.
 *
 * Body:
 *   agent_id  string      (requis)
 *   type      string      (requis) — product | customer | catalog | faq | custom
 *   items     object[]    (requis) — chaque item doit avoir un champ "id"
 *
 * Chaque item est upserted par (agent_id, type, id).
 * Limite : 200 items par appel.
 *
 * Exemple — sync catalogue produits :
 * {
 *   "agent_id": "uuid",
 *   "type": "product",
 *   "items": [
 *     {
 *       "id": "prod_abc",
 *       "name": "Robe Noire",
 *       "description": "Robe de soirée élégante",
 *       "variants": [{ "size": "M", "price": 18000, "stock": 5 }]
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    // ── Auth ──────────────────────────────────────────────────────────────
    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    // ── Parse body ────────────────────────────────────────────────────────
    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { agent_id, type, items } = body

    if (!agent_id || !type || !Array.isArray(items)) {
        return NextResponse.json({
            error: 'Missing required fields: agent_id, type, items (array)',
            code: 'BAD_REQUEST'
        }, { status: 400 })
    }

    if (!VALID_TYPES.includes(type as DataType)) {
        return NextResponse.json({
            error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
            code: 'BAD_REQUEST'
        }, { status: 400 })
    }

    if (items.length === 0) {
        return NextResponse.json({ error: 'items array cannot be empty', code: 'BAD_REQUEST' }, { status: 400 })
    }

    if (items.length > 200) {
        return NextResponse.json({ error: 'Maximum 200 items per sync call', code: 'BAD_REQUEST' }, { status: 400 })
    }

    // Vérifier que tous les items ont un id
    const missingId = items.findIndex((item: any) => !item?.id)
    if (missingId !== -1) {
        return NextResponse.json({
            error: `Item at index ${missingId} is missing required field "id"`,
            code: 'BAD_REQUEST'
        }, { status: 400 })
    }

    // ── Vérifier agent ────────────────────────────────────────────────────
    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id, is_active')
        .eq('id', agent_id)
        .single()

    if (!agent) {
        return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    }

    if (!isAgentAllowed(agent.user_id, userId!, agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    // ── Upsert les données ────────────────────────────────────────────────
    const rows = items.map((item: any) => {
        const { id: externalId, ...rest } = item
        return {
            agent_id,
            user_id: userId,
            data_type: type,
            external_id: String(externalId),
            data: rest,
        }
    })

    const { error: upsertError } = await supabaseAdmin
        .from('agent_external_data')
        .upsert(rows, { onConflict: 'agent_id,data_type,external_id' })

    if (upsertError) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
            endpoint: '/api/public/v1/sync', method: 'POST', statusCode: 500,
            requestBody: { agent_id, type, item_count: items.length }, responseMs: Date.now() - startTime, ipAddress: ip
        })
        return NextResponse.json({ error: upsertError.message, code: 'SYNC_FAILED' }, { status: 500 })
    }

    // ── Log + réponse ─────────────────────────────────────────────────────
    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
        endpoint: '/api/public/v1/sync', method: 'POST', statusCode: 200,
        requestBody: { agent_id, type, item_count: items.length }, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: {
            synced: items.length,
            type,
            agent_id,
        }
    }, { status: 200 })
}

/**
 * DELETE /api/public/v1/sync
 *
 * Supprime les données synchronisées pour un agent.
 * Body: { agent_id, type? } — si type absent, supprime tout.
 */
export async function DELETE(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    let body: any
    try { body = await request.json() } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { agent_id, type } = body
    if (!agent_id) {
        return NextResponse.json({ error: 'Missing required field: agent_id', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { data: agent } = await supabaseAdmin.from('agents').select('id, user_id').eq('id', agent_id).single()
    if (!agent) return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    if (!isAgentAllowed(agent.user_id, userId!, agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    let query = supabaseAdmin.from('agent_external_data').delete().eq('agent_id', agent_id)
    if (type && VALID_TYPES.includes(type as DataType)) {
        query = query.eq('data_type', type)
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
        endpoint: '/api/public/v1/sync', method: 'DELETE', statusCode: 200,
        requestBody: { agent_id, type }, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({ success: true, data: { agent_id, type: type || 'all' } })
}

/**
 * GET /api/public/v1/sync?agent_id=xxx&type=product&limit=50&offset=0
 * Lire les données synchronisées pour un agent.
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    const { searchParams } = new URL(request.url)
    const agent_id = searchParams.get('agent_id')
    const type = searchParams.get('type')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    if (!agent_id) {
        return NextResponse.json({ error: 'Missing required parameter: agent_id', code: 'BAD_REQUEST' }, { status: 400 })
    }

    if (type && !VALID_TYPES.includes(type as DataType)) {
        return NextResponse.json({
            error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
            code: 'BAD_REQUEST'
        }, { status: 400 })
    }

    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id')
        .eq('id', agent_id)
        .single()

    if (!agent) return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    if (!isAgentAllowed(agent.user_id, userId!, agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    let query = supabaseAdmin
        .from('agent_external_data')
        .select('external_id, data_type, data, updated_at', { count: 'exact' })
        .eq('agent_id', agent_id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (type) query = query.eq('data_type', type)

    const { data, error, count } = await query

    if (error) {
        return NextResponse.json({ error: error.message, code: 'FETCH_FAILED' }, { status: 500 })
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
        endpoint: '/api/public/v1/sync', method: 'GET', statusCode: 200,
        requestBody: { agent_id, type }, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: {
            items: (data || []).map(row => ({ id: row.external_id, type: row.data_type, ...row.data, _updated_at: row.updated_at })),
            total: count || 0,
            limit,
            offset,
        }
    }, { status: 200 })
}
