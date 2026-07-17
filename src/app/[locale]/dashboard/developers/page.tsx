'use client'

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
    Activity,
    AlertCircle,
    BookOpen,
    ChevronDown,
    Code2,
    Globe
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type {
    TabId,
    ScopeMode,
    AgentSummary,
    ApiKey,
    UsageLog,
    WebhookItem,
    PlatformConnectionItem,
    PlatformProvider,
    FormProvider,
    PlatformEventOption,
    PlatformSyncConnectionItem,
    PlatformSyncRunItem,
    SyncedProduct,
} from './types'
import {
    WEBHOOK_EVENTS,
    PLATFORM_PROVIDERS,
    PROVIDER_PLACEHOLDERS,
    PROVIDER_DESCRIPTIONS,
    PLATFORM_SYNC_PROVIDERS,
    PLATFORM_SYNC_INTERVAL_OPTIONS,
    PLATFORM_EVENT_OPTIONS,
} from './constants'
import {
    sectionStyle,
    inputStyle,
    secondaryButtonStyle,
    primaryButtonStyle,
    normalizeScopeMode,
} from './styles'
import { DocumentationTab } from './components/DocumentationTab'
import { TestsTab } from './components/TestsTab'
import { LogsTab } from './components/LogsTab'
import { WebhooksTab } from './components/WebhooksTab'
import { ApiKeysSection } from './components/ApiKeysSection'
import { PlatformConnectionsSection } from './components/PlatformConnectionsSection'

