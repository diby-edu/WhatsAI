import { successResponse, errorResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'CINETPAY_API_KEY',
    'CINETPAY_SITE_ID',
]

const optionalEnvVars = [
    'CINETPAY_SECRET_KEY',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_PUBLIC_KEY',
    'WHATSAPP_API_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
]

export async function GET() {
    const { response } = await requireAdminAccess()
    if (response) return response

    try {
        const missing = requiredEnvVars.filter((envVar) => !process.env[envVar])
        const configured = requiredEnvVars.filter((envVar) => !!process.env[envVar])
        const optional = optionalEnvVars.filter((envVar) => !!process.env[envVar])

        return successResponse({
            missing,
            configured: configured.length,
            optionalConfigured: optional,
            total: requiredEnvVars.length,
        })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
