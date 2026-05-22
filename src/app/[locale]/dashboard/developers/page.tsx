'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import {
    Activity,
    AlertCircle,
    BookOpen,
    Check,
    ChevronDown,
    Clock,
    Code2,
    Copy,
    Eye,
    EyeOff,
    Globe,
    Key,
    Plus,
    Power,
    RefreshCw,
    Shield,
    Trash2
} from 'lucide-react'

type TabId = 'keys' | 'catalog_sync' | 'synced_products' | 'platform_connections' | 'webhooks' | 'logs' | 'documentation' | 'tests'
type ScopeMode = 'all' | 'selected'

interface AgentSummary {
    id: string
    name: string
    mission?: string | null
    is_active?: boolean
    archived_at?: string | null
    ecommerce_mode?: string | null
}

interface ApiKey {
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

interface UsageLog {
    id: string
    api_key_id: string
    agent_id: string | null
    endpoint: string
    method: string
    status_code: number
    response_ms: number
    ip_address: string | null
    created_at: string
}

interface WebhookItem {
    id: string
    url: string
    events: string[]
    is_active: boolean
    created_at: string
    description: string | null
    secret?: string
}

interface PlatformConnectionItem {
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

type PlatformProvider = PlatformConnectionItem['provider']
type PlatformEventOption = { value: string; label: string }

interface PlatformSyncConnectionItem {
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

interface PlatformSyncRunItem {
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

interface SyncedProduct {
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

const WEBHOOK_EVENTS = [
    'message.received',
    'message.sent',
    'conversation.started',
    'conversation.ended',
    'lead.collected',
] as const

const PLATFORM_PROVIDERS = [
    { value: 'shopify', label: 'Shopify' },
    { value: 'woocommerce', label: 'WooCommerce' },
    { value: 'chariow', label: 'Chariow' },
    { value: 'maketou', label: 'Maketou' },
    { value: 'generic', label: 'Generic (custom)' },
] as const

const PLATFORM_SYNC_PROVIDERS = [
    { value: 'woocommerce', label: 'WooCommerce' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'chariow', label: 'Chariow' },
] as const

const PLATFORM_SYNC_INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 180, 360, 720, 1440] as const

const PLATFORM_EVENT_OPTIONS: Record<PlatformProvider, PlatformEventOption[]> = {
    shopify: [
        { value: 'orders/create', label: 'Commande creee (orders/create)' },
        { value: 'orders/paid', label: 'Commande payee (orders/paid)' },
        { value: 'orders/fulfilled', label: 'Commande expediee (orders/fulfilled)' },
        { value: 'orders/updated', label: 'Commande mise a jour (orders/updated)' },
        { value: 'checkouts/update', label: 'Checkout mis a jour (checkouts/update)' },
        { value: 'carts/update', label: 'Panier mis a jour (carts/update)' },
    ],
    woocommerce: [
        { value: 'order.created', label: 'Commande creee (order.created)' },
        { value: 'order.updated', label: 'Commande mise a jour (order.updated)' },
        { value: 'order.failed', label: 'Paiement echoue (order.failed)' },
        { value: 'order.pending', label: 'Paiement en attente (order.pending)' },
        { value: 'order.deleted', label: 'Commande supprimee (order.deleted)' },
    ],
    chariow: [
        { value: 'payment_confirmed', label: 'Vente reussie' },
        { value: 'cart_abandoned', label: 'Panier abandonne' },
        { value: 'payment_failed', label: 'Paiement echoue' },
    ],
    maketou: [
        { value: 'order_created', label: 'Commande creee (order_created)' },
        { value: 'order_paid', label: 'Commande payee (order_paid)' },
        { value: 'cart_abandoned', label: 'Panier abandonne (cart_abandoned)' },
        { value: 'payment_failed', label: 'Paiement echoue (payment_failed)' },
    ],
    generic: [
        { value: 'order_created', label: 'Commande creee (order_created)' },
        { value: 'order_shipped', label: 'Commande expediee (order_shipped)' },
        { value: 'cart_abandoned', label: 'Panier abandonne (cart_abandoned)' },
        { value: 'payment_failed', label: 'Paiement echoue (payment_failed)' },
        { value: 'custom', label: 'Evenement personnalise (custom)' },
    ],
}

const sectionStyle: CSSProperties = {
    background: 'var(--card-bg, #1a1a2e)',
    border: '1px solid var(--border, #2a2a3e)',
    borderRadius: 16,
    padding: 24,
}

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--input-bg, #0f0f1a)',
    border: '1px solid var(--border, #2a2a3e)',
    borderRadius: 8,
    color: 'var(--text-primary, #fff)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
}

const secondaryButtonStyle: CSSProperties = {
    padding: '10px 14px',
    background: 'transparent',
    border: '1px solid var(--border, #2a2a3e)',
    borderRadius: 8,
    color: 'var(--text-secondary, #9ca3af)',
    cursor: 'pointer',
    fontSize: 13,
}

const primaryButtonStyle: CSSProperties = {
    padding: '10px 16px',
    background: '#25d366',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
}

function normalizeScopeMode(allowedAgentIds: string[] | null | undefined): ScopeMode {
    return allowedAgentIds && allowedAgentIds.length > 0 ? 'selected' : 'all'
}

export default function DevelopersPage() {
    const [activeTab, setActiveTab] = useState<TabId>('keys')
    const [pageError, setPageError] = useState<string | null>(null)

    const [keys, setKeys] = useState<ApiKey[]>([])
    const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
    const [platformSyncConnections, setPlatformSyncConnections] = useState<PlatformSyncConnectionItem[]>([])
    const [platformConnections, setPlatformConnections] = useState<PlatformConnectionItem[]>([])
    const [logs, setLogs] = useState<UsageLog[]>([])
    const [agents, setAgents] = useState<AgentSummary[]>([])

    const [keysLoading, setKeysLoading] = useState(true)
    const [webhooksLoading, setWebhooksLoading] = useState(true)
    const [platformSyncConnectionsLoading, setPlatformSyncConnectionsLoading] = useState(true)
    const [platformConnectionsLoading, setPlatformConnectionsLoading] = useState(true)
    const [logsLoading, setLogsLoading] = useState(false)
    const [agentsLoading, setAgentsLoading] = useState(true)

    const [showKeyForm, setShowKeyForm] = useState(false)
    const [creatingKey, setCreatingKey] = useState(false)
    const [newKeyName, setNewKeyName] = useState('')
    const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live')
    const [newKeyLimit, setNewKeyLimit] = useState(60)
    const [newKeyScopeMode, setNewKeyScopeMode] = useState<ScopeMode>('all')
    const [newKeyAllowedAgentIds, setNewKeyAllowedAgentIds] = useState<string[]>([])

    const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null)
    const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
    const [editingKeyScopeMode, setEditingKeyScopeMode] = useState<ScopeMode>('all')
    const [editingKeyAllowedAgentIds, setEditingKeyAllowedAgentIds] = useState<string[]>([])
    const [savingKeyScope, setSavingKeyScope] = useState(false)
    const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null)

