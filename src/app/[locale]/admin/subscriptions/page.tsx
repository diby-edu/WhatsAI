'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Users, TrendingUp, Calendar, FileText, Loader2, RefreshCw } from 'lucide-react'

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
    newThisMonth: number
}

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [stats, setStats] = useState<Stats>({
        activeSubscriptions: 0,
        monthlyRevenue: 0,
        newThisMonth: 0
    })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/subscriptions')
            if (res.ok) {
                const data = await res.json()
                setSubscriptions(data.data?.subscriptions || [])
                setStats(data.data?.stats || stats)
            }
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => {
        setRefreshing(true)
        fetchData()
    }

    const statCards = [
        { label: 'Abonnements actifs', value: stats.activeSubscriptions.toString(), icon: Users, color: '#10b981' },
        { label: 'Revenus mensuels', value: `${stats.monthlyRevenue.toLocaleString()} FCFA`, icon: TrendingUp, color: '#a855f7' },
        { label: 'Nouveaux ce mois', value: stats.newThisMonth.toString(), icon: CreditCard, color: '#f59e0b' },
    ]

    const getPlanBadgeColor = (plan: string) => {
        switch (plan) {
            case 'business': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
            case 'pro': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            case 'starter': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Abonnements</h1>
                    <p style={{ color: '#94a3b8' }}>Gestion des abonnements utilisateurs</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    style={{
                        padding: '10px 20px',
                        borderRadius: 12,
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        background: 'rgba(30, 41, 59, 0.5)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    <RefreshCw style={{ width: 16, height: 16, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    Actualiser
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                {statCards.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16
                        }}
                    >
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: `${stat.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <stat.icon style={{ width: 28, height: 28, color: stat.color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                            <div style={{ fontSize: 14, color: '#94a3b8' }}>{stat.label}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflow: 'hidden',
                minHeight: 300
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Utilisateur', 'Email', 'Plan', 'Crédits', 'Statut', 'Inscrit le'].map(h => (
                                <th key={h} style={{
                                    padding: '16px 24px',
                                    textAlign: 'left',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptions.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <div style={{
                                            width: 64, height: 64, borderRadius: '50%', background: 'rgba(148, 163, 184, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <FileText style={{ width: 32, height: 32, color: '#64748b' }} />
                                        </div>
                                        <div>
                                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Aucun abonnement payant</h3>
                                            <p style={{ color: '#64748b', fontSize: 14 }}>Les abonnements apparaîtront ici après les paiements.</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            subscriptions.map((sub) => {
                                const planColors = getPlanBadgeColor(sub.plan)
                                return (
                                    <tr key={sub.id}>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: 'white', fontWeight: 500 }}>
                                            {sub.user}
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8' }}>
                                            {sub.email}
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <span style={{
                                                padding: '6px 14px',
                                                borderRadius: 100,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: planColors.bg,
                                                color: planColors.color,
                                                textTransform: 'capitalize'
                                            }}>
                                                {sub.plan}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#34d399', fontWeight: 600 }}>
                                            {sub.credits.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <span style={{
                                                padding: '6px 14px',
                                                borderRadius: 100,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: 'rgba(34, 197, 94, 0.15)',
                                                color: '#4ade80'
                                            }}>Actif</span>
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8' }}>
                                            {sub.startDate}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
