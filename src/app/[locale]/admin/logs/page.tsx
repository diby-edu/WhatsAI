'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    FileText, AlertCircle, CheckCircle, Info, User, Clock,
    Search, Download, RefreshCw, Loader2, XCircle,
    Bot, CreditCard, Shield, Settings, LogIn, Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type LogCategory = 'tous' | 'auth' | 'paiements' | 'agents' | 'systeme' | 'admin'
type LogType = 'info' | 'success' | 'warning' | 'error'

interface LogEntry {
    id: string
    category: LogCategory
    type: LogType
    action: string
    user: string
    details?: string
    date: string
}

const CATEGORIES: { key: LogCategory; label: string; icon: React.ElementType }[] = [
    { key: 'tous', label: 'Tous', icon: FileText },
    { key: 'auth', label: 'Auth', icon: LogIn },
    { key: 'paiements', label: 'Paiements', icon: CreditCard },
    { key: 'agents', label: 'Agents', icon: Bot },
    { key: 'systeme', label: 'Système', icon: Settings },
    { key: 'admin', label: 'Admin', icon: Shield },
]

const CATEGORY_COLOR: Record<LogCategory, string> = {
    tous: '#94a3b8',
    auth: '#60a5fa',
    paiements: '#34d399',
    agents: '#a78bfa',
    systeme: '#f59e0b',
    admin: '#f87171',
}

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [category, setCategory] = useState<LogCategory>('tous')
    const [typeFilter, setTypeFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => { fetchLogs() }, [])

    const fetchLogs = async () => {
        try {
            const supabase = createClient()
            const entries: LogEntry[] = []
            const now = Date.now()
            const days30 = 30 * 24 * 60 * 60 * 1000

            // ── AUTH ─────────────────────────────────────────────────────────
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name, created_at, last_sign_in_at')
                .order('created_at', { ascending: false })
                .limit(50)

            profiles?.forEach(p => {
                if (now - new Date(p.created_at).getTime() < days30) {
                    entries.push({
                        id: `reg-${p.id}`,
                        category: 'auth',
                        type: 'success',
                        action: 'Inscription utilisateur',
                        user: p.full_name || p.email || 'Inconnu',
                        details: p.email,
                        date: p.created_at
                    })
                }
                if (p.last_sign_in_at && now - new Date(p.last_sign_in_at).getTime() < days30) {
                    entries.push({
                        id: `login-${p.id}`,
                        category: 'auth',
                        type: 'info',
                        action: 'Connexion',
                        user: p.full_name || p.email || 'Inconnu',
                        details: p.email,
                        date: p.last_sign_in_at
                    })
                }
            })

            // ── PAIEMENTS ─────────────────────────────────────────────────────
            const { data: payments } = await supabase
                .from('payments')
                .select('id, amount, currency, status, payment_type, created_at, profiles(email, full_name)')
                .order('created_at', { ascending: false })
                .limit(30)

            payments?.forEach((pay: any) => {
                if (now - new Date(pay.created_at).getTime() < days30) {
                    const isSuccess = pay.status === 'completed' || pay.status === 'success'
                    const amount = pay.amount ? `${Number(pay.amount).toLocaleString('fr-FR')} ${pay.currency || 'XOF'}` : ''
                    entries.push({
                        id: `pay-${pay.id}`,
                        category: 'paiements',
                        type: isSuccess ? 'success' : pay.status === 'failed' ? 'error' : 'warning',
                        action: pay.payment_type === 'subscription' ? 'Paiement abonnement' : pay.payment_type === 'credits' ? 'Achat crédits' : 'Paiement',
                        user: pay.profiles?.full_name || pay.profiles?.email || 'Utilisateur',
                        details: amount,
                        date: pay.created_at
                    })
                }
            })

            const { data: subscriptions } = await supabase
                .from('subscriptions')
                .select('id, status, plan, created_at, profiles(email, full_name)')
                .order('created_at', { ascending: false })
                .limit(20)

            subscriptions?.forEach((sub: any) => {
                if (now - new Date(sub.created_at).getTime() < days30) {
                    entries.push({
                        id: `sub-${sub.id}`,
                        category: 'paiements',
                        type: sub.status === 'active' ? 'success' : 'warning',
                        action: sub.status === 'active' ? 'Abonnement activé' : 'Abonnement en attente',
                        user: sub.profiles?.full_name || sub.profiles?.email || 'Utilisateur',
                        details: sub.plan ? `Plan ${sub.plan}` : undefined,
                        date: sub.created_at
                    })
                }
            })

            // ── AGENTS ────────────────────────────────────────────────────────
            const { data: agents } = await supabase
                .from('agents')
                .select('id, name, created_at, whatsapp_ever_connected, whatsapp_connected, updated_at')
                .order('created_at', { ascending: false })
                .limit(30)

            agents?.forEach(agent => {
                if (now - new Date(agent.created_at).getTime() < days30) {
                    entries.push({
                        id: `agent-${agent.id}`,
                        category: 'agents',
                        type: 'success',
                        action: 'Agent IA créé',
                        user: agent.name,
                        details: `ID: ${agent.id.substring(0, 8)}…`,
                        date: agent.created_at
                    })
                }
                if (agent.whatsapp_ever_connected && now - new Date(agent.updated_at).getTime() < days30) {
                    entries.push({
                        id: `wa-${agent.id}`,
                        category: 'agents',
                        type: agent.whatsapp_connected ? 'success' : 'warning',
                        action: agent.whatsapp_connected ? 'WhatsApp connecté' : 'WhatsApp déconnecté',
                        user: agent.name,
                        date: agent.updated_at
                    })
                }
            })

            // ── SYSTÈME ───────────────────────────────────────────────────────
            const { data: cronLogs } = await supabase
                .from('system_deletion_audit_logs')
                .select('id, email, deletion_reason, deletion_result, created_at')
                .order('created_at', { ascending: false })
                .limit(50)

            cronLogs?.forEach(log => {
                if (now - new Date(log.created_at).getTime() < days30) {
                    entries.push({
                        id: `cron-${log.id}`,
                        category: 'systeme',
                        type: log.deletion_result === 'deleted' ? 'success' : log.deletion_result === 'failed' ? 'error' : 'info',
                        action: log.deletion_result === 'deleted' ? 'Compte test supprimé (cron)' : log.deletion_result === 'failed' ? 'Suppression cron échouée' : 'Cron ignoré',
                        user: log.email || 'Système',
                        details: log.deletion_reason,
                        date: log.created_at
                    })
                }
            })

            // ── ADMIN ─────────────────────────────────────────────────────────
            const { data: adminLogs } = await supabase
                .from('admin_audit_logs')
                .select('id, admin_id, action_type, target_type, target_id, metadata, created_at, profiles(email, full_name)')
                .order('created_at', { ascending: false })
                .limit(50)

            adminLogs?.forEach((log: any) => {
                if (now - new Date(log.created_at).getTime() < days30) {
                    const isDestructive = ['delete', 'ban', 'suspend', 'reset'].some(k => log.action_type?.toLowerCase().includes(k))
                    entries.push({
                        id: `admin-${log.id}`,
                        category: 'admin',
                        type: isDestructive ? 'warning' : 'info',
                        action: log.action_type || 'Action admin',
                        user: log.profiles?.full_name || log.profiles?.email || `Admin ${log.admin_id?.substring(0, 8)}`,
                        details: log.target_type ? `${log.target_type} · ${String(log.target_id || '').substring(0, 8)}` : undefined,
                        date: log.created_at
                    })
                }
            })

            entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setLogs(entries.slice(0, 200))
        } catch (err) {
            console.error('Error fetching logs:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => { setRefreshing(true); fetchLogs() }

    const getTypeIcon = (type: LogType) => {
        switch (type) {
            case 'success': return <CheckCircle style={{ width: 16, height: 16, color: '#4ade80' }} />
            case 'warning': return <AlertCircle style={{ width: 16, height: 16, color: '#fbbf24' }} />
            case 'error': return <XCircle style={{ width: 16, height: 16, color: '#f87171' }} />
            default: return <Info style={{ width: 16, height: 16, color: '#60a5fa' }} />
        }
    }

    const getCategoryIcon = (cat: LogCategory) => {
        const C = CATEGORIES.find(c => c.key === cat)?.icon || FileText
        return <C style={{ width: 14, height: 14 }} />
    }

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const filtered = logs.filter(log => {
        const matchCat = category === 'tous' || log.category === category
        const matchType = typeFilter === 'all' || log.type === typeFilter
        const matchSearch = !searchQuery ||
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details || '').toLowerCase().includes(searchQuery.toLowerCase())
        return matchCat && matchType && matchSearch
    })

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 4 }}>Logs Activité</h1>
                    <p style={{ color: '#64748b', fontSize: 13 }}>{logs.length} entrées · 30 derniers jours</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleRefresh} disabled={refreshing} style={{
                        padding: '9px 14px', borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
                    }}>
                        <RefreshCw style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Actualiser
                    </button>
                    <button style={{
                        padding: '9px 14px', borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
                    }}>
                        <Download style={{ width: 14, height: 14 }} /> Exporter
                    </button>
                </div>
            </div>

            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORIES.map(({ key, label, icon: Icon }) => {
                    const count = key === 'tous' ? logs.length : logs.filter(l => l.category === key).length
                    const active = category === key
                    const color = CATEGORY_COLOR[key]
                    return (
                        <button
                            key={key}
                            onClick={() => setCategory(key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                                cursor: 'pointer', transition: 'all 0.15s ease',
                                backgroundColor: active ? `${color}20` : 'rgba(30, 41, 59, 0.5)',
                                border: `1px solid ${active ? `${color}50` : 'rgba(148, 163, 184, 0.1)'}`,
                                color: active ? color : '#64748b'
                            }}
                        >
                            <Icon style={{ width: 13, height: 13 }} />
                            {label}
                            <span style={{
                                fontSize: 11, fontWeight: 700,
                                backgroundColor: active ? `${color}30` : 'rgba(148, 163, 184, 0.1)',
                                color: active ? color : '#64748b',
                                padding: '1px 6px', borderRadius: 10
                            }}>{count}</span>
                        </button>
                    )
                })}
            </div>

            {/* Search + type filter */}
            <div style={{
                display: 'flex', gap: 12, flexWrap: 'wrap',
                padding: 14, background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 14, border: '1px solid rgba(148, 163, 184, 0.1)'
            }}>
                <div style={{ flex: '1 1 250px', position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Rechercher action, utilisateur, détail…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 40px', borderRadius: 9,
                            background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: 'white', fontSize: 13, outline: 'none'
                        }}
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{
                        padding: '10px 14px', borderRadius: 9, fontSize: 13,
                        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: 'white', minWidth: 140, outline: 'none'
                    }}
                >
                    <option value="all">Tous les niveaux</option>
                    <option value="info">Info</option>
                    <option value="success">Succès</option>
                    <option value="warning">Avertissement</option>
                    <option value="error">Erreur</option>
                </select>
            </div>

            {/* Results count */}
            <div style={{ fontSize: 12, color: '#475569' }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>{filtered.length}</span> résultat{filtered.length !== 1 ? 's' : ''}
                {category !== 'tous' && <span> dans <span style={{ color: CATEGORY_COLOR[category] }}>{CATEGORIES.find(c => c.key === category)?.label}</span></span>}
            </div>

            {/* Logs list */}
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 16, overflow: 'hidden' }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
                        <FileText style={{ width: 36, height: 36, marginBottom: 12, opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 14 }}>Aucun log correspondant</p>
                    </div>
                ) : (
                    filtered.map((log, i) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '13px 20px',
                                borderBottom: i < filtered.length - 1 ? '1px solid rgba(148, 163, 184, 0.04)' : 'none'
                            }}
                        >
                            {/* Type icon */}
                            <div style={{ flexShrink: 0 }}>{getTypeIcon(log.type)}</div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                    <span style={{ fontWeight: 500, color: 'white', fontSize: 13 }}>{log.action}</span>
                                    {/* Category badge */}
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                        fontSize: 10, fontWeight: 600,
                                        color: CATEGORY_COLOR[log.category],
                                        backgroundColor: `${CATEGORY_COLOR[log.category]}15`,
                                        padding: '2px 7px', borderRadius: 8,
                                        textTransform: 'uppercase', letterSpacing: '0.04em'
                                    }}>
                                        {getCategoryIcon(log.category)}
                                        {log.category}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <User style={{ width: 11, height: 11 }} />
                                        {log.user}
                                    </span>
                                    {log.details && <span style={{ color: '#475569' }}>{log.details}</span>}
                                </div>
                            </div>

                            {/* Date */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                <Clock style={{ width: 12, height: 12 }} />
                                {formatDate(log.date)}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    )
}
