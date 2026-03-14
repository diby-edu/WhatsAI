import { NextRequest } from 'next/server'
import https from 'https'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

async function checkSSL(hostname: string): Promise<{ status: string; message: string; daysRemaining?: number }> {
    return new Promise((resolve) => {
        const req = https.request({
            hostname,
            port: 443,
            method: 'HEAD',
            rejectUnauthorized: true,
            timeout: 5000,
        }, (res) => {
            const socket = res.socket as any
            const cert = socket.getPeerCertificate ? socket.getPeerCertificate() : null
            if (!cert?.valid_to) {
                resolve({ status: 'ok', message: 'Certificat valide' })
                return
            }

            const validTo = new Date(cert.valid_to)
            const now = new Date()
            const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

            if (daysRemaining < 0) resolve({ status: 'error', message: 'Certificat expire', daysRemaining })
            else if (daysRemaining < 14) resolve({ status: 'warning', message: `Expire dans ${daysRemaining}j`, daysRemaining })
            else resolve({ status: 'ok', message: `Valide (${daysRemaining}j)`, daysRemaining })
        })

        req.on('error', (err) => resolve({ status: 'error', message: err.message }))
        req.on('timeout', () => {
            req.destroy()
            resolve({ status: 'error', message: 'Timeout' })
        })
        req.end()
    })
}

export async function GET(request: NextRequest) {
    const { response } = await requireAdminAccess()
    if (response) return response

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

    try {
        const url = new URL(appUrl)
        const ssl = url.protocol === 'https:'
            ? await checkSSL(url.hostname)
            : { status: 'warning', message: 'Site non HTTPS' }

        let apiLatency = { status: 'error', value: 0, message: 'Timeout ou erreur' }
        try {
            const start = Date.now()
            const res = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
            const latency = Date.now() - start
            apiLatency = {
                status: res.ok ? (latency < 200 ? 'ok' : latency < 500 ? 'warning' : 'error') : 'error',
                value: latency,
                message: `${latency}ms`,
            }
        } catch {
            // keep default error result
        }

        let webhook = { status: 'error', message: 'Timeout ou erreur' }
        try {
            const start = Date.now()
            const res = await fetch(`${appUrl}/api/payments/cinetpay/webhook`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
            })
            const latency = Date.now() - start
            webhook = {
                status: res.status < 500 ? 'ok' : 'error',
                message: res.status < 500 ? 'Endpoint accessible' : 'Endpoint inaccessible',
                httpStatus: res.status,
                latency: `${latency}ms`,
            } as any
        } catch {
            // keep default error result
        }

        return successResponse({ ssl, apiLatency, webhook })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
