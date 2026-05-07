'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CreditCard, Users, TrendingUp, FileText, Loader2, RefreshCw,
    DollarSign, Edit, XCircle, Zap, X, Download, Search, Package, Eye
} from 'lucide-react'

interface Subscription {
    id: string
    user: string
    email: string
    plan: string
    credits: number
    status: string
    startDate: string
}

interface Stats {
    activeSubscriptions: number
    monthlyRevenue: number
    monthlyRevenueSub: number
    monthlyRevenueCredits: number
    totalRevenue: number
    totalRevenueSub: number
    totalRevenueCredits: number
    totalCreditPacksCount: number
    totalSubsCount: number
    newThisMonth: number
    totalUsers: number
}

export default function AdminSubscriptionsPage() {
    const [activeTab, setActiveTab] = useState<'subscriptions' | 'credits' | 'verify'>('subscriptions')
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [creditPayments, setCreditPayments] = useState<any[]>([])
    const [allPayments, setAllPayments] = useState<any[]>([])
    const [stats, setStats] = useState<Stats>({ activeSubscriptions: 0, monthlyRevenue: 0, monthlyRevenueSub: 0, monthlyRevenueCredits: 0, totalRevenue: 0, totalRevenueSub: 0, totalRevenueCredits: 0, totalCreditPacksCount: 0, totalSubsCount: 0, newThisMonth: 0, totalUsers: 0 })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [editSub, setEditSub] = useState<Subscription | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [checkingPayment, setCheckingPayment] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    // Filtres abonnements
    const [subSearch, setSubSearch] = useState('')
    const [subPlanFilter, setSubPlanFilter] = useState('all')

    // Filtres packs de crédits
    const [creditSearch, setCreditSearch] = useState('')
    const [creditStatusFilter, setCreditStatusFilter] = useState('all')

    // Filtres vérification paiements
    const [verifySearch, setVerifySearch] = useState('')
    const [verifyStatusFilter, setVerifyStatusFilter] = useState('all')

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const [subRes, payRes] = await Promise.all([
                fetch('/api/admin/subscriptions'),
                fetch('/api/admin/payments')
            ])
            if (subRes.ok) {
                const data = await subRes.json()
                setSubscriptions(data.data?.subscriptions || [])
                setStats(data.data?.stats || stats)
            }
            if (payRes.ok) {
                const data = await payRes.json()
                const allPays = data.data?.payments || []
                const credits = allPays.filter((p: any) => p.payment_type === 'credits')
                setCreditPayments(credits)
                setAllPayments(allPays)
            }
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false); setRefreshing(false)
        }
    }

    const handleAction = async (userId: string, action: string, extraData?: any) => {
        setActionLoading(userId)
        try {
            const res = await fetch(`/api/admin/subscriptions/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extraData })
            })
            const data = await res.json()
            if (data.success) {
                await fetchData()
                setEditSub(null)
            } else {
                alert(data.error || 'Erreur')
            }
        } catch {
            alert('Erreur réseau')
        } finally {
            setActionLoading(null)
        }
    }

    const verifyPaymentStatus = async (transactionId: string) => {
        setCheckingPayment(transactionId)
        try {
            const res = await fetch('/api/payments/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: transactionId })
            })
            const data = await res.json()
            const rawStatus = data.data?.status || data.status || 'UNKNOWN'
            const mapped = mapHostedStatus(rawStatus)

            // Mettre à jour l'état local
            setAllPayments(prev => prev.map((p: any) =>
                p.transaction_id === transactionId ? { ...p, status: mapped } : p
            ))

            // Persister en DB si le statut est terminal (failed, completed, cancelled)
            if (['failed', 'completed', 'cancelled'].includes(mapped)) {
                const payment = allPayments.find((p: any) => p.transaction_id === transactionId)
                if (payment?.id) {
                    await fetch(`/api/admin/payments/${payment.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: mapped })
                    })
                }
            }
        } catch (err) {
            console.error('Error verifying:', err)
        } finally {
            setCheckingPayment(null)
        }
    }

    const mapHostedStatus = (s: string): string => {
        switch (s) {
            case 'ACCEPTED': return 'completed'
            case 'REFUSED': return 'failed'
            case 'CANCELLED': return 'cancelled'
            case 'UNKNOWN': return 'failed'
            default: return 'pending'
        }
    }

    const getVerifyStatusBadge = (status: string) => {
        const map: Record<string, { bg: string; color: string; text: string }> = {
            completed: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', text: 'Réussi' },
            pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'En attente' },
            processing: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'En cours' },
            failed: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Échoué' },
            cancelled: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', text: 'Annulé' },
        }
        const s = map[status] || map.pending
        return <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>{s.text}</span>
    }

    const exportCSV = () => {
        if (activeTab === 'subscriptions') {
            const header = 'Utilisateur,Email,Plan,Crédits,Statut,Date\n'
            const rows = filteredSubscriptions.map(s => `"${s.user}","${s.email}","${s.plan}",${s.credits},"${s.status}","${s.startDate}"`).join('\n')
            const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = 'abonnements.csv'; a.click()
            URL.revokeObjectURL(url)
        } else {
            const header = 'Utilisateur,Email,Pack,Montant,Crédits,Statut,Date\n'
            const rows = filteredCreditPayments.map((p: any) => `"${p.user_name || ''}","${p.user_email || ''}","${p.description || ''}",${p.amount || 0},${p.credits_purchased || 0},"${p.status}","${new Date(p.created_at).toLocaleDateString('fr-FR')}"`).join('\n')
            const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = 'packs-credits.csv'; a.click()
            URL.revokeObjectURL(url)
        }
    }

    const fmt = (n: number) => n.toLocaleString('fr-FR')

    const statCards = [
        { label: 'Total inscrits', value: stats.totalUsers.toString(), icon: Users, color: '#3b82f6' },
        { label: 'Abonnés actifs', value: stats.activeSubscriptions.toString(), icon: CreditCard, color: '#10b981' },
        { label: 'Revenus ce mois (total)', value: `${fmt(stats.monthlyRevenue)} F`, icon: TrendingUp, color: '#a855f7' },
        { label: '↳ dont abonnements', value: `${fmt(stats.monthlyRevenueSub)} F`, icon: FileText, color: '#8b5cf6' },
        { label: '↳ dont crédits', value: `${fmt(stats.monthlyRevenueCredits)} F`, icon: Zap, color: '#06b6d4' },
        { label: 'Revenus totaux (all time)', value: `${fmt(stats.totalRevenue)} F`, icon: DollarSign, color: '#f59e0b' },
        { label: 'Total abonnements vendus', value: stats.totalSubsCount.toString(), icon: FileText, color: '#34d399' },
        { label: 'Total packs crédits vendus', value: stats.totalCreditPacksCount.toString(), icon: Package, color: '#f97316' },
        { label: 'Nouveaux abonnements/mois', value: stats.newThisMonth.toString(), icon: TrendingUp, color: '#ef4444' },
    ]

    const getPlanColors = (plan: string) => {
        switch (plan.toLowerCase()) {
            case 'business': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
            case 'pro': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            case 'starter': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', label: 'Complété' }
            case 'pending': return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', label: 'En attente' }
            case 'failed': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', label: 'Échoué' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', label: status }
        }
    }

    const filteredSubscriptions = subscriptions.filter(s => {
        const matchSearch = !subSearch ||
            s.user.toLowerCase().includes(subSearch.toLowerCase()) ||
            s.email.toLowerCase().includes(subSearch.toLowerCase())
        const matchPlan = subPlanFilter === 'all' || s.plan.toLowerCase() === subPlanFilter
        return matchSearch && matchPlan
    })

    const filteredCreditPayments = creditPayments.filter((p: any) => {
        const matchSearch = !creditSearch ||
            (p.full_name || p.user_name || '').toLowerCase().includes(creditSearch.toLowerCase()) ||
            (p.email || p.user_email || p.customer_email || '').toLowerCase().includes(creditSearch.toLowerCase())
        const matchStatus = creditStatusFilter === 'all' || p.status === creditStatusFilter
        return matchSearch && matchStatus
    })

    const filteredVerifyPayments = allPayments.filter((p: any) => {
        const matchSearch = !verifySearch ||
            (p.transaction_id || '').toLowerCase().includes(verifySearch.toLowerCase()) ||
            (p.profiles?.email || p.user_email || '').toLowerCase().includes(verifySearch.toLowerCase()) ||
            (p.profiles?.full_name || p.full_name || '').toLowerCase().includes(verifySearch.toLowerCase())
        const matchStatus = verifyStatusFilter === 'all' || p.status === verifyStatusFilter
        return matchSearch && matchStatus
    })

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    const tabStyle = (active: boolean) => ({
        padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
        background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
        color: active ? '#60a5fa' : '#64748b',
        borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Paiements</h1>
                    <p style={{ color: '#94a3b8' }}>Gestion des abonnements, packs de crédits et vérification des paiements</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} style={{
                        padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.1)',
                        background: 'rgba(30, 41, 59, 0.5)', color: '#94a3b8', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
                    }}>
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={() => { setRefreshing(true); fetchData() }} disabled={refreshing}
                        style={{
                            padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.1)',
                            background: 'rgba(30, 41, 59, 0.5)', color: '#94a3b8', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                        <RefreshCw style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'start' }}>
                {statCards.map((stat) => (
                    <motion.div key={stat.label} whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 12
                        }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12, background: `${stat.color}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <stat.icon style={{ width: 20, height: 20, color: stat.color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{stat.label}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: 0 }}>
                <button style={tabStyle(activeTab === 'subscriptions')} onClick={() => setActiveTab('subscriptions')}>
                    <CreditCard size={14} style={{ display: 'inline', marginRight: 6 }} />
                    Abonnements ({subscriptions.length})
                </button>
                <button style={tabStyle(activeTab === 'credits')} onClick={() => setActiveTab('credits')}>
                    <Package size={14} style={{ display: 'inline', marginRight: 6 }} />
                    Packs de Crédits ({creditPayments.length})
                </button>
                <button style={tabStyle(activeTab === 'verify')} onClick={() => setActiveTab('verify')}>
                    <Eye size={14} style={{ display: 'inline', marginRight: 6 }} />
                    Vérification Paiement ({allPayments.length})
                </button>
            </div>

            {/* Search + Filter bar */}
            {activeTab === 'verify' ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 200,
                        padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10
                    }}>
                        <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                        <input
                            type="text" placeholder="Transaction ID, email, nom..."
                            value={verifySearch} onChange={e => setVerifySearch(e.target.value)}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 13 }}
                        />
                    </div>
                    <select value={verifyStatusFilter} onChange={e => setVerifyStatusFilter(e.target.value)}
                        style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10, color: 'white', fontSize: 13, cursor: 'pointer' }}>
                        <option value="all">Tous les statuts</option>
                        <option value="completed">Réussis</option>
                        <option value="pending">En attente</option>
                        <option value="processing">En cours</option>
                        <option value="failed">Échoués</option>
                    </select>
                </div>
            ) : activeTab === 'subscriptions' ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 200,
                        padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10
                    }}>
                        <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                        <input
                            type="text" placeholder="Rechercher un utilisateur..."
                            value={subSearch} onChange={e => setSubSearch(e.target.value)}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 13 }}
                        />
                    </div>
                    <select value={subPlanFilter} onChange={e => setSubPlanFilter(e.target.value)}
                        style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10, color: 'white', fontSize: 13, cursor: 'pointer' }}>
                        <option value="all">Tous les plans</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                        <option value="scale">Scale</option>
                    </select>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 200,
                        padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10
                    }}>
                        <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                        <input
                            type="text" placeholder="Rechercher un acheteur..."
                            value={creditSearch} onChange={e => setCreditSearch(e.target.value)}
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 13 }}
                        />
                    </div>
                    <select value={creditStatusFilter} onChange={e => setCreditStatusFilter(e.target.value)}
                        style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10, color: 'white', fontSize: 13, cursor: 'pointer' }}>
                        <option value="all">Tous les statuts</option>
                        <option value="completed">Complétés</option>
                        <option value="pending">En attente</option>
                        <option value="failed">Échoués</option>
                    </select>
                </div>
            )}

            {/* Table */}
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 16, overflow: 'hidden' }}>
                <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>

                    {activeTab === 'verify' ? (
                        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                            <thead>
                                <tr>
                                    {['Transaction', 'Utilisateur', 'Montant', 'Provider', 'Statut', 'Date', 'Actions'].map(h => (
                                        <th key={h} style={{
                                            padding: '14px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                                            background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVerifyPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                                            <Eye style={{ width: 32, height: 32, color: '#64748b', margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Aucun paiement trouvé</h3>
                                            <p style={{ color: '#64748b', fontSize: 13 }}>Les transactions apparaîtront ici.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredVerifyPayments.map((p: any) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0' }}>
                                                {p.transaction_id ? `${p.transaction_id.slice(0, 14)}...` : 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{p.profiles?.full_name || p.full_name || '-'}</div>
                                                <div style={{ color: '#64748b', fontSize: 11 }}>{p.profiles?.email || p.user_email || '-'}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 600, fontSize: 13 }}>
                                                {(p.amount || 0).toLocaleString('fr-FR')} {p.currency || 'F'}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>
                                                {p.payment_provider || p.payment_method || '-'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {getVerifyStatusBadge(p.status)}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>
                                                <div>{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
                                                <div style={{ fontSize: 11, color: '#475569' }}>{new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {p.transaction_id && (p.status === 'pending' || p.status === 'processing') && (
                                                    <button
                                                        onClick={() => verifyPaymentStatus(p.transaction_id)}
                                                        disabled={checkingPayment === p.transaction_id}
                                                        style={{
                                                            padding: '6px 12px', borderRadius: 8,
                                                            background: 'rgba(59, 130, 246, 0.15)', border: 'none',
                                                            color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                                            display: 'flex', alignItems: 'center', gap: 4,
                                                            opacity: checkingPayment === p.transaction_id ? 0.5 : 1
                                                        }}>
                                                        {checkingPayment === p.transaction_id
                                                            ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                                                            : <><Eye size={12} /> Vérifier</>
                                                        }
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : activeTab === 'subscriptions' ? (
                        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                            <thead>
                                <tr>
                                    {['Utilisateur', 'Email', 'Plan', 'Crédits', 'Statut', 'Inscrit le', 'Actions'].map(h => (
                                        <th key={h} style={{
                                            padding: '14px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                                            background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubscriptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                                            <FileText style={{ width: 32, height: 32, color: '#64748b', margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Aucun abonnement trouvé</h3>
                                            <p style={{ color: '#64748b', fontSize: 13 }}>Les abonnements payants apparaîtront ici.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSubscriptions.map((sub) => {
                                        const pc = getPlanColors(sub.plan)
                                        return (
                                            <tr key={sub.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500, fontSize: 13 }}>{sub.user}</td>
                                                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{sub.email}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color, textTransform: 'capitalize' }}>
                                                        {sub.plan}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 600, fontSize: 13 }}>
                                                    {sub.credits.toLocaleString()}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
                                                        Actif
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{sub.startDate}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={() => setEditSub(sub)} title="Modifier plan"
                                                            style={{ padding: 7, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', border: 'none', cursor: 'pointer' }}>
                                                            <Edit style={{ width: 14, height: 14, color: '#60a5fa' }} />
                                                        </button>
                                                        <button onClick={() => { if (confirm(`Annuler l'abonnement de ${sub.user} ?`)) handleAction(sub.id, 'cancel') }}
                                                            title="Annuler abonnement" disabled={actionLoading === sub.id}
                                                            style={{ padding: 7, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', opacity: actionLoading === sub.id ? 0.5 : 1 }}>
                                                            <XCircle style={{ width: 14, height: 14, color: '#f87171' }} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                            <thead>
                                <tr>
                                    {['Utilisateur', 'Email', 'Pack', 'Montant', 'Crédits', 'Statut', 'Date'].map(h => (
                                        <th key={h} style={{
                                            padding: '14px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                                            background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCreditPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                                            <Package style={{ width: 32, height: 32, color: '#64748b', margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Aucun achat de pack trouvé</h3>
                                            <p style={{ color: '#64748b', fontSize: 13 }}>Les achats de packs de crédits apparaîtront ici.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCreditPayments.map((p: any) => {
                                        const sc = getStatusColor(p.status)
                                        return (
                                            <tr key={p.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500, fontSize: 13 }}>{p.full_name || p.user_name || '-'}</td>
                                                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{p.email || p.user_email || p.customer_email || '-'}</td>
                                                <td style={{ padding: '12px 16px', color: '#e2e8f0', fontSize: 13 }}>{p.description || '-'}</td>
                                                <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 600, fontSize: 13 }}>
                                                    {(p.amount || 0).toLocaleString('fr-FR')} F
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#a78bfa', fontWeight: 600, fontSize: 13 }}>
                                                    {(p.credits_purchased || 0).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                                                    <div>{new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
                                                    <div style={{ fontSize: 11, color: '#475569' }}>
                                                        {new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Edit Subscription Modal */}
            <AnimatePresence>
                {editSub && (
                    <EditSubModal
                        sub={editSub}
                        onClose={() => setEditSub(null)}
                        onChangePlan={(plan, billing_period) => handleAction(editSub.id, 'change_plan', { plan, billing_period })}
                        onSetCredits={(credits) => handleAction(editSub.id, 'set_credits', { credits })}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function EditSubModal({ sub, onClose, onChangePlan, onSetCredits }: {
    sub: Subscription; onClose: () => void
    onChangePlan: (plan: string, billing_period: 'monthly' | 'annual') => void; onSetCredits: (credits: number) => void
}) {
    const [plan, setPlan] = useState(sub.plan)
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
    const [credits, setCredits] = useState(sub.credits)

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: 10,
        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.15)',
        color: 'white', fontSize: 14, outline: 'none'
    }

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    zIndex: 101, width: 'min(420px, 92vw)', background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 16, padding: 'clamp(16px, 4vw, 24px)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>Modifier l'abonnement</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{sub.user} — {sub.email}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Changer le plan</label>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            {(['monthly', 'annual'] as const).map(p => (
                                <button key={p} onClick={() => setBillingPeriod(p)} style={{
                                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    border: billingPeriod === p ? '1px solid #3b82f6' : '1px solid rgba(148,163,184,0.15)',
                                    background: billingPeriod === p ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)',
                                    color: billingPeriod === p ? '#60a5fa' : '#64748b',
                                }}>
                                    {p === 'monthly' ? 'Mensuel' : 'Annuel'}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                <option value="free">Free</option>
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="business">Business</option>
                                <option value="scale">Scale</option>
                            </select>
                            <button onClick={() => onChangePlan(plan, billingPeriod)} style={{
                                padding: '10px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}>
                                Appliquer
                            </button>
                        </div>
                        {plan !== 'free' && (
                            <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                                Échéance : {billingPeriod === 'annual' ? '+365 jours' : '+30 jours'} à partir d'aujourd'hui
                            </p>
                        )}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 14 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Définir les crédits</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={() => onSetCredits(credits)} style={{
                                padding: '10px 16px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)',
                                border: 'none', color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                            }}>
                                <Zap size={14} /> Définir
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    )
}
