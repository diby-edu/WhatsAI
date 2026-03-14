import { successResponse, errorResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET() {
    const { response } = await requireAdminAccess()
    if (response) return response

    try {
        const required = ['CINETPAY_API_KEY', 'CINETPAY_SITE_ID']
        const optional = ['CINETPAY_SECRET_KEY']
        const missingRequired = required.filter((key) => !process.env[key])
        const configuredOptional = optional.filter((key) => !!process.env[key])

        const configured = missingRequired.length === 0

        return successResponse({
            configured,
            mode: process.env.CINETPAY_MODE || 'production',
            missingRequired,
            optionalConfigured: configuredOptional,
            message: configured
                ? 'Configuration CinetPay detectee'
                : `Configuration incomplete: ${missingRequired.join(', ')}`,
        })
    } catch (err: any) {
        console.error('CinetPay diagnostics error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
