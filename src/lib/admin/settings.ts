import type { SupabaseClient } from '@supabase/supabase-js'
import { resumeActiveConversationsForAgents } from '@/lib/conversations/resume-agent-conversations'
import { collectReconnectableAgentIds } from '@/lib/whatsapp/reactivation'

export const DEFAULT_ADMIN_SETTINGS = {
    appName: 'WazzapAI',
    appDescription: "Plateforme d'automatisation WhatsApp avec IA",
    maintenanceMode: false,
    allowRegistrations: true,
    defaultCredits: 100,
    openaiModel: 'gpt-4o-mini',
    maxTokensPerMessage: 500,
    temperatureDefault: 0.7,
    maxAgentsFree: 1,
    maxAgentsStarter: 1,
    maxAgentsPro: 3,
    maxAgentsBusiness: 6,
    cinetpayMode: 'sandbox',
    cinetpaySiteId: '********',
    defaultPaymentProvider: 'cinetpay',
    currency: 'XOF',
    defaultCommissionRate: 10,
    emailNotifications: true,
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 465,
    smtpUser: 'support@wazzapai.com',
    smtpPassword: '',
    smtpSecure: true,
    sessionTimeout: 0,
    maxLoginAttempts: 5,
    requireEmailVerification: false,
    enable2FA: false,
    logLevel: 'info',
    enableMetrics: true,
    apiRateLimit: 100,
}

const UI_TO_DB_KEY: Record<string, string> = {
    defaultCommissionRate: 'default_commission_rate',
}

const DB_TO_UI_KEY = Object.fromEntries(
    Object.entries(UI_TO_DB_KEY).map(([uiKey, dbKey]) => [dbKey, uiKey])
)

const FEATURE_FLAG_KEYS = {
    maintenanceMode: 'maintenance_mode',
    allowRegistrations: 'registrations_open',
} as const

const PLAN_LIMIT_KEYS = {
    maxAgentsFree: 'free',
    maxAgentsStarter: 'starter',
    maxAgentsPro: 'pro',
    maxAgentsBusiness: 'business',
} as const

const FEATURE_SETTING_KEYS = new Set(Object.keys(FEATURE_FLAG_KEYS))
const PLAN_LIMIT_SETTING_KEYS = new Set(Object.keys(PLAN_LIMIT_KEYS))

function cloneDefaultSettings() {
    return { ...DEFAULT_ADMIN_SETTINGS }
}

function getDbKeyFromUiKey(key: string): string {
    return UI_TO_DB_KEY[key] || key
}

function getUiKeyFromDbKey(key: string): string {
    return DB_TO_UI_KEY[key] || key
}

function normalizePlanName(name: string | null | undefined): string | null {
    const normalized = (name || '').trim().toLowerCase()

    if (!normalized) return null
    if (normalized === 'gratuit' || normalized === 'free') return 'free'
    if (normalized === 'starter') return 'starter'
    if (normalized === 'pro') return 'pro'
    if (normalized === 'business') return 'business'
    if (normalized === 'scale') return 'scale'
    return null
}

function coerceSettingValue(key: string, value: any) {
    const defaultValue = (DEFAULT_ADMIN_SETTINGS as Record<string, any>)[key]

    if (defaultValue === undefined || value === null || value === undefined) {
        return value
    }

    if (typeof defaultValue === 'number') {
        const parsed = typeof value === 'number' ? value : Number(value)
        return Number.isFinite(parsed) ? parsed : defaultValue
    }

    if (typeof defaultValue === 'boolean') {
        if (typeof value === 'boolean') return value
        if (value === 'true') return true
        if (value === 'false') return false
        return Boolean(value)
    }

    return value
}

async function fetchAppSettingsRows(adminSupabase: SupabaseClient, keys?: string[]) {
    let query = adminSupabase.from('app_settings').select('key, value')
    if (keys && keys.length > 0) {
        query = query.in('key', keys)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
}

async function upsertAppSetting(adminSupabase: SupabaseClient, userId: string, key: string, value: any) {
    const { error } = await adminSupabase
        .from('app_settings')
        .upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
            updated_by: userId,
        }, { onConflict: 'key' })

    if (error) throw error
}

