import { isAdminRole } from '@/lib/api-utils'
import { notifyAdmins } from '@/lib/notifications/admin-notify'
import { collectReconnectableAgentIds } from '@/lib/whatsapp/reactivation'
import { checkHostedPaymentStatus, normalizePaymentProvider } from '@/lib/payments/provider'
import { extractPaystackChannelInfo } from '@/lib/payments/paystack'
import { markUserAsQualified } from '@/lib/test-account'

export type PaymentRow = {
    id: string
    user_id: string
    status: string
    payment_type?: string | null
    provider_transaction_id?: string | null
    transaction_id?: string | null
    payment_provider?: string | null
    amount_fcfa?: number | null
    credits_purchased?: number | null
    provider_response?: unknown
    metadata?: unknown
    payment_channel?: string | null
    payment_channel_detail?: string | null
}

type SupabaseClientLike = any

type ProviderStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'

export type PaymentFinalizationState =
    | 'completed'
    | 'already_completed'
    | 'failed'
    | 'pending'
    | 'not_found'
    | 'forbidden'
    | 'provider_error'
    | 'error'

export type PaymentFinalizationResult = {
    ok: boolean
    state: PaymentFinalizationState
    payment: PaymentRow | null
    providerStatus: ProviderStatus
    creditsAdded: number
    newBalance: number | null
    planUpdated: boolean
    message: string
}

