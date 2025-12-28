import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'
import dns from 'dns'
import { promisify } from 'util'

const dnsResolve = promisify(dns.resolve)
const dnsLookup = promisify(dns.lookup)

export async function GET(request: NextRequest) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.ci'
    const results: any = {
        domain: '',
        dns: { status: 'unknown', message: '' },
        ipAddress: null,
        nameservers: [],
        propagated: false
    }

    try {
        const url = new URL(appUrl)
        const domain = url.hostname
        results.domain = domain

        // 1. DNS Lookup - Get IP address
        try {
            const { address } = await dnsLookup(domain)
            results.ipAddress = address
            results.dns.status = 'ok'
            results.dns.message = `Résolu vers ${address}`
            results.propagated = true
        } catch (err: any) {
            results.dns.status = 'error'
            results.dns.message = err.code === 'ENOTFOUND'
                ? 'Domaine non résolu'
                : err.message
        }

        // 2. Get nameservers (if accessible)
        try {
            const ns = await dnsResolve(domain, 'NS').catch(() => [])
            results.nameservers = ns.slice(0, 3) // First 3 NS
        } catch (err) {
            // NS lookup failed, not critical
        }

        // 3. Check MX records (for email capability)
        try {
            const mx = await dnsResolve(domain, 'MX').catch(() => [])
            results.mxRecords = mx.length > 0
            results.mxCount = mx.length
        } catch (err) {
            results.mxRecords = false
        }

        // 4. Check if domain is reachable via HTTP
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)

            const res = await fetch(appUrl, {
                method: 'HEAD',
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            results.httpReachable = res.ok || res.status < 500
            results.httpStatus = res.status
        } catch (err: any) {
            results.httpReachable = false
            results.httpError = err.name === 'AbortError' ? 'Timeout' : err.message
        }

    } catch (err: any) {
        results.dns.status = 'error'
        results.dns.message = 'Erreur de configuration URL'
    }

    return successResponse(results)
}
