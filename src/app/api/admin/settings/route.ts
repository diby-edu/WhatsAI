import { NextRequest } from 'next/server'
import { errorResponse, logAdminAction, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { loadAdminSettings, saveAdminSettings } from '@/lib/admin/settings'
import { getPaymentProviderReadiness, parsePaymentProvider } from '@/lib/payments/provider'

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const settings = await loadAdminSettings(adminSupabase)
        const currentProvider = parsePaymentProvider(settings.defaultPaymentProvider)
        const providerReadiness = {
            current: currentProvider
                ? getPaymentProviderReadiness(currentProvider)
                : {
                    provider: 'cinetpay' as const,
                    ready: false,
                    requiredKeys: [],
                    missingKeys: [],
                    warnings: [`defaultPaymentProvider is invalid: ${String(settings.defaultPaymentProvider || '')}`],
                },
            cinetpay: getPaymentProviderReadiness('cinetpay'),
            paystack: getPaymentProviderReadiness('paystack'),
            feexpay: getPaymentProviderReadiness('feexpay'),
        }

        return successResponse({ settings, providerReadiness })
    } catch (err: any) {
        console.error('Settings API error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}

export async function PATCH(request: NextRequest) {
    const { response, user, adminSupabase } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

    try {
        const updates = await request.json()
        const updatedKeys = await saveAdminSettings(adminSupabase, user.id, updates)

        await logAdminAction(user.id, 'update_settings', undefined, 'system', { keys: updatedKeys })

        return successResponse({ success: true, updatedKeys })
    } catch (err: any) {
        console.error('Settings update error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
