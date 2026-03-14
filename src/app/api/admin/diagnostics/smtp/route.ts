import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

async function loadSmtpConfig(adminSupabase: any) {
    const { data, error } = await adminSupabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'smtpSecure'])

    if (error) throw error

    const settings = Object.fromEntries((data || []).map((row: any) => [row.key, row.value]))
    const host = settings.smtpHost || process.env.SMTP_HOST || null
    const port = settings.smtpPort || process.env.SMTP_PORT || null
    const user = settings.smtpUser || process.env.SMTP_USER || null
    const pass = settings.smtpPassword || process.env.SMTP_PASSWORD || process.env.SMTP_PASS || null
    const secure = settings.smtpSecure !== undefined ? settings.smtpSecure : (Number(port || 465) === 465)

    return { host, port, user, pass, secure }
}

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const smtp = await loadSmtpConfig(adminSupabase)
        const configured = !!(smtp.host && smtp.user && smtp.pass)

        return successResponse({
            configured,
            status: configured ? 'configured' : 'not_configured',
            message: configured ? 'SMTP configure' : 'SMTP incomplet',
            config: {
                host: smtp.host,
                port: smtp.port,
                secure: smtp.secure,
                user: smtp.user ? `${String(smtp.user).slice(0, 5)}***` : null,
                source: configured ? 'app_settings/env' : 'missing',
            },
        })
    } catch (err: any) {
        console.error('SMTP diagnostics error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}

export async function POST(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { testEmail } = await request.json()
        if (!testEmail) {
            return errorResponse('Email de test requis', 400)
        }

        const smtp = await loadSmtpConfig(adminSupabase)
        const configured = !!(smtp.host && smtp.user && smtp.pass)

        return successResponse({
            success: configured,
            message: configured
                ? `Configuration SMTP disponible pour un test vers ${testEmail}`
                : 'SMTP non configure',
        })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur test email', 500)
    }
}