    const [showWebhookForm, setShowWebhookForm] = useState(false)
    const [creatingWebhook, setCreatingWebhook] = useState(false)
    const [newWebhookUrl, setNewWebhookUrl] = useState('')
    const [newWebhookDescription, setNewWebhookDescription] = useState('')
    const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([...WEBHOOK_EVENTS])
    const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null)
    const [editingWebhookUrl, setEditingWebhookUrl] = useState('')
    const [editingWebhookDescription, setEditingWebhookDescription] = useState('')
    const [editingWebhookEvents, setEditingWebhookEvents] = useState<string[]>([])
    const [savingWebhookEdit, setSavingWebhookEdit] = useState(false)
    const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null)

    const [showPlatformSyncForm, setShowPlatformSyncForm] = useState(false)
    const [creatingPlatformSync, setCreatingPlatformSync] = useState(false)
    const [newPlatformSyncName, setNewPlatformSyncName] = useState('')
    const [newPlatformSyncProvider, setNewPlatformSyncProvider] = useState<'woocommerce' | 'shopify' | 'chariow'>('woocommerce')
    const [newPlatformSyncAgentId, setNewPlatformSyncAgentId] = useState('')
    const [newPlatformSyncAutoSyncEnabled, setNewPlatformSyncAutoSyncEnabled] = useState(false)
    const [newPlatformSyncIntervalMinutes, setNewPlatformSyncIntervalMinutes] = useState(15)
    const [newWooStoreUrl, setNewWooStoreUrl] = useState('')
    const [newWooConsumerKey, setNewWooConsumerKey] = useState('')
    const [newWooConsumerSecret, setNewWooConsumerSecret] = useState('')
    const [newShopifyDomain, setNewShopifyDomain] = useState('')
    const [newShopifyToken, setNewShopifyToken] = useState('')
    const [newShopifyApiVersion, setNewShopifyApiVersion] = useState('2024-10')
    const [newChariowApiKey, setNewChariowApiKey] = useState('')
    const [testingPlatformSyncId, setTestingPlatformSyncId] = useState<string | null>(null)
    const [syncingPlatformSyncId, setSyncingPlatformSyncId] = useState<string | null>(null)
    const [savingPlatformSyncConfigId, setSavingPlatformSyncConfigId] = useState<string | null>(null)
    const [deletingPlatformSyncId, setDeletingPlatformSyncId] = useState<string | null>(null)
    const [expandedPlatformSyncRunsId, setExpandedPlatformSyncRunsId] = useState<string | null>(null)
    const [loadingPlatformSyncRunsId, setLoadingPlatformSyncRunsId] = useState<string | null>(null)
    const [platformSyncRunsByConnection, setPlatformSyncRunsByConnection] = useState<Record<string, PlatformSyncRunItem[]>>({})

    const [syncedProducts, setSyncedProducts] = useState<SyncedProduct[]>([])
    const [syncedProductsLoading, setSyncedProductsLoading] = useState(false)
    const [syncedProductsAgentFilter, setSyncedProductsAgentFilter] = useState<string>('all')
    const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set())

    const [showPlatformConnectionForm, setShowPlatformConnectionForm] = useState(false)
    const [creatingPlatformConnection, setCreatingPlatformConnection] = useState(false)
    const [newPlatformConnectionName, setNewPlatformConnectionName] = useState('')
    const [newPlatformProvider, setNewPlatformProvider] = useState<PlatformConnectionItem['provider']>('shopify')
    const [newPlatformAgentId, setNewPlatformAgentId] = useState('')
    const [newPlatformRateLimit, setNewPlatformRateLimit] = useState(60)
    const [deletingPlatformConnectionId, setDeletingPlatformConnectionId] = useState<string | null>(null)
    const [rotatingPlatformConnectionId, setRotatingPlatformConnectionId] = useState<string | null>(null)
    const [revealedPlatformWebhookUrlIds, setRevealedPlatformWebhookUrlIds] = useState<Record<string, boolean>>({})
    const [revealedPlatformSecretIds, setRevealedPlatformSecretIds] = useState<Record<string, boolean>>({})

    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null)
    const [logKeyFilterId, setLogKeyFilterId] = useState<string>('all')

    const activeAgents = useMemo(
        () => agents.filter(agent => !agent.archived_at && agent.ecommerce_mode === 'external_sync'),
        [agents]
    )

    const agentNameById = useMemo(() => {
        const map = new Map<string, string>()
        activeAgents.forEach(agent => map.set(agent.id, agent.name))
        return map
    }, [activeAgents])

    const fetchKeys = useCallback(async () => {
        setKeysLoading(true)
        try {
            const res = await fetch('/api/developer/keys')
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger les cles API')
            }
            setKeys(result.data || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les cles API')
        } finally {
            setKeysLoading(false)
        }
    }, [])

    const fetchAgents = useCallback(async () => {
        setAgentsLoading(true)
        try {
            const res = await fetch('/api/agents')
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger les agents')
            }
            setAgents(result.data?.agents || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les agents')
        } finally {
            setAgentsLoading(false)
        }
    }, [])

    const fetchWebhooks = useCallback(async () => {
        setWebhooksLoading(true)
        try {
            const res = await fetch('/api/developer/webhooks')
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger les webhooks')
            }
            setWebhooks(result.data?.data || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les webhooks')
        } finally {
            setWebhooksLoading(false)
        }
    }, [])

    const fetchPlatformSyncConnections = useCallback(async () => {
        setPlatformSyncConnectionsLoading(true)
        try {
            const res = await fetch('/api/developer/platform-sync-connections')
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger les connexions de sync catalogue')
            }
            setPlatformSyncConnections(result.data || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les connexions de sync catalogue')
        } finally {
            setPlatformSyncConnectionsLoading(false)
        }
    }, [])

    const fetchSyncedProducts = useCallback(async (agentId?: string) => {
        setSyncedProductsLoading(true)
        try {
            const url = agentId && agentId !== 'all'
                ? `/api/developer/synced-products?agent_id=${agentId}`
                : '/api/developer/synced-products'
            const res = await fetch(url)
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Impossible de charger les produits')
            setSyncedProducts(result.data || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les produits')
        } finally {
            setSyncedProductsLoading(false)
        }
    }, [])

    const fetchPlatformConnections = useCallback(async () => {
        setPlatformConnectionsLoading(true)
        try {
            const res = await fetch('/api/developer/platform-connections')
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger les connexions plateforme')
            }
            setPlatformConnections(result.data || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les connexions plateforme')
        } finally {
            setPlatformConnectionsLoading(false)
        }
    }, [])

    const fetchLogs = useCallback(async (keyFilterId?: string) => {
        setLogsLoading(true)
        try {
            const filterValue = keyFilterId ?? logKeyFilterId
            const query = filterValue !== 'all'
                ? `/api/developer/logs?key_id=${encodeURIComponent(filterValue)}&limit=50`
                : '/api/developer/logs?limit=50'

            const res = await fetch(query)
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger les logs')
            }
            setLogs(result.data || [])
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger les logs')
        } finally {
            setLogsLoading(false)
        }
    }, [logKeyFilterId])

    useEffect(() => {
        setPageError(null)
        void Promise.all([fetchKeys(), fetchAgents(), fetchWebhooks(), fetchPlatformSyncConnections(), fetchPlatformConnections(), fetchSyncedProducts()])
    }, [fetchAgents, fetchKeys, fetchWebhooks, fetchPlatformConnections, fetchPlatformSyncConnections, fetchSyncedProducts])

    useEffect(() => {
        if (activeTab === 'logs') {
            void fetchLogs(logKeyFilterId)
        }
    }, [activeTab, logKeyFilterId, fetchLogs])

    useEffect(() => {
        if (activeAgents.length === 0) return
        const hasCurrent = activeAgents.some(agent => agent.id === newPlatformAgentId)
        if (!newPlatformAgentId || !hasCurrent) {
            setNewPlatformAgentId(activeAgents[0].id)
        }
    }, [activeAgents, newPlatformAgentId])

    useEffect(() => {
        if (activeAgents.length === 0) return
        const hasCurrent = activeAgents.some(agent => agent.id === newPlatformSyncAgentId)
        if (!newPlatformSyncAgentId || !hasCurrent) {
            setNewPlatformSyncAgentId(activeAgents[0].id)
        }
    }, [activeAgents, newPlatformSyncAgentId])


    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

    const statusColor = (code: number) => {
        if (code < 300) return '#22c55e'
        if (code < 400) return '#f59e0b'
        return '#ef4444'
    }

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const toggleReveal = (
        id: string,
        setter: Dispatch<SetStateAction<Record<string, boolean>>>
    ) => {
        setter(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const maskValue = (value: string, visiblePrefix = 8, visibleSuffix = 6) => {
        if (!value) return '********'
        if (value.length <= visiblePrefix + visibleSuffix) {
            return `${value.slice(0, Math.min(4, value.length))}********`
        }
        return `${value.slice(0, visiblePrefix)}********${value.slice(-visibleSuffix)}`
    }

    const maskWebhookUrl = (url: string) => {
        try {
            const parsed = new URL(url)
            const pathParts = parsed.pathname.split('/').filter(Boolean)
            const token = pathParts[pathParts.length - 1] || ''
            const maskedToken = maskValue(token, 8, 4)
            return `${parsed.origin}/api/public/v1/incoming/${maskedToken}`
        } catch {
            return maskValue(url, 16, 8)
        }
    }

    const toggleAgentSelection = (
        currentIds: string[],
        agentId: string,
        setter: (value: string[]) => void
    ) => {
        if (currentIds.includes(agentId)) {
            setter(currentIds.filter(id => id !== agentId))
            return
        }
        setter([...currentIds, agentId])
    }

    const describeAgentScope = (allowedAgentIds: string[] | null) => {
        if (!allowedAgentIds || allowedAgentIds.length === 0) {
            return 'Tous les agents'
        }

        const names = allowedAgentIds.map(id => agentNameById.get(id) || id)
        if (names.length <= 2) {
            return names.join(', ')
        }
        return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    }

    const resetKeyForm = () => {
        setNewKeyName('')
        setNewKeyEnv('live')
        setNewKeyLimit(60)
        setNewKeyScopeMode('all')
        setNewKeyAllowedAgentIds([])
    }

    const createKey = async () => {
        if (!newKeyName.trim()) return

        setCreatingKey(true)
        setPageError(null)

        try {
            const res = await fetch('/api/developer/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newKeyName.trim(),
                    environment: newKeyEnv,
                    rate_limit_per_minute: newKeyLimit,
                    allowed_agent_ids: newKeyAllowedAgentIds.length > 0 ? newKeyAllowedAgentIds : null,
                }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Erreur lors de la creation de la cle')
            }

            const createdKey: ApiKey = result.data
            setKeys(prev => [createdKey, ...prev])
            setExpandedKeyId(createdKey.id)
            setRevealedKeyId(createdKey.id)
            resetKeyForm()
            setShowKeyForm(false)
            setActiveTab('keys')
        } catch (error: any) {
            setPageError(error.message || 'Erreur lors de la creation de la cle')
        } finally {
            setCreatingKey(false)
        }
    }

    const toggleKey = async (key: ApiKey) => {
        setPageError(null)
        const res = await fetch(`/api/developer/keys/${key.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !key.is_active }),
        })

        const result = await res.json()
        if (!res.ok) {
            setPageError(result.error || 'Impossible de modifier la cle')
            return
        }

        setKeys(prev => prev.map(item => item.id === key.id ? { ...item, ...result.data } : item))
    }

    const startEditKeyScope = (key: ApiKey) => {
        setExpandedKeyId(key.id)
        setEditingKeyId(key.id)
        setEditingKeyScopeMode(normalizeScopeMode(key.allowed_agent_ids))
        setEditingKeyAllowedAgentIds(key.allowed_agent_ids || [])
    }

    const cancelEditKeyScope = () => {
        setEditingKeyId(null)
        setEditingKeyScopeMode('all')
        setEditingKeyAllowedAgentIds([])
    }

    const saveKeyScope = async () => {
        if (!editingKeyId) return

        setSavingKeyScope(true)
        setPageError(null)

        try {
            const res = await fetch(`/api/developer/keys/${editingKeyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    allowed_agent_ids: editingKeyAllowedAgentIds.length > 0 ? editingKeyAllowedAgentIds : null,
                }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de mettre a jour le scope agent')
            }

            setKeys(prev => prev.map(item => item.id === editingKeyId ? { ...item, ...result.data } : item))
            cancelEditKeyScope()
        } catch (error: any) {
            setPageError(error.message || 'Impossible de mettre a jour le scope agent')
        } finally {
            setSavingKeyScope(false)
        }
    }

    const deleteKey = async (id: string) => {
        if (!confirm('Supprimer definitivement cette cle API ? Les integrations qui l utilisent s arreteront.')) {
            return
        }

        setDeletingKeyId(id)
        setPageError(null)

        try {
            const res = await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de supprimer la cle')
            }

            setKeys(prev => prev.filter(item => item.id !== id))
            if (expandedKeyId === id) setExpandedKeyId(null)
            if (editingKeyId === id) cancelEditKeyScope()
            if (logKeyFilterId === id) setLogKeyFilterId('all')
        } catch (error: any) {
            setPageError(error.message || 'Impossible de supprimer la cle')
        } finally {
            setDeletingKeyId(null)
        }
    }

    const toggleWebhookEvent = (
        currentEvents: string[],
        eventName: string,
        setter: (events: string[]) => void
    ) => {
        if (currentEvents.includes(eventName)) {
            setter(currentEvents.filter(item => item !== eventName))
            return
        }
        setter([...currentEvents, eventName])
    }

    const resetWebhookForm = () => {
        setNewWebhookUrl('')
        setNewWebhookDescription('')
        setNewWebhookEvents([...WEBHOOK_EVENTS])
    }

    const createWebhook = async () => {
        if (!newWebhookUrl.trim()) return
        if (newWebhookEvents.length === 0) return

        setCreatingWebhook(true)
        setPageError(null)

        try {
            const res = await fetch('/api/developer/webhooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: newWebhookUrl.trim(),
                    description: newWebhookDescription.trim() || null,
                    events: newWebhookEvents,
                }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de creer le webhook')
            }

            setWebhooks(prev => [result.data?.data, ...prev])
            resetWebhookForm()
            setShowWebhookForm(false)
            setActiveTab('webhooks')
        } catch (error: any) {
            setPageError(error.message || 'Impossible de creer le webhook')
        } finally {
            setCreatingWebhook(false)
        }
    }

    const toggleWebhook = async (webhook: WebhookItem) => {
        setPageError(null)
        const res = await fetch(`/api/developer/webhooks/${webhook.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !webhook.is_active }),
        })

        const result = await res.json()
        if (!res.ok) {
            setPageError(result.error || 'Impossible de modifier le webhook')
            return
        }

        setWebhooks(prev => prev.map(item => item.id === webhook.id ? { ...item, ...result.data?.data } : item))
    }

    const startEditWebhook = (webhook: WebhookItem) => {
        setEditingWebhookId(webhook.id)
        setEditingWebhookUrl(webhook.url)
        setEditingWebhookDescription(webhook.description || '')
        setEditingWebhookEvents(webhook.events || [])
    }

    const cancelEditWebhook = () => {
        setEditingWebhookId(null)
        setEditingWebhookUrl('')
        setEditingWebhookDescription('')
        setEditingWebhookEvents([])
    }

    const saveWebhookEdit = async () => {
        if (!editingWebhookId || !editingWebhookUrl.trim() || editingWebhookEvents.length === 0) return

        setSavingWebhookEdit(true)
        setPageError(null)

        try {
            const res = await fetch(`/api/developer/webhooks/${editingWebhookId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: editingWebhookUrl.trim(),
                    description: editingWebhookDescription.trim() || null,
                    events: editingWebhookEvents,
                }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de mettre a jour le webhook')
            }

            setWebhooks(prev => prev.map(item => item.id === editingWebhookId ? { ...item, ...result.data?.data } : item))
            cancelEditWebhook()
        } catch (error: any) {
            setPageError(error.message || 'Impossible de mettre a jour le webhook')
        } finally {
            setSavingWebhookEdit(false)
        }
    }

    const deleteWebhook = async (id: string) => {
        if (!confirm('Supprimer ce webhook ?')) return

        setDeletingWebhookId(id)
        setPageError(null)

        try {
            const res = await fetch(`/api/developer/webhooks/${id}`, { method: 'DELETE' })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de supprimer le webhook')
            }
            setWebhooks(prev => prev.filter(item => item.id !== id))
            if (editingWebhookId === id) cancelEditWebhook()
        } catch (error: any) {
            setPageError(error.message || 'Impossible de supprimer le webhook')
        } finally {
            setDeletingWebhookId(null)
        }
    }

    const resetPlatformSyncForm = () => {
        setNewPlatformSyncName('')
        setNewPlatformSyncProvider('woocommerce')
        setNewPlatformSyncAutoSyncEnabled(false)
        setNewPlatformSyncIntervalMinutes(15)
        setNewWooStoreUrl('')
        setNewWooConsumerKey('')
        setNewWooConsumerSecret('')
        setNewShopifyDomain('')
        setNewShopifyToken('')
        setNewShopifyApiVersion('2024-10')
        setNewChariowApiKey('')
    }

    const createPlatformSyncConnection = async () => {
        if (!newPlatformSyncName.trim() || !newPlatformSyncAgentId) return

        const credentials = newPlatformSyncProvider === 'woocommerce'
            ? {
                store_url: newWooStoreUrl.trim(),
                consumer_key: newWooConsumerKey.trim(),
                consumer_secret: newWooConsumerSecret.trim(),
            }
            : newPlatformSyncProvider === 'chariow'
            ? {
                api_key: newChariowApiKey.trim(),
            }
            : {
                shop_domain: newShopifyDomain.trim(),
                admin_api_token: newShopifyToken.trim(),
                api_version: newShopifyApiVersion.trim() || '2024-10',
            }

        setCreatingPlatformSync(true)
        setPageError(null)

        try {
            const res = await fetch('/api/developer/platform-sync-connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newPlatformSyncName.trim(),
                    provider: newPlatformSyncProvider,
                    agent_id: newPlatformSyncAgentId,
                    credentials,
                    is_active: true,
                    auto_sync_enabled: newPlatformSyncAutoSyncEnabled,
                    sync_interval_minutes: newPlatformSyncIntervalMinutes,
                }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de creer la connexion de sync')
            }

            setPlatformSyncConnections(prev => [result.data, ...prev])
            resetPlatformSyncForm()
            setShowPlatformSyncForm(false)
            setActiveTab('catalog_sync')
        } catch (error: any) {
            setPageError(error.message || 'Impossible de creer la connexion de sync')
        } finally {
            setCreatingPlatformSync(false)
        }
    }

    const updatePlatformSyncConnection = async (
        connection: PlatformSyncConnectionItem,
        updates: Record<string, unknown>,
        fallbackErrorMessage: string
    ) => {
        setSavingPlatformSyncConfigId(connection.id)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-sync-connections/${connection.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || fallbackErrorMessage)
            }
            setPlatformSyncConnections(prev =>
                prev.map(item => item.id === connection.id ? { ...item, ...result.data } : item)
            )
        } catch (error: any) {
            setPageError(error.message || fallbackErrorMessage)
        } finally {
            setSavingPlatformSyncConfigId(null)
        }
    }

    const togglePlatformSyncConnection = async (connection: PlatformSyncConnectionItem) => {
        await updatePlatformSyncConnection(
            connection,
            { is_active: !connection.is_active },
            'Impossible de modifier la connexion de sync'
        )
    }

    const togglePlatformSyncAuto = async (connection: PlatformSyncConnectionItem) => {
        await updatePlatformSyncConnection(
            connection,
            { auto_sync_enabled: !connection.auto_sync_enabled },
            'Impossible de modifier le mode auto-sync'
        )
    }

    const changePlatformSyncInterval = async (
        connection: PlatformSyncConnectionItem,
        value: number
    ) => {
        await updatePlatformSyncConnection(
            connection,
            { sync_interval_minutes: value },
            'Impossible de modifier l intervalle de sync'
        )
    }

    const testPlatformSyncConnection = async (id: string) => {
        setTestingPlatformSyncId(id)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-sync-connections/${id}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Test de connexion echoue')
            }
            await fetchPlatformSyncConnections()
        } catch (error: any) {
            setPageError(error.message || 'Test de connexion echoue')
        } finally {
            setTestingPlatformSyncId(null)
        }
    }

    const syncNowPlatformSyncConnection = async (id: string) => {
        setSyncingPlatformSyncId(id)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-sync-connections/${id}/sync-now`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_items: 200 }),
            })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Sync catalogue echouee')
            }
            await fetchPlatformSyncConnections()
            if (expandedPlatformSyncRunsId === id) {
                await fetchPlatformSyncRuns(id, true)
            }
        } catch (error: any) {
            setPageError(error.message || 'Sync catalogue echouee')
        } finally {
            setSyncingPlatformSyncId(null)
        }
    }

    const fetchPlatformSyncRuns = async (connectionId: string, force = false) => {
        if (!force && platformSyncRunsByConnection[connectionId]) {
            return
        }

        setLoadingPlatformSyncRunsId(connectionId)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-sync-connections/${connectionId}/runs?limit=10`)
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de charger l historique des syncs')
            }
            setPlatformSyncRunsByConnection(prev => ({ ...prev, [connectionId]: result.data || [] }))
        } catch (error: any) {
            setPageError(error.message || 'Impossible de charger l historique des syncs')
        } finally {
            setLoadingPlatformSyncRunsId(null)
        }
    }

    const togglePlatformSyncRuns = async (connectionId: string) => {
        if (expandedPlatformSyncRunsId === connectionId) {
            setExpandedPlatformSyncRunsId(null)
            return
        }
        setExpandedPlatformSyncRunsId(connectionId)
        await fetchPlatformSyncRuns(connectionId)
    }

    const deletePlatformSyncConnection = async (id: string) => {
        if (!confirm('Supprimer cette connexion de sync catalogue ?')) return

        setDeletingPlatformSyncId(id)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-sync-connections/${id}`, { method: 'DELETE' })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de supprimer la connexion de sync')
            }
            setPlatformSyncConnections(prev => prev.filter(item => item.id !== id))
            setPlatformSyncRunsByConnection(prev => {
                const next = { ...prev }
                delete next[id]
                return next
            })
            if (expandedPlatformSyncRunsId === id) {
                setExpandedPlatformSyncRunsId(null)
            }
        } catch (error: any) {
            setPageError(error.message || 'Impossible de supprimer la connexion de sync')
        } finally {
            setDeletingPlatformSyncId(null)
        }
    }

    const resetPlatformConnectionForm = () => {
        setNewPlatformConnectionName('')
        setNewPlatformProvider('shopify')
        setNewPlatformRateLimit(60)
    }

    const createPlatformConnection = async () => {
        if (!newPlatformConnectionName.trim() || !newPlatformAgentId) return

        setCreatingPlatformConnection(true)
        setPageError(null)

        try {
            const res = await fetch('/api/developer/platform-connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newPlatformConnectionName.trim(),
                    provider: newPlatformProvider,
                    agent_id: newPlatformAgentId,
                    rate_limit_per_minute: newPlatformRateLimit,
                    allowed_events: null,
                }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de creer la connexion plateforme')
            }

            setPlatformConnections(prev => [result.data, ...prev])
            resetPlatformConnectionForm()
            setShowPlatformConnectionForm(false)
            setActiveTab('platform_connections')
        } catch (error: any) {
            setPageError(error.message || 'Impossible de creer la connexion plateforme')
        } finally {
            setCreatingPlatformConnection(false)
        }
    }

    const togglePlatformConnection = async (connection: PlatformConnectionItem) => {
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-connections/${connection.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !connection.is_active }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de modifier la connexion plateforme')
            }

            setPlatformConnections(prev => prev.map(item => item.id === connection.id ? { ...item, ...result.data } : item))
        } catch (error: any) {
            setPageError(error.message || 'Impossible de modifier la connexion plateforme')
        }
    }

    const rotatePlatformConnectionSecret = async (id: string) => {
        setRotatingPlatformConnectionId(id)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-connections/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rotate_signing_secret: true }),
            })

            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de regenerer le secret')
            }

            setPlatformConnections(prev => prev.map(item => item.id === id ? { ...item, ...result.data } : item))
        } catch (error: any) {
            setPageError(error.message || 'Impossible de regenerer le secret')
        } finally {
            setRotatingPlatformConnectionId(null)
        }
    }

    const deletePlatformConnection = async (id: string) => {
        if (!confirm('Supprimer cette connexion plateforme ?')) return

        setDeletingPlatformConnectionId(id)
        setPageError(null)
        try {
            const res = await fetch(`/api/developer/platform-connections/${id}`, {
                method: 'DELETE',
            })
            const result = await res.json()
            if (!res.ok) {
                throw new Error(result.error || 'Impossible de supprimer la connexion plateforme')
            }
            setPlatformConnections(prev => prev.filter(item => item.id !== id))
        } catch (error: any) {
            setPageError(error.message || 'Impossible de supprimer la connexion plateforme')
        } finally {
            setDeletingPlatformConnectionId(null)
        }
    }

    const tabs = [
        { id: 'keys' as const, label: 'Cles API', icon: Key, count: keys.length },
        { id: 'catalog_sync' as const, label: 'Sync catalogue', icon: RefreshCw, count: platformSyncConnections.length },
        { id: 'synced_products' as const, label: 'Produits sync', icon: Shield, count: syncedProducts.length },
        { id: 'platform_connections' as const, label: 'Connexions plateforme directes', icon: Globe, count: platformConnections.length },
        { id: 'webhooks' as const, label: 'Webhooks', icon: Globe, count: webhooks.length },
        { id: 'logs' as const, label: 'Logs', icon: Activity, count: undefined },
        { id: 'documentation' as const, label: 'Documentation', icon: BookOpen, count: undefined },
        { id: 'tests' as const, label: 'Tests', icon: Code2, count: undefined },
    ]

    const canCreatePlatformSync = newPlatformSyncProvider === 'woocommerce'
        ? Boolean(
            newPlatformSyncName.trim()
            && newPlatformSyncAgentId
            && newPlatformSyncIntervalMinutes >= 5
            && newPlatformSyncIntervalMinutes <= 1440
            && newWooStoreUrl.trim()
            && newWooConsumerKey.trim()
            && newWooConsumerSecret.trim()
        )
        : newPlatformSyncProvider === 'chariow'
        ? Boolean(
            newPlatformSyncName.trim()
            && newPlatformSyncAgentId
            && newPlatformSyncIntervalMinutes >= 5
            && newPlatformSyncIntervalMinutes <= 1440
            && newChariowApiKey.trim()
        )
        : Boolean(
            newPlatformSyncName.trim()
            && newPlatformSyncAgentId
            && newPlatformSyncIntervalMinutes >= 5
            && newPlatformSyncIntervalMinutes <= 1440
            && newShopifyDomain.trim()
            && newShopifyToken.trim()
        )

    return (
        <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary, #fff)' }}>
                        API publique
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary, #9ca3af)', maxWidth: 760 }}>
                        Gere tes cles API, tes connexions plateforme entrantes, tes webhooks sortants, puis valide le tout via les onglets Documentation et Tests sans changer le comportement prod des endpoints publics.
                    </p>
                </div>

            </div>

            {pageError && (
                <div style={{
                    marginBottom: 20,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.28)',
                    color: '#fca5a5',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}>
                    <AlertCircle size={16} />
                    <span>{pageError}</span>
                </div>
            )}

            <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                padding: 8,
                borderRadius: 14,
                border: '1px solid var(--border, #2a2a3e)',
                background: 'rgba(255,255,255,0.02)',
                marginBottom: 24,
            }}>
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: 'none',
                                background: isActive ? 'rgba(37,211,102,0.16)' : 'transparent',
                                color: isActive ? '#25d366' : 'var(--text-secondary, #9ca3af)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                                fontWeight: 600,
                            }}
                        >
                            <Icon size={15} />
                            <span>{tab.label}</span>
                            {typeof tab.count === 'number' && (
                                <span style={{
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    background: isActive ? 'rgba(37,211,102,0.18)' : 'rgba(255,255,255,0.06)',
                                    fontSize: 11,
                                }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {activeTab === 'keys' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                        Pour envoyer des donnees a WazzapAI depuis votre propre code ou script. Passez la cle dans le header <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4 }}>Authorization: Bearer sk_live_...</code> de chaque requete.
                    </p>
                    {showKeyForm && (
                        <div style={sectionStyle}>
                            <h2 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                                Creer une cle API
                            </h2>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Nom
                                    </label>
                                    <input
                                        value={newKeyName}
                                        onChange={event => setNewKeyName(event.target.value)}
                                        placeholder="Ex: Integration Shopify"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Environnement
                                    </label>
                                    <select
                                        value={newKeyEnv}
                                        onChange={event => setNewKeyEnv(event.target.value as 'live' | 'test')}
                                        style={inputStyle}
                                    >
                                        <option value="live">Live</option>
                                        <option value="test">Test</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Requetes par minute
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={newKeyLimit}
                                        onChange={event => setNewKeyLimit(Number(event.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: 18 }}>
                                <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text-secondary, #9ca3af)' }}>
                                    Agents autorisés
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginBottom: 10, opacity: 0.7 }}>
                                    Laissez tout décoché pour autoriser tous vos agents catalogue.
                                </div>
                                <div style={{
                                    border: '1px solid var(--border, #2a2a3e)',
                                    borderRadius: 12,
                                    padding: 14,
                                    background: 'rgba(255,255,255,0.02)',
                                }}>
                                    {agentsLoading ? (
                                        <div style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>Chargement des agents...</div>
                                    ) : activeAgents.length === 0 ? (
                                        <div style={{ color: '#f59e0b', fontSize: 13 }}>
                                            Aucun agent en mode catalogue externe. Activez ce mode dans les paramètres de l'agent.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {activeAgents.map(agent => (
                                                <label
                                                    key={agent.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        padding: '8px 10px',
                                                        borderRadius: 8,
                                                        background: 'rgba(255,255,255,0.03)',
                                                        color: 'var(--text-primary, #fff)',
                                                        fontSize: 13,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={newKeyAllowedAgentIds.includes(agent.id)}
                                                        onChange={() => toggleAgentSelection(newKeyAllowedAgentIds, agent.id, setNewKeyAllowedAgentIds)}
                                                    />
                                                    <span>{agent.name}</span>
                                                    {!agent.is_active && (
                                                        <span style={{ color: '#f59e0b', fontSize: 11 }}>(inactif)</span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                                <button
                                    onClick={createKey}
                                    disabled={creatingKey || !newKeyName.trim()}
                                    style={{
                                        ...primaryButtonStyle,
                                        opacity: creatingKey || !newKeyName.trim() ? 0.6 : 1,
                                        cursor: creatingKey ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {creatingKey ? 'Creation...' : 'Creer la cle'}
                                </button>
                                <button
                                    onClick={() => {
                                        resetKeyForm()
                                        setShowKeyForm(false)
                                    }}
                                    style={secondaryButtonStyle}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Key size={16} />
                                Cles API ({keys.length})
                            </h2>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setShowKeyForm(value => !value)}
                                    style={primaryButtonStyle}
                                >
                                    <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Nouvelle cle
                                </button>
                                <button onClick={() => void fetchKeys()} style={secondaryButtonStyle}>
                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Rafraichir
                                </button>
                            </div>
                        </div>

                        {keysLoading ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                        ) : keys.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                                Aucune cle API pour le moment.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {keys.map(key => {
                                    const isExpanded = expandedKeyId === key.id
                                    const isEditing = editingKeyId === key.id
                                    return (
                                        <div
                                            key={key.id}
                                            style={{
                                                borderRadius: 14,
                                                border: `1px solid ${isExpanded ? '#25d366' : 'var(--border, #2a2a3e)'}`,
                                                background: 'rgba(255,255,255,0.02)',
                                                padding: 16,
                                                opacity: key.is_active ? 1 : 0.72,
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 6,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    background: key.environment === 'live' ? 'rgba(37,211,102,0.14)' : 'rgba(245,158,11,0.14)',
                                                    color: key.environment === 'live' ? '#25d366' : '#f59e0b',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {key.environment}
                                                </span>

                                                <button
                                                    onClick={() => setExpandedKeyId(isExpanded ? null : key.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: 0,
                                                        color: 'var(--text-primary, #fff)',
                                                        fontSize: 15,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {key.name}
                                                </button>

                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '5px 10px',
                                                    borderRadius: 8,
                                                    background: 'var(--input-bg, #0f0f1a)',
                                                    border: '1px solid var(--border, #2a2a3e)',
                                                    fontSize: 12,
                                                    fontFamily: 'monospace',
                                                    color: 'var(--text-secondary, #9ca3af)',
                                                }}>
                                                    {revealedKeyId === key.id && key.raw_key ? key.raw_key : `${key.key_prefix}************`}
                                                    {key.raw_key && (
                                                        <button
                                                            onClick={() => setRevealedKeyId(revealedKeyId === key.id ? null : key.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                            title={revealedKeyId === key.id ? 'Masquer la cle' : 'Afficher la cle'}
                                                        >
                                                            {revealedKeyId === key.id ? <EyeOff size={13} /> : <Eye size={13} />}
                                                        </button>
                                                    )}
                                                    {revealedKeyId === key.id && key.raw_key && (
                                                        <button
                                                            onClick={() => copyToClipboard(key.raw_key!, `key_${key.id}`)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
                                                        >
                                                            {copiedId === `key_${key.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                        </button>
                                                    )}
                                                </div>

                                                <span style={{
                                                    padding: '5px 10px',
                                                    borderRadius: 999,
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: 'var(--text-secondary, #9ca3af)',
                                                    fontSize: 12,
                                                }}>
                                                    {describeAgentScope(key.allowed_agent_ids)}
                                                </span>

                                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => {
                                                            setLogKeyFilterId(key.id)
                                                            setActiveTab('logs')
                                                        }}
                                                        style={secondaryButtonStyle}
                                                    >
                                                        Voir logs
                                                    </button>
                                                    <button
                                                        onClick={() => startEditKeyScope(key)}
                                                        style={secondaryButtonStyle}
                                                    >
                                                        Scope agent
                                                    </button>
                                                    <button
                                                        onClick={() => toggleKey(key)}
                                                        style={{
                                                            ...secondaryButtonStyle,
                                                            color: key.is_active ? '#25d366' : '#ef4444',
                                                        }}
                                                    >
                                                        <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                        {key.is_active ? 'Desactiver' : 'Activer'}
                                                    </button>
                                                    <button
                                                        onClick={() => void deleteKey(key.id)}
                                                        disabled={deletingKeyId === key.id}
                                                        style={{
                                                            ...secondaryButtonStyle,
                                                            color: '#ef4444',
                                                            opacity: deletingKeyId === key.id ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {deletingKeyId === key.id ? (
                                                            <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                        ) : (
                                                            <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                        )}
                                                        Supprimer
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Shield size={11} />
                                                    {key.rate_limit_per_minute} req/min
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Clock size={11} />
                                                    Creee {formatDate(key.created_at)}
                                                </span>
                                                {key.last_used_at && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Activity size={11} />
                                                        Utilisee {formatTime(key.last_used_at)}
                                                    </span>
                                                )}
                                            </div>

                                            {revealedKeyId === key.id && key.raw_key && (
                                                <>
                                                    <div style={{
                                                        marginTop: 12,
                                                        padding: '10px 12px',
                                                        borderRadius: 10,
                                                        border: '1px solid rgba(245,158,11,0.3)',
                                                        background: 'rgba(245,158,11,0.1)',
                                                        color: '#f59e0b',
                                                        fontSize: 13,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                    }}>
                                                        <AlertCircle size={14} />
                                                        Copie cette cle maintenant. Elle ne sera plus jamais reaffichee.
                                                    </div>
                                                    {/* Section 1 : URLs prêtes par agent (priorité) */}
                                                    <div style={{
                                                        marginTop: 10,
                                                        padding: '12px 14px',
                                                        borderRadius: 10,
                                                        border: '1px solid rgba(37,211,102,0.2)',
                                                        background: 'rgba(37,211,102,0.06)',
                                                        fontSize: 12,
                                                        color: 'var(--text-secondary, #9ca3af)',
                                                    }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>URL a coller dans Chariow (Pulse)</div>
                                                        <div style={{ fontSize: 11, marginBottom: 10, opacity: 0.8 }}>
                                                            Copiez cette URL et collez-la dans le champ &quot;URL du pulse&quot; sur Chariow. C&apos;est tout.
                                                        </div>
                                                        {key.allowed_agent_ids && key.allowed_agent_ids.length > 0 ? (
                                                            key.allowed_agent_ids.map(agentId => {
                                                                const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://wazzapai.com'
                                                                const readyUrl = `${baseUrl}/api/public/v1/platform-webhook?api_key=${key.raw_key}&agent_id=${agentId}&provider=chariow`
                                                                const urlCopyId = `ready_url_${key.id}_${agentId}`
                                                                return (
                                                                    <div key={agentId} style={{ marginBottom: 8 }}>
                                                                        <div style={{ fontSize: 11, color: '#25d366', marginBottom: 4, fontWeight: 600 }}>
                                                                            Agent : {agentNameById.get(agentId) || agentId}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                                            <code style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6, wordBreak: 'break-all', flex: 1, lineHeight: 1.7, fontSize: 11 }}>
                                                                                {readyUrl}
                                                                            </code>
                                                                            <button
                                                                                onClick={() => copyToClipboard(readyUrl, urlCopyId)}
                                                                                style={{ ...secondaryButtonStyle, flexShrink: 0 }}
                                                                            >
                                                                                {copiedId === urlCopyId ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })
                                                        ) : (
                                                            <div style={{ color: 'var(--text-secondary, #9ca3af)', fontStyle: 'italic', fontSize: 11 }}>
                                                                Selectionnez des agents autorises lors de la creation pour generer les URLs automatiquement ici.
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Section 2 : clé brute pour code custom */}
                                                    <div style={{
                                                        marginTop: 8,
                                                        padding: '12px 14px',
                                                        borderRadius: 10,
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        background: 'rgba(255,255,255,0.02)',
                                                        fontSize: 12,
                                                        color: 'var(--text-secondary, #9ca3af)',
                                                    }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: 4 }}>Cle brute (pour vos scripts / Zapier / code)</div>
                                                        <div style={{ fontSize: 11, marginBottom: 8, opacity: 0.8 }}>
                                                            A utiliser dans le header HTTP : <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4 }}>Authorization: Bearer [cle]</code>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: 6, wordBreak: 'break-all', flex: 1, fontSize: 11 }}>
                                                                {key.raw_key}
                                                            </code>
                                                            <button
                                                                onClick={() => copyToClipboard(key.raw_key!, `key_raw_${key.id}`)}
                                                                style={secondaryButtonStyle}
                                                            >
                                                                {copiedId === `key_raw_${key.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {isExpanded && (
                                                <div style={{
                                                    marginTop: 16,
                                                    paddingTop: 16,
                                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                                }}>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', marginBottom: 10 }}>
                                                        Agents autorises
                                                    </div>

                                                    {(!key.allowed_agent_ids || key.allowed_agent_ids.length === 0) ? (
                                                        <div style={{ color: 'var(--text-primary, #fff)', fontSize: 13 }}>
                                                            Cette cle peut appeler tous tes agents.
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                                            {key.allowed_agent_ids.map(agentId => (
                                                                <span
                                                                    key={agentId}
                                                                    style={{
                                                                        padding: '6px 10px',
                                                                        borderRadius: 999,
                                                                        background: 'rgba(37,211,102,0.12)',
                                                                        color: '#25d366',
                                                                        fontSize: 12,
                                                                    }}
                                                                >
                                                                    {agentNameById.get(agentId) || agentId}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isEditing && (
                                                        <div style={{
                                                            marginTop: 12,
                                                            padding: 14,
                                                            borderRadius: 12,
                                                            border: '1px solid var(--border, #2a2a3e)',
                                                            background: 'rgba(255,255,255,0.02)',
                                                        }}>
                                                            <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginBottom: 10, opacity: 0.7 }}>
                                                                Laissez tout décoché pour autoriser tous vos agents catalogue.
                                                            </div>
                                                            <div style={{ display: 'grid', gap: 8 }}>
                                                                {activeAgents.length === 0 ? (
                                                                    <div style={{ color: '#f59e0b', fontSize: 13 }}>
                                                                        Aucun agent en mode catalogue externe.
                                                                    </div>
                                                                ) : activeAgents.map(agent => (
                                                                    <label
                                                                        key={agent.id}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 10,
                                                                            padding: '8px 10px',
                                                                            borderRadius: 8,
                                                                            background: 'rgba(255,255,255,0.03)',
                                                                            color: 'var(--text-primary, #fff)',
                                                                            fontSize: 13,
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={editingKeyAllowedAgentIds.includes(agent.id)}
                                                                            onChange={() => toggleAgentSelection(editingKeyAllowedAgentIds, agent.id, setEditingKeyAllowedAgentIds)}
                                                                        />
                                                                        <span>{agent.name}</span>
                                                                    </label>
                                                                ))}
                                                            </div>

                                                            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                                                                <button
                                                                    onClick={saveKeyScope}
                                                                    disabled={savingKeyScope}
                                                                    style={{
                                                                        ...primaryButtonStyle,
                                                                        opacity: savingKeyScope ? 0.6 : 1,
                                                                    }}
                                                                >
                                                                    {savingKeyScope ? 'Enregistrement...' : 'Enregistrer le scope'}
                                                                </button>
                                                                <button onClick={cancelEditKeyScope} style={secondaryButtonStyle}>
                                                                    Annuler
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'catalog_sync' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                        Envoyez votre catalogue produit externe vers WazzapAI pour que votre agent connaisse vos produits en temps reel (prix, stocks, descriptions).
                    </p>
                    {showPlatformSyncForm && (
                        <div style={sectionStyle}>
                            <h2 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                                Creer une connexion de sync catalogue
                            </h2>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Nom de la connexion
                                    </label>
                                    <input
                                        value={newPlatformSyncName}
                                        onChange={event => setNewPlatformSyncName(event.target.value)}
                                        placeholder="Ex: Woo principal - sync catalogue"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Plateforme
                                    </label>
                                    <select
                                        value={newPlatformSyncProvider}
                                        onChange={event => setNewPlatformSyncProvider(event.target.value as 'woocommerce' | 'shopify' | 'chariow')}
                                        style={inputStyle}
                                    >
                                        {PLATFORM_SYNC_PROVIDERS.map(provider => (
                                            <option key={provider.value} value={provider.value}>
                                                {provider.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Agent cible
                                    </label>
                                    <select
                                        value={newPlatformSyncAgentId}
                                        onChange={event => setNewPlatformSyncAgentId(event.target.value)}
                                        style={inputStyle}
                                    >
                                        {activeAgents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Auto-sync catalogue
                                    </label>
                                    <select
                                        value={newPlatformSyncAutoSyncEnabled ? 'on' : 'off'}
                                        onChange={event => setNewPlatformSyncAutoSyncEnabled(event.target.value === 'on')}
                                        style={inputStyle}
                                    >
                                        <option value="off">Desactive</option>
                                        <option value="on">Active</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Intervalle auto-sync
                                    </label>
                                    <select
                                        value={String(newPlatformSyncIntervalMinutes)}
                                        onChange={event => setNewPlatformSyncIntervalMinutes(Number(event.target.value))}
                                        style={inputStyle}
                                    >
                                        {PLATFORM_SYNC_INTERVAL_OPTIONS.map(minutes => (
                                            <option key={minutes} value={String(minutes)}>
                                                {minutes >= 60 ? `${minutes / 60}h` : `${minutes} min`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {newPlatformSyncProvider === 'woocommerce' ? (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                                URL boutique Woo
                                            </label>
                                            <input
                                                value={newWooStoreUrl}
                                                onChange={event => setNewWooStoreUrl(event.target.value)}
                                                placeholder="https://votre-boutique.com"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                                Consumer key
                                            </label>
                                            <input
                                                value={newWooConsumerKey}
                                                onChange={event => setNewWooConsumerKey(event.target.value)}
                                                placeholder="ck_xxxxxxxxxxxxxxxxx"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                                Consumer secret
                                            </label>
                                            <input
                                                value={newWooConsumerSecret}
                                                onChange={event => setNewWooConsumerSecret(event.target.value)}
                                                placeholder="cs_xxxxxxxxxxxxxxxxx"
                                                style={inputStyle}
                                            />
                                        </div>
                                    </>
                                ) : newPlatformSyncProvider === 'chariow' ? (
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                            Cle API Chariow
                                        </label>
                                        <input
                                            value={newChariowApiKey}
                                            onChange={event => setNewChariowApiKey(event.target.value)}
                                            placeholder="chariow_api_xxxxxxxxxxxxxxxxx"
                                            type="password"
                                            style={inputStyle}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                                Domaine Shopify
                                            </label>
                                            <input
                                                value={newShopifyDomain}
                                                onChange={event => setNewShopifyDomain(event.target.value)}
                                                placeholder="votre-boutique.myshopify.com"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                                Admin API token
                                            </label>
                                            <input
                                                value={newShopifyToken}
                                                onChange={event => setNewShopifyToken(event.target.value)}
                                                placeholder="shpat_xxxxxxxxxxxxxxxxx"
                                                style={inputStyle}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                                API version
                                            </label>
                                            <input
                                                value={newShopifyApiVersion}
                                                onChange={event => setNewShopifyApiVersion(event.target.value)}
                                                placeholder="2024-10"
                                                style={inputStyle}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {agentsLoading ? (
                                <div style={{ marginTop: 12, color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>
                                    Chargement des agents...
                                </div>
                            ) : activeAgents.length === 0 ? (
                                <div style={{ marginTop: 12, color: '#f59e0b', fontSize: 13 }}>
                                    Aucun agent externe disponible. Creez un agent avec ecommerce_mode = external_sync.
                                </div>
                            ) : null}

                            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                                <button
                                    onClick={createPlatformSyncConnection}
                                    disabled={creatingPlatformSync || !canCreatePlatformSync || activeAgents.length === 0}
                                    style={{
                                        ...primaryButtonStyle,
                                        opacity: creatingPlatformSync || !canCreatePlatformSync || activeAgents.length === 0 ? 0.6 : 1,
                                    }}
                                >
                                    {creatingPlatformSync ? 'Creation...' : 'Creer la connexion sync'}
                                </button>
                                <button
                                    onClick={() => {
                                        resetPlatformSyncForm()
                                        setShowPlatformSyncForm(false)
                                    }}
                                    style={secondaryButtonStyle}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <RefreshCw size={16} />
                                Sync catalogue ({platformSyncConnections.length})
                            </h2>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setShowPlatformSyncForm(value => !value)}
                                    style={primaryButtonStyle}
                                >
                                    <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Nouvelle connexion sync
                                </button>
                                <button onClick={() => void fetchPlatformSyncConnections()} style={secondaryButtonStyle}>
                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Rafraichir
                                </button>
                            </div>
                        </div>

                        {platformSyncConnectionsLoading ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                        ) : platformSyncConnections.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                                Aucune connexion de sync catalogue configuree.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {platformSyncConnections.map(connection => (
                                    <div
                                        key={connection.id}
                                        style={{
                                            borderRadius: 14,
                                            border: '1px solid var(--border, #2a2a3e)',
                                            background: 'rgba(255,255,255,0.02)',
                                            padding: 16,
                                            opacity: connection.is_active ? 1 : 0.72,
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'grid', gap: 6 }}>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 15, color: 'var(--text-primary, #fff)', fontWeight: 600 }}>
                                                        {connection.name}
                                                    </span>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: 999,
                                                        background: 'rgba(37, 211, 102, 0.15)',
                                                        color: '#25d366',
                                                        fontSize: 11,
                                                        textTransform: 'uppercase',
                                                        fontWeight: 700,
                                                    }}>
                                                        {connection.provider}
                                                    </span>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: 999,
                                                        background: 'rgba(59,130,246,0.12)',
                                                        color: '#93c5fd',
                                                        fontSize: 11,
                                                    }}>
                                                        {agentNameById.get(connection.agent_id) || connection.agent_id}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                    <span>Creee le {formatDate(connection.created_at)}</span>
                                                    <span>Dernier test: {connection.last_tested_at ? formatTime(connection.last_tested_at) : 'jamais'}</span>
                                                    {connection.last_test_status_code != null && (
                                                        <span style={{ color: statusColor(connection.last_test_status_code) }}>
                                                            Test HTTP {connection.last_test_status_code}
                                                        </span>
                                                    )}
                                                    <span>Derniere sync: {connection.last_synced_at ? formatTime(connection.last_synced_at) : 'jamais'}</span>
                                                    <span>Auto-sync: {connection.auto_sync_enabled ? 'actif' : 'off'}</span>
                                                    <span>Intervalle: {connection.sync_interval_minutes || 15} min</span>
                                                    {connection.next_retry_at && (
                                                        <span style={{ color: '#f59e0b' }}>
                                                            Prochain retry: {formatTime(connection.next_retry_at)}
                                                        </span>
                                                    )}
                                                    <span>Retry count: {connection.retry_count || 0}</span>
                                                    <span style={{
                                                        color: connection.last_sync_status === 'success'
                                                            ? '#22c55e'
                                                            : connection.last_sync_status === 'failed'
                                                                ? '#ef4444'
                                                                : 'var(--text-secondary, #9ca3af)'
                                                    }}>
                                                        Etat sync: {connection.last_sync_status}
                                                    </span>
                                                    <span>Elements sync: {connection.last_sync_count || 0}</span>
                                                    {connection.last_sync_started_at && (
                                                        <span>Debut run: {formatTime(connection.last_sync_started_at)}</span>
                                                    )}
                                                    {connection.last_sync_finished_at && (
                                                        <span>Fin run: {formatTime(connection.last_sync_finished_at)}</span>
                                                    )}
                                                </div>

                                                <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                    {connection.provider === 'woocommerce'
                                                        ? `Boutique: ${String(connection.credentials_hint?.store_url_origin || 'non renseignee')}`
                                                        : connection.provider === 'chariow'
                                                        ? `Cle API: ${String(connection.credentials_hint?.api_key_preview || '...')}`
                                                        : `Shop: ${String(connection.credentials_hint?.shop_domain || 'non renseigne')} (API ${String(connection.credentials_hint?.api_version || '2024-10')})`}
                                                </div>

                                                {connection.last_test_error && (
                                                    <div style={{ color: '#fca5a5', fontSize: 12 }}>
                                                        Erreur test: {connection.last_test_error}
                                                    </div>
                                                )}

                                                {connection.last_sync_error && (
                                                    <div style={{ color: '#fca5a5', fontSize: 12 }}>
                                                        Erreur sync: {connection.last_sync_error}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                <select
                                                    value={String(connection.sync_interval_minutes || 15)}
                                                    onChange={event => void changePlatformSyncInterval(connection, Number(event.target.value))}
                                                    disabled={savingPlatformSyncConfigId === connection.id || !connection.auto_sync_enabled}
                                                    style={{ ...inputStyle, minWidth: 120, width: 'auto', opacity: connection.auto_sync_enabled ? 1 : 0.6 }}
                                                >
                                                    {PLATFORM_SYNC_INTERVAL_OPTIONS.map(minutes => (
                                                        <option key={minutes} value={String(minutes)}>
                                                            {minutes >= 60 ? `${minutes / 60}h` : `${minutes} min`}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => void testPlatformSyncConnection(connection.id)}
                                                    disabled={testingPlatformSyncId === connection.id}
                                                    style={secondaryButtonStyle}
                                                >
                                                    {testingPlatformSyncId === connection.id ? 'Test...' : 'Tester connexion'}
                                                </button>
                                                <button
                                                    onClick={() => void syncNowPlatformSyncConnection(connection.id)}
                                                    disabled={syncingPlatformSyncId === connection.id || !connection.is_active}
                                                    style={secondaryButtonStyle}
                                                >
                                                    {syncingPlatformSyncId === connection.id ? 'Sync...' : 'Sync maintenant'}
                                                </button>
                                                <button
                                                    onClick={() => void togglePlatformSyncAuto(connection)}
                                                    disabled={savingPlatformSyncConfigId === connection.id}
                                                    style={{
                                                        ...secondaryButtonStyle,
                                                        color: connection.auto_sync_enabled ? '#25d366' : 'var(--text-secondary, #9ca3af)',
                                                        opacity: savingPlatformSyncConfigId === connection.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    {connection.auto_sync_enabled ? 'Auto-sync ON' : 'Auto-sync OFF'}
                                                </button>
                                                <button
                                                    onClick={() => void togglePlatformSyncConnection(connection)}
                                                    disabled={savingPlatformSyncConfigId === connection.id}
                                                    style={{
                                                        ...secondaryButtonStyle,
                                                        color: connection.is_active ? '#25d366' : '#ef4444',
                                                        opacity: savingPlatformSyncConfigId === connection.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                    {connection.is_active ? 'Desactiver' : 'Activer'}
                                                </button>
                                                <button
                                                    onClick={() => void togglePlatformSyncRuns(connection.id)}
                                                    style={secondaryButtonStyle}
                                                >
                                                    {expandedPlatformSyncRunsId === connection.id ? 'Masquer runs' : 'Voir runs'}
                                                </button>
                                                <button
                                                    onClick={() => void deletePlatformSyncConnection(connection.id)}
                                                    disabled={deletingPlatformSyncId === connection.id}
                                                    style={{
                                                        ...secondaryButtonStyle,
                                                        color: '#ef4444',
                                                        opacity: deletingPlatformSyncId === connection.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    {deletingPlatformSyncId === connection.id ? (
                                                        <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                    ) : (
                                                        <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                    )}
                                                    Supprimer
                                                </button>
                                            </div>
                                        </div>

                                        {expandedPlatformSyncRunsId === connection.id && (
                                            <div
                                                style={{
                                                    marginTop: 14,
                                                    paddingTop: 12,
                                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                                    display: 'grid',
                                                    gap: 8,
                                                }}
                                            >
                                                {loadingPlatformSyncRunsId === connection.id ? (
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                        Chargement des runs...
                                                    </div>
                                                ) : (platformSyncRunsByConnection[connection.id] || []).length === 0 ? (
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                        Aucun run enregistre pour cette connexion.
                                                    </div>
                                                ) : (
                                                    (platformSyncRunsByConnection[connection.id] || []).map(run => (
                                                        <div
                                                            key={run.id}
                                                            style={{
                                                                border: '1px solid var(--border, #2a2a3e)',
                                                                borderRadius: 10,
                                                                padding: '8px 10px',
                                                                fontSize: 12,
                                                                display: 'flex',
                                                                gap: 10,
                                                                flexWrap: 'wrap',
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <span style={{ color: run.status === 'success' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                                                                {run.status.toUpperCase()}
                                                            </span>
                                                            <span>Source: {run.trigger_source}</span>
                                                            <span>Fetched: {run.fetched_count}</span>
                                                            <span>Synced: {run.synced_count}</span>
                                                            <span>Has more: {run.has_more ? 'oui' : 'non'}</span>
                                                            <span>Debut: {formatTime(run.started_at)}</span>
                                                            <span>Fin: {formatTime(run.finished_at)}</span>
                                                            {run.error && (
                                                                <span style={{ color: '#fca5a5' }}>
                                                                    Erreur: {run.error}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'synced_products' && (
                <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)' }}>
                            Produits synchronises depuis vos connexions externes. Votre agent utilise ces donnees pour repondre aux questions clients.
                        </p>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                                value={syncedProductsAgentFilter}
                                onChange={event => {
                                    const val = event.target.value
                                    setSyncedProductsAgentFilter(val)
                                    fetchSyncedProducts(val)
                                }}
                                style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
                            >
                                <option value="all">Tous les agents</option>
                                {activeAgents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => fetchSyncedProducts(syncedProductsAgentFilter)}
                                style={{ ...secondaryButtonStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <RefreshCw size={13} />
                                Rafraichir
                            </button>
                        </div>
                    </div>

                    {syncedProductsLoading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>
                            Chargement...
                        </div>
                    ) : syncedProducts.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>
                            Aucun produit synchronise. Lancez une sync depuis l'onglet "Sync catalogue".
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                            {syncedProducts.map(product => {
                                const d = product.data
                                const agentName = agentNameById.get(product.agent_id) || product.agent_id.slice(0, 8)
                                const isExpanded = expandedProductIds.has(product.id)
                                const toggleExpanded = () => setExpandedProductIds(prev => {
                                    const next = new Set(prev)
                                    if (next.has(product.id)) next.delete(product.id)
                                    else next.add(product.id)
                                    return next
                                })
                                return (
                                    <div key={product.id} style={{
                                        borderRadius: 10,
                                        border: '1px solid var(--border, #2a2a3e)',
                                        background: 'rgba(255,255,255,0.02)',
                                        overflow: 'hidden',
                                    }}>
                                        {/* Header — toujours visible, cliquable */}
                                        <button
                                            onClick={toggleExpanded}
                                            style={{
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '12px 14px',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 7,
                                                background: 'rgba(255,255,255,0.06)',
                                                flexShrink: 0,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                {d.image_url ? (
                                                    <img
                                                        src={d.image_url}
                                                        alt={d.name || ''}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: 18 }}>📦</span>
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                                                        {d.name || product.external_id}
                                                    </span>
                                                    {d.price != null && (
                                                        <span style={{ fontSize: 12, color: '#25d366', fontWeight: 700, flexShrink: 0 }}>
                                                            {Number(d.price).toLocaleString('fr-FR')} {d.currency || 'XOF'}
                                                        </span>
                                                    )}
                                                    {d.provider && (
                                                        <span style={{
                                                            padding: '1px 7px',
                                                            borderRadius: 999,
                                                            background: 'rgba(37,211,102,0.12)',
                                                            color: '#25d366',
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            flexShrink: 0,
                                                        }}>
                                                            {d.provider}
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        padding: '1px 7px',
                                                        borderRadius: 999,
                                                        background: 'rgba(255,255,255,0.06)',
                                                        color: 'var(--text-secondary, #9ca3af)',
                                                        fontSize: 10,
                                                        flexShrink: 0,
                                                    }}>
                                                        {agentName}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronDown
                                                size={15}
                                                style={{
                                                    flexShrink: 0,
                                                    color: 'var(--text-secondary, #9ca3af)',
                                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    transition: 'transform 0.2s',
                                                }}
                                            />
                                        </button>

                                        {/* Détails — visibles uniquement si déplié */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '0 14px 14px 14px',
                                                borderTop: '1px solid var(--border, #2a2a3e)',
                                                paddingTop: 12,
                                                display: 'grid',
                                                gap: 8,
                                            }}>
                                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                    {d.original_price != null && (
                                                        <span>Prix original : <span style={{ textDecoration: 'line-through' }}>{Number(d.original_price).toLocaleString('fr-FR')} {d.currency || 'XOF'}</span></span>
                                                    )}
                                                    {(d as any).price_off && <span style={{ color: '#f87171' }}>-{(d as any).price_off}</span>}
                                                    {d.type && <span>Type : {d.type}</span>}
                                                    {(d as any).pricing_type && <span>Paiement : {(d as any).pricing_type}</span>}
                                                    {d.category && <span>Categorie : {d.category}</span>}
                                                    {d.stock != null && <span>Stock : {d.stock}</span>}
                                                    {(d as any).sales_count != null && <span>Ventes : {(d as any).sales_count}</span>}
                                                    {(d as any).on_sale_until && <span>Promo jusqu'au : {new Date((d as any).on_sale_until).toLocaleDateString('fr-FR')}</span>}
                                                    {d.synced_at && (
                                                        <span>Sync : {new Date(d.synced_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                    )}
                                                </div>
                                                {d.description && (
                                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                                                        {d.description}
                                                    </p>
                                                )}
                                                {d.url && (
                                                    <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#60a5fa' }}>
                                                        Voir le produit →
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {(activeTab === 'webhooks' || activeTab === 'platform_connections') && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {activeTab === 'platform_connections' && (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                            Pour Shopify, WooCommerce, Chariow ou Maketou — collez simplement l&apos;URL generee dans votre plateforme. Aucune cle API a gerer, l&apos;agent est deja configure dans la connexion.
                        </p>
                    )}
                    {activeTab === 'webhooks' && (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                            WazzapAI appellera votre URL a chaque evenement (message recu, conversation terminee, lead collecte...). Ideal pour connecter un CRM, Google Sheets ou Zapier.
                        </p>
                    )}
                    {activeTab === 'webhooks' && showWebhookForm && (
                        <div style={sectionStyle}>
                            <h2 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                                Creer un webhook
                            </h2>

                            <div style={{ display: 'grid', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        URL cible
                                    </label>
                                    <input
                                        value={newWebhookUrl}
                                        onChange={event => setNewWebhookUrl(event.target.value)}
                                        placeholder="https://votre-app.com/webhooks/wazzap"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Description
                                    </label>
                                    <input
                                        value={newWebhookDescription}
                                        onChange={event => setNewWebhookDescription(event.target.value)}
                                        placeholder="Ex: Reception des evenements CRM"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Evenements
                                    </div>
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {WEBHOOK_EVENTS.map(eventName => (
                                            <label
                                                key={eventName}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    background: 'rgba(255,255,255,0.03)',
                                                    color: 'var(--text-primary, #fff)',
                                                    fontSize: 13,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={newWebhookEvents.includes(eventName)}
                                                    onChange={() => toggleWebhookEvent(newWebhookEvents, eventName, setNewWebhookEvents)}
                                                />
                                                <span>{eventName}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                                <button
                                    onClick={createWebhook}
                                    disabled={creatingWebhook || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
                                    style={{
                                        ...primaryButtonStyle,
                                        opacity: creatingWebhook || !newWebhookUrl.trim() || newWebhookEvents.length === 0 ? 0.6 : 1,
                                    }}
                                >
                                    {creatingWebhook ? 'Creation...' : 'Creer le webhook'}
                                </button>
                                <button
                                    onClick={() => {
                                        resetWebhookForm()
                                        setShowWebhookForm(false)
                                    }}
                                    style={secondaryButtonStyle}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'platform_connections' && showPlatformConnectionForm && (
                        <div style={sectionStyle}>
                            <h2 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                                Creer une connexion plateforme directe
                            </h2>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Nom de la connexion
                                    </label>
                                    <input
                                        value={newPlatformConnectionName}
                                        onChange={event => setNewPlatformConnectionName(event.target.value)}
                                        placeholder="Ex: Boutique Shopify principale"
                                        style={inputStyle}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Plateforme
                                    </label>
                                    <select
                                        value={newPlatformProvider}
                                        onChange={event => setNewPlatformProvider(event.target.value as PlatformConnectionItem['provider'])}
                                        style={inputStyle}
                                    >
                                        {PLATFORM_PROVIDERS.map(provider => (
                                            <option key={provider.value} value={provider.value}>
                                                {provider.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Agent cible
                                    </label>
                                    <select
                                        value={newPlatformAgentId}
                                        onChange={event => setNewPlatformAgentId(event.target.value)}
                                        style={inputStyle}
                                    >
                                        {activeAgents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary, #9ca3af)' }}>
                                        Limite req/min
                                    </label>
                                    <input
                                        type="number"
                                        min={30}
                                        max={5000}
                                        value={newPlatformRateLimit}
                                        onChange={event => setNewPlatformRateLimit(Number(event.target.value))}
                                        style={inputStyle}
                                    />
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginTop: 5, opacity: 0.7 }}>
                                        60/min suffit pour la plupart des boutiques. Augmentez si vous avez un fort volume de commandes.
                                    </div>
                                </div>

                            </div>

                            {agentsLoading ? (
                                <div style={{ marginTop: 12, color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>
                                    Chargement des agents...
                                </div>
                            ) : activeAgents.length === 0 ? (
                                <div style={{ marginTop: 12, color: '#f59e0b', fontSize: 13 }}>
                                    Aucun agent externe disponible. Creez un agent avec ecommerce_mode = external_sync.
                                </div>
                            ) : null}

                            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                                <button
                                    onClick={createPlatformConnection}
                                    disabled={creatingPlatformConnection || !newPlatformConnectionName.trim() || !newPlatformAgentId || activeAgents.length === 0}
                                    style={{
                                        ...primaryButtonStyle,
                                        opacity: creatingPlatformConnection || !newPlatformConnectionName.trim() || !newPlatformAgentId || activeAgents.length === 0 ? 0.6 : 1,
                                    }}
                                >
                                    {creatingPlatformConnection ? 'Creation...' : 'Creer la connexion'}
                                </button>
                                <button
                                    onClick={() => {
                                        resetPlatformConnectionForm()
                                        setShowPlatformConnectionForm(false)
                                    }}
                                    style={secondaryButtonStyle}
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'platform_connections' && (
                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Globe size={16} />
                                Connexions plateforme directes ({platformConnections.length})
                            </h2>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setShowPlatformConnectionForm(value => !value)}
                                    style={primaryButtonStyle}
                                >
                                    <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Nouvelle connexion plateforme
                                </button>
                                <button onClick={() => void fetchPlatformConnections()} style={secondaryButtonStyle}>
                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Rafraichir
                                </button>
                            </div>
                        </div>

                        {platformConnectionsLoading ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                        ) : platformConnections.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                                Aucune connexion plateforme configuree.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {platformConnections.map(connection => {
                                    const hasFreshSecret = Boolean(connection.signing_secret)
                                    const isWebhookVisible = Boolean(revealedPlatformWebhookUrlIds[connection.id])
                                    const isSecretVisible = Boolean(revealedPlatformSecretIds[connection.id])
                                    return (
                                        <div
                                            key={connection.id}
                                            style={{
                                                borderRadius: 14,
                                                border: '1px solid var(--border, #2a2a3e)',
                                                background: 'rgba(255,255,255,0.02)',
                                                padding: 16,
                                                opacity: connection.is_active ? 1 : 0.72,
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                <div style={{ display: 'grid', gap: 6 }}>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <span style={{ fontSize: 15, color: 'var(--text-primary, #fff)', fontWeight: 600 }}>
                                                            {connection.name}
                                                        </span>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: 999,
                                                            background: 'rgba(37, 211, 102, 0.15)',
                                                            color: '#25d366',
                                                            fontSize: 11,
                                                            textTransform: 'uppercase',
                                                            fontWeight: 700,
                                                        }}>
                                                            {connection.provider}
                                                        </span>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            borderRadius: 999,
                                                            background: 'rgba(59,130,246,0.12)',
                                                            color: '#93c5fd',
                                                            fontSize: 11,
                                                        }}>
                                                            {agentNameById.get(connection.agent_id) || connection.agent_id}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                        <span>Creee le {formatDate(connection.created_at)}</span>
                                                        <span>Limite: {connection.rate_limit_per_minute}/min</span>
                                                        {connection.last_status_code != null && (
                                                            <span style={{ color: statusColor(connection.last_status_code) }}>
                                                                Dernier statut: {connection.last_status_code}
                                                            </span>
                                                        )}
                                                        {connection.last_received_at && (
                                                            <span>Derniere reception: {formatTime(connection.last_received_at)}</span>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <div style={{
                                                            padding: '8px 10px',
                                                            borderRadius: 8,
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            background: 'rgba(0,0,0,0.2)',
                                                            color: '#a5f3fc',
                                                            fontSize: 12,
                                                            fontFamily: 'monospace',
                                                            wordBreak: 'break-all',
                                                        }}>
                                                            {isWebhookVisible ? connection.webhook_url : maskWebhookUrl(connection.webhook_url)}
                                                        </div>
                                                        <button
                                                            onClick={() => toggleReveal(connection.id, setRevealedPlatformWebhookUrlIds)}
                                                            style={secondaryButtonStyle}
                                                            title={isWebhookVisible ? 'Masquer URL' : 'Afficher URL'}
                                                        >
                                                            {isWebhookVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(connection.webhook_url, `incoming_url_${connection.id}`)}
                                                            style={secondaryButtonStyle}
                                                        >
                                                            {copiedId === `incoming_url_${connection.id}` ? 'Copiee' : 'Copier URL'}
                                                        </button>
                                                    </div>

                                                    <div style={{
                                                        marginTop: 10,
                                                        padding: '10px 12px',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        fontSize: 12,
                                                        color: 'var(--text-secondary, #9ca3af)',
                                                        lineHeight: 1.6,
                                                    }}>
                                                        {connection.provider === 'chariow' && (
                                                            <>Chariow : Tableau de bord → <strong style={{ color: 'var(--text-primary, #fff)' }}>Pulses</strong> → Nouveau pulse → coller l&apos;URL ci-dessus dans &quot;URL de destination&quot;.</>
                                                        )}
                                                        {connection.provider === 'shopify' && (
                                                            <>Shopify : Admin → <strong style={{ color: 'var(--text-primary, #fff)' }}>Settings → Notifications → Webhooks</strong> → Create webhook → coller l&apos;URL ci-dessus.</>
                                                        )}
                                                        {connection.provider === 'woocommerce' && (
                                                            <>WooCommerce : Admin → <strong style={{ color: 'var(--text-primary, #fff)' }}>WooCommerce → Settings → Advanced → Webhooks</strong> → Add webhook → coller l&apos;URL ci-dessus.</>
                                                        )}
                                                        {connection.provider === 'maketou' && (
                                                            <>Maketou : Tableau de bord → <strong style={{ color: 'var(--text-primary, #fff)' }}>Integrations → Webhooks</strong> → Ajouter → coller l&apos;URL ci-dessus.</>
                                                        )}
                                                        {connection.provider === 'generic' && (
                                                            <>Coller l&apos;URL ci-dessus dans le champ &quot;Webhook URL&quot; de votre plateforme. Envoyer les evenements en POST JSON.</>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => togglePlatformConnection(connection)}
                                                        style={{
                                                            ...secondaryButtonStyle,
                                                            color: connection.is_active ? '#25d366' : '#ef4444',
                                                        }}
                                                    >
                                                        <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                        {connection.is_active ? 'Desactiver' : 'Activer'}
                                                    </button>
                                                    <button
                                                        onClick={() => void rotatePlatformConnectionSecret(connection.id)}
                                                        disabled={rotatingPlatformConnectionId === connection.id}
                                                        style={secondaryButtonStyle}
                                                    >
                                                        {rotatingPlatformConnectionId === connection.id ? 'Rotation...' : 'Regenerer secret'}
                                                    </button>
                                                    <button
                                                        onClick={() => void deletePlatformConnection(connection.id)}
                                                        disabled={deletingPlatformConnectionId === connection.id}
                                                        style={{
                                                            ...secondaryButtonStyle,
                                                            color: '#ef4444',
                                                            opacity: deletingPlatformConnectionId === connection.id ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {deletingPlatformConnectionId === connection.id ? (
                                                            <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                        ) : (
                                                            <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                        )}
                                                        Supprimer
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {(connection.allowed_events || []).map(eventName => (
                                                    <span
                                                        key={eventName}
                                                        style={{
                                                            padding: '5px 10px',
                                                            borderRadius: 999,
                                                            background: 'rgba(16,185,129,0.14)',
                                                            color: '#6ee7b7',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {eventName}
                                                    </span>
                                                ))}
                                                {(!connection.allowed_events || connection.allowed_events.length === 0) && (
                                                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                                        Tous les evenements sont acceptes
                                                    </span>
                                                )}
                                            </div>

                                            {connection.last_error && (
                                                <div style={{
                                                    marginTop: 10,
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(239,68,68,0.3)',
                                                    background: 'rgba(239,68,68,0.08)',
                                                    color: '#fca5a5',
                                                    fontSize: 12,
                                                }}>
                                                    Derniere erreur: {connection.last_error}
                                                </div>
                                            )}

                                            {(hasFreshSecret || connection.signing_secret_masked) && (
                                                <div style={{
                                                    marginTop: 12,
                                                    padding: '10px 12px',
                                                    borderRadius: 10,
                                                    border: '1px solid rgba(245,158,11,0.3)',
                                                    background: 'rgba(245,158,11,0.1)',
                                                    color: '#f59e0b',
                                                    fontSize: 13,
                                                }}>
                                                    <div style={{ marginBottom: 8 }}>
                                                        {hasFreshSecret
                                                            ? 'Copie ce secret maintenant. Il ne sera plus reaffiche.'
                                                            : 'Secret stocke (masque). Utilise Regenerer secret pour en obtenir un nouveau.'
                                                        }
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        padding: '8px 10px',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        color: '#fde68a',
                                                        fontFamily: 'monospace',
                                                        wordBreak: 'break-all',
                                                    }}>
                                                        <span style={{ flex: 1 }}>
                                                            {hasFreshSecret
                                                                ? (isSecretVisible ? connection.signing_secret : maskValue(connection.signing_secret || ''))
                                                                : connection.signing_secret_masked}
                                                        </span>
                                                        {hasFreshSecret && (
                                                            <button
                                                                onClick={() => toggleReveal(connection.id, setRevealedPlatformSecretIds)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                                                                title={isSecretVisible ? 'Masquer secret' : 'Afficher secret'}
                                                            >
                                                                {isSecretVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                                                            </button>
                                                        )}
                                                        {hasFreshSecret && (
                                                            <button
                                                                onClick={() => copyToClipboard(connection.signing_secret!, `incoming_secret_${connection.id}`)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                                                            >
                                                                {copiedId === `incoming_secret_${connection.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    )}

                    {activeTab === 'webhooks' && (
                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Globe size={16} />
                                Webhooks ({webhooks.length})
                            </h2>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setShowWebhookForm(value => !value)}
                                    style={primaryButtonStyle}
                                >
                                    <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Nouveau webhook
                                </button>
                                <button onClick={() => void fetchWebhooks()} style={secondaryButtonStyle}>
                                    <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                    Rafraichir
                                </button>
                            </div>
                        </div>

                        {webhooksLoading ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                        ) : webhooks.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                                Aucun webhook configure.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {webhooks.map(webhook => {
                                    const isEditing = editingWebhookId === webhook.id
                                    return (
                                        <div
                                            key={webhook.id}
                                            style={{
                                                borderRadius: 14,
                                                border: '1px solid var(--border, #2a2a3e)',
                                                background: 'rgba(255,255,255,0.02)',
                                                padding: 16,
                                                opacity: webhook.is_active ? 1 : 0.72,
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)', wordBreak: 'break-all' }}>
                                                        {webhook.url}
                                                    </div>
                                                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
                                                        Cree le {formatDate(webhook.created_at)}
                                                        {webhook.description ? ` - ${webhook.description}` : ''}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => toggleWebhook(webhook)}
                                                        style={{
                                                            ...secondaryButtonStyle,
                                                            color: webhook.is_active ? '#25d366' : '#ef4444',
                                                        }}
                                                    >
                                                        <Power size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                        {webhook.is_active ? 'Desactiver' : 'Activer'}
                                                    </button>
                                                    <button
                                                        onClick={() => startEditWebhook(webhook)}
                                                        style={secondaryButtonStyle}
                                                    >
                                                        Modifier
                                                    </button>
                                                    <button
                                                        onClick={() => void deleteWebhook(webhook.id)}
                                                        disabled={deletingWebhookId === webhook.id}
                                                        style={{
                                                            ...secondaryButtonStyle,
                                                            color: '#ef4444',
                                                            opacity: deletingWebhookId === webhook.id ? 0.6 : 1,
                                                        }}
                                                    >
                                                        {deletingWebhookId === webhook.id ? (
                                                            <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} />
                                                        ) : (
                                                            <Trash2 size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                        )}
                                                        Supprimer
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                                {webhook.events.map(eventName => (
                                                    <span
                                                        key={eventName}
                                                        style={{
                                                            padding: '5px 10px',
                                                            borderRadius: 999,
                                                            background: 'rgba(59,130,246,0.12)',
                                                            color: '#93c5fd',
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {eventName}
                                                    </span>
                                                ))}
                                            </div>

                                            {webhook.secret && (
                                                <div style={{
                                                    marginTop: 12,
                                                    padding: '10px 12px',
                                                    borderRadius: 10,
                                                    border: '1px solid rgba(245,158,11,0.3)',
                                                    background: 'rgba(245,158,11,0.1)',
                                                    color: '#f59e0b',
                                                    fontSize: 13,
                                                }}>
                                                    <div style={{ marginBottom: 8 }}>Copie ce secret maintenant. Il ne sera plus reaffiche.</div>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        padding: '8px 10px',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        color: '#fde68a',
                                                        fontFamily: 'monospace',
                                                        wordBreak: 'break-all',
                                                    }}>
                                                        <span style={{ flex: 1 }}>{webhook.secret}</span>
                                                        <button
                                                            onClick={() => copyToClipboard(webhook.secret!, `whsec_${webhook.id}`)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                                                        >
                                                            {copiedId === `whsec_${webhook.id}` ? <Check size={13} color="#25d366" /> : <Copy size={13} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {isEditing && (
                                                <div style={{
                                                    marginTop: 16,
                                                    paddingTop: 16,
                                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                                    display: 'grid',
                                                    gap: 12,
                                                }}>
                                                    <input
                                                        value={editingWebhookUrl}
                                                        onChange={event => setEditingWebhookUrl(event.target.value)}
                                                        style={inputStyle}
                                                    />
                                                    <input
                                                        value={editingWebhookDescription}
                                                        onChange={event => setEditingWebhookDescription(event.target.value)}
                                                        placeholder="Description"
                                                        style={inputStyle}
                                                    />
                                                    <div style={{ display: 'grid', gap: 8 }}>
                                                        {WEBHOOK_EVENTS.map(eventName => (
                                                            <label
                                                                key={eventName}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 10,
                                                                    padding: '8px 10px',
                                                                    borderRadius: 8,
                                                                    background: 'rgba(255,255,255,0.03)',
                                                                    color: 'var(--text-primary, #fff)',
                                                                    fontSize: 13,
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={editingWebhookEvents.includes(eventName)}
                                                                    onChange={() => toggleWebhookEvent(editingWebhookEvents, eventName, setEditingWebhookEvents)}
                                                                />
                                                                <span>{eventName}</span>
                                                            </label>
                                                        ))}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                        <button
                                                            onClick={saveWebhookEdit}
                                                            disabled={savingWebhookEdit || !editingWebhookUrl.trim() || editingWebhookEvents.length === 0}
                                                            style={{
                                                                ...primaryButtonStyle,
                                                                opacity: savingWebhookEdit || !editingWebhookUrl.trim() || editingWebhookEvents.length === 0 ? 0.6 : 1,
                                                            }}
                                                        >
                                                            {savingWebhookEdit ? 'Enregistrement...' : 'Enregistrer'}
                                                        </button>
                                                        <button onClick={cancelEditWebhook} style={secondaryButtonStyle}>
                                                            Annuler
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                    )}
                </div>
            )}

            {activeTab === 'logs' && (
                <div style={sectionStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Activity size={16} />
                            Logs d usage
                        </h2>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <select
                                value={logKeyFilterId}
                                onChange={event => setLogKeyFilterId(event.target.value)}
                                style={{ ...inputStyle, minWidth: 220 }}
                            >
                                <option value="all">Toutes les cles</option>
                                {keys.map(key => (
                                    <option key={key.id} value={key.id}>
                                        {key.name}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => void fetchLogs(logKeyFilterId)} style={secondaryButtonStyle}>
                                <RefreshCw size={13} style={logsLoading ? { marginRight: 6, verticalAlign: 'middle', animation: 'spin 1s linear infinite' } : { marginRight: 6, verticalAlign: 'middle' }} />
                                Rafraichir
                            </button>
                        </div>
                    </div>

                    {logsLoading ? (
                        <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>Chargement...</div>
                    ) : logs.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary, #9ca3af)', textAlign: 'center', padding: 30 }}>
                            Aucun appel API enregistre pour le filtre courant.
                        </div>
                    ) : (
                        <div style={{
                            border: '1px solid var(--border, #2a2a3e)',
                            borderRadius: 14,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '80px 1fr 90px 90px auto',
                                padding: '10px 16px',
                                borderBottom: '1px solid var(--border, #2a2a3e)',
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--text-secondary, #9ca3af)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                <span>Statut</span>
                                <span>Endpoint</span>
                                <span>Methode</span>
                                <span>Latence</span>
                                <span>Date</span>
                            </div>
                            {logs.map(log => (
                                <div
                                    key={log.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '80px 1fr 90px 90px auto',
                                        padding: '10px 16px',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        fontSize: 13,
                                        alignItems: 'center',
                                    }}
                                >
                                    <span style={{ color: statusColor(log.status_code), fontWeight: 700, fontFamily: 'monospace' }}>
                                        {log.status_code}
                                    </span>
                                    <span style={{ color: 'var(--text-primary, #fff)', fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.endpoint}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                        {log.method}
                                    </span>
                                    <span style={{ color: log.response_ms > 2000 ? '#f59e0b' : 'var(--text-secondary, #9ca3af)', fontSize: 12 }}>
                                        {log.response_ms}ms
                                    </span>
                                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 11, whiteSpace: 'nowrap' }}>
                                        {formatTime(log.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'documentation' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    <div style={sectionStyle}>
                        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BookOpen size={16} />
                            Ce que chaque endpoint fait
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                            {[
                                { method: 'POST', path: '/api/public/v1/send', desc: 'Envoi bas niveau: tu fournis deja le texte exact a envoyer.' },
                                { method: 'POST', path: '/api/public/v1/trigger', desc: 'Envoi metier: tu fournis un evenement structure, WazzapAI construit le bon message.' },
                                { method: 'POST', path: '/api/public/v1/platform-webhook', desc: 'Ingestion webhook plateforme: payload Shopify/Woo/Chariow/Maketou mappe vers un trigger.' },
                                { method: 'POST', path: '/api/public/v1/incoming/{webhook_token}', desc: 'Ingestion webhook directe (sans n8n): auth par token URL + signature HMAC fournisseur.' },
                                { method: 'POST/DELETE', path: '/api/public/v1/sync', desc: 'Memoire metier: tu pousses ou retires des donnees externes pour un agent.' },
                                { method: 'GET', path: '/api/public/v1/status', desc: 'Lecture de l etat de l agent et de sa connexion WhatsApp.' },
                                { method: 'GET', path: '/api/public/v1/conversations', desc: 'Liste les conversations accessibles a la cle.' },
                                { method: 'GET', path: '/api/public/v1/conversation', desc: 'Detaille une conversation et ses messages.' },
                            ].map(item => (
                                <div
                                    key={item.path}
                                    style={{
                                        padding: 14,
                                        borderRadius: 12,
                                        border: '1px solid var(--border, #2a2a3e)',
                                        background: 'rgba(255,255,255,0.02)',
                                    }}
                                >
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#25d366', marginBottom: 6 }}>
                                        {item.method}
                                    </div>
                                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>
                                        {item.path}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                                        {item.desc}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={16} />
                            Regles utiles
                        </h2>

                        <div style={{ display: 'grid', gap: 10, color: 'var(--text-secondary, #9ca3af)', fontSize: 13, lineHeight: 1.6 }}>
                            <div>1. Une cle sans scope agent peut appeler tous tes agents autorises sur le compte.</div>
                            <div>2. Une cle avec scope agent limite strictement les endpoints publics a ces agents la.</div>
                            <div>3. Utilise toujours un <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>idempotency_key</code> pour les evenements retry-cotes plateforme.</div>
                            <div>4. Les webhooks servent pour la sortie d evenements WazzapAI vers ta plateforme; les cles API servent pour les appels entrants de ta plateforme vers WazzapAI.</div>
                            <div>5. En mode direct <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>/incoming/{'{'}webhook_token{'}'}</code>, protege toujours le flux avec la signature HMAC de la plateforme.</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'tests' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    <div style={sectionStyle}>
                        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Code2 size={16} />
                            Exemples de tests rapides
                        </h2>

                        <div style={{ display: 'grid', gap: 16 }}>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>1. Test send</div>
                                <pre style={{
                                    margin: 0,
                                    padding: 14,
                                    borderRadius: 12,
                                    border: '1px solid var(--border, #2a2a3e)',
                                    background: 'var(--input-bg, #0f0f1a)',
                                    color: '#a5f3fc',
                                    fontSize: 12,
                                    overflowX: 'auto',
                                    lineHeight: 1.6,
                                }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/send \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-agent",
    "to": "+2250700000000",
    "message": "Bonjour ! Votre panier vous attend.",
    "idempotency_key": "cart_reminder_1001_v1"
  }'`}
                                </pre>
                            </div>

                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>2. Test trigger</div>
                                <pre style={{
                                    margin: 0,
                                    padding: 14,
                                    borderRadius: 12,
                                    border: '1px solid var(--border, #2a2a3e)',
                                    background: 'var(--input-bg, #0f0f1a)',
                                    color: '#a5f3fc',
                                    fontSize: 12,
                                    overflowX: 'auto',
                                    lineHeight: 1.6,
                                }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/trigger \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-agent",
    "event": "order_created",
    "customer": {
      "name": "Client test",
      "phone": "+2250700000000",
      "email": "client@example.com"
    },
    "order": {
      "id": "4587",
      "reference": "CMD-4587",
      "total": 12500
    },
    "idempotency_key": "order_created_4587_v1"
  }'`}
                                </pre>
                            </div>

                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>3. Test sync</div>
                                <pre style={{
                                    margin: 0,
                                    padding: 14,
                                    borderRadius: 12,
                                    border: '1px solid var(--border, #2a2a3e)',
                                    background: 'var(--input-bg, #0f0f1a)',
                                    color: '#a5f3fc',
                                    fontSize: 12,
                                    overflowX: 'auto',
                                    lineHeight: 1.6,
                                }}>
{`curl -X POST https://votre-domaine.com/api/public/v1/sync \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "uuid-agent",
    "type": "product",
    "items": [
      {
        "id": "sku_robe_noire",
        "name": "Robe noire",
        "description": "Robe de soiree elegante",
        "price": 18000,
        "stock": 5
      }
    ]
  }'`}
                                </pre>
                            </div>

                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>4. Test incoming direct (Woo)</div>
                                <pre style={{
                                    margin: 0,
                                    padding: 14,
                                    borderRadius: 12,
                                    border: '1px solid var(--border, #2a2a3e)',
                                    background: 'var(--input-bg, #0f0f1a)',
                                    color: '#a5f3fc',
                                    fontSize: 12,
                                    overflowX: 'auto',
                                    lineHeight: 1.6,
                                }}>
{`curl -X POST "https://votre-domaine.com/api/public/v1/incoming/pwk_xxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "X-WC-Webhook-Topic: order.created" \\
  -H "X-WC-Webhook-Delivery-ID: 95cbf8ad-baa4-4a0f-9d72-9ff13fe1999a" \\
  -H "X-WC-Webhook-Signature: <signature_base64>" \\
  -d '{
    "id": 4587,
    "number": "CMD-4587",
    "total": "12500",
    "billing": {
      "first_name": "Client",
      "last_name": "Direct",
      "phone": "+2250700000000"
    }
  }'`}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={16} />
                            Checklist de validation
                        </h2>
                        <div style={{ display: 'grid', gap: 10, color: 'var(--text-secondary, #9ca3af)', fontSize: 13, lineHeight: 1.6 }}>
                            <div>1. Verifier que le webhook entrant repond 200 avec une signature valide.</div>
                            <div>2. Rejouer le meme event avec le meme delivery id et verifier l en-tete <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>x-idempotent-replayed: true</code>.</div>
                            <div>3. Tester une mauvaise signature et verifier 401.</div>
                            <div>4. Confirmer qu une seule ligne outbound est creee pour un event idempotent.</div>
                            <div>5. Verifier dans l onglet Logs que les appels sont traces avec le bon code HTTP.</div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
