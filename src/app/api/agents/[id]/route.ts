import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { normalizeAgentPaymentMode } from '@/lib/payments/payment-mode-display'
import { buildAgentDeactivationUpdate, buildAgentReactivationUpdate } from '@/lib/whatsapp/agent-lifecycle'
import { buildAccountLifecycleAccessState, getAccountLifecycleBlockMessage } from '@/lib/account-lifecycle'

function normalizeRestaurantDepositSettings(body: any) {
    const enabled = !!body.restaurant_deposit_enabled
    const rawMode = String(body.restaurant_deposit_mode ?? 'percentage').trim().toLowerCase()
    const depositMode = rawMode === 'fixed' ? 'fixed' : 'percentage'
    const rawPercentage = Number(body.restaurant_deposit_percentage ?? 0)
    const boundedPercentage = Number.isFinite(rawPercentage)
        ? Math.max(0, Math.min(100, rawPercentage))
        : 0
    const rawFixedAmount = Number(body.restaurant_deposit_fixed_amount_fcfa ?? 0)
    const boundedFixedAmount = Number.isFinite(rawFixedAmount)
        ? Math.max(0, Math.round(rawFixedAmount))
        : 0

    return {
        restaurant_deposit_enabled: enabled,
        restaurant_deposit_mode: enabled ? depositMode : 'percentage',
        restaurant_deposit_percentage: enabled && depositMode === 'percentage' ? boundedPercentage : 0,
        restaurant_deposit_fixed_amount_fcfa: enabled && depositMode === 'fixed' ? boundedFixedAmount : 0
    }
}

async function cleanupAgentDependencies(adminSupabase: ReturnType<typeof createAdminClient>, agentId: string) {
    // This table exists in production schema and can block agent deletion (FK restriction)
    const { error: outboundError } = await adminSupabase
        .from('outbound_messages')
        .delete()
        .eq('agent_id', agentId)

    if (outboundError && outboundError.code !== '42P01') {
        throw outboundError
    }

    // Current production schema uses session_id (key-value store)
    const { error: bySessionIdError } = await adminSupabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', agentId)

    if (!bySessionIdError) return

    // Legacy schema fallback uses agent_id
    if (bySessionIdError.code === '42703') {
        const { error: byAgentIdError } = await adminSupabase
            .from('whatsapp_sessions')
            .delete()
            .eq('agent_id', agentId)

        if (byAgentIdError && byAgentIdError.code !== '42P01' && byAgentIdError.code !== '42703') {
            throw byAgentIdError
        }
        return
    }

    if (bySessionIdError.code !== '42P01') {
        throw bySessionIdError
    }
}

// GET /api/agents/[id] - Get a single agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single()

    if (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Agent fetch failed:', error.message)
        }
        return errorResponse('Agent non trouve', 404)
    }

    return successResponse({ agent })
}

