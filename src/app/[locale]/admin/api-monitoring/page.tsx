'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Activity, Key, Users, AlertTriangle, CheckCircle,
    RefreshCw, Search, Power, ChevronDown, ChevronUp,
    BarChart3, Globe, TrendingUp, Shield, Clock, Zap, Database
} from 'lucide-react'

interface Stats {
    overview: {
        total_calls: number
        calls_today: number
        calls_last_7_days: number
        calls_last_30_days: number
        total_keys: number
        active_keys: number
        users_with_access: number
        total_users: number
        webhooks_active: number
        synced_data_count: number
        error_rate_percent: number
        success_rate_percent: number
        avg_response_ms: number
        last_call: { created_at: string; endpoint: string; status_code: number } | null
    }
    top_endpoints: { endpoint: string; count: number; percent: number }[]
    top_users: { user_id: string; count: number }[]
    daily_stats: { date: string; total: number; errors: number }[]
}

interface ApiKeyAdmin {
    id: string
    name: string
    key_prefix: string
    environment: 'live' | 'test'
    is_active: boolean
    rate_limit_per_minute: number
    last_used_at: string | null
    created_at: string
    user_id: string
    profiles: { full_name: string | null; email: string | null } | null
}

interface UserAccess {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    plan: string | null
    api_access_enabled: boolean | null
    created_at: string
}

interface LogEntry {
    id: string
    user_id: string
    api_key_id: string
    endpoint: string
    method: string
    status_code: number
    response_ms: number
    ip_address: string | null
    created_at: string
}

type Tab = 'overview' | 'users' | 'keys' | 'logs' | 'platforms'

const ALL_PLATFORMS = [
    { value: 'chariow',     label: 'Chariow',                    verified: true },
    { value: 'shopify',     label: 'Shopify',                    verified: false },
    { value: 'woocommerce', label: 'WooCommerce',                verified: false },
    { value: 'maketou',     label: 'Maketou',                    verified: false },
    { value: 'generic',     label: 'Webhook générique',           verified: true },
    { value: 'api_key',     label: 'Code personnalisé (API key)', verified: true },
]

const DEFAULT_ENABLED = ['chariow', 'generic', 'api_key']