export async function loadAdminSettings(adminSupabase: SupabaseClient) {
    const [appRows, featureRows, planRows] = await Promise.all([
        fetchAppSettingsRows(adminSupabase),
        adminSupabase
            .from('feature_flags')
            .select('key, enabled')
            .in('key', Object.values(FEATURE_FLAG_KEYS)),
        adminSupabase
            .from('subscription_plans')
            .select('name, max_agents')
            .eq('is_active', true),
    ])

    const settings = cloneDefaultSettings() as Record<string, any>

    for (const row of appRows) {
        const uiKey = getUiKeyFromDbKey(row.key)
        if (uiKey in settings) {
            settings[uiKey] = coerceSettingValue(uiKey, row.value)
        }
    }

    for (const flag of featureRows.data || []) {
        const uiKey = Object.entries(FEATURE_FLAG_KEYS).find(([, value]) => value === flag.key)?.[0]
        if (uiKey) {
            settings[uiKey] = flag.enabled === true
        }
    }

    for (const plan of planRows.data || []) {
        const normalizedPlan = normalizePlanName(plan.name)
        if (normalizedPlan === 'free') settings.maxAgentsFree = plan.max_agents ?? settings.maxAgentsFree
        if (normalizedPlan === 'starter') settings.maxAgentsStarter = plan.max_agents ?? settings.maxAgentsStarter
        if (normalizedPlan === 'pro') settings.maxAgentsPro = plan.max_agents ?? settings.maxAgentsPro
        if (normalizedPlan === 'business') settings.maxAgentsBusiness = plan.max_agents ?? settings.maxAgentsBusiness
    }

    return settings
}

export async function getAIRuntimeSettings(adminSupabase: SupabaseClient) {
    const rows = await fetchAppSettingsRows(adminSupabase, [
        'openaiModel',
        'maxTokensPerMessage',
        'temperatureDefault',
    ])

    const settings = {
        openaiModel: DEFAULT_ADMIN_SETTINGS.openaiModel,
        maxTokensPerMessage: DEFAULT_ADMIN_SETTINGS.maxTokensPerMessage,
        temperatureDefault: DEFAULT_ADMIN_SETTINGS.temperatureDefault,
    }

    for (const row of rows) {
        const uiKey = getUiKeyFromDbKey(row.key)
        if (uiKey in settings) {
            ;(settings as Record<string, any>)[uiKey] = coerceSettingValue(uiKey, row.value)
        }
    }

    return settings
}

export async function getPublicRuntimeConfig(adminSupabase: SupabaseClient) {
    const [featureRows, appRows] = await Promise.all([
        adminSupabase
            .from('feature_flags')
            .select('key, enabled')
            .in('key', Object.values(FEATURE_FLAG_KEYS)),
        fetchAppSettingsRows(adminSupabase, ['requireEmailVerification', 'sessionTimeout', 'maxLoginAttempts']),
    ])

    const result = {
        maintenanceMode: DEFAULT_ADMIN_SETTINGS.maintenanceMode,
        allowRegistrations: DEFAULT_ADMIN_SETTINGS.allowRegistrations,
        requireEmailVerification: DEFAULT_ADMIN_SETTINGS.requireEmailVerification,
        sessionTimeout: DEFAULT_ADMIN_SETTINGS.sessionTimeout,
        maxLoginAttempts: DEFAULT_ADMIN_SETTINGS.maxLoginAttempts,
    }

    for (const flag of featureRows.data || []) {
        const uiKey = Object.entries(FEATURE_FLAG_KEYS).find(([, value]) => value === flag.key)?.[0]
        if (uiKey && uiKey in result) {
            ;(result as Record<string, any>)[uiKey] = flag.enabled === true
        }
    }

    for (const row of appRows) {
        const uiKey = getUiKeyFromDbKey(row.key)
        if (uiKey in result) {
            ;(result as Record<string, any>)[uiKey] = coerceSettingValue(uiKey, row.value)
        }
    }

    return result
}

