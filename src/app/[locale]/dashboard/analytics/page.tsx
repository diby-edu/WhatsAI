'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, ShoppingBag, MessageSquare, TrendingUp, Loader2, Package } from 'lucide-react'

export default function AnalyticsPage() {
    const [data, setData] = useState({
        kpi: {
            totalSales: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            totalMessages: 0
        },
        chartData: [] as { date: string; sales: number }[],
        topProducts: [] as { name: string; quantity: number; revenue: number }[]
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [])

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/analytics')
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
        return `${value.toLocaleString('fr-FR')} FCFA`
    }

    const cards = [
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
        },
        {
            title: 'Messages IA',
            value: data.kpi.totalMessages,
            icon: MessageSquare,
            color: '#8b5cf6',
            bg: 'rgba(139, 92, 246, 0.1)'
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
            <p style={{ color: '#94a3b8', marginBottom: 40 }}>
                Performance de votre force de vente IA en temps réel.
            </p>

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
                    <h3 style={{ color: 'white', fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Évolution des Ventes (30 jours)</h3>
                    {data.chartData.length > 0 ? (
                        <div style={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                                        itemStyle={{ color: 'white' }}
                                        formatter={(value: number) => [formatFCFA(value), 'Ventes']}
                                    />
                                    <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontStyle: 'italic' }}>
                            Aucune vente sur les 30 derniers jours
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
