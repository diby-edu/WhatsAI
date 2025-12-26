import { successResponse } from '@/lib/api-utils'

const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'CINETPAY_API_KEY',
    'CINETPAY_SITE_ID'
]

const optionalEnvVars = [
    'CINETPAY_SECRET_KEY',
    'WHATSAPP_API_URL'
]

export async function GET() {
    const missing: string[] = []
    const configured: string[] = []

    for (const envVar of requiredEnvVars) {
        if (process.env[envVar]) {
            configured.push(envVar)
        } else {
            missing.push(envVar)
        }
    }

    const optional: string[] = []
    for (const envVar of optionalEnvVars) {
        if (process.env[envVar]) {
            optional.push(envVar)
        }
    }

    return successResponse({
        missing,
        configured: configured.length,
        optional: optional.length,
        total: requiredEnvVars.length
    })
}
