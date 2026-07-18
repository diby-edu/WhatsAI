import { NextRequest } from 'next/server'
import { errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// PATCH /api/admin/payouts/[id] — Update payout status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, adminSupabase, response } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

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

        await logAdminAction(user.id, 'process_payout', id, 'payout', { status, payment_reference })

        return successResponse({ payout })
    } catch (err) {
        console.error('Update payout error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
