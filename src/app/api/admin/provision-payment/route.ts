import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { finalizePaymentRecord } from '@/lib/payments/finalization'

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 403)
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Non autorisé', 403)
    }

    let body: {
        userId: string
        paymentType: 'subscription' | 'credits'
        planId?: string
        creditPackId?: string
        amountFcfa: number
        creditsAmount?: number
        adminNotes?: string
        provisionDate?: string
    }

    try {
        body = await request.json()
    } catch {
        return errorResponse('Corps de requête invalide', 400)
    }

    const { userId, paymentType, planId, creditPackId, amountFcfa, creditsAmount, adminNotes, provisionDate } = body

    if (!userId || !paymentType || !amountFcfa) {
        return errorResponse('userId, paymentType et amountFcfa sont requis', 400)
    }

    if (paymentType === 'subscription' && !planId) {
        return errorResponse('planId est requis pour un abonnement', 400)
    }

    if (paymentType === 'credits' && !creditPackId && !creditsAmount) {
        return errorResponse('creditPackId ou creditsAmount est requis pour un achat de crédits', 400)
    }

    const adminSupabase = createAdminClient()

    // Vérifier que l'utilisateur existe
    const { data: targetProfile } = await adminSupabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single()

    if (!targetProfile) {
        return errorResponse('Utilisateur introuvable', 404)
    }

    const createdAt = provisionDate ? new Date(provisionDate).toISOString() : new Date().toISOString()

    // Les métadonnées sont stockées dans provider_response (pas de colonne metadata)
    const providerResponse: Record<string, unknown> = {
        source: 'manual_admin_provision',
        provisioned_by: user.id,
        provisioned_by_role: profile.role,
    }

    if (paymentType === 'subscription' && planId) {
        providerResponse.plan_id = planId
        providerResponse.plan_name = planId
    }

    if (paymentType === 'credits') {
        if (creditPackId) providerResponse.pack_id = creditPackId
        if (creditsAmount) providerResponse.credits = creditsAmount
    }

    // Créer l'enregistrement de paiement manuel
    const { data: newPayment, error: insertError } = await adminSupabase
        .from('payments')
        .insert({
            user_id: userId,
            amount_fcfa: amountFcfa,
            status: 'pending',
            payment_type: paymentType,
            payment_provider: 'manual',
            payment_method_source: 'manual',
            admin_notes: adminNotes || null,
            credits_purchased: creditsAmount || null,
            customer_email: targetProfile.email,
            provider_response: providerResponse,
            created_at: createdAt,
        })
        .select('*')
        .single()

    if (insertError || !newPayment) {
        console.error('[provision-payment] Insert error:', insertError)
        return errorResponse('Échec création du paiement', 500)
    }

    // Finaliser via la même logique que les paiements automatiques
    const result = await finalizePaymentRecord(
        adminSupabase,
        newPayment,
        'ACCEPTED', // Paiement manuel = accepté par définition
        { source: 'manual_admin_provision', provisioned_by: user.id }
    )

    if (!result.ok) {
        // Supprimer le paiement orphelin en cas d'erreur de finalisation
        await adminSupabase.from('payments').delete().eq('id', newPayment.id)
        return errorResponse(result.message || 'Échec finalisation du paiement', 500)
    }

    return successResponse({
        paymentId: newPayment.id,
        state: result.state,
        creditsAdded: result.creditsAdded,
        newBalance: result.newBalance,
        planUpdated: result.planUpdated,
        user: {
            id: userId,
            email: targetProfile.email,
            fullName: targetProfile.full_name,
        },
    })
}