export default function ApiMonitoringPage() {
    const [tab, setTab] = useState<Tab>('overview')
    const [stats, setStats] = useState<Stats | null>(null)
    const [users, setUsers] = useState<UserAccess[]>([])
    const [keys, setKeys] = useState<ApiKeyAdmin[]>([])
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [accessFilter, setAccessFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [globalEnabled, setGlobalEnabled] = useState<boolean | null>(null)
    const [savingGlobal, setSavingGlobal] = useState(false)
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
    const [dailyPeriod, setDailyPeriod] = useState<7 | 14 | 30>(14)
    const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>(DEFAULT_ENABLED)
    const [savingPlatforms, setSavingPlatforms] = useState(false)

    const fetchStats = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/api-stats')
            const result = await res.json()
            if (result.data) setStats(result.data)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ limit: '100' })
            if (search) params.set('search', search)
            if (accessFilter !== 'all') params.set('access', accessFilter)
            const res = await fetch(`/api/admin/api-users-access?${params}`)
            const result = await res.json()
            setUsers(result.data?.data || [])
        } finally {
            setLoading(false)
        }
    }, [search, accessFilter])

    const fetchKeys = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/api-keys-admin?limit=100')
            const result = await res.json()
            setKeys(result.data?.data || [])
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/api-logs-admin?limit=100')
            const result = await res.json()
            setLogs(result.data?.data || [])
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchGlobalFlag = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/features')
            const result = await res.json()
            const features = result.data?.features || []
            const flag = features.find((f: any) => f.key === 'api_public_enabled')
            setGlobalEnabled(flag?.enabled ?? false)
        } catch (_) {}
    }, [])

    const fetchEnabledPlatforms = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/platforms')
            const result = await res.json()
            if (Array.isArray(result.data?.enabledPlatforms)) {
                setEnabledPlatforms(result.data.enabledPlatforms)
            }
        } catch (_) {}
    }, [])

    const savePlatforms = async (platforms: string[]) => {
        setSavingPlatforms(true)
        try {
            await fetch('/api/admin/platforms', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledPlatforms: platforms })
            })
            setEnabledPlatforms(platforms)
        } finally { setSavingPlatforms(false) }
    }

    const togglePlatform = (value: string) => {
        const next = enabledPlatforms.includes(value)
            ? enabledPlatforms.filter(p => p !== value)
            : [...enabledPlatforms, value]
        savePlatforms(next)
    }

    useEffect(() => {
        fetchGlobalFlag()
        fetchEnabledPlatforms()
        if (tab === 'overview') fetchStats()
        else if (tab === 'users') fetchUsers()
        else if (tab === 'keys') fetchKeys()
        else if (tab === 'logs') fetchLogs()
        else if (tab === 'platforms') fetchEnabledPlatforms()
    }, [tab, fetchStats, fetchUsers, fetchKeys, fetchLogs, fetchGlobalFlag, fetchEnabledPlatforms])

    useEffect(() => {
        if (tab === 'users') fetchUsers()
    }, [search, accessFilter, tab, fetchUsers])

    const toggleGlobal = async () => {
        if (globalEnabled === null) return
        setSavingGlobal(true)
        try {
            const newVal = !globalEnabled
            const res = await fetch('/api/admin/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    features: [{ key: 'api_public_enabled', enabled: newVal }]
                })
            })
            if (res.ok) setGlobalEnabled(newVal)
        } finally {
            setSavingGlobal(false)
        }
    }

    const toggleUserAccess = async (userId: string, effectivelyActive: boolean) => {
        setTogglingId(userId)
        const newValue = !effectivelyActive
        try {
            const res = await fetch('/api/admin/api-users-access', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, api_access_enabled: newValue })
            })
            if (res.ok) {
                setUsers(prev => prev.map(u =>
                    u.id === userId ? { ...u, api_access_enabled: newValue } : u
                ))
            }
        } finally {
            setTogglingId(null)
        }
    }

    const toggleBulkAccess = async (enable: boolean) => {
        if (selectedUsers.size === 0) return
        const ids = Array.from(selectedUsers)
        const res = await fetch('/api/admin/api-users-access', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: ids, api_access_enabled: enable })
        })
        if (res.ok) {
            setUsers(prev => prev.map(u =>
                ids.includes(u.id) ? { ...u, api_access_enabled: enable } : u
            ))
            setSelectedUsers(new Set())
        }
    }

    const toggleKeyAdmin = async (key: ApiKeyAdmin) => {
        setTogglingId(key.id)
        try {
            const res = await fetch(`/api/admin/api-keys-admin/${key.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !key.is_active })
            })
            if (res.ok) {
                setKeys(prev => prev.map(k =>
                    k.id === key.id ? { ...k, is_active: !key.is_active } : k
                ))
            }
        } finally {
            setTogglingId(null)
        }
    }

    const toggleSelectUser = (id: string) => {
        setSelectedUsers(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const statusColor = (code: number) => code < 300 ? '#22c55e' : code < 400 ? '#f59e0b' : '#ef4444'

    const card = (children: React.ReactNode, style?: React.CSSProperties) => (
        <div style={{
            background: 'var(--card-bg, #1a1a2e)',
            border: '1px solid var(--border, #2a2a3e)',
            borderRadius: 14, padding: 20, ...style
        }}>
            {children}
        </div>
    )

    const tabStyle = (t: Tab): React.CSSProperties => ({
        padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: 14,
        background: tab === t ? '#25d366' : 'transparent',
        color: tab === t ? '#fff' : 'var(--text-secondary, #9ca3af)',
    })

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary, #fff)' }}>
                        Monitoring API
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary, #9ca3af)' }}>
                        Supervision de l'API publique WazzapAI
                    </p>
                </div>

                {/* Kill switch global */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: globalEnabled
                        ? 'rgba(37,211,102,0.1)'
                        : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${globalEnabled ? 'rgba(37,211,102,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    borderRadius: 12, padding: '12px 18px'
                }}>
                    <Globe size={16} color={globalEnabled ? '#25d366' : '#ef4444'} />
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)', marginBottom: 2 }}>
                            API publique
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: globalEnabled ? '#25d366' : '#ef4444' }}>
                            {globalEnabled === null ? '...' : globalEnabled ? 'ACTIVÉE' : 'DÉSACTIVÉE'}
                        </div>
                    </div>
                    <button
                        onClick={toggleGlobal}
                        disabled={savingGlobal || globalEnabled === null}
                        style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 13,
                            background: globalEnabled ? '#ef4444' : '#25d366',
                            color: '#fff', opacity: savingGlobal ? 0.6 : 1
                        }}
                    >
                        {savingGlobal ? '...' : globalEnabled ? 'Désactiver tout' : 'Activer tout'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card-bg, #1a1a2e)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                {([
                    { id: 'overview',   label: 'Vue d\'ensemble',    icon: BarChart3 },
                    { id: 'users',      label: 'Accès utilisateurs', icon: Users },
                    { id: 'keys',       label: 'Clés API',           icon: Key },
                    { id: 'logs',       label: 'Logs',               icon: Activity },
                    { id: 'platforms',  label: 'Plateformes',        icon: Globe },
                ] as { id: Tab; label: string; icon: any }[]).map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(t.id)}>
                        <t.icon size={14} style={{ display: 'inline', marginRight: 6 }} />
                        {t.label}
                    </button>
                ))}
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary, #9ca3af)' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            )}

            {/* ── TAB : VUE D'ENSEMBLE ────────────────────────────────────── */}
            {!loading && tab === 'overview' && stats && (
                <div>
                    {/* Ligne 1 — Volumes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                        {[
                            { label: 'Appels total', value: stats.overview.total_calls.toLocaleString('fr-FR'), icon: Activity, color: '#25d366' },
                            { label: 'Aujourd\'hui', value: stats.overview.calls_today.toLocaleString('fr-FR'), icon: TrendingUp, color: '#3b82f6' },
                            { label: '7 derniers jours', value: stats.overview.calls_last_7_days.toLocaleString('fr-FR'), icon: BarChart3, color: '#8b5cf6' },
                            { label: '30 derniers jours', value: stats.overview.calls_last_30_days.toLocaleString('fr-FR'), icon: BarChart3, color: '#6366f1' },
                        ].map(item => (
                            <div key={item.label} style={{
                                background: 'var(--card-bg, #1a1a2e)',
                                border: '1px solid var(--border, #2a2a3e)',
                                borderRadius: 12, padding: '14px 16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                                    <item.icon size={13} color={item.color} />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)' }}>{item.label}</span>
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Ligne 2 — Santé + Infra */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                        {[
                            {
                                label: 'Taux de succès (7j)',
                                value: `${stats.overview.success_rate_percent}%`,
                                icon: CheckCircle,
                                color: stats.overview.success_rate_percent >= 90 ? '#22c55e' : stats.overview.success_rate_percent >= 70 ? '#f59e0b' : '#ef4444'
                            },
                            {
                                label: 'Taux d\'erreur (7j)',
                                value: `${stats.overview.error_rate_percent}%`,
                                icon: AlertTriangle,
                                color: stats.overview.error_rate_percent > 10 ? '#ef4444' : '#22c55e'
                            },
                            {
                                label: 'Latence moyenne (30j)',
                                value: stats.overview.avg_response_ms > 0 ? `${stats.overview.avg_response_ms} ms` : '— ms',
                                icon: Clock,
                                color: stats.overview.avg_response_ms > 2000 ? '#ef4444' : stats.overview.avg_response_ms > 800 ? '#f59e0b' : '#06b6d4'
                            },
                            { label: 'Clés créées', value: stats.overview.total_keys.toString(), icon: Key, color: '#f59e0b' },
                            { label: 'Clés activées', value: stats.overview.active_keys.toString(), icon: Key, color: '#22c55e' },
                            { label: 'Users avec accès', value: `${stats.overview.users_with_access} / ${stats.overview.total_users}`, icon: Users, color: '#06b6d4' },
                            { label: 'Webhooks actifs', value: stats.overview.webhooks_active.toString(), icon: Zap, color: '#a855f7' },
                            { label: 'Données synchronisées', value: stats.overview.synced_data_count.toLocaleString('fr-FR'), icon: Database, color: '#14b8a6' },
                        ].map(item => (
                            <div key={item.label} style={{
                                background: 'var(--card-bg, #1a1a2e)',
                                border: '1px solid var(--border, #2a2a3e)',
                                borderRadius: 12, padding: '14px 16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                                    <item.icon size={13} color={item.color} />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)' }}>{item.label}</span>
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Dernier appel */}
                    {stats.overview.last_call && (
                        <div style={{
                            background: 'var(--card-bg, #1a1a2e)',
                            border: '1px solid var(--border, #2a2a3e)',
                            borderRadius: 12, padding: '12px 16px',
                            display: 'flex', alignItems: 'center', gap: 12,
                            marginBottom: 20, fontSize: 13
                        }}>
                            <Clock size={14} color="#9ca3af" />
                            <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>Dernier appel :</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-primary, #fff)', fontSize: 12 }}>
                                {stats.overview.last_call.endpoint}
                            </span>
                            <span style={{ fontWeight: 700, color: stats.overview.last_call.status_code < 400 ? '#22c55e' : '#ef4444' }}>
                                {stats.overview.last_call.status_code}
                            </span>
                            <span style={{ color: 'var(--text-secondary, #9ca3af)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                {new Date(stats.overview.last_call.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )}

                    {/* Grille inférieure */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

                        {/* Volume par jour */}
                        {card(
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                        Volume par jour
                                    </h3>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {([7, 14, 30] as const).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setDailyPeriod(p)}
                                                style={{
                                                    padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                                    fontSize: 11, fontWeight: 600,
                                                    background: dailyPeriod === p ? '#25d366' : 'rgba(255,255,255,0.07)',
                                                    color: dailyPeriod === p ? '#fff' : 'var(--text-secondary, #9ca3af)',
                                                }}
                                            >
                                                {p}j
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {stats.daily_stats.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>Aucune donnée</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
                                        {stats.daily_stats.slice(-dailyPeriod).reverse().map(day => (
                                            <div key={day.date} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto auto', gap: 7, alignItems: 'center', fontSize: 12 }}>
                                                <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>{day.date}</span>
                                                <div style={{
                                                    height: 5, borderRadius: 3,
                                                    background: `linear-gradient(to right, #25d366 ${100 - (day.errors / Math.max(day.total, 1) * 100)}%, #ef4444 0%)`,
                                                    opacity: 0.7
                                                }} />
                                                <span style={{ color: '#25d366', minWidth: 36, textAlign: 'right' }}>{day.total}</span>
                                                {day.errors > 0 && (
                                                    <span style={{ color: '#ef4444', minWidth: 28, textAlign: 'right' }}>-{day.errors}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Top endpoints */}
                        {card(
                            <>
                                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                    Top endpoints (30j)
                                </h3>
                                {stats.top_endpoints.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>Aucune donnée</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {stats.top_endpoints.map((ep, i) => (
                                            <div key={ep.endpoint}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                                        {ep.endpoint}
                                                    </span>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#25d366', flexShrink: 0 }}>
                                                        {ep.count.toLocaleString('fr-FR')}
                                                    </span>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
                                                    <div style={{ height: '100%', borderRadius: 2, background: i === 0 ? '#25d366' : i === 1 ? '#3b82f6' : i === 2 ? '#8b5cf6' : '#6b7280', width: `${ep.percent}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Top utilisateurs */}
                        {card(
                            <>
                                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                    Top utilisateurs (30j)
                                </h3>
                                {stats.top_users.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 13 }}>Aucune donnée</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        {stats.top_users.slice(0, 8).map((u, i) => (
                                            <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
                                                <span style={{
                                                    width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', fontSize: 10, fontWeight: 700,
                                                    background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : 'rgba(255,255,255,0.1)',
                                                    color: '#fff', flexShrink: 0
                                                }}>
                                                    {i + 1}
                                                </span>
                                                <span style={{ flex: 1, color: 'var(--text-secondary, #9ca3af)', fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.user_id.slice(0, 18)}…
                                                </span>
                                                <span style={{ color: '#25d366', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>{u.count.toLocaleString('fr-FR')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── TAB : ACCÈS UTILISATEURS ────────────────────────────────── */}
            {!loading && tab === 'users' && (
                <div>
                    {/* Barre d'outils */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Rechercher par nom ou email..."
                                style={{
                                    width: '100%', padding: '9px 10px 9px 32px',
                                    background: 'var(--input-bg, #0f0f1a)',
                                    border: '1px solid var(--border, #2a2a3e)',
                                    borderRadius: 8, color: 'var(--text-primary, #fff)',
                                    fontSize: 13, outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <select
                            value={accessFilter}
                            onChange={e => setAccessFilter(e.target.value as any)}
                            style={{
                                padding: '9px 12px', background: 'var(--input-bg, #0f0f1a)',
                                border: '1px solid var(--border, #2a2a3e)', borderRadius: 8,
                                color: 'var(--text-primary, #fff)', fontSize: 13, cursor: 'pointer'
                            }}
                        >
                            <option value="all">Tous</option>
                            <option value="enabled">Accès activé</option>
                            <option value="disabled">Accès désactivé</option>
                        </select>

                        {selectedUsers.size > 0 && (
                            <>
                                <span style={{ fontSize: 13, color: '#25d366' }}>{selectedUsers.size} sélectionné(s)</span>
                                <button
                                    onClick={() => toggleBulkAccess(true)}
                                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(37,211,102,0.15)', color: '#25d366', fontWeight: 600, fontSize: 13 }}
                                >
                                    Activer
                                </button>
                                <button
                                    onClick={() => toggleBulkAccess(false)}
                                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600, fontSize: 13 }}
                                >
                                    Désactiver
                                </button>
                            </>
                        )}
                    </div>

                    {/* Table utilisateurs */}
                    <div style={{
                        background: 'var(--card-bg, #1a1a2e)',
                        border: '1px solid var(--border, #2a2a3e)',
                        borderRadius: 14, overflow: 'hidden'
                    }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '40px 1fr 1fr 100px 100px 80px',
                            padding: '10px 16px', borderBottom: '1px solid var(--border, #2a2a3e)',
                            fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #9ca3af)',
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>
                            <span></span>
                            <span>Utilisateur</span>
                            <span>Email</span>
                            <span>Plan</span>
                            <span>Statut API</span>
                            <span>Action</span>
                        </div>

                        {users.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>
                                Aucun utilisateur trouvé
                            </div>
                        ) : users.map(u => (
                            <div
                                key={u.id}
                                style={{
                                    display: 'grid', gridTemplateColumns: '40px 1fr 1fr 100px 100px 80px',
                                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                    alignItems: 'center',
                                    background: selectedUsers.has(u.id) ? 'rgba(37,211,102,0.04)' : 'transparent'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.has(u.id)}
                                    onChange={() => toggleSelectUser(u.id)}
                                    style={{ cursor: 'pointer', accentColor: '#25d366' }}
                                />
                                <span style={{ fontSize: 13, color: 'var(--text-primary, #fff)', fontWeight: 500 }}>
                                    {u.full_name || 'Sans nom'}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {u.email || '-'}
                                </span>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                                    background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
                                    textTransform: 'uppercase', width: 'fit-content'
                                }}>
                                    {u.plan || 'free'}
                                </span>
                                {(() => {
                                    const planHasApi = ['pro', 'business', 'scale'].includes((u.plan || '').toLowerCase())
                                    const effectivelyActive = u.api_access_enabled === true || (u.api_access_enabled === null && planHasApi)
                                    const statusLabel = u.api_access_enabled === false
                                        ? 'Bloqué'
                                        : u.api_access_enabled === true
                                            ? 'Actif (manuel)'
                                            : planHasApi ? 'Actif (plan)' : 'Inactif'
                                    const statusColor = effectivelyActive ? '#25d366' : u.api_access_enabled === false ? '#ef4444' : '#9ca3af'
                                    return (<>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: statusColor }}>
                                            {effectivelyActive
                                                ? <><CheckCircle size={12} /> {statusLabel}</>
                                                : u.api_access_enabled === false
                                                    ? <><Shield size={12} /> {statusLabel}</>
                                                    : <><Shield size={12} /> {statusLabel}</>
                                            }
                                        </span>
                                        <button
                                            onClick={() => toggleUserAccess(u.id, effectivelyActive)}
                                            disabled={togglingId === u.id}
                                            style={{
                                                padding: '5px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                                fontSize: 12, fontWeight: 600,
                                                background: effectivelyActive ? 'rgba(239,68,68,0.1)' : 'rgba(37,211,102,0.15)',
                                                color: effectivelyActive ? '#ef4444' : '#25d366',
                                                opacity: togglingId === u.id ? 0.5 : 1
                                            }}
                                        >
                                            {togglingId === u.id ? '...' : effectivelyActive ? 'Bloquer' : 'Activer'}
                                        </button>
                                    </>)
                                })()}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TAB : CLÉS API ──────────────────────────────────────────── */}
            {!loading && tab === 'keys' && (
                <div style={{
                    background: 'var(--card-bg, #1a1a2e)',
                    border: '1px solid var(--border, #2a2a3e)',
                    borderRadius: 14, overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 100px 80px',
                        padding: '10px 16px', borderBottom: '1px solid var(--border, #2a2a3e)',
                        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #9ca3af)',
                        textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                        <span>Clé / Propriétaire</span>
                        <span>Email</span>
                        <span>Env</span>
                        <span>Dernière utilisation</span>
                        <span>Statut</span>
                        <span>Action</span>
                    </div>

                    {keys.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>
                            Aucune clé API
                        </div>
                    ) : keys.map(k => (
                        <div
                            key={k.id}
                            style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr 80px 100px 100px 80px',
                                padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                alignItems: 'center', opacity: k.is_active ? 1 : 0.5
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{k.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', fontFamily: 'monospace', marginTop: 2 }}>{k.key_prefix}••••</div>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary, #9ca3af)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {k.profiles?.email || '-'}
                            </span>
                            <span style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 5, fontWeight: 700,
                                background: k.environment === 'live' ? 'rgba(37,211,102,0.15)' : 'rgba(245,158,11,0.15)',
                                color: k.environment === 'live' ? '#25d366' : '#f59e0b',
                                textTransform: 'uppercase', width: 'fit-content'
                            }}>
                                {k.environment}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)' }}>
                                {k.last_used_at
                                    ? new Date(k.last_used_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                                    : 'Jamais'
                                }
                            </span>
                            <span style={{ color: k.is_active ? '#25d366' : '#ef4444', fontSize: 12, fontWeight: 600 }}>
                                {k.is_active ? 'Active' : 'Révoquée'}
                            </span>
                            <button
                                onClick={() => toggleKeyAdmin(k)}
                                disabled={togglingId === k.id}
                                title={k.is_active ? 'Révoquer' : 'Réactiver'}
                                style={{
                                    padding: '5px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                    background: k.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(37,211,102,0.1)',
                                    color: k.is_active ? '#ef4444' : '#25d366',
                                    opacity: togglingId === k.id ? 0.5 : 1
                                }}
                            >
                                <Power size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TAB : LOGS ──────────────────────────────────────────────── */}
            {!loading && tab === 'logs' && (
                <div style={{
                    background: 'var(--card-bg, #1a1a2e)',
                    border: '1px solid var(--border, #2a2a3e)',
                    borderRadius: 14, overflow: 'hidden'
                }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '70px 1fr 80px 80px auto',
                        padding: '10px 16px', borderBottom: '1px solid var(--border, #2a2a3e)',
                        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #9ca3af)',
                        textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                        <span>Statut</span>
                        <span>Endpoint</span>
                        <span>Méthode</span>
                        <span>Latence</span>
                        <span>Date</span>
                    </div>

                    {logs.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #9ca3af)', fontSize: 14 }}>
                            Aucun log
                        </div>
                    ) : logs.map(log => (
                        <div
                            key={log.id}
                            style={{
                                display: 'grid', gridTemplateColumns: '70px 1fr 80px 80px auto',
                                padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                alignItems: 'center', fontSize: 12
                            }}
                        >
                            <span style={{ fontWeight: 700, fontFamily: 'monospace', color: statusColor(log.status_code) }}>
                                {log.status_code}
                            </span>
                            <span style={{ color: 'var(--text-primary, #fff)', fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.endpoint}
                            </span>
                            <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>{log.method}</span>
                            <span style={{ color: log.response_ms > 2000 ? '#f59e0b' : 'var(--text-secondary, #9ca3af)' }}>
                                {log.response_ms}ms
                            </span>
                            <span style={{ color: 'var(--text-secondary, #9ca3af)', whiteSpace: 'nowrap' }}>
                                {new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'platforms' && (
                <div style={{ maxWidth: 680 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Plateformes disponibles</h3>
                    <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                        Activez ou désactivez les plateformes accessibles aux utilisateurs dans leur module API.
                        Les plateformes non vérifiées sont désactivées par défaut.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {ALL_PLATFORMS.map(p => {
                            const isEnabled = enabledPlatforms.includes(p.value)
                            return (
                                <div key={p.value} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 18px', borderRadius: 10,
                                    background: 'rgba(30,41,59,0.6)',
                                    border: `1px solid ${isEnabled ? 'rgba(37,211,102,0.2)' : 'rgba(100,116,139,0.15)'}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 15, fontWeight: 600, color: isEnabled ? '#f1f5f9' : '#64748b' }}>{p.label}</span>
                                        {p.verified
                                            ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(37,211,102,0.1)', color: '#25d366', fontWeight: 700 }}>Vérifié</span>
                                            : <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700 }}>Non vérifié</span>
                                        }
                                    </div>
                                    <button
                                        disabled={savingPlatforms}
                                        onClick={() => togglePlatform(p.value)}
                                        style={{
                                            padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                                            fontWeight: 600, fontSize: 12,
                                            background: isEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(37,211,102,0.15)',
                                            color: isEnabled ? '#ef4444' : '#25d366',
                                        }}
                                    >
                                        {savingPlatforms ? '...' : isEnabled ? 'Désactiver' : 'Activer'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
