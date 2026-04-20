import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuthenticatedApiKey {
    id: string
    user_id: string
    name: string
    environment: string
    rate_limit_per_minute: number
    allowed_agent_ids: string[] | null
}

export interface AuthResult {
    apiKey?: AuthenticatedApiKey
    userId?: string
    error?: string
    status?: number
}

export interface PublicApiAccessResult {
    allowed: boolean
    error?: string
    status?: number
}

export async function checkPublicApiAccessForUser(userId: string): Promise<PublicApiAccessResult> {
    try {
        const { data: flag } = await supabaseAdmin
            .from('feature_flags')
            .select('enabled')
            .eq('key', 'api_public_enabled')
            .single()

        if (flag && flag.enabled === false) {
            return {
                allowed: false,
                error: 'L\'API publique est temporairement desactivee. Contactez le support.',
                status: 503,
            }
        }
    } catch {
        // fail-open if feature_flags is unavailable
    }

    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('api_access_enabled')
            .eq('id', userId)
            .single()

        if (profile && profile.api_access_enabled === false) {
            return {
                allowed: false,
                error: 'Votre compte n\'a pas acces a l\'API publique. Contactez l\'administrateur.',
                status: 403,
            }
        }
    } catch {
        // fail-open if column is not available
    }

    return { allowed: true }
}

export async function authenticateApiKey(
    request: NextRequest,
    supabase: any
): Promise<AuthResult> {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'Missing Authorization header. Use: Bearer sk_live_...', status: 401 }
    }

    const rawKey = authHeader.slice(7).trim()
    if (!rawKey.startsWith('sk_live_') && !rawKey.startsWith('sk_test_')) {
        return { error: 'Invalid API key format', status: 401 }
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    const { data: apiKey, error } = await supabase
        .from('api_keys')
        .select('id, user_id, name, environment, rate_limit_per_minute, allowed_agent_ids, expires_at, is_active')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single()

    if (error || !apiKey) {
        return { error: 'Invalid or revoked API key', status: 401 }
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return { error: 'API key has expired', status: 401 }
    }

    const access = await checkPublicApiAccessForUser(apiKey.user_id)
    if (!access.allowed) {
        return {
            error: access.error,
            status: access.status,
        }
    }

    supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKey.id)
        .then(() => {})
        .catch(() => {})

    return { apiKey, userId: apiKey.user_id }
}

export function isAgentAllowed(
    agentOwnerId: string,
    userId: string,
    agentId: string,
    allowedAgentIds: string[] | null
): boolean {
    if (agentOwnerId !== userId) return false
    if (!allowedAgentIds) return true
    return allowedAgentIds.includes(agentId)
}
