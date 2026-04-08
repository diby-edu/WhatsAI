import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// POST - Toggle bot pause for conversation
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()
        const paused = body.paused ?? true

        // Check ownership
        const { data: conversation, error: fetchError } = await supabase
            .from('conversations')
            .select('id, user_id, bot_paused, status')
            .eq('id', id)
            .single()

        if (fetchError || !conversation) {
            return errorResponse('Conversation non trouvée', 404)
        }

        if (conversation.user_id !== user.id) {
            return errorResponse('Accès non autorisé', 403)
        }

        const updatePayload: Record<string, unknown> = { bot_paused: paused }
        if (!paused && conversation.status === 'escalated') {
            updatePayload.status = 'active'
        }

        // Toggle pause
        const { data: updated, error: updateError } = await supabase
            .from('conversations')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single()

        if (updateError) throw updateError

        return successResponse({
            bot_paused: updated.bot_paused,
            status: updated.status,
            message: updated.bot_paused
                ? 'Bot mis en pause - vous contrôlez maintenant la conversation'
                : (conversation.status === 'escalated'
                    ? 'Escalade résolue - les réponses automatiques reprennent'
                    : 'Bot réactivé - les réponses automatiques reprennent')
        })
    } catch (err) {
        console.error('Error toggling pause:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
