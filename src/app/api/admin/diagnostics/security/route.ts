import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import https from 'https'
import http from 'http'

export async function GET(request: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

    const results: any = {
        ssl: { status: 'unknown', message: '' },
        webhook: { status: 'unknown', message: '' },
        apiLatency: { status: 'unknown', value: 0 }
    }

    // 1. SSL Certificate Check
    try {
        const url = new URL(appUrl)
        if (url.protocol === 'https:') {
            const sslResult = await checkSSL(url.hostname)
            results.ssl = sslResult
        } else {
            results.ssl = { status: 'warning', message: 'Site non HTTPS' }
        }
    } catch (err: any) {
        results.ssl = { status: 'error', message: err.message }
    }

    // 2. Webhook Reachability (CinetPay webhook endpoint)
    try {
        const webhookUrl = `${appUrl}/api/payments/cinetpay/webhook`
        const start = Date.now()
        const res = await fetch(webhookUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
        })
        const latency = Date.now() - start

        // Webhook endpoint should accept POST but respond to HEAD with some status
        results.webhook = {
            status: res.status < 500 ? 'ok' : 'error',
            message: res.status < 500 ? 'Endpoint accessible' : 'Endpoint inaccessible',
            latency: `${latency}ms`,
            httpStatus: res.status
        }
    } catch (err: any) {
        results.webhook = {
            status: 'error',
            message: err.name === 'TimeoutError' ? 'Timeout (>5s)' : err.message
        }
    }

    // 3. API Latency Test
    try {
        const start = Date.now()
        await fetch(`${appUrl}/api/health`, {
            signal: AbortSignal.timeout(5000)
        })
        const latency = Date.now() - start

        results.apiLatency = {
            status: latency < 200 ? 'ok' : latency < 500 ? 'warning' : 'error',
            value: latency,
            message: `${latency}ms`
        }
    } catch (err: any) {
        results.apiLatency = { status: 'error', value: 0, message: 'Timeout ou erreur' }
    }

    return successResponse(results)
}

async function checkSSL(hostname: string): Promise<{ status: string, message: string, daysRemaining?: number }> {
    return new Promise((resolve) => {
        const options = {
            hostname,
            port: 443,
            method: 'HEAD',
            rejectUnauthorized: true,
            timeout: 5000
        }

        const req = https.request(options, (res) => {
            const socket = res.socket as any
            if (socket.getPeerCertificate) {
                const cert = socket.getPeerCertificate()
                if (cert && cert.valid_to) {
                    const validTo = new Date(cert.valid_to)
                    const now = new Date()
                    const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

                    if (daysRemaining < 0) {
                        resolve({ status: 'error', message: 'Certificat expiré', daysRemaining })
                    } else if (daysRemaining < 14) {
                        resolve({ status: 'warning', message: `Expire dans ${daysRemaining}j`, daysRemaining })
                    } else {
                        resolve({ status: 'ok', message: `Valide (${daysRemaining}j)`, daysRemaining })
                    }
                    return
                }
            }
            resolve({ status: 'ok', message: 'Certificat valide' })
        })

        req.on('error', (err) => {
            resolve({ status: 'error', message: err.message })
        })

        req.on('timeout', () => {
            req.destroy()
            resolve({ status: 'error', message: 'Timeout' })
        })

        req.end()
    })
}
