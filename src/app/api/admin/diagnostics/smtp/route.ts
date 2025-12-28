import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const results: any = {
        configured: false,
        testResult: null,
        config: {
            host: null,
            port: null,
            user: null
        },
        status: 'unknown'
    }

    // Check SMTP configuration
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS

    if (smtpHost && smtpUser) {
        results.configured = true
        results.config = {
            host: smtpHost,
            port: smtpPort || '587',
            user: smtpUser.substring(0, 5) + '***' // Mask for security
        }
        results.status = 'configured'
        results.message = 'SMTP configuré'
    } else {
        // Check if using Supabase built-in email
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (supabaseUrl) {
            results.configured = true
            results.status = 'supabase'
            results.message = 'Utilise Supabase Auth Email'
            results.config = {
                provider: 'Supabase',
                url: supabaseUrl.substring(0, 30) + '...'
            }
        } else {
            results.status = 'not_configured'
            results.message = 'SMTP non configuré'
        }
    }

    return successResponse(results)
}

// Optional: POST to actually send a test email
export async function POST(request: NextRequest) {
    try {
        const { testEmail } = await request.json()

        if (!testEmail) {
            return successResponse({
                success: false,
                message: 'Email de test requis'
            })
        }

        // For now, just verify config exists
        // Real email test would require nodemailer or similar
        const smtpHost = process.env.SMTP_HOST

        if (!smtpHost) {
            return successResponse({
                success: false,
                message: 'SMTP non configuré - test impossible'
            })
        }

        // Placeholder for actual email test
        return successResponse({
            success: true,
            message: 'Configuration SMTP détectée. Envoi d\'email de test à implémenter.'
        })

    } catch (err: any) {
        return successResponse({
            success: false,
            message: err.message || 'Erreur test email'
        })
    }
}
