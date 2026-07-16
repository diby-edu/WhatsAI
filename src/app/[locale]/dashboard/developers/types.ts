export type TabId = 'platform_connections' | 'webhooks' | 'logs' | 'documentation' | 'tests'
export type ScopeMode = 'all' | 'selected'

export interface AgentSummary {
    id: string
    name: string
    mission?: string | null
    is_active?: boolean
    archived_at?: string | null
    ecommerce_mode?: string | null
}

export interface ApiKey {
    id: string
    name: string
    key_prefix: string
    environment: 'live' | 'test'
    is_active: boolean
    rate_limit_per_minute: number
    allowed_agent_ids: string[] | null
    last_used_at: string | null
    created_at: string
    expires_at: string | null
    raw_key?: string
}

export interface UsageLog {
    id: string
    api_key_id: string
    agent_id: string | null
    endpoint: string
    method: string
    status_code: number
    response_ms: number
    ip_address: string | null
    request_body: Record<string, unknown> | null
    created_at: string
}

export interface WebhookItem {
    id: string
    url: string
    events: string[]
    is_active: boolean
    created_at: string
    description: string | null
    secret?: string
}

export interface PlatformConnectionItem {
    id: string
    name: string
    provider: 'shopify' | 'woocommerce' | 'chariow' | 'maketou' | 'generic'
    agent_id: string
    allowed_events: string[] | null
    rate_limit_per_minute: number
    is_active: boolean
    last_received_at: string | null
    last_status_code: number | null
    last_error: string | null
    metadata?: Record<string, any> | null
    created_at: string
    updated_at: string
    webhook_url: string
    webhook_token_preview?: string | null
    signing_secret?: string
    signing_secret_masked?: string
}

export type PlatformProvider = PlatformConnectionItem['provider']
export type FormProvider = PlatformProvider | 'api_key'
export type PlatformEventOption = { value: string; label: string }

export interface PlatformSyncConnectionItem {
    id: string
    name: string
    provider: 'woocommerce' | 'shopify' | 'chariow'
    agent_id: string
    is_active: boolean
    auto_sync_enabled: boolean
    sync_interval_minutes: number
    retry_count: number
    next_retry_at: string | null
    credentials_hint: Record<string, any> | null
    last_tested_at: string | null
    last_test_status_code: number | null
    last_test_error: string | null
    last_synced_at: string | null
    last_sync_started_at: string | null
    last_sync_finished_at: string | null
    last_sync_status: 'idle' | 'success' | 'failed' | 'running'
    last_sync_error: string | null
    last_sync_count: number
    metadata?: Record<string, any> | null
    created_at: string
    updated_at: string
}

export interface PlatformSyncRunItem {
    id: string
    trigger_source: 'manual' | 'cron'
    status: 'success' | 'failed'
    fetched_count: number
    synced_count: number
    has_more: boolean
    error: string | null
    started_at: string
    finished_at: string
    created_at: string
}

export interface SyncedProduct {
    id: string
    agent_id: string
    external_id: string
    data: {
        name?: string | null
        description?: string | null
        price?: number | null
        original_price?: number | null
        currency?: string | null
        availability?: string | null
        url?: string | null
        image_url?: string | null
        categories?: string[]
        category?: string | null
        type?: string | null
        stock?: number | null
        provider?: string | null
        raw_status?: string | null
        synced_at?: string | null
        [key: string]: unknown
    }
    created_at: string
    updated_at: string | null
}
