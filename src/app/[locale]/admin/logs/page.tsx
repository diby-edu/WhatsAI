'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    FileText, AlertCircle, CheckCircle, Info, User, Clock,
    Search, Filter, Download, RefreshCw, Loader2, XCircle,
    LogIn, LogOut, Bot, CreditCard, MessageSquare, Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LogEntry {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    action: string
    user: string
    details?: string
    ip?: string
    date: string
}

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            const supabase = createClient()
            const entries: LogEntry[] = []

            // Fetch recent user activities
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name, created_at, last_sign_in_at')
                .order('created_at', { ascending: false })
                .limit(20)

            profiles?.forEach(profile => {
                // User registration log
                const createdDate = new Date(profile.created_at)
                if (Date.now() - createdDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
                    entries.push({
                        id: `reg-${profile.id}`,
                        type: 'success',
                        action: 'Inscription utilisateur',
                        user: profile.full_name || profile.email || 'Unknown',
                        date: profile.created_at
                    })
                }

                // Last sign in log
                if (profile.last_sign_in_at) {
                    const signInDate = new Date(profile.last_sign_in_at)
                    if (Date.now() - signInDate.getTime() < 24 * 60 * 60 * 1000) {
                        entries.push({
                            id: `login-${profile.id}`,
                            type: 'info',
                            action: 'Connexion utilisateur',
                            user: profile.full_name || profile.email || 'Unknown',
                            date: profile.last_sign_in_at
                        })
                    }
                }
            })

            // Fetch recent agents created
            const { data: agents } = await supabase
                .from('agents')
                .select('id, name, created_at, user_id')
                .order('created_at', { ascending: false })
                .limit(10)

            agents?.forEach(agent => {
                const createdDate = new Date(agent.created_at)
                if (Date.now() - createdDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
                    entries.push({
                        id: `agent-${agent.id}`,
                        type: 'success',
                        action: 'Agent IA créé',
                        user: agent.name,
                        details: `ID: ${agent.id.substring(0, 8)}...`,
                        date: agent.created_at
                    })
                }
            })

            // Fetch recent conversations
            const { data: conversations } = await supabase
                .from('conversations')
                .select('id, contact_phone, contact_name, created_at')
                .order('created_at', { ascending: false })
                .limit(10)

            conversations?.forEach(conv => {
                const createdDate = new Date(conv.created_at)
                if (Date.now() - createdDate.getTime() < 3 * 24 * 60 * 60 * 1000) {
                    entries.push({
                        id: `conv-${conv.id}`,
                        type: 'info',
                        action: 'Nouvelle conversation WhatsApp',
                        user: conv.contact_name || conv.contact_phone || 'Contact',
                        date: conv.created_at
                    })
                }
            })

            // Fetch recent subscriptions
            const { data: subscriptions } = await supabase
                .from('subscriptions')
                .select('id, status, created_at, profiles(email)')
                .order('created_at', { ascending: false })
                .limit(10)

            subscriptions?.forEach((sub: any) => {
                const createdDate = new Date(sub.created_at)
                if (Date.now() - createdDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
                    entries.push({
                        id: `sub-${sub.id}`,
                        type: sub.status === 'active' ? 'success' : 'warning',
                        action: sub.status === 'active' ? 'Abonnement activé' : 'Abonnement en attente',
                        user: sub.profiles?.email || 'Utilisateur',
                        date: sub.created_at
                    })
                }
            })

            // Sort all entries by date (newest first)
            entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            // If no entries, show placeholder logs
            if (entries.length === 0) {
                entries.push({
                    id: 'system-1',
                    type: 'info',
                    action: 'Système démarré',
                    user: 'System',
                    date: new Date().toISOString()
                })
            }

            setLogs(entries.slice(0, 50))
        } catch (err) {
            console.error('Error fetching logs:', err)
            setLogs([{
                id: 'error-1',
                type: 'error',
                action: 'Erreur de chargement des logs',
                user: 'System',
                date: new Date().toISOString()
            }])
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => {
        setRefreshing(true)
        fetchLogs()
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle style={{ width: 18, height: 18, color: '#4ade80' }} />
            case 'warning': return <AlertCircle style={{ width: 18, height: 18, color: '#fbbf24' }} />
            case 'error': return <XCircle style={{ width: 18, height: 18, color: '#f87171' }} />
            default: return <Info style={{ width: 18, height: 18, color: '#60a5fa' }} />
        }
    }

    const getTypeStyle = (type: string) => {
        switch (type) {
            case 'success': return { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
            case 'warning': return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }
            case 'error': return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
            default: return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const filteredLogs = logs.filter(log => {
        const matchesFilter = filter === 'all' || log.type === filter
        const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.user.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesFilter && matchesSearch
    })

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Logs d'audit</h1>
                    <p style={{ color: '#94a3b8' }}>Journal des activités du système ({logs.length} entrées)</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <RefreshCw style={{
                            width: 16,
                            height: 16,
                            animation: refreshing ? 'spin 1s linear infinite' : 'none'
                        }} />
                        Actualiser
                    </motion.button>
                    <button
                        style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <Download style={{ width: 16, height: 16 }} />
                        Exporter
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                padding: 16,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 16,
                border: '1px solid rgba(148, 163, 184, 0.1)'
            }}>
                <div style={{ flex: '1 1 250px', position: 'relative' }}>
                    <Search style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 18,
                        height: 18,
                        color: '#64748b'
                    }} />
                    <input
                        type="text"
                        placeholder="Rechercher dans les logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 44px',
                            borderRadius: 10,
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: 'white',
                            fontSize: 14
                        }}
                    />
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: 'white',
                        minWidth: 150
                    }}
                >
                    <option value="all">Tous les types</option>
                    <option value="info">Info</option>
                    <option value="success">Succès</option>
                    <option value="warning">Avertissement</option>
                    <option value="error">Erreur</option>
                </select>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {[
                    { label: 'Total', value: logs.length, color: '#94a3b8' },
                    { label: 'Info', value: logs.filter(l => l.type === 'info').length, color: '#60a5fa' },
                    { label: 'Succès', value: logs.filter(l => l.type === 'success').length, color: '#4ade80' },
                    { label: 'Avertissements', value: logs.filter(l => l.type === 'warning').length, color: '#fbbf24' },
                    { label: 'Erreurs', value: logs.filter(l => l.type === 'error').length, color: '#f87171' },
                ].map(stat => (
                    <div
                        key={stat.label}
                        style={{
                            padding: 16,
                            borderRadius: 12,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Logs List */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflow: 'hidden'
            }}>
                {filteredLogs.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <FileText style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.5 }} />
                        <p>Aucun log correspondant</p>
                    </div>
                ) : (
                    filteredLogs.map((log, i) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(i * 0.03, 0.5) }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: '16px 24px',
                                borderBottom: i < filteredLogs.length - 1 ? '1px solid rgba(148, 163, 184, 0.05)' : 'none'
                            }}
                        >
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                ...getTypeStyle(log.type)
                            }}>
                                {getIcon(log.type)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, color: 'white', marginBottom: 4 }}>{log.action}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <User style={{ width: 14, height: 14 }} />
                                        {log.user}
                                    </span>
                                    {log.details && <span>{log.details}</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, whiteSpace: 'nowrap' }}>
                                <Clock style={{ width: 14, height: 14 }} />
                                {formatDate(log.date)}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
