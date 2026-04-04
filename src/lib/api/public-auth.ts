import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

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

/**
 * Authentifie une requête entrante via sa clé API (Bearer token).
 * La clé n'est jamais stockée en clair — seul le SHA256 est comparé.
 */
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

    // Mettre à jour last_used_at (fire & forget — pas d'await)
    supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKey.id)
        .then(() => {})
        .catch(() => {})

    return { apiKey, userId: apiKey.user_id }
}

/**
 * Vérifie que l'agent_id fourni appartient bien à l'utilisateur
 * et est autorisé par la clé API.
 */
export function isAgentAllowed(
    agentOwnerId: string,
    userId: string,
    agentId: string,
    allowedAgentIds: string[] | null
): boolean {
    if (agentOwnerId !== userId) return false
    if (!allowedAgentIds) return true // null = tous autorisés
    return allowedAgentIds.includes(agentId)
}
