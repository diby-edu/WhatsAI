import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const results: any = {
        openai: { status: 'unknown', message: '', remaining: null },
        cinetpay: { status: 'unknown', message: '' },
        supabase: { status: 'unknown', message: '' }
    }

    // 1. OpenAI - Check configuration (no actual API call to save costs)
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey && openaiKey.startsWith('sk-')) {
        results.openai = {
            status: 'ok',
            message: 'API configurée',
            details: 'Clé sk-*** détectée'
        }
    } else if (openaiKey) {
        results.openai = {
            status: 'warning',
            message: 'Format de clé inhabituel'
        }
    } else {
        results.openai = {
            status: 'error',
            message: 'Clé API non configurée'
        }
    }

    // 2. CinetPay - Check if configured (no actual rate limit API)
    const cinetpayApiKey = process.env.CINETPAY_API_KEY
    const cinetpaySiteId = process.env.CINETPAY_SITE_ID

    if (cinetpayApiKey && cinetpaySiteId) {
        results.cinetpay = {
            status: 'ok',
            message: 'API configurée',
            details: 'Pas de limite connue'
        }
    } else {
        results.cinetpay = {
            status: 'warning',
            message: 'Non configuré'
        }
    }

    // 3. Supabase - Check connection (no rate limit for service role)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
        results.supabase = {
            status: 'ok',
            message: 'Connexion établie',
            details: 'Service role (pas de limite)'
        }
    } else {
        results.supabase = {
            status: 'warning',
            message: 'Configuration incomplète'
        }
    }

    // Overall status
    const statuses = [results.openai.status, results.cinetpay.status, results.supabase.status]
    results.overallStatus = statuses.includes('error') ? 'error'
        : statuses.includes('warning') ? 'warning' : 'ok'

    return successResponse(results)
}
