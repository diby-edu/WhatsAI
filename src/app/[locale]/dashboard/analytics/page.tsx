'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { DollarSign, ShoppingBag, MessageSquare, TrendingUp, Loader2, Package, Zap, Users, BarChart2 } from 'lucide-react'

// BUNDLE-2 : recharts (~100 Ko) chargé uniquement côté client, hors du bundle initial.
const SalesBarChart = dynamic(() => import('@/components/dashboard/SalesBarChart'), {
    ssr: false,
    loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Chargement du graphique...</div>,
})

type PeriodKey = 'month' | 'last_month' | '3months' | '30d' | '60d' | '90d'

const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'month',      label: 'Ce mois' },
    { key: 'last_month', label: 'Mois dernier' },
    { key: '3months',    label: '3 derniers mois' },
    { key: '30d',        label: '30 jours' },
    { key: '60d',        label: '60 jours' },
    { key: '90d',        label: '90 jours' },
]

function getPeriodDates(key: PeriodKey): { from: Date; to: Date } {
    const now = new Date()
    const to = new Date(now)
    let from: Date

    switch (key) {
        case 'month': {
            from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
            break
        }
        case 'last_month': {
            from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
            to.setTime(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime())
            break
        }
        case '3months': {
            from = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0)
            break
        }
        case '30d': {
            from = new Date(now); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0)
            break
        }
        case '60d': {
            from = new Date(now); from.setDate(from.getDate() - 60); from.setHours(0, 0, 0, 0)
            break
        }
        case '90d': {
            from = new Date(now); from.setDate(from.getDate() - 90); from.setHours(0, 0, 0, 0)
            break
        }
    }
    return { from, to }
}

export default function AnalyticsPage() {
    const [period, setPeriod] = useState<PeriodKey>('month')
    const [data, setData] = useState({
        kpi: {
            totalSales: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            totalMessages: 0,
            conversationCount: 0,
            creditsConsumed: 0,
            orderRate: null as number | null
        },
        chartData: [] as { date: string; sales: number }[],
        topProducts: [] as { name: string; quantity: number; revenue: number }[]
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics(period)
    }, [period])

    const fetchAnalytics = async (p: PeriodKey) => {
        setLoading(true)
        try {
            const { from, to } = getPeriodDates(p)
            const url = `/api/analytics?from=${from.toISOString()}&to=${to.toISOString()}`
            const res = await fetch(url)
            const result = await res.json()
            if (result.data) {
                setData({
                    kpi: result.data.kpi || data.kpi,
                    chartData: result.data.chartData || [],
                    topProducts: result.data.topProducts || []
                })
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const formatFCFA = (value: number) => {
        const n = Math.round(Number(value) || 0)
        return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')} FCFA`
    }

    const cards = [
        {
            title: 'Conversations ce mois',
            value: data.kpi.conversationCount,
            icon: Users,
            color: '#3b82f6',
            bg: 'rgba(59, 130, 246, 0.1)'
        },
        {
            title: 'Messages IA',
            value: data.kpi.totalMessages,
            icon: MessageSquare,
            color: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.1)'
        },
        {
            title: 'Crédits consommés ce mois',
            value: data.kpi.creditsConsumed,
            icon: Zap,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.1)'
        },
        {
            title: 'Taux de commande',
            value: data.kpi.orderRate !== null ? `${data.kpi.orderRate}%` : '—',
            icon: BarChart2,
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.1)'
        },
        {
            title: 'Chiffre d\'Affaires',
            value: formatFCFA(data.kpi.totalSales),
            icon: DollarSign,
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.1)'
        },
        {
            title: 'Commandes',
            value: data.kpi.totalOrders,
            icon: ShoppingBag,
            color: '#3b82f6',
            bg: 'rgba(59, 130, 246, 0.1)'
        },
        {
            title: 'Panier Moyen',
            value: formatFCFA(data.kpi.averageOrderValue),
            icon: TrendingUp,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.1)'
        }
    ]

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
                <Loader2 style={{ width: 32, height: 32, color: '#10b981', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ padding: 'clamp(16px, 5vw, 40px)', background: '#0f172a', minHeight: '100vh', paddingBottom: 100 }}>
            <h1 style={{ fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>
                Pilotage & Analytics 📈
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                Performance de votre force de vente IA en temps réel.
            </p>

            {/* Filtres période */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => setPeriod(p.key)}
                        style={{
                            padding: '7px 16px',
                            borderRadius: 20,
                            border: period === p.key ? 'none' : '1px solid rgba(148,163,184,0.2)',
                            background: period === p.key ? '#10b981' : 'rgba(30,41,59,0.6)',
                            color: period === p.key ? 'white' : '#94a3b8',
                            fontSize: 13,
                            fontWeight: period === p.key ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 40 }}>
                {cards.map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        style={{
                            background: '#1e293b',
                            borderRadius: 16,
                            padding: 24,
                            border: '1px solid #334155'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{
                                width: 48, height: 48,
                                borderRadius: 12,
                                background: card.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <card.icon size={24} color={card.color} />
                            </div>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 4 }}>{card.title}</p>
                        <h3 style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>{card.value}</h3>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        background: '#1e293b',
                        borderRadius: 24,
                        padding: 24,
                        border: '1px solid #334155',
                        minHeight: 400
                    }}
                >
                    <h3 style={{ color: 'white', fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Évolution des Ventes (14 jours)</h3>
                    {data.chartData.length > 0 ? (
                        <div style={{ height: 300, width: '100%' }}>
                            <SalesBarChart chartData={data.chartData} />
                        </div>
                    ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic' }}>
                            Aucune vente sur les 14 derniers jours
                        </div>
                    )}
                </motion.div>

                {/* Top Products */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        background: '#1e293b',
                        borderRadius: 24,
                        padding: 24,
                        border: '1px solid #334155',
                    }}
                >
                    <h3 style={{ color: 'white', fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Top Produits</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data.topProducts.length > 0 ? (
                            data.topProducts.map((product, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        background: 'rgba(51, 65, 85, 0.3)',
                                        borderRadius: 12,
                                        border: '1px solid rgba(148, 163, 184, 0.05)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                            width: 32, height: 32,
                                            borderRadius: 8,
                                            background: i === 0 ? 'rgba(245, 158, 11, 0.15)' : i === 1 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(180, 83, 9, 0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 14, fontWeight: 700,
                                            color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#b45309'
                                        }}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: 0 }}>{product.name}</p>
                                            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{product.quantity} vendu{product.quantity > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>
                                        {formatFCFA(product.revenue)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#64748b' }}>
                                <Package style={{ width: 20, height: 20, marginRight: 8, opacity: 0.5 }} />
                                <span style={{ fontStyle: 'italic' }}>Aucune vente de produit pour le moment</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