// PATCH /api/agents/[id] - Update an agent
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()

        // Only allow specific fields to be updated
        const allowedFields = [
            'name', 'description', 'system_prompt', 'personality',
            'model', 'temperature', 'max_tokens', 'use_emojis',
            'response_delay_seconds', 'language', 'is_active',
            'enable_voice_responses', 'voice_id',
            // New structured fields
            'business_address', 'business_hours', 'contact_phone',
            'social_links', 'custom_rules', 'agent_tone', 'agent_goal',
            // GPS
            'latitude', 'longitude',
            'is_online_only',
            // Payment settings
            'payment_mode', 'mobile_money_orange', 'mobile_money_mtn',
            'mobile_money_wave', 'custom_payment_methods', 'escalation_phone',
            'restaurant_deposit_enabled', 'restaurant_deposit_mode',
            'restaurant_deposit_percentage', 'restaurant_deposit_fixed_amount_fcfa',
            // Support Client
            'agent_context', 'welcome_message',
            // Leads
            'lead_collection_enabled', 'lead_redirect_message', 'lead_collect_fields',
            // Fallback contact
            'fallback_contact_message',
            // Live Query API
            'live_query_url', 'live_query_secret'
        ]

        const updates: Record<string, any> = {}
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field]
            }
        }

        if (Object.prototype.hasOwnProperty.call(updates, 'payment_mode')) {
            updates.payment_mode = normalizeAgentPaymentMode(updates.payment_mode)
        }

        const depositSettingsTouched = body.restaurant_deposit_enabled !== undefined
            || body.restaurant_deposit_mode !== undefined
            || body.restaurant_deposit_percentage !== undefined
            || body.restaurant_deposit_fixed_amount_fcfa !== undefined
        let currentAgent: any = null

        if (updates.is_active === true || depositSettingsTouched) {
            const { data } = await supabase
                .from('agents')
                .select(`
                    is_active,
                    whatsapp_connected,
                    whatsapp_status,
                    whatsapp_phone,
                    whatsapp_ever_connected,
                    restaurant_deposit_enabled,
                    restaurant_deposit_mode,
                    restaurant_deposit_percentage,
                    restaurant_deposit_fixed_amount_fcfa
                `)
                .eq('id', id)
                .eq('user_id', user!.id)
                .single()

            currentAgent = data
        }

        if (body.ecommerce_mode !== undefined) {
            return errorResponse("Le mode e-commerce ne peut pas etre modifie apres la creation de l'agent.", 400)
        }

        if (depositSettingsTouched) {
            Object.assign(updates, normalizeRestaurantDepositSettings({
                restaurant_deposit_enabled:
                    body.restaurant_deposit_enabled !== undefined
                        ? body.restaurant_deposit_enabled
                        : currentAgent?.restaurant_deposit_enabled,
                restaurant_deposit_mode:
                    body.restaurant_deposit_mode !== undefined
                        ? body.restaurant_deposit_mode
                        : currentAgent?.restaurant_deposit_mode,
                restaurant_deposit_percentage:
                    body.restaurant_deposit_percentage !== undefined
                        ? body.restaurant_deposit_percentage
                        : currentAgent?.restaurant_deposit_percentage,
                restaurant_deposit_fixed_amount_fcfa:
                    body.restaurant_deposit_fixed_amount_fcfa !== undefined
                        ? body.restaurant_deposit_fixed_amount_fcfa
                        : currentAgent?.restaurant_deposit_fixed_amount_fcfa
            }))
        }

        // Prevent bypassing plan limits by manually activating an agent
        if (updates.is_active === true) {
            if (currentAgent && !currentAgent.is_active) {
                Object.assign(updates, buildAgentReactivationUpdate(currentAgent))
                let { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('plan, paid_until, grace_until, test_account_cleanup_deadline, test_account_qualified_at')
                    .eq('id', user!.id)
                    .single()

                if (profileError?.code === '42703') {
                    const fallback = await supabase
                        .from('profiles')
                        .select('plan')
                        .eq('id', user!.id)
                        .single()

                    profile = fallback.data as any
                    profileError = fallback.error
                }

                if (profileError) {
                    return errorResponse('Impossible de verifier le statut du compte', 500)
                }

                const lifecycleAccess = buildAccountLifecycleAccessState({
                    paidUntil: (profile as any)?.paid_until || null,
                    graceUntil: (profile as any)?.grace_until || null,
                    testAccountCleanupDeadline: (profile as any)?.test_account_cleanup_deadline || null,
                    testAccountQualifiedAt: (profile as any)?.test_account_qualified_at || null,
                })

                const blockMessage = getAccountLifecycleBlockMessage(lifecycleAccess, 'agent_reactivation')
                if (blockMessage) {
                    return errorResponse(blockMessage, 403)
                }

                const { count: activeAgentCount } = await supabase
                    .from('agents')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user!.id)
                    .is('archived_at', null)
                    .eq('is_active', true)

                const { data: planData } = await supabase
                    .from('subscription_plans')
                    .select('max_agents')
                    .ilike('name', profile?.plan || 'free')
                    .single()

                const { PLANS } = await import('@/lib/plans')
                const fallbackLimit = (PLANS as any)[profile?.plan || 'free']?.agents ?? 1
                const limit: number = planData?.max_agents ?? fallbackLimit

                if (limit !== -1 && (activeAgentCount || 0) >= limit) {
                    return errorResponse(`Limite d'agents actifs atteinte pour votre plan (${limit} max)`, 403)
                }
            }
        }

        if (updates.is_active === false) {
            Object.assign(updates, buildAgentDeactivationUpdate())
        }

        const { data: agent, error } = await supabase
            .from('agents')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user!.id)
            .select()
            .single()

        if (error) {
            return errorResponse('Mise a jour echouee', 500)
        }

        return successResponse({ agent })
    } catch {
        return errorResponse('Donnees invalides', 400)
    }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const adminSupabase = createAdminClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { data: agent, error: fetchError } = await adminSupabase
        .from('agents')
        .select('id, user_id')
        .eq('id', id)
        .single()

    if (fetchError || !agent) {
        return errorResponse('Agent non trouve', 404)
    }

    if (agent.user_id !== user!.id) {
        return errorResponse('Acces refuse', 403)
    }

    try {
        await cleanupAgentDependencies(adminSupabase, id)
    } catch (cleanupError) {
        console.error('Agent dependency cleanup failed:', cleanupError)
        return errorResponse('Suppression echouee', 500)
    }

    const { error } = await adminSupabase
        .from('agents')
        .delete()
        .eq('id', id)

    if (error) {
        return errorResponse('Suppression echouee', 500)
    }

    return successResponse({ success: true })
}