export default function DevelopersPage() {
    const toast = useToast()
    const [activeTab, setActiveTab] = useState<TabId>('platform_connections')
    const [pageError, setPageError] = useState<string | null>(null)
    const [userPlan, setUserPlan] = useState<string | null>(null)
    const [apiAccessEnabled, setApiAccessEnabled] = useState<boolean | null>(null)
    const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>(['chariow', 'generic', 'api_key'])

    useEffect(() => {
        const loadAccess = async () => {
            try {
                const [profileRes, configRes] = await Promise.all([
                    fetch('/api/profile'),
                    fetch('/api/public/runtime-config'),
                ])
                const profileJson = await profileRes.json()
                const profile = profileJson.data?.profile || profileJson.data || profileJson
                setUserPlan((profile.plan || 'free').toLowerCase())
                setApiAccessEnabled(profile.api_access_enabled ?? null)

                const configJson = await configRes.json()
                if (Array.isArray(configJson.data?.enabledPlatforms)) {
                    setEnabledPlatforms(configJson.data.enabledPlatforms)
                }
            } catch { setUserPlan('free') }
        }
        loadAccess()
    }, [])

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
    const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set())
    const [agentsLoading, setAgentsLoading] = useState(true)

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
    const [newPlatformProvider, setNewPlatformProvider] = useState<FormProvider>('shopify')
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

    const allActiveAgents = useMemo(
        () => agents.filter(agent => !agent.archived_at),
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
        const ok = await toast.confirm({ title: 'Supprimer cette clé API ?', message: 'Les intégrations qui l\'utilisent s\'arrêteront.', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return

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
        const ok = await toast.confirm({ title: 'Supprimer ce webhook ?', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return

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
            setActiveTab('platform_connections')
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
        const ok = await toast.confirm({ title: 'Supprimer cette connexion de sync catalogue ?', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return

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
        if (!newPlatformConnectionName.trim()) return

        // Cas API key : créer une clé via l'endpoint keys
        if (newPlatformProvider === 'api_key') {
            setCreatingPlatformConnection(true)
            setPageError(null)
            try {
                const res = await fetch('/api/developer/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newPlatformConnectionName.trim(),
                        environment: newKeyEnv,
                        rate_limit_per_minute: newKeyLimit,
                        allowed_agent_ids: newKeyAllowedAgentIds.length > 0 ? newKeyAllowedAgentIds : null,
                    }),
                })
                const result = await res.json()
                if (!res.ok) throw new Error(result.error || 'Erreur lors de la creation de la cle')
                const createdKey: ApiKey = result.data
                setKeys(prev => [createdKey, ...prev])
                setExpandedKeyId(createdKey.id)
                setRevealedKeyId(createdKey.id)
                resetPlatformConnectionForm()
                setShowPlatformConnectionForm(false)
            } catch (error: any) {
                setPageError(error.message || 'Erreur lors de la creation de la cle')
            } finally {
                setCreatingPlatformConnection(false)
            }
            return
        }

        if (!newPlatformAgentId) return
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
        const ok = await toast.confirm({ title: 'Supprimer cette connexion plateforme ?', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return

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
        { id: 'platform_connections' as const, label: 'API', icon: Globe, count: keys.length + platformConnections.length },
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

    const planHasApi = userPlan !== null && ['pro', 'business', 'scale'].includes(userPlan)
    const isDisabledByAdmin = apiAccessEnabled === false

    if (userPlan !== null && !planHasApi && apiAccessEnabled !== true) {
        return (
            <div style={{ padding: 24, maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Mode Développeur — Plan Pro requis</h2>
                <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                    L'accès à l'API WazzapAI vous permet de connecter votre boutique, votre CRM ou tout outil externe directement à WhatsApp. Disponible à partir du plan <strong style={{ color: '#34d399' }}>Pro</strong>.
                </p>
                <a href="/dashboard/billing" style={{
                    display: 'inline-block', padding: '12px 28px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #25d366, #1aab55)',
                    color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none'
                }}>
                    Passer au plan Pro
                </a>
            </div>
        )
    }

    if (isDisabledByAdmin) {
        return (
            <div style={{ padding: 24, maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Accès API désactivé</h2>
                <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                    L'accès à l'API a été temporairement désactivé pour votre compte. Contactez le support pour plus d'informations.
                </p>
            </div>
        )
    }

    return (
        <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary, #fff)' }}>
                        API publique
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary, #9ca3af)', maxWidth: 760 }}>
                        Onglet API : connectez vos plateformes ou votre code pour envoyer des événements vers WazzapAI. Onglet Webhooks : recevez les événements WazzapAI sur votre propre URL. Onglet Logs : suivez chaque appel. Onglet Tests : exemples prêts à copier.
                    </p>
                </div>
                {activeTab === 'platform_connections' && (
                    <button
                        onClick={() => setShowPlatformConnectionForm(v => !v)}
                        className="btn-create-key"
                    >
                        <span className="plus-icon">+</span>
                        Créer une clé
                    </button>
                )}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {activeTab === 'platform_connections' && (
                <ApiKeysSection
                    keys={keys}
                    keysLoading={keysLoading}
                    fetchKeys={fetchKeys}
                    expandedKeyId={expandedKeyId}
                    setExpandedKeyId={setExpandedKeyId}
                    editingKeyId={editingKeyId}
                    revealedKeyId={revealedKeyId}
                    setRevealedKeyId={setRevealedKeyId}
                    copiedId={copiedId}
                    copyToClipboard={copyToClipboard}
                    describeAgentScope={describeAgentScope}
                    setLogKeyFilterId={setLogKeyFilterId}
                    setActiveTab={setActiveTab}
                    startEditKeyScope={startEditKeyScope}
                    toggleKey={toggleKey}
                    deleteKey={deleteKey}
                    deletingKeyId={deletingKeyId}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    agentNameById={agentNameById}
                    activeAgents={activeAgents}
                    editingKeyAllowedAgentIds={editingKeyAllowedAgentIds}
                    setEditingKeyAllowedAgentIds={setEditingKeyAllowedAgentIds}
                    toggleAgentSelection={toggleAgentSelection}
                    saveKeyScope={saveKeyScope}
                    savingKeyScope={savingKeyScope}
                    cancelEditKeyScope={cancelEditKeyScope}
                />
            )}

            {activeTab === 'webhooks' && (
                <WebhooksTab
                    webhooks={webhooks}
                    webhooksLoading={webhooksLoading}
                    fetchWebhooks={fetchWebhooks}
                    showWebhookForm={showWebhookForm}
                    setShowWebhookForm={setShowWebhookForm}
                    newWebhookUrl={newWebhookUrl}
                    setNewWebhookUrl={setNewWebhookUrl}
                    newWebhookDescription={newWebhookDescription}
                    setNewWebhookDescription={setNewWebhookDescription}
                    newWebhookEvents={newWebhookEvents}
                    setNewWebhookEvents={setNewWebhookEvents}
                    toggleWebhookEvent={toggleWebhookEvent}
                    createWebhook={createWebhook}
                    creatingWebhook={creatingWebhook}
                    resetWebhookForm={resetWebhookForm}
                    editingWebhookId={editingWebhookId}
                    editingWebhookUrl={editingWebhookUrl}
                    setEditingWebhookUrl={setEditingWebhookUrl}
                    editingWebhookDescription={editingWebhookDescription}
                    setEditingWebhookDescription={setEditingWebhookDescription}
                    editingWebhookEvents={editingWebhookEvents}
                    setEditingWebhookEvents={setEditingWebhookEvents}
                    startEditWebhook={startEditWebhook}
                    saveWebhookEdit={saveWebhookEdit}
                    savingWebhookEdit={savingWebhookEdit}
                    cancelEditWebhook={cancelEditWebhook}
                    toggleWebhook={toggleWebhook}
                    deleteWebhook={deleteWebhook}
                    deletingWebhookId={deletingWebhookId}
                    copyToClipboard={copyToClipboard}
                    copiedId={copiedId}
                    formatDate={formatDate}
                />
            )}

            {activeTab === 'platform_connections' && (
                <PlatformConnectionsSection
                    showPlatformConnectionForm={showPlatformConnectionForm}
                    setShowPlatformConnectionForm={setShowPlatformConnectionForm}
                    newPlatformProvider={newPlatformProvider}
                    setNewPlatformProvider={setNewPlatformProvider}
                    newPlatformConnectionName={newPlatformConnectionName}
                    setNewPlatformConnectionName={setNewPlatformConnectionName}
                    enabledPlatforms={enabledPlatforms}
                    newKeyEnv={newKeyEnv}
                    setNewKeyEnv={setNewKeyEnv}
                    newKeyLimit={newKeyLimit}
                    setNewKeyLimit={setNewKeyLimit}
                    activeAgents={activeAgents}
                    newPlatformAgentId={newPlatformAgentId}
                    setNewPlatformAgentId={setNewPlatformAgentId}
                    newPlatformRateLimit={newPlatformRateLimit}
                    setNewPlatformRateLimit={setNewPlatformRateLimit}
                    agentsLoading={agentsLoading}
                    allActiveAgents={allActiveAgents}
                    newKeyAllowedAgentIds={newKeyAllowedAgentIds}
                    setNewKeyAllowedAgentIds={setNewKeyAllowedAgentIds}
                    toggleAgentSelection={toggleAgentSelection}
                    createPlatformConnection={createPlatformConnection}
                    creatingPlatformConnection={creatingPlatformConnection}
                    resetPlatformConnectionForm={resetPlatformConnectionForm}
                    platformConnections={platformConnections}
                    platformConnectionsLoading={platformConnectionsLoading}
                    fetchPlatformConnections={fetchPlatformConnections}
                    revealedPlatformWebhookUrlIds={revealedPlatformWebhookUrlIds}
                    setRevealedPlatformWebhookUrlIds={setRevealedPlatformWebhookUrlIds}
                    revealedPlatformSecretIds={revealedPlatformSecretIds}
                    setRevealedPlatformSecretIds={setRevealedPlatformSecretIds}
                    agentNameById={agentNameById}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    statusColor={statusColor}
                    maskWebhookUrl={maskWebhookUrl}
                    maskValue={maskValue}
                    toggleReveal={toggleReveal}
                    copyToClipboard={copyToClipboard}
                    copiedId={copiedId}
                    togglePlatformConnection={togglePlatformConnection}
                    rotatePlatformConnectionSecret={rotatePlatformConnectionSecret}
                    rotatingPlatformConnectionId={rotatingPlatformConnectionId}
                    deletePlatformConnection={deletePlatformConnection}
                    deletingPlatformConnectionId={deletingPlatformConnectionId}
                />
            )}

            {activeTab === 'logs' && (
                <LogsTab
                    logKeyFilterId={logKeyFilterId}
                    setLogKeyFilterId={setLogKeyFilterId}
                    keys={keys}
                    fetchLogs={fetchLogs}
                    logsLoading={logsLoading}
                    logs={logs}
                    expandedLogIds={expandedLogIds}
                    setExpandedLogIds={setExpandedLogIds}
                    statusColor={statusColor}
                    formatTime={formatTime}
                />
            )}

            {activeTab === 'documentation' && <DocumentationTab />}

            {activeTab === 'tests' && <TestsTab />}

            </div>{/* end flex sections wrapper */}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,0.5), 0 4px 14px rgba(37,211,102,0.3); }
                    50%       { box-shadow: 0 0 0 10px rgba(37,211,102,0), 0 4px 14px rgba(37,211,102,0.3); }
                }
                .btn-create-key {
                    background: linear-gradient(135deg, #25d366, #1aab55);
                    color: #fff;
                    border: 1.5px solid rgba(37,211,102,0.6);
                    border-radius: 10px;
                    padding: 11px 22px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    animation: pulse-glow 2s ease-in-out infinite;
                    transition: box-shadow 0.2s;
                    font-family: inherit;
                }
                .btn-create-key:hover {
                    box-shadow: 0 0 0 4px rgba(37,211,102,0.2), 0 6px 20px rgba(37,211,102,0.5);
                }
                .btn-create-key .plus-icon {
                    display: inline-block;
                    font-size: 18px;
                    line-height: 1;
                    transition: transform 0.25s ease;
                }
                .btn-create-key:hover .plus-icon {
                    transform: rotate(90deg);
                }
            `}</style>
        </div>
    )
}
