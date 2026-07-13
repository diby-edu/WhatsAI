'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mail, Search, CheckCircle, XCircle, Clock, RefreshCw, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface EmailLog {
    id: string
    user_id: string | null
    email: string
    type: string
    subject: string
    status: 'sent' | 'failed' | 'pending'
    failure_reason: string | null
    sent_at: string | null
    created_at: string
    profiles?: { full_name: string | null } | null
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    low_credits:           { label: 'Crédits faibles',      color: '#fbbf24' },
    credits_depleted:      { label: 'Crédits épuisés',       color: '#ef4444' },
    subscription_expiring: { label: 'Abonnement expirant',   color: '#f97316' },
    payment_received:      { label: 'Paiement reçu',         color: '#10b981' },
    account_deleted:       { label: 'Compte supprimé',       color: '#64748b' },
}

const STATUS_CONFIG = {
    sent:    { label: 'Envoyé',   color: '#10b981', icon: CheckCircle },
    failed:  { label: 'Échec',    color: '#ef4444', icon: XCircle     },
    pending: { label: 'En attente', color: '#fbbf24', icon: Clock     },
}

export default function AdminEmailsPage() {
    const [logs, setLogs] = useState<EmailLog[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterType, setFilterType] = useState<string>('all')
    const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 })

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('email_logs')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(500)
            if (error) throw error
            const rows = (data ?? []) as EmailLog[]
            setLogs(rows)
            const total = rows.length
            const sent = rows.filter(l => l.status === 'sent').length
            const failed = rows.filter(l => l.status === 'failed').length
            setStats({ total, sent, failed })
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchLogs() }, [fetchLogs])

    const filtered = logs.filter(log => {
        const matchSearch = searchQuery === '' ||
            log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.profiles?.full_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.subject.toLowerCase().includes(searchQuery.toLowerCase())
        const matchStatus = filterStatus === 'all' || log.status === filterStatus
        const matchType = filterType === 'all' || log.type === filterType
        return matchSearch && matchStatus && matchType
    })

    function exportCSV() {
        const header = 'Date,Email,Nom,Type,Sujet,Statut,Erreur'
        const rows = filtered.map(l => [
            new Date(l.created_at).toLocaleString('fr-FR'),
            l.email,
            l.profiles?.full_name ?? '',
            TYPE_LABELS[l.type]?.label ?? l.type,
            `"${l.subject.replace(/"/g, '""')}"`,
            l.status,
            l.failure_reason ?? '',
        ].join(','))
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `emails_${new Date().toISOString().slice(0,10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const deliveryRate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', margin: 0 }}>
                        Emails transactionnels
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                        Historique des emails envoyés · {stats.total} emails · taux de livraison {deliveryRate}%
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={fetchLogs}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                    >
                        <RefreshCw style={{ width: 14, height: 14 }} />
                        Actualiser
                    </button>
                    <button
                        onClick={exportCSV}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', cursor: 'pointer', fontSize: 13 }}
                    >
                        <Download style={{ width: 14, height: 14 }} />
                        CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                    { label: 'Total envoyés', value: stats.total, color: '#94a3b8' },
                    { label: 'Livrés', value: stats.sent, color: '#10b981' },
                    { label: 'Échecs', value: stats.failed, color: '#ef4444' },
                ].map(stat => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 16, padding: '20px 24px' }}
                    >
                        <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#64748b' }} />
                    <input
                        placeholder="Rechercher par email, nom, sujet..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', fontSize: 13, cursor: 'pointer', outline: 'none' }}
                >
                    <option value="all">Tous les statuts</option>
                    <option value="sent">Envoyés</option>
                    <option value="failed">Échecs</option>
                    <option value="pending">En attente</option>
                </select>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', fontSize: 13, cursor: 'pointer', outline: 'none' }}
                >
                    <option value="all">Tous les types</option>
                    {Object.entries(TYPE_LABELS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 24, overflowX: 'auto', overflowY: 'hidden' }}
            >
                {/* Table header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'grid', gridTemplateColumns: '180px 1fr 160px 120px 80px', minWidth: 700, gap: 16, alignItems: 'center' }}>
                    {['DESTINATAIRE', 'SUJET', 'TYPE', 'STATUT', 'DATE'].map(col => (
                        <span key={col} style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</span>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw style={{ width: 24, height: 24, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                        Chargement...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                        <Mail style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
                        {logs.length === 0 ? 'Aucun email enregistré' : 'Aucun résultat pour ces filtres'}
                    </div>
                ) : (
                    filtered.map((log, i) => {
                        const statusCfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.pending
                        const StatusIcon = statusCfg.icon
                        const typeCfg = TYPE_LABELS[log.type]
                        return (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.02 }}
                                style={{ padding: '14px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', display: 'grid', gridTemplateColumns: '180px 1fr 160px 120px 80px', minWidth: 700, gap: 16, alignItems: 'center' }}
                                title={log.failure_reason ?? undefined}
                            >
                                {/* Destinataire */}
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: 13, color: 'white', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {log.profiles?.full_name ?? log.email.split('@')[0]}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {log.email}
                                    </div>
                                </div>

                                {/* Sujet */}
                                <div style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {log.subject}
                                </div>

                                {/* Type */}
                                <div>
                                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${typeCfg?.color ?? '#64748b'}20`, color: typeCfg?.color ?? '#94a3b8', fontWeight: 500 }}>
                                        {typeCfg?.label ?? log.type}
                                    </span>
                                </div>

                                {/* Statut */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <StatusIcon style={{ width: 14, height: 14, color: statusCfg.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: statusCfg.color }}>{statusCfg.label}</span>
                                </div>

                                {/* Date */}
                                <div style={{ fontSize: 11, color: '#475569' }}>
                                    {new Date(log.sent_at ?? log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                    <br />
                                    {new Date(log.sent_at ?? log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </motion.div>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
