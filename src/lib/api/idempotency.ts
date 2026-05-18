import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gestion de l'idempotence pour l'API publique.
 * Garantit qu'une requête avec le même idempotency_key n'est exécutée qu'une seule fois.
 * Les entrées expirent après 24h.
 */

const IDEMPOTENCY_TTL_HOURS = 24

/**
 * Vérifie si une clé d'idempotence existe déjà.
 * Retourne la réponse cachée si oui, null sinon.
 */
export async function checkIdempotency(
    supabase: SupabaseClient,
    userId: string,
    idempotencyKey: string
): Promise<Record<string, any> | null> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000).toISOString()

    const { data } = await supabase
        .from('api_idempotency')
        .select('response_body, created_at')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .gt('created_at', cutoff)
        .maybeSingle()

    return data?.response_body ?? null
}

/**
 * Stocke une réponse pour une clé d'idempotence.
 * Fire & forget — ne bloque pas la réponse.
 */
export function storeIdempotency(
    supabase: SupabaseClient,
    userId: string,
    idempotencyKey: string,
    responseBody: Record<string, any>
): void {
    supabase
        .from('api_idempotency')
        .upsert({
            user_id: userId,
            idempotency_key: idempotencyKey,
            response_body: responseBody,
        }, { onConflict: 'user_id,idempotency_key' })
        .then(() => {}, () => {})
}