function parseMaybeJson(value: unknown): Record<string, any> | null {
    if (!value) return null
    if (typeof value === 'object') return value as Record<string, any>
    if (typeof value !== 'string') return null
    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

function normalizeProviderStatus(status: unknown): ProviderStatus {
    const value = String(status || '').toUpperCase()
    if (value === 'SUCCESS') return 'ACCEPTED'
    if (value === 'FAILED' || value === 'INSUFFICIENT_BALANCE') return 'REFUSED'
    if (value === 'EXPIRED') return 'CANCELLED'
    if (value === 'INITIATED') return 'PENDING'
    if (value === 'ACCEPTED') return 'ACCEPTED'
    if (value === 'REFUSED') return 'REFUSED'
    if (value === 'CANCELLED') return 'CANCELLED'
    if (value === 'PENDING') return 'PENDING'
    return 'UNKNOWN'
}

function inferPlanIdFromCredits(credits: number): string | null {
    if (credits >= 15000) return 'scale'
    if (credits >= 6000)  return 'business'
    if (credits >= 2000)  return 'pro'
    if (credits >= 500)   return 'starter'
    return null
}

function getMetadata(payment: PaymentRow) {
    const providerResponse = parseMaybeJson(payment.provider_response) || {}
    const rawMetadata = parseMaybeJson(payment.metadata) || {}
    return {
        providerResponse,
        metadata: providerResponse.metadata || rawMetadata || {},
    }
}

function buildPaymentProviderUpdate(payment: PaymentRow, providerPayload?: unknown) {
    const currentProviderResponse = parseMaybeJson(payment.provider_response) || {}
    const mergedProviderResponse = providerPayload
        ? { ...currentProviderResponse, last_verification_payload: providerPayload }
        : currentProviderResponse

    const update: Record<string, unknown> = {
        provider_response: mergedProviderResponse,
    }

    if (normalizePaymentProvider(payment.payment_provider) === 'paystack' && providerPayload) {
        const channelInfo = extractPaystackChannelInfo(providerPayload)
        if (channelInfo.paymentChannel) {
            update.payment_channel = channelInfo.paymentChannel
        }
        if (channelInfo.paymentChannelDetail) {
            update.payment_channel_detail = channelInfo.paymentChannelDetail
        }
    }

    return update
}

async function resolveCreditsToAdd(adminSupabase: SupabaseClientLike, payment: PaymentRow): Promise<number> {
    if (payment.credits_purchased && payment.credits_purchased > 0) {
        return payment.credits_purchased
    }

    const { providerResponse, metadata } = getMetadata(payment)

    const directCredits =
        Number(providerResponse?.credits || 0) ||
        Number(metadata?.credits || 0)

    if (directCredits > 0) {
        return directCredits
    }

    const packId = metadata?.pack_id
    if (packId) {
        const { data: pack } = await adminSupabase
            .from('credit_packs')
            .select('credits')
            .eq('id', packId)
            .maybeSingle()

        const packCredits = Number(pack?.credits || 0)
        if (packCredits > 0) {
            return packCredits
        }
    }

    return Math.max(0, Math.floor((payment.amount_fcfa || 0) / 10))
}

async function resolveSubscriptionPlan(adminSupabase: SupabaseClientLike, payment: PaymentRow) {
    const { metadata, providerResponse } = getMetadata(payment)
    const planId = String(metadata?.plan_id || providerResponse?.plan_id || '').trim()
    const planName = String(metadata?.plan_name || providerResponse?.plan_name || '').trim()

    if (planId) {
        const { data: byId } = await adminSupabase
            .from('subscription_plans')
            .select('id, name, credits_included, price_fcfa')
            .eq('id', planId)
            .maybeSingle()

        if (byId) return byId
    }

    if (planName) {
        const { data: byName } = await adminSupabase
            .from('subscription_plans')
            .select('id, name, credits_included, price_fcfa')
            .ilike('name', planName)
            .maybeSingle()

        if (byName) return byName
    }

    const fallbackCredits = await resolveCreditsToAdd(adminSupabase, payment)
    const inferredPlanId = inferPlanIdFromCredits(fallbackCredits)
    if (!inferredPlanId) return null

    const { data: inferredPlan } = await adminSupabase
        .from('subscription_plans')
        .select('id, name, credits_included, price_fcfa')
        .eq('id', inferredPlanId)
        .maybeSingle()

    return inferredPlan || null
}

export async function getUserRole(adminSupabase: SupabaseClientLike, userId: string): Promise<string | null> {
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

    return profile?.role || null
}

export async function canAccessPayment(
    adminSupabase: SupabaseClientLike,
    userId: string,
    payment: PaymentRow | null
): Promise<boolean> {
    if (!payment) return false
    const role = await getUserRole(adminSupabase, userId)
    return isAdminRole(role) || payment.user_id === userId
}

export async function findPaymentByIdentifiers(
    adminSupabase: SupabaseClientLike,
    identifiers: string[],
    select: string = '*'
): Promise<PaymentRow | null> {
    for (const raw of identifiers) {
        const identifier = String(raw || '').trim()
        if (!identifier) continue

        const { data: byId } = await adminSupabase
            .from('payments')
            .select(select)
            .eq('id', identifier)
            .maybeSingle()

        if (byId) return byId as PaymentRow

        const { data: byProviderTx } = await adminSupabase
            .from('payments')
            .select(select)
            .eq('provider_transaction_id', identifier)
            .maybeSingle()

        if (byProviderTx) return byProviderTx as PaymentRow

        const { data: byLegacyTx } = await adminSupabase
            .from('payments')
            .select(select)
            .eq('transaction_id', identifier)
            .maybeSingle()

        if (byLegacyTx) return byLegacyTx as PaymentRow
    }

    return null
}

export function getPaymentTransactionId(payment: PaymentRow, fallbacks: string[] = []): string | null {
    const candidates = [
        payment.provider_transaction_id,
        payment.transaction_id,
        ...fallbacks,
    ]
    for (const candidate of candidates) {
        const tx = String(candidate || '').trim()
        if (tx) return tx
    }
    return null
}

export async function finalizePaymentRecord(
    adminSupabase: SupabaseClientLike,
    payment: PaymentRow,
    providerStatusInput: unknown,
    providerPayload?: unknown
): Promise<PaymentFinalizationResult> {
    const providerStatus = normalizeProviderStatus(providerStatusInput)

    if (providerStatus === 'ACCEPTED') {
        if (payment.status === 'completed') {
            try {
                await markUserAsQualified(adminSupabase, payment.user_id)
            } catch (qualificationError) {
                console.error('Failed to clear test-account deadline for already completed payment:', qualificationError)
            }

            return {
                ok: true,
                state: 'already_completed',
                payment,
                providerStatus,
                creditsAdded: payment.credits_purchased || 0,
                newBalance: null,
                planUpdated: false,
                message: 'Paiement deja traite',
            }
        }

        const isSubscription = payment.payment_type === 'subscription' || getMetadata(payment).metadata?.type === 'subscription'
        let creditsAdded = 0
        let newBalance: number | null = null
        let planUpdated = false

        if (isSubscription) {
            const plan = await resolveSubscriptionPlan(adminSupabase, payment)
            if (!plan) {
                return {
                    ok: false,
                    state: 'error',
                    payment,
                    providerStatus,
                    creditsAdded: 0,
                    newBalance: null,
                    planUpdated: false,
                    message: 'Plan abonnement introuvable pour finalisation',
                }
            }

            const periodStart = new Date()
            const periodEnd = new Date()
            periodEnd.setMonth(periodEnd.getMonth() + 1)

            const { data: existingSub } = await adminSupabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', payment.user_id)
                .eq('status', 'active')
                .gte('current_period_end', new Date().toISOString())
                .maybeSingle()

            const planSlug = plan.name.toLowerCase()

            if (existingSub) {
                await adminSupabase
                    .from('subscriptions')
                    .update({
                        plan: planSlug,
                        status: 'active',
                        credits_included: plan.credits_included,
                        price_fcfa: plan.price_fcfa,
                        current_period_start: periodStart.toISOString(),
                        current_period_end: periodEnd.toISOString(),
                    })
                    .eq('id', existingSub.id)
            } else {
                await adminSupabase
                    .from('subscriptions')
                    .insert({
                        user_id: payment.user_id,
                        plan: planSlug,
                        status: 'active',
                        credits_included: plan.credits_included,
                        price_fcfa: plan.price_fcfa,
                        current_period_start: periodStart.toISOString(),
                        current_period_end: periodEnd.toISOString(),
                    })
            }

            // Determine new credits balance:
            // - Scale: rollover 20% of remaining + new credits + 2000 bonus
            // - Others: ADD if active sub, REPLACE if expired/first
            // Also unfreeze any frozen credits on renewal
            const { data: currentProfile } = await adminSupabase
                .from('profiles')
                .select('credits_balance, credits_frozen_at, credits_expire_at')
                .eq('id', payment.user_id)
                .single()

            const isCreditExpired = currentProfile?.credits_expire_at &&
                new Date(currentProfile.credits_expire_at) < new Date()
            const currentBalance = isCreditExpired ? 0 : (Number(currentProfile?.credits_balance) || 0)

            let newCreditsBalance: number
            let rolloverAmount = 0
            let bonusAmount = 0

            if (planSlug === 'scale') {
                // Scale : rollover 20% sur les crédits récupérés + bonus 2000
                rolloverAmount = Math.floor(currentBalance * 0.20)
                bonusAmount = 2000
                newCreditsBalance = currentBalance + rolloverAmount + plan.credits_included + bonusAmount
            } else {
                // Tous les autres plans : anciens crédits (si non expirés) + nouveaux crédits
                // currentBalance est déjà 0 si isCreditExpired = true
                newCreditsBalance = currentBalance + plan.credits_included
            }

            const { error: profileUpdateError } = await adminSupabase
                .from('profiles')
                .update({
                    plan: planSlug,
                    credits_balance: newCreditsBalance,
                    credits_used_this_month: 0,
                    credits_frozen_at: null,
                    credits_expire_at: null,
                    credits_high_usage_notified_at: null,
                })
                .eq('id', payment.user_id)

            if (profileUpdateError) {
                console.error('[finalization] Profile full update failed:', profileUpdateError.message, profileUpdateError.code)
                if (profileUpdateError.code === '42703') {
                    // Fallback 1: retry without optional columns
                    const { error: fb1Error } = await adminSupabase
                        .from('profiles')
                        .update({ plan: planSlug, credits_balance: newCreditsBalance, credits_used_this_month: 0 })
                        .eq('id', payment.user_id)
                    if (fb1Error) {
                        console.error('[finalization] Profile fallback-1 failed:', fb1Error.message, fb1Error.code)
                        if (fb1Error.code === '42703') {
                            // Fallback 2: absolute minimum — plan + credits only
                            const { error: fb2Error } = await adminSupabase
                                .from('profiles')
                                .update({ plan: planSlug, credits_balance: newCreditsBalance })
                                .eq('id', payment.user_id)
                            if (fb2Error) {
                                console.error('[finalization] Profile fallback-2 failed:', fb2Error.message)
                            }
                        }
                    }
                }
            }

            // Réactiver les agents désactivés selon la limite du nouveau plan
            const planAgentLimits: Record<string, number> = {
                free: 1, starter: 1, pro: 3, business: 6, scale: -1
            }
            const agentLimit = planAgentLimits[planSlug] ?? 1

            const { data: deactivatedAgents } = await adminSupabase
                .from('agents')
                .select('id, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone, whatsapp_ever_connected')
                .eq('user_id', payment.user_id)
                .not('archived_at', 'is', null)
                .order('whatsapp_connected', { ascending: false })
                .order('updated_at', { ascending: false })

            if (deactivatedAgents && deactivatedAgents.length > 0) {
                const toReactivate = agentLimit === -1
                    ? deactivatedAgents
                    : deactivatedAgents.slice(0, agentLimit)
                const reconnectableIds = collectReconnectableAgentIds(toReactivate)

                await adminSupabase
                    .from('agents')
                    .update({ is_active: true, archived_at: null, archived_reason: null })
                    .in('id', toReactivate.map((a: any) => a.id))

                if (reconnectableIds.length > 0) {
                    await adminSupabase
                        .from('agents')
                        .update({
                            whatsapp_connected: false,
                            whatsapp_status: 'connecting',
                            whatsapp_qr_code: null,
                            whatsapp_disconnected_by: null,
                        })
                        .in('id', reconnectableIds)
                }
            }

            // Notify Scale users of their rollover bonus
            if (planSlug === 'scale' && rolloverAmount > 0) {
                const { notify: notifyUser } = await import('@/lib/notifications/notification.service')
                notifyUser(payment.user_id, 'scale_renewal_bonus', {
                    rolloverAmount,
                    bonusAmount,
                    balance: newCreditsBalance
                }).catch(() => {})
            }

            creditsAdded = Number(plan.credits_included || 0)
            planUpdated = true
        } else {
            creditsAdded = await resolveCreditsToAdd(adminSupabase, payment)
            if (creditsAdded > 0 && payment.user_id) {
                const { data: creditResult, error: creditError } = await adminSupabase.rpc('add_credits', {
                    p_user_id: payment.user_id,
                    p_amount: creditsAdded,
                })

                if (creditError) {
                    console.error('add_credits error:', creditError)
                    return {
                        ok: false,
                        state: 'error',
                        payment,
                        providerStatus,
                        creditsAdded: 0,
                        newBalance: null,
                        planUpdated: false,
                        message: 'Echec ajout credits',
                    }
                }

                newBalance = typeof creditResult === 'number' ? creditResult : null
            }
        }

        const { error: updatePaymentError } = await adminSupabase
            .from('payments')
            .update({
                status: 'completed',
                credits_purchased: creditsAdded > 0 ? creditsAdded : payment.credits_purchased,
                completed_at: new Date().toISOString(),
                ...buildPaymentProviderUpdate(payment, providerPayload),
            })
            .eq('id', payment.id)

        if (updatePaymentError) {
            console.error('Failed to update payment:', updatePaymentError)
            return {
                ok: false,
                state: 'error',
                payment,
                providerStatus,
                creditsAdded: 0,
                newBalance: null,
                planUpdated: false,
                message: 'Echec mise a jour paiement',
            }
        }

        try {
            await markUserAsQualified(adminSupabase, payment.user_id)
        } catch (qualificationError) {
            console.error('Failed to clear test-account deadline after payment:', qualificationError)
        }

        // Notify admins of successful payment
        notifyAdmins('payment_received', {
            userId: payment.user_id,
            paymentAmount: payment.amount_fcfa || 0,
            planName: planUpdated ? (getMetadata(payment).metadata?.plan_name || '') : undefined,
            creditsAdded,
        }).catch(() => {})

        return {
            ok: true,
            state: 'completed',
            payment: {
                ...payment,
                status: 'completed',
                credits_purchased: creditsAdded > 0 ? creditsAdded : payment.credits_purchased,
            },
            providerStatus,
            creditsAdded,
            newBalance,
            planUpdated,
            message: 'Paiement finalise',
        }
    }

    if (providerStatus === 'REFUSED' || providerStatus === 'CANCELLED') {
        if (payment.status !== 'failed') {
            await adminSupabase
                .from('payments')
                .update({
                    status: 'failed',
                    ...buildPaymentProviderUpdate(payment, providerPayload),
                })
                .eq('id', payment.id)

            // Notify admins of failed payment
            notifyAdmins('payment_failed', {
                userId: payment.user_id,
                paymentAmount: payment.amount_fcfa || 0,
            }).catch(() => {})
        }

        return {
            ok: true,
            state: 'failed',
            payment: { ...payment, status: 'failed' },
            providerStatus,
            creditsAdded: 0,
            newBalance: null,
            planUpdated: false,
            message: 'Paiement refuse ou annule',
        }
    }

    return {
        ok: true,
        state: 'pending',
        payment,
        providerStatus,
        creditsAdded: 0,
        newBalance: null,
        planUpdated: false,
        message: 'Paiement en attente',
    }
}

export async function finalizePaymentByTransaction(
    adminSupabase: SupabaseClientLike,
    transactionId: string,
    providerStatusInput?: unknown,
    providerPayload?: unknown
): Promise<PaymentFinalizationResult> {
    const payment = await findPaymentByIdentifiers(adminSupabase, [transactionId], '*')
    if (!payment) {
        return {
            ok: false,
            state: 'not_found',
            payment: null,
            providerStatus: 'UNKNOWN',
            creditsAdded: 0,
            newBalance: null,
            planUpdated: false,
            message: 'Paiement introuvable',
        }
    }

    let providerStatus = normalizeProviderStatus(providerStatusInput)
    if (!providerStatusInput) {
        const providerResult = await checkHostedPaymentStatus(
            normalizePaymentProvider(payment.payment_provider),
            transactionId
        )
        if (!providerResult.success) {
            return {
                ok: false,
                state: 'provider_error',
                payment,
                providerStatus: 'UNKNOWN',
                creditsAdded: 0,
                newBalance: null,
                planUpdated: false,
                message: providerResult.message || 'Echec verification provider',
            }
        }
        providerStatus = normalizeProviderStatus(providerResult.status)
        providerPayload = providerPayload || providerResult.raw || providerResult
    }

    return finalizePaymentRecord(adminSupabase, payment, providerStatus, providerPayload)
}
