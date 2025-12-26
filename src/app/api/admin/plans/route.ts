import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - List all subscription plans
export async function GET() {
    const supabase = await createApiClient()

    try {
        const { data: plans, error } = await supabase
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
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    // Check if admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès réservé aux administrateurs', 403)
    }

    try {
        const body = await request.json()

        const { data: plan, error } = await supabase
            .from('subscription_plans')
            .insert({
                name: body.name,
                price_fcfa: body.price_fcfa,
                credits_included: body.credits_included,
                features: body.features || [],
                is_active: body.is_active ?? true,
                billing_cycle: body.billing_cycle || 'monthly'
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
