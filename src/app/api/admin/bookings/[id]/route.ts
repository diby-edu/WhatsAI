import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

// PATCH - Update booking status (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

    try {
        const body = await request.json()
        const { status } = body

        if (!status) {
            return errorResponse('Status is required', 400)
        }

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled']
        if (!validStatuses.includes(status)) {
            return errorResponse('Invalid status', 400)
        }

        const { error } = await adminSupabase
            .from('bookings')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        return successResponse({ message: 'Booking updated', bookingId: id, newStatus: status })
    } catch (err) {
        console.error('Error updating booking:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
