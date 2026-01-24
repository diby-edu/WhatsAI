import { NextRequest } from 'next/server'
import { createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: bookingId } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    try {
        const body = await request.json()
        const { status } = body

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled']
        if (!validStatuses.includes(status)) {
            return errorResponse(`Statut invalide: ${status}`)
        }

        // Check booking exists and belongs to user's agent
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, agent_id, status')
            .eq('id', bookingId)
            .single()

        if (bookingError || !booking) {
            return errorResponse('Réservation non trouvée', 404)
        }

        // Verify the booking's agent belongs to the user
        const { data: agent } = await supabase
            .from('agents')
            .select('id, user_id')
            .eq('id', booking.agent_id)
            .single()

        if (!agent || agent.user_id !== user.id) {
            return errorResponse('Vous n\'êtes pas autorisé à modifier cette réservation', 403)
        }

        // Update booking status
        const { error: updateError } = await supabase
            .from('bookings')
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', bookingId)

        if (updateError) {
            console.error('Error updating booking status:', updateError)
            return errorResponse('Erreur lors de la mise à jour du statut')
        }

        return successResponse({ message: `Statut mis à jour: ${status}` })
    } catch (err) {
        console.error('Booking status update error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
