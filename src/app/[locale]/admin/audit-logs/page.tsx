'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    History, Search, Filter, Loader2, User, Globe,
    Smartphone, AlertCircle, Info, Ban, RefreshCw,
    CreditCard, DollarSign, Package, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react'
import { TableSkeleton } from '@/components/admin/AdminSkeletons'

export default function AdminAuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    // Pagination state
    const [page, setPage] = useState(1)
    const [meta, setMeta] = useState<any>(null)
    const pageSize = 20

    useEffect(() => {
        fetchLogs()
    }, [page])

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/audit-logs?page=${page}&pageSize=${pageSize}`)
            const json = await res.json()
            if (json.data) {
                setLogs(json.data)
                setMeta(json.meta)
            }
        } catch (err) {
            console.error('Failed to fetch audit logs:', err)
        } finally {
            setLoading(false)
        }
    }

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'ban_user':
            case 'bulk_ban_users': return <Ban size={18} color="#ef4444" />
            case 'unban_user':
            case 'bulk_unban_users': return <RefreshCw size={18} color="#34d399" />
            case 'reset_credits': return <CreditCard size={18} color="#f59e0b" />
            case 'set_credits': return <CreditCard size={18} color="#60a5fa" />
            case 'change_role':
            case 'bulk_change_role': return <User size={18} color="#a78bfa" />
            case 'update_user_profile': return <Info size={18} color="#94a3b8" />
            case 'delete_user': return <Trash2 size={18} color="#ef4444" />
            case 'create_payout': return <DollarSign size={18} color="#10b981" />
            case 'process_payout': return <Package size={18} color="#34d399" />
            default: return <History size={18} color="#94a3b8" />
        }
    }

    const filteredLogs = logs.filter(log =>
        log.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target_id?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.1); }
                ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.3); }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 8 }}>
                        Audit Trail
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 16 }}>
                        Historique complet des actions administratives.
                        {meta ? ` (${meta.total} événements)` : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher dans cette page..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 12,
                                padding: '10px 12px 10px 40px',
                                color: 'white',
                                width: 280,
                                fontSize: 14,
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Logs List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 24,
                    overflow: 'hidden'
                }}
            >
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 2fr 1.2fr', gap: 20 }}>
                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</span>
                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Par (Admin)</span>
                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cible</span>
                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Détails (Metadata)</span>
                    <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</span>
                </div>

                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ padding: 24 }}>
                            <TableSkeleton rows={8} />
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div style={{ padding: 100, textAlign: 'center', color: '#64748b' }}>
                            <History size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <p>Aucun log trouvé.</p>
                        </div>
                    ) : filteredLogs.map((log, i) => (
                        <div key={log.id} style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                            display: 'grid',
                            gridTemplateColumns: '1.5fr 1.5fr 1fr 2fr 1.2fr',
                            gap: 20,
                            alignItems: 'center',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.02)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(148, 163, 184, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {getActionIcon(log.action_type)}
                                </div>
                                <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>{log.action_type.replace(/_/g, ' ')}</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{log.profiles?.full_name || 'Admin'}</span>
                                <span style={{ color: '#64748b', fontSize: 12 }}>{log.profiles?.email}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', padding: '2px 8px', borderRadius: 6, fontWeight: 500 }}>
                                    {log.target_type || 'system'}
                                </span>
                                <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>{log.target_id?.slice(0, 8)}...</span>
                            </div>

                            <div style={{ color: '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {JSON.stringify(log.metadata) !== '{}' ? JSON.stringify(log.metadata) : '—'}
                            </div>

                            <div style={{ color: '#64748b', fontSize: 13 }}>
                                {new Date(log.created_at).toLocaleString('fr-FR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Pagination Controls */}
            {meta && meta.last_page > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12 }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        style={{
                            padding: '8px 12px', borderRadius: 8, background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)', color: page === 1 ? '#475569' : '#e2e8f0',
                            cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        <ChevronLeft size={16} /> Précédent
                    </button>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>
                        Page <span style={{ color: 'white', fontWeight: 600 }}>{page}</span> sur {meta.last_page}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                        disabled={page === meta.last_page || loading}
                        style={{
                            padding: '8px 12px', borderRadius: 8, background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)', color: page === meta.last_page ? '#475569' : '#e2e8f0',
                            cursor: page === meta.last_page ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        Suivant <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    )
}
