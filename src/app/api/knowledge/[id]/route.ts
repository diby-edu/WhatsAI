import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// DELETE /api/knowledge/[id] - Remove a document
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

    // Supprimer tous les chunks de cette source (source_id = id)
    // Compatibilité : les vieux documents ont source_id = id (après migration backfill)
    const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('source_id', id)
        .eq('user_id', user.id) // Security check

    if (error) {
        console.error('Error deleting knowledge:', error)
        return errorResponse('Error deleting document', 500)
    }

    return successResponse({ success: true })
}
