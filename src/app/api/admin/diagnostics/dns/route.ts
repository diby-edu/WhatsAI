import dns from 'dns'
import { promisify } from 'util'
import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

const dnsResolve = promisify(dns.resolve)
const dnsLookup = promisify(dns.lookup)

export async function GET(request: NextRequest) {
    const { response } = await requireAdminAccess()
    if (response) return response

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    const results: any = {
        domain: '',
        dns: { status: 'unknown', message: '' },
        ipAddress: null,
        nameservers: [],
        propagated: false,
        httpReachable: false,
    }

    try {
        const url = new URL(appUrl)
        const domain = url.hostname
        results.domain = domain

        try {
            const { address } = await dnsLookup(domain)
            results.ipAddress = address
            results.dns.status = 'ok'
            results.dns.message = `Resolu vers ${address}`
            results.propagated = true
        } catch (err: any) {
            results.dns.status = 'error'
            results.dns.message = err.code === 'ENOTFOUND' ? 'Domaine non resolu' : err.message
        }

        try {
            results.nameservers = (await dnsResolve(domain, 'NS').catch(() => [])).slice(0, 3)
        } catch {
            results.nameservers = []
        }

        try {
            const mx = await dnsResolve(domain, 'MX').catch(() => [])
            results.mxRecords = mx.length > 0
            results.mxCount = mx.length
        } catch {
            results.mxRecords = false
            results.mxCount = 0
        }

        try {
            const response = await fetch(appUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
            })
            results.httpReachable = response.ok || response.status < 500
            results.httpStatus = response.status
        } catch (err: any) {
            results.httpReachable = false
            results.httpError = err.name === 'TimeoutError' ? 'Timeout' : err.message
        }

        return successResponse(results)
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur de configuration URL', 500)
    }
}
