import { createClient } from '@supabase/supabase-js'
import { notify } from '../notification.service'
import nodemailer from 'nodemailer'
import { buildAgentDeactivationUpdate } from '@/lib/whatsapp/agent-lifecycle'
import { ACCOUNT_PAID_GRACE_DAYS, resolveGraceUntilFromPaidUntil } from '@/lib/account-lifecycle'
import {
    buildSystemDeletionAuditEntry,
    recordSystemDeletionAuditEntry,
} from '@/lib/notifications/system-deletion-audit'

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function logCronRun(taskKey: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now()
    const supabase = getAdminSupabase()
    try {
        await fn()
        await supabase.from('cron_run_logs').insert({
            task_key: taskKey,
            status: 'success',
            duration_ms: Date.now() - start
        })
    } catch (err: any) {
        await supabase.from('cron_run_logs').insert({
            task_key: taskKey,
            status: 'error',
            duration_ms: Date.now() - start,
            error_message: err?.message || String(err)
        })
    }
}

function getMailTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.wazzapai.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true,
        auth: {
            user: process.env.SMTP_USER || process.env.SMTP_FROM,
            pass: process.env.SMTP_PASSWORD
        }
    })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim()
    }

    try {
        return JSON.stringify(error)
    } catch {
        return 'unknown_error'
    }
}

function buildEmptyDeletionSnapshot() {
    return {
        capturedAt: new Date().toISOString(),
        relatedCounts: {
            agents: 0,
            whatsapp_sessions: 0,
            conversations: 0,
            messages: 0,
            knowledge_base: 0,
            products: 0,
            subscriptions: 0,
            payments: 0,
            orders: 0,
        },
    }
}

async function persistSystemDeletionAudit(
    supabase: ReturnType<typeof getAdminSupabase>,
    payload: Parameters<typeof buildSystemDeletionAuditEntry>[0]
) {
    try {
        const entry = buildSystemDeletionAuditEntry(payload)
        await recordSystemDeletionAuditEntry(supabase, entry)
    } catch (auditError) {
        console.error('[CRON] Failed to persist system deletion audit log:', auditError)
    }
}

async function updateProfileFreezeState(
    supabase: ReturnType<typeof getAdminSupabase>,
    userId: string,
    payload: Record<string, unknown>
) {
    let { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)

    if (error?.code === '42703') {
        const fallbackPayload = { ...payload }
        delete fallbackPayload.grace_until
        delete fallbackPayload.account_lifecycle_status

        ;({ error } = await supabase
            .from('profiles')
            .update(fallbackPayload)
            .eq('id', userId))
    }

    if (error?.code === '42703') {
        const legacyPayload = { ...payload }
        delete legacyPayload.grace_until
        delete legacyPayload.account_lifecycle_status
        delete legacyPayload.credits_frozen_at
        delete legacyPayload.credits_expire_at

        ;({ error } = await supabase
            .from('profiles')
            .update(legacyPayload)
            .eq('id', userId))
    }

    return error
}

async function freezePaidLifecycleForUser(
    supabase: ReturnType<typeof getAdminSupabase>,
    userId: string,
    paidUntilInput?: string | null
) {
    let profileQuery = await supabase
        .from('profiles')
        .select('plan, credits_balance, paid_until, grace_until, account_lifecycle_status')
        .eq('id', userId)
        .single()

    if (profileQuery.error?.code === '42703') {
        profileQuery = await supabase
            .from('profiles')
            .select('plan, credits_balance, paid_until, grace_until')
            .eq('id', userId)
            .single()
    }

    if (profileQuery.error?.code === '42703') {
        profileQuery = await supabase
            .from('profiles')
            .select('plan, credits_balance')
            .eq('id', userId)
            .single()
    }

    if (profileQuery.error) {
        throw profileQuery.error
    }

    const profile = profileQuery.data || {}
    const currentStatus = String((profile as any).account_lifecycle_status || '').trim().toLowerCase()
    const currentGraceUntil = String((profile as any).grace_until || '').trim()
    const nowMs = Date.now()

    if (currentStatus === 'frozen_grace' && currentGraceUntil) {
        const currentGraceMs = new Date(currentGraceUntil).getTime()
        if (Number.isFinite(currentGraceMs) && currentGraceMs > nowMs) {
            return {
                frozen: false,
                graceUntil: currentGraceUntil,
            }
        }
    }

    const freezeDate = new Date(nowMs)
    const paidUntil = paidUntilInput || (profile as any).paid_until || freezeDate.toISOString()
    const graceUntil = resolveGraceUntilFromPaidUntil(paidUntil, nowMs, ACCOUNT_PAID_GRACE_DAYS)
    const currentBalance = Number((profile as any).credits_balance || 0)

    const profileUpdateError = await updateProfileFreezeState(supabase, userId, {
        plan: 'free',
        credits_frozen_at: freezeDate.toISOString(),
        credits_expire_at: graceUntil,
        grace_until: graceUntil,
        account_lifecycle_status: 'frozen_grace',
    })

    if (profileUpdateError) {
        throw profileUpdateError
    }

    if (currentBalance > 0) {
        await notify(userId, 'credits_freeze_warning', {
            balance: currentBalance,
            creditExpireDate: new Date(graceUntil).toLocaleDateString('fr-FR')
        })
    }

    const { data: userAgents } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .is('archived_at', null)

    if (userAgents && userAgents.length > 0) {
        const toDeactivate = userAgents.map((agent: any) => agent.id)
        await supabase
            .from('agents')
            .update({
                archived_at: freezeDate.toISOString(),
                archived_reason: 'payment_window_expired',
                ...buildAgentDeactivationUpdate(),
            })
            .in('id', toDeactivate)

        await notify(userId, 'agent_archived', {
            count: toDeactivate.length,
            deleteDate: new Date(graceUntil).toLocaleDateString('fr-FR')
        })
    }

    return {
        frozen: true,
        graceUntil,
    }
}

/**
 * Check for expiring subscriptions and notify users.
 * Runs daily at 8:00 AM (Africa/Abidjan timezone).
 */

export {
    getAdminSupabase,
    logCronRun,
    getMailTransporter,
    APP_URL,
    toErrorMessage,
    buildEmptyDeletionSnapshot,
    persistSystemDeletionAudit,
    updateProfileFreezeState,
    freezePaidLifecycleForUser,
}
