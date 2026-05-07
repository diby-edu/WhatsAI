import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, isAdminRole, errorResponse, successResponse } from '@/lib/api-utils'

// PATCH /api/admin/payments/[id] — Update payment status (admin only)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    const role = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    if (!isAdminRole(role.data?.role)) return errorResponse('Accès refusé', 403)

    const { id } = await params
    const body = await request.json()
    const { status } = body

    const allowed = ['completed', 'failed', 'cancelled', 'pending']
    if (!allowed.includes(status)) return errorResponse('Statut invalide', 400)

    const { error } = await adminSupabase
        .from('payments')
        .update({ status })
        .eq('id', id)

    if (error) return errorResponse(error.message, 500)

    return successResponse({ message: `Paiement mis à jour : ${status}` })
}
