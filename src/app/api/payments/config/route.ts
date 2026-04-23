import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, errorResponse, getAuthUser, successResponse } from '@/lib/api-utils'
import { getDefaultPaymentProvider } from '@/lib/payments/provider'
import { getFeexPayDefaultNetwork } from '@/lib/payments/feexpay'

export async function GET(_request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorise', 401)
    }

    try {
        const adminSupabase = createAdminClient()
        const defaultProvider = await getDefaultPaymentProvider(adminSupabase)

        return successResponse({
            defaultPaymentProvider: defaultProvider,
            feexpayDefaultNetwork: getFeexPayDefaultNetwork() || null,
        })
    } catch (err: any) {
        console.error('Payments config error:', err)
        return errorResponse(err?.message || 'Erreur serveur', 500)
    }
}