export async function setMaintenanceMode(adminSupabase: SupabaseClient, userId: string, enabled: boolean) {
    if (enabled) {
        const { data: activeAgents, error: agentsError } = await adminSupabase
            .from('agents')
            .select('id')
            .eq('is_active', true)

        if (agentsError) throw agentsError

        const agentIds = (activeAgents || []).map((agent: any) => agent.id)

        await upsertAppSetting(adminSupabase, userId, 'maintenance_paused_agents', { ids: agentIds })

        if (agentIds.length > 0) {
            const { error: updateError } = await adminSupabase
                .from('agents')
                .update({ is_active: false })
                .in('id', agentIds)

            if (updateError) throw updateError
        }

        const { error: flagError } = await adminSupabase
            .from('feature_flags')
            .upsert({
                key: FEATURE_FLAG_KEYS.maintenanceMode,
                enabled: true,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' })

        if (flagError) throw flagError

        return { affectedAgents: agentIds.length }
    }

    const storedRows = await fetchAppSettingsRows(adminSupabase, ['maintenance_paused_agents'])
    const storedValue = storedRows.find((row) => row.key === 'maintenance_paused_agents')?.value as { ids?: string[] } | undefined
    const ids = Array.isArray(storedValue?.ids) ? storedValue.ids : []

    if (ids.length > 0) {
        const { data: pausedAgents } = await adminSupabase
            .from('agents')
            .select('id, is_active, whatsapp_connected, whatsapp_status')
            .in('id', ids)

        const reconnectableIds = collectReconnectableAgentIds(pausedAgents || [])

        const { error: updateError } = await adminSupabase
            .from('agents')
            .update({ is_active: true })
            .in('id', ids)

        if (updateError) throw updateError

        if (reconnectableIds.length > 0) {
            const { error: reconnectError } = await adminSupabase
                .from('agents')
                .update({ whatsapp_status: 'connecting' })
                .in('id', reconnectableIds)

            if (reconnectError) throw reconnectError
        }

        await resumeActiveConversationsForAgents(adminSupabase, ids)
    }

    await upsertAppSetting(adminSupabase, userId, 'maintenance_paused_agents', { ids: [] })

    const { error: flagError } = await adminSupabase
        .from('feature_flags')
        .upsert({
            key: FEATURE_FLAG_KEYS.maintenanceMode,
            enabled: false,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

    if (flagError) throw flagError

    return { affectedAgents: ids.length }
}

export async function saveAdminSettings(
    adminSupabase: SupabaseClient,
    userId: string,
    updates: Record<string, any>
) {
    const current = await loadAdminSettings(adminSupabase)
    const updatedKeys: string[] = []

    const appSettingsToSave = Object.entries(updates)
        .filter(([key]) => !FEATURE_SETTING_KEYS.has(key) && !PLAN_LIMIT_SETTING_KEYS.has(key))
        .filter(([key]) => key in DEFAULT_ADMIN_SETTINGS || key in UI_TO_DB_KEY)

    for (const [uiKey, value] of appSettingsToSave) {
        const dbKey = getDbKeyFromUiKey(uiKey)
        await upsertAppSetting(adminSupabase, userId, dbKey, value)
        updatedKeys.push(uiKey)
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'allowRegistrations')) {
        const { error } = await adminSupabase
            .from('feature_flags')
            .upsert({
                key: FEATURE_FLAG_KEYS.allowRegistrations,
                enabled: updates.allowRegistrations === true,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' })

        if (error) throw error
        updatedKeys.push('allowRegistrations')
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'maintenanceMode') && updates.maintenanceMode !== current.maintenanceMode) {
        await setMaintenanceMode(adminSupabase, userId, updates.maintenanceMode === true)
        updatedKeys.push('maintenanceMode')
    }

    const { data: plans, error: plansError } = await adminSupabase
        .from('subscription_plans')
        .select('id, name')
        .eq('is_active', true)

    if (plansError) throw plansError

    for (const [settingKey, targetPlan] of Object.entries(PLAN_LIMIT_KEYS)) {
        if (!Object.prototype.hasOwnProperty.call(updates, settingKey)) continue
        const plan = (plans || []).find((item: any) => normalizePlanName(item.name) === targetPlan)
        if (!plan) continue

        const { error } = await adminSupabase
            .from('subscription_plans')
            .update({ max_agents: updates[settingKey] })
            .eq('id', plan.id)

        if (error) throw error
        updatedKeys.push(settingKey)
    }

    return updatedKeys
}
