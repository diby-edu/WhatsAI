'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
    Activity,
    AlertCircle,
    BookOpen,
    Check,
    Clock,
    Code2,
    Copy,
    Globe,
    Key,
    Plus,
    Power,
    RefreshCw,
    Shield,
    Trash2
} from 'lucide-react'

type TabId = 'keys' | 'webhooks' | 'logs' | 'docs'
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

const WEBHOOK_EVENTS = [
    'message.received',
    'message.sent',
    'conversation.started',
    'conversation.ended',
    'lead.collected',
] as const

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
    const [logs, setLogs] = useState<UsageLog[]>([])
    const [agents, setAgents] = useState<AgentSummary[]>([])

    const [keysLoading, setKeysLoading] = useState(true)
    const [webhooksLoading, setWebhooksLoading] = useState(true)
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
        void Promise.all([fetchKeys(), fetchAgents(), fetchWebhooks()])
    }, [fetchAgents, fetchKeys, fetchWebhooks])

    useEffect(() => {
        if (activeTab === 'logs') {
            void fetchLogs(logKeyFilterId)
        }
    }, [activeTab, logKeyFilterId, fetchLogs])

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

    const tabs = [
        { id: 'keys' as const, label: 'Cles API', icon: Key, count: keys.length },
        { id: 'webhooks' as const, label: 'Webhooks', icon: Globe, count: webhooks.length },
        { id: 'logs' as const, label: 'Logs', icon: Activity, count: undefined },
        { id: 'docs' as const, label: 'Documentation & Tests', icon: BookOpen, count: undefined },
    ]

    return (
        <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary, #fff)' }}>
                        API publique
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary, #9ca3af)', maxWidth: 760 }}>
                        Gere tes cles, limite chaque cle a un ou plusieurs agents, branche tes webhooks et verifie rapidement les appels entrants sans modifier le comportement prod des endpoints publics.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                        onClick={() => {
                            setActiveTab('keys')
                            setShowKeyForm(value => !value)
                        }}
                        style={primaryButtonStyle}
                    >
                        <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Nouvelle cle
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('webhooks')
                            setShowWebhookForm(value => !value)
                        }}
                        style={secondaryButtonStyle}
                    >
                        <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Nouveau webhook
                    </button>
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
                            <button onClick={() => void fetchKeys()} style={secondaryButtonStyle}>
                                <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Rafraichir
                            </button>
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

            {activeTab === 'webhooks' && (
                <div style={{ display: 'grid', gap: 20 }}>
                    {showWebhookForm && (
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

                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Globe size={16} />
                                Webhooks ({webhooks.length})
                            </h2>
                            <button onClick={() => void fetchWebhooks()} style={secondaryButtonStyle}>
                                <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Rafraichir
                            </button>
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

            {activeTab === 'docs' && (
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
                            <Code2 size={16} />
                            Exemples rapides
                        </h2>

                        <div style={{ display: 'grid', gap: 16 }}>
                            <div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>1. Send</div>
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
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>2. Trigger</div>
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
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>3. Sync</div>
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
                                <div style={{ fontSize: 13, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>4. Platform Webhook</div>
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
{`curl -X POST "https://votre-domaine.com/api/public/v1/platform-webhook?agent_id=uuid-agent" \\
  -H "Authorization: Bearer sk_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -H "X-WC-Webhook-Topic: order.created" \\
  -H "X-WC-Webhook-Delivery-ID: 95cbf8ad-baa4-4a0f-9d72-9ff13fe1999a" \\
  -d '{
    "id": 4587,
    "number": "CMD-4587",
    "total": "12500",
    "billing": {
      "first_name": "Client",
      "last_name": "Test",
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
                            Regles utiles
                        </h2>

                        <div style={{ display: 'grid', gap: 10, color: 'var(--text-secondary, #9ca3af)', fontSize: 13, lineHeight: 1.6 }}>
                            <div>1. Une cle sans scope agent peut appeler tous tes agents autorises sur le compte.</div>
                            <div>2. Une cle avec scope agent limite strictement les endpoints publics a ces agents la.</div>
                            <div>3. Utilise toujours un <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>idempotency_key</code> pour les evenements retry-cotes plateforme.</div>
                            <div>4. Les webhooks servent pour la sortie d evenements WazzapAI vers ta plateforme; les cles API servent pour les appels entrants de ta plateforme vers WazzapAI.</div>
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
