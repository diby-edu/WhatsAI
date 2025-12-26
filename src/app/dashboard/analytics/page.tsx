'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, MessageCircle, Users, Clock, Loader2, Zap, ArrowUp, ArrowDown } from 'lucide-react'

interface ChartDataPoint {
    date: string
    label: string
    messages: number
    incoming: number
    outgoing: number
    conversations: number
}

interface AnalyticsSummary {
    totalMessages: number
    totalIncoming: number
    totalOutgoing: number
    totalConversations: number
    avgMessagesPerDay: number
    avgResponseRate: number
    creditsBalance: number
    creditsUsedThisMonth: number
}

export default function DashboardAnalyticsPage() {
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')
    const [chartData, setChartData] = useState<ChartDataPoint[]>([])
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null)

    useEffect(() => {
        fetchAnalytics()
    }, [period])

    const fetchAnalytics = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/analytics?period=${period}`)
            const data = await res.json()
            if (data.data) {
                setChartData(data.data.chartData || [])
                setSummary(data.data.summary)
            }
        } catch (err) {
            console.error('Error fetching analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    const maxValue = Math.max(...chartData.map(d => d.messages), 1)

    const stats = summary ? [
        {
            label: 'Messages totaux',
            value: summary.totalMessages.toLocaleString('fr-FR'),
            icon: MessageCircle,
            color: '#10b981'
        },
        {
            label: 'Conversations',
            value: summary.totalConversations.toLocaleString('fr-FR'),
            icon: Users,
            color: '#3b82f6'
        },
        {
            label: 'Crédits utilisés',
            value: summary.creditsUsedThisMonth.toLocaleString('fr-FR'),
            icon: Zap,
            color: '#f59e0b'
        },
        {
            label: 'Crédits restants',
            value: summary.creditsBalance.toLocaleString('fr-FR'),
            icon: TrendingUp,
            color: '#8b5cf6'
        },
    ] : []

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Analytics</h1>
                    <p style={{ color: '#94a3b8' }}>Performances de vos agents</p>
                </div>

                {/* Period selector */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['7d', '30d', '90d'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '10px 16px',
                                borderRadius: 10,
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: 14,
                                background: period === p ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(51, 65, 85, 0.5)',
                                color: period === p ? 'white' : '#94a3b8'
                            }}
                        >
                            {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : '90 jours'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                    <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        {stats.map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 16,
                                    padding: 20
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: `${stat.color}20`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <stat.icon style={{ width: 20, height: 20, color: stat.color }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <BarChart3 style={{ width: 24, height: 24, color: '#34d399' }} />
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>Messages par jour</h2>
                        </div>

                        {chartData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                                Aucune donnée disponible pour cette période
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', height: 200, gap: 8 }}>
                                {chartData.slice(-14).map((point, i) => (
                                    <div key={point.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: '100%',
                                            height: `${(point.messages / maxValue) * 160}px`,
                                            minHeight: 4,
                                            background: point.messages > 0
                                                ? 'linear-gradient(180deg, #34d399, #10b981)'
                                                : 'rgba(51, 65, 85, 0.5)',
                                            borderRadius: 6,
                                            transition: 'height 0.3s ease'
                                        }} />
                                        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                                            {point.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Legend */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981' }} />
                                <span style={{ fontSize: 13, color: '#94a3b8' }}>Messages entrants</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: '#3b82f6' }} />
                                <span style={{ fontSize: 13, color: '#94a3b8' }}>Messages sortants</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Detailed Stats */}
                    {summary && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 16,
                                    padding: 24
                                }}
                            >
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16 }}>Détails des messages</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Messages entrants</span>
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>{summary.totalIncoming}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Messages sortants (bot)</span>
                                        <span style={{ color: '#3b82f6', fontWeight: 600 }}>{summary.totalOutgoing}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Moyenne par jour</span>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{summary.avgMessagesPerDay}</span>
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 16,
                                    padding: 24
                                }}
                            >
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16 }}>Consommation de crédits</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Crédits disponibles</span>
                                        <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{summary.creditsBalance}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#94a3b8' }}>Utilisés ce mois</span>
                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{summary.creditsUsedThisMonth}</span>
                                    </div>
                                    <div style={{
                                        marginTop: 8,
                                        padding: 12,
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        borderRadius: 10,
                                        textAlign: 'center'
                                    }}>
                                        <span style={{ color: '#c4b5fd', fontSize: 13 }}>
                                            1 message = 1 crédit
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
