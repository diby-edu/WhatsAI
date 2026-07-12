import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

const SIGNED_URL_TTL_SECONDS = 300

// CSEC-4 : bucket verification-images désormais privé. Cette route génère une
// URL signée à durée de vie courte, réservée au marchand propriétaire de la
// commande (scopé via RLS sur orders.user_id, comme /api/orders/[id]).
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const { data: order, error } = await supabase
        .from('orders')
        .select('id, payment_screenshot_url')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error || !order || !order.payment_screenshot_url) {
        return errorResponse('Justificatif introuvable', 404)
    }

    const adminSupabase = createAdminClient()
    const { data: signed, error: signError } = await adminSupabase
        .storage
        .from('verification-images')
        .createSignedUrl(order.payment_screenshot_url, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
        return errorResponse('Impossible de générer le lien', 500)
    }

    return successResponse({ url: signed.signedUrl })
}
