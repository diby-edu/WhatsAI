import { createAdminClient, successResponse } from '@/lib/api-utils'

async function probeWhatsAppBot() {
    try {
        const response = await fetch('http://localhost:3001/health', {
            signal: AbortSignal.timeout(3000),
        })

        if (!response.ok) {
            return { status: 'warning', httpStatus: response.status }
        }

        const data = await response.json().catch(() => null)
        return { status: 'ok', data }
    } catch (err: any) {
        return { status: 'warning', error: err.message || 'Unavailable' }
    }
}

export async function GET() {
    const adminSupabase = createAdminClient()
    const timestamp = new Date().toISOString()

    const [dbResult, maintenanceResult, botResult] = await Promise.all([
        adminSupabase.from('profiles').select('id').limit(1),
        adminSupabase
            .from('feature_flags')
            .select('enabled')
            .eq('key', 'maintenance_mode')
            .maybeSingle(),
        probeWhatsAppBot(),
    ])

    const databaseOk = !dbResult.error
    const maintenanceEnabled = maintenanceResult.data?.enabled === true
    const overallStatus = !databaseOk ? 'unhealthy' : botResult.status === 'warning' ? 'degraded' : 'healthy'

    return successResponse({
        status: overallStatus,
        timestamp,
        version: '1.1.0',
        services: {
            database: {
                status: databaseOk ? 'ok' : 'error',
                error: dbResult.error?.message || null,
            },
            maintenance: {
                status: maintenanceEnabled ? 'warning' : 'ok',
                enabled: maintenanceEnabled,
            },
            whatsappBot: botResult,
        },
    }, databaseOk ? 200 : 503)
}
