'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, ShoppingBag, MessageSquare, TrendingUp, Loader2 } from 'lucide-react'

// Mock data for initial render or fallback
const mockData = [
    { date: '01/01', sales: 0 },
]

export default function AnalyticsPage() {
    const [data, setData] = useState({
        kpi: {
            totalSales: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            totalMessages: 0
        },
        chartData: mockData
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
                setData(result.data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const cards = [
        {
            title: 'Chiffre d\'Affaires',
            value: `${data.kpi.totalSales.toLocaleString()} FCFA`,
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
            value: `${data.kpi.averageOrderValue.toLocaleString()} FCFA`,
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
        <div style={{ padding: 40, background: '#0f172a', minHeight: '100vh', paddingBottom: 100 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 8 }}>
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
                            <span style={{
                                color: '#10b981',
                                background: 'rgba(16, 185, 129, 0.1)',
                                padding: '4px 8px',
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 500
                            }}>
                                +12%
                            </span>
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 4 }}>{card.title}</p>
                        <h3 style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>{card.value}</h3>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
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
                    <div style={{ height: 300, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                                    itemStyle={{ color: 'white' }}
                                />
                                <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Top Products (Placeholder) */}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ color: '#64748b', fontStyle: 'italic' }}>Données indisponibles (Nécessite Vue SQL)</p>
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
