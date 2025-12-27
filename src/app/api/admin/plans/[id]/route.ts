import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// PUT - Update plan
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

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

        // Build update object with all possible fields
        const updateData: Record<string, any> = {}

        if (body.name !== undefined) updateData.name = body.name
        if (body.price_fcfa !== undefined) updateData.price_fcfa = body.price_fcfa
        if (body.credits_included !== undefined) updateData.credits_included = body.credits_included
        if (body.features !== undefined) updateData.features = body.features
        if (body.is_active !== undefined) updateData.is_active = body.is_active
        if (body.billing_cycle !== undefined) updateData.billing_cycle = body.billing_cycle
        if (body.max_agents !== undefined) updateData.max_agents = body.max_agents
        if (body.max_whatsapp_numbers !== undefined) updateData.max_whatsapp_numbers = body.max_whatsapp_numbers
        if (body.is_popular !== undefined) updateData.is_popular = body.is_popular
        if (body.description !== undefined) updateData.description = body.description

        const { data: plan, error } = await supabase
            .from('subscription_plans')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return successResponse({ plan })
    } catch (err) {
        console.error('Error updating plan:', err)
        return errorResponse('Erreur lors de la mise à jour', 500)
    }
}

// DELETE - Delete plan
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès réservé aux administrateurs', 403)
    }

    try {
        const { error } = await supabase
            .from('subscription_plans')
            .delete()
            .eq('id', id)

        if (error) throw error

        return successResponse({ message: 'Plan supprimé' })
    } catch (err) {
        console.error('Error deleting plan:', err)
        return errorResponse('Erreur lors de la suppression', 500)
    }
}
