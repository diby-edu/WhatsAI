import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import {
    calculateMrrMetrics,
    calculatePlatformRevenue,
    calculateChurnedMrr,
    calculateSaasMetrics,
    calculateAgentActivationRate,
} from '@/lib/services/admin-dashboard-metrics'

export async function GET(request: NextRequest) {
    const { adminSupabase: db, response } = await requireAdminAccess()
    if (response || !db) return response!

    try {
        const now = new Date()
        const today = new Date(now); today.setHours(0, 0, 0, 0)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
        const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7)
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

        // ── Utilisateurs ──────────────────────────────────────────────────
        const [
            { count: totalUsers },
            { count: newUsersToday },
            { count: newUsersYesterday },
            { count: activeUsers },
        ] = await Promise.all([
            db.from('profiles').select('*', { count: 'exact', head: true }),
            db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
            db.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', new Date(now.getTime() - 30 * 86400000).toISOString()),
        ])

        // ── Abonnés actifs & statuts ───────────────────────────────────────
        const [
            { count: activeSubscribers },
            { count: inGracePeriod },
            { count: expiringIn7Days },
            { count: trialAccounts },
        ] = await Promise.all([
            db.from('profiles').select('*', { count: 'exact', head: true }).eq('account_lifecycle_status', 'paid_active'),
            db.from('profiles').select('*', { count: 'exact', head: true }).eq('account_lifecycle_status', 'frozen_grace'),
            db.from('profiles').select('*', { count: 'exact', head: true })
                .eq('account_lifecycle_status', 'paid_active')
                .lte('paid_until', in7Days.toISOString())
                .gte('paid_until', now.toISOString()),
            db.from('profiles').select('*', { count: 'exact', head: true })
                .is('test_account_qualified_at', null)
                .not('role', 'in', '("admin","superadmin")'),
        ])

        // ── Revenue: MRR (abonnements seulement) ──────────────────────────
        const [
            { data: subPaymentsThisMonth },
            { data: subPaymentsLastMonth },
            { data: allSubPaymentsBeforeMonth },
        ] = await Promise.all([
            db.from('payments').select('user_id, amount_fcfa, payment_method_source')
                .eq('status', 'completed').eq('payment_type', 'subscription')
                .gte('completed_at', monthStart.toISOString()),
            db.from('payments').select('amount_fcfa')
                .eq('status', 'completed').eq('payment_type', 'subscription')
                .gte('completed_at', lastMonthStart.toISOString())
                .lte('completed_at', lastMonthEnd.toISOString()),
            db.from('payments').select('user_id')
                .eq('status', 'completed').eq('payment_type', 'subscription')
                .lt('completed_at', monthStart.toISOString()),
        ])

        const { mrr, mrrLastMonth, mrrGrowth, newMrr, newSubPayments } = calculateMrrMetrics({
            subPaymentsThisMonth,
            subPaymentsLastMonth,
            allSubPaymentsBeforeMonth,
        })

        // Revenue auto vs manuel (abonnements + crédits ce mois)
        const { data: allPlatformPayments } = await db.from('payments').select('amount_fcfa, payment_method_source, payment_type')
            .eq('status', 'completed').in('payment_type', ['subscription', 'credits'])
            .gte('completed_at', monthStart.toISOString())
        const { platformRevenue, revenueAutomatic, revenueManual } = calculatePlatformRevenue(allPlatformPayments)

        // Merchant revenue
        const { data: orderPayments } = await db.from('payments').select('amount_fcfa')
            .eq('status', 'completed').eq('payment_type', 'one_time').gte('completed_at', monthStart.toISOString())
        const merchantRevenue = orderPayments?.reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0

        // ── Churned MRR : abonnés qui ont expiré ce mois sans renouveler ──
        let churnedMrr = 0
        let churnedCount = 0
        try {
            const { data: churnedProfiles } = await db.from('profiles')
                .select('plan, account_lifecycle_status')
                .in('account_lifecycle_status', ['frozen_grace', 'inactive'])
                .gte('paid_until', lastMonthStart.toISOString())
                .lte('paid_until', now.toISOString())
            const churned = calculateChurnedMrr(churnedProfiles)
            churnedMrr = churned.churnedMrr
            churnedCount = churned.churnedCount
        } catch { }

        // ── Churn rate & LTV ─────────────────────────────────────────────
        const { churnRate, arpu, ltv } = calculateSaasMetrics({
            activeSubscribers: activeSubscribers || 0,
            churnedCount,
            mrr,
        })

        // Trial → Paid conversion rate
        const { count: qualifiedUsers } = await db.from('profiles')
            .select('*', { count: 'exact', head: true })
            .not('test_account_qualified_at', 'is', null)
        const trialToPaidRate = (totalUsers || 0) > 0
            ? parseFloat(((qualifiedUsers || 0) / (totalUsers || 1) * 100).toFixed(1))
            : 0

        // ── Agent activation rate ──────────────────────────────────────────
        let agentActivationRate = 0
        try {
            const { data: connectedAgentUserIds } = await db.from('agents')
                .select('user_id').eq('whatsapp_connected', true)
            const { data: payingProfiles } = await db.from('profiles')
                .select('id').eq('account_lifecycle_status', 'paid_active')
            agentActivationRate = calculateAgentActivationRate({ connectedAgentUserIds, payingProfiles })
        } catch { }

        // ── Agents ────────────────────────────────────────────────────────
        const [{ count: totalAgents }, { count: connectedAgents }] = await Promise.all([
            db.from('agents').select('*', { count: 'exact', head: true }),
            db.from('agents').select('*', { count: 'exact', head: true }).eq('whatsapp_connected', true),
        ])

        // Active agents (activity last 7 days)
        let activeAgents = 0
        try {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
            const { data: agentIds } = await db.from('messages').select('agent_id').gte('created_at', sevenDaysAgo.toISOString())
            activeAgents = new Set(agentIds?.map(m => m.agent_id) || []).size
        } catch { }

        // ── Messages & conversations ───────────────────────────────────────
        let totalMessages = 0, messagesToday = 0, totalConversations = 0, conversationsToday = 0
        try {
            const [{ count: mc }, { count: mt }, { count: cc }, { count: ct }] = await Promise.all([
                db.from('messages').select('*', { count: 'exact', head: true }),
                db.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
                db.from('conversations').select('*', { count: 'exact', head: true }),
                db.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
            ])
            totalMessages = mc || 0; messagesToday = mt || 0
            totalConversations = cc || 0; conversationsToday = ct || 0
        } catch { }

        // ── Leads ce mois ─────────────────────────────────────────────────
        let leadsThisMonth = 0
        try {
            const { count: lc } = await db.from('leads').select('*', { count: 'exact', head: true })
                .gte('created_at', monthStart.toISOString())
            leadsThisMonth = lc || 0
        } catch { }

        // ── Crédits ───────────────────────────────────────────────────────
        let totalCreditsUsed = 0
        try {
            const { data: profiles } = await db.from('profiles').select('credits_used_this_month')
            totalCreditsUsed = profiles?.reduce((s, p) => s + (p.credits_used_this_month || 0), 0) || 0
        } catch { }

        // ── Commandes ─────────────────────────────────────────────────────
        let totalOrders = 0, pendingOrders = 0
        try {
            const [{ count: oc }, { count: pc }] = await Promise.all([
                db.from('orders').select('*', { count: 'exact', head: true }),
                db.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            ])
            totalOrders = oc || 0; pendingOrders = pc || 0
        } catch { }

        // ── Derniers inscrits ─────────────────────────────────────────────
        const { data: recentUsers } = await db.from('profiles')
            .select('id, full_name, email, created_at, plan, account_lifecycle_status')
            .order('created_at', { ascending: false }).limit(6)

        // ── Derived ───────────────────────────────────────────────────────
        const userGrowth = (newUsersYesterday || 0) > 0
            ? Math.round((((newUsersToday || 0) - (newUsersYesterday || 0)) / (newUsersYesterday || 1)) * 100)
            : 0
        const avgMessagesPerAgent = (totalAgents || 0) > 0 ? Math.round(totalMessages / (totalAgents || 1)) : 0
        const newPaidThisMonth = newSubPayments.length
        const conversionRate = (totalUsers || 0) > 0 ? Math.round(((qualifiedUsers || 0) / (totalUsers || 1)) * 100) : 0

        return successResponse({
            stats: {
                // Utilisateurs
                totalUsers: totalUsers || 0,
                newUsersToday: newUsersToday || 0,
                newUsersYesterday: newUsersYesterday || 0,
                activeUsers: activeUsers || 0,
                userGrowth,
                // Abonnés & lifecycle
                activeSubscribers: activeSubscribers || 0,
                inGracePeriod: inGracePeriod || 0,
                expiringIn7Days: expiringIn7Days || 0,
                trialAccounts: trialAccounts || 0,
                // MRR & finances
                mrr,
                mrrLastMonth,
                mrrGrowth,
                newMrr,
                churnedMrr,
                platformRevenue,
                revenueAutomatic,
                revenueManual,
                merchantRevenue,
                // Métriques SaaS
                arpu,
                ltv,
                churnRate,
                churnedCount,
                trialToPaidRate,
                conversionRate,
                newPaidThisMonth,
                // Agents
                totalAgents: totalAgents || 0,
                connectedAgents: connectedAgents || 0,
                activeAgents,
                agentActivationRate,
                // Engagement
                totalMessages,
                messagesToday,
                totalConversations,
                conversationsToday,
                leadsThisMonth,
                totalCreditsUsed,
                avgMessagesPerAgent,
                // Commandes
                totalOrders,
                pendingOrders,
            },
            recentUsers: recentUsers || []
        })

    } catch (err) {
        console.error('Admin dashboard API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
