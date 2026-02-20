import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// PATCH /api/admin/payouts/[id] — Update payout status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { id } = await params
        const body = await request.json()
        const { status, payment_reference, payment_method, notes } = body

        const updateData: any = {
            status,
            processed_by: user.id
        }

        if (payment_reference) updateData.payment_reference = payment_reference
        if (payment_method) updateData.payment_method = payment_method
        if (notes !== undefined) updateData.notes = notes

        // If marking as completed, set paid_at
        if (status === 'completed') {
            updateData.paid_at = new Date().toISOString()
        }

        const { data: payout, error } = await adminSupabase
            .from('payouts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return successResponse({ payout })
    } catch (err) {
        console.error('Update payout error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
