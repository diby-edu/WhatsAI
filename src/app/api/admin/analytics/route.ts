import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { buildAdminAlerts } from '@/lib/admin/monitoring'

type PeriodType = '7d' | '14d' | '30d' | '90d' | '12m'

const PERIOD_CONFIG: Record<PeriodType, { days: number; unit: 'day' | 'month' }> = {
    '7d': { days: 7, unit: 'day' },
    '14d': { days: 14, unit: 'day' },
    '30d': { days: 30, unit: 'day' },
    '90d': { days: 90, unit: 'day' },
    '12m': { days: 365, unit: 'month' },
}

function startOfDay(date: Date) {
    const value = new Date(date)
    value.setHours(0, 0, 0, 0)
    return value
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addUnit(date: Date, unit: 'day' | 'month', amount: number) {
    const value = new Date(date)
    if (unit === 'month') {
        value.setMonth(value.getMonth() + amount)
        return value
    }
    value.setDate(value.getDate() + amount)
    return value
}

function bucketKey(date: Date, unit: 'day' | 'month') {
    if (unit === 'month') {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    return date.toISOString().split('T')[0]
}

function bucketLabel(date: Date, unit: 'day' | 'month') {
    if (unit === 'month') {
        return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function buildBuckets(period: PeriodType) {
    const config = PERIOD_CONFIG[period]
    const now = new Date()
    const end = config.unit === 'month' ? startOfMonth(now) : startOfDay(now)
    const startBase = addUnit(end, config.unit, -(config.unit === 'month' ? 11 : config.days - 1))
    const start = config.unit === 'month' ? startOfMonth(startBase) : startOfDay(startBase)

    const buckets: Array<{ key: string; date: string; label: string }> = []
    for (let cursor = new Date(start); cursor <= end; cursor = addUnit(cursor, config.unit, 1)) {
        buckets.push({
            key: bucketKey(cursor, config.unit),
            date: cursor.toISOString(),
            label: bucketLabel(cursor, config.unit),
        })
    }

    return { config, start, buckets }
}

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    const { searchParams } = new URL(request.url)
    const requestedPeriod = (searchParams.get('period') || '30d') as PeriodType
    const period: PeriodType = PERIOD_CONFIG[requestedPeriod] ? requestedPeriod : '30d'
    const { config, start, buckets } = buildBuckets(period)
    const startIso = start.toISOString()

    try {
        const [paymentsResult, profilesResult, messagesResult, alerts] = await Promise.all([
            adminSupabase
                .from('payments')
                .select('created_at, payment_type, amount_fcfa')
                .eq('status', 'completed')
                .gte('created_at', startIso),
            adminSupabase
                .from('profiles')
                .select('created_at')
                .gte('created_at', startIso),
            adminSupabase
                .from('messages')
                .select('created_at')
                .gte('created_at', startIso),
            buildAdminAlerts(adminSupabase),
        ])

        if (paymentsResult.error) throw paymentsResult.error
        if (profilesResult.error) throw profilesResult.error
        if (messagesResult.error) throw messagesResult.error

        const revenueIndex = new Map(
            buckets.map((bucket) => [bucket.key, {
                date: bucket.date,
                label: bucket.label,
                platform_revenue: 0,
                merchant_revenue: 0,
                transaction_count: 0,
            }])
        )

        for (const payment of paymentsResult.data || []) {
            const date = new Date(payment.created_at)
            const key = bucketKey(config.unit === 'month' ? startOfMonth(date) : startOfDay(date), config.unit)
            const entry = revenueIndex.get(key)
            if (!entry) continue

            if (payment.payment_type === 'one_time') {
                entry.merchant_revenue += payment.amount_fcfa || 0
            } else {
                entry.platform_revenue += payment.amount_fcfa || 0
            }
            entry.transaction_count += 1
        }

        const userIndex = new Map(
            buckets.map((bucket) => [bucket.key, {
                date: bucket.date,
                label: bucket.label,
                new_users: 0,
            }])
        )

        for (const profile of profilesResult.data || []) {
            const date = new Date(profile.created_at)
            const key = bucketKey(config.unit === 'month' ? startOfMonth(date) : startOfDay(date), config.unit)
            const entry = userIndex.get(key)
            if (entry) entry.new_users += 1
        }

        const messageIndex = new Map(
            buckets.map((bucket) => [bucket.key, {
                day: bucket.label,
                total_messages: 0,
                date: bucket.date,
            }])
        )

        for (const message of messagesResult.data || []) {
            const date = new Date(message.created_at)
            const key = bucketKey(config.unit === 'month' ? startOfMonth(date) : startOfDay(date), config.unit)
            const entry = messageIndex.get(key)
            if (entry) entry.total_messages += 1
        }

        return successResponse({
            period,
            revenueSeries: Array.from(revenueIndex.values()),
            userSeries: Array.from(userIndex.values()),
            messageSeries: Array.from(messageIndex.values()),
            alerts,
        })
    } catch (err) {
        console.error('Admin Analytics API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
