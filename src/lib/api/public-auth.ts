import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Client admin pour vérifier feature_flags et profiles (sans RLS)
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

/**
 * Authentifie une requête entrante via sa clé API (Bearer token).
 * La clé n'est jamais stockée en clair — seul le SHA256 est comparé.
 *
 * Vérifie également :
 * 1. Le flag global feature_flags.api_public_enabled
 * 2. Le flag utilisateur profiles.api_access_enabled
 */
export async function authenticateApiKey(
    request: NextRequest,
    supabase: any
): Promise<AuthResult> {
    // ── 1. Vérifier le kill switch global ──────────────────────────────
    try {
        const { data: flag } = await supabaseAdmin
            .from('feature_flags')
            .select('enabled')
            .eq('key', 'api_public_enabled')
            .single()

        if (flag && flag.enabled === false) {
            return {
                error: 'L\'API publique est temporairement désactivée. Contactez le support.',
                status: 503
            }
        }
    } catch (_) {
        // Si la table n'existe pas ou erreur → on laisse passer (fail open)
    }

    // ── 2. Extraire et valider la clé Bearer ───────────────────────────
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

    // ── 3. Vérifier l'accès API pour cet utilisateur ───────────────────
    try {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('api_access_enabled')
            .eq('id', apiKey.user_id)
            .single()

        if (profile && profile.api_access_enabled === false) {
            return {
                error: 'Votre compte n\'a pas accès à l\'API publique. Contactez l\'administrateur.',
                status: 403
            }
        }
    } catch (_) {
        // Si colonne absente (migration pas encore appliquée) → on laisse passer
    }

    // ── 4. Mettre à jour last_used_at (fire & forget) ──────────────────
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
