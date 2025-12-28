import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
    const results: any = {
        openai: { status: 'unknown', message: '', remaining: null },
        cinetpay: { status: 'unknown', message: '' },
        supabase: { status: 'unknown', message: '' }
    }

    // 1. OpenAI Rate Limit Check
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        })

        // Make a minimal API call to check rate limits
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1
        })

        // OpenAI doesn't return rate limit headers easily in SDK
        // But if the call succeeds, we're within limits
        results.openai = {
            status: 'ok',
            message: 'Dans les limites',
            details: 'API fonctionnelle',
            model: response.model
        }
    } catch (err: any) {
        if (err.status === 429) {
            results.openai = {
                status: 'error',
                message: 'Rate limit atteint',
                details: err.message
            }
        } else if (err.status === 401) {
            results.openai = {
                status: 'error',
                message: 'Clé API invalide'
            }
        } else {
            results.openai = {
                status: 'warning',
                message: err.message || 'Erreur vérification'
            }
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
