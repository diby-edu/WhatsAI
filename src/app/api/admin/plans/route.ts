import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// GET - List all subscription plans (admin only)
// Audit F-09 : cette route servait toutes les colonnes de configuration des plans
// à n'importe quel utilisateur connecté (aucun garde). L'affichage public des tarifs
// passe par /api/plans ; on réserve donc /api/admin/plans aux administrateurs.
export async function GET() {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { data: plans, error } = await adminSupabase
            .from('subscription_plans')
            .select('*')
            .order('price_fcfa', { ascending: true })

        if (error) throw error

        return successResponse({ plans: plans || [] })
    } catch (err) {
        console.error('Error fetching plans:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST - Create new plan (admin only)
export async function POST(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const body = await request.json()

        const { data: plan, error } = await adminSupabase
            .from('subscription_plans')
            .insert({
                name: body.name,
                price_fcfa: body.price_fcfa || 0,
                credits_included: body.credits_included || 100,
                features: body.features || [],
                is_active: body.is_active ?? true,
                billing_cycle: body.billing_cycle || 'monthly',
                max_agents: body.max_agents || 1,
                max_whatsapp_numbers: body.max_whatsapp_numbers || 1,
                is_popular: body.is_popular || false,
                description: body.description || ''
            })
            .select()
            .single()

        if (error) throw error

        return successResponse({ plan }, 201)
    } catch (err) {
        console.error('Error creating plan:', err)
        return errorResponse('Erreur lors de la création', 500)
    }
}
