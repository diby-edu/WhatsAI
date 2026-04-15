import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// GET /api/features — retourne les flags actifs pour l'utilisateur courant
// Logique : flag global ON  → disponible pour tous
//           flag global OFF + user override ON → disponible pour cet utilisateur uniquement
//           flag global OFF → grisé
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user } = await getAuthUser(supabase)
    const adminSupabase = createAdminClient()

    try {
        // Flags globaux
        const { data: globalFlags } = await adminSupabase
            .from('feature_flags')
            .select('key, enabled')

        const flags: Record<string, boolean> = {}

        // Defaults (fallback si table vide ou erreur)
        const defaults: Record<string, boolean> = {
            agent_ecommerce: true, agent_restaurant: false, agent_hotel: false,
            agent_salon: false, agent_services: false, agent_custom: false,
            product_digital: true, product_physical: false, product_service: false,
        }

        // Appliquer globaux
        for (const [key, val] of Object.entries(defaults)) flags[key] = val
        for (const f of globalFlags || []) flags[f.key] = f.enabled

        // Override par utilisateur si connecté
        if (user) {
            const { data: userFlags } = await adminSupabase
                .from('user_feature_flags')
                .select('feature_key, enabled')
                .eq('user_id', user.id)

            for (const f of userFlags || []) {
                if (f.enabled) flags[f.feature_key] = true
            }
        }

        return successResponse({ flags })
    } catch (err) {
        console.error('features GET error:', err)
        // Fallback : tout activé pour ne pas bloquer les utilisateurs
        return successResponse({
            flags: {
                agent_ecommerce: true, agent_restaurant: true, agent_hotel: true,
                agent_salon: true, agent_services: true, agent_custom: true,
                product_digital: true, product_physical: true, product_service: true,
            }
        })
    }
}
