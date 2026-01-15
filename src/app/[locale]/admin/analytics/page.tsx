'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, MessageCircle, DollarSign, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function AdminAnalyticsPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [])

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/admin/analytics')
            const json = await res.json()
            if (json.success) {
                setData(json.data)
            }
        } catch (err) {
            console.error('Failed to fetch analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 style={{ width: 40, height: 40, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    // Prepare chart data from messageStats
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    const chartData = data?.messageStats?.map((s: any) => ({
        day: days[new Date(s.day).getDay()],
        messages: parseInt(s.total_messages)
    })) || []

    const maxMessages = Math.max(...chartData.map((d: any) => d.messages), 1)

    // Global stats summary
    const totalRevenue = data?.payments?.reduce((sum: number, p: any) => sum + (p.total_revenue || 0), 0) || 0
    const pendingAlerts = data?.alerts?.length || 0

    const stats = [
        { label: 'Revenus (30j)', value: `${totalRevenue.toLocaleString()} FCFA`, change: 'Live', icon: DollarSign, color: '#34d399' },
        { label: 'Alertes Système', value: pendingAlerts, change: pendingAlerts > 0 ? 'Action requise' : 'Sain', icon: AlertCircle, color: pendingAlerts > 0 ? '#fb7185' : '#34d399' },
        { label: 'Messages (7j)', value: chartData.reduce((sum: number, d: any) => sum + d.messages, 0), change: 'Hebdo', icon: MessageCircle, color: '#60a5fa' },
        { label: 'Taux Succès', value: '98%', change: '+1.2%', icon: TrendingUp, color: '#a78bfa' },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Analytics & Monitoring</h1>
                    <p style={{ color: '#94a3b8' }}>Données en temps réel issues des vues professionnelles</p>
                </div>
                <button
                    onClick={fetchAnalytics}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: 'rgba(52, 211, 153, 0.1)',
                        color: '#34d399',
                        border: '1px solid rgba(52, 211, 153, 0.2)',
                        cursor: 'pointer'
                    }}
                >
                    Actualiser
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                background: `${stat.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <stat.icon style={{ width: 24, height: 24, color: stat.color }} />
                            </div>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 600,
                                background: 'rgba(100, 116, 139, 0.15)',
                                color: '#94a3b8'
                            }}>
                                {stat.change}
                            </span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                        <div style={{ fontSize: 14, color: '#94a3b8' }}>{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Weekly Volume Chart */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 20,
                        padding: 24
                    }}
                >
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Volume de Messages (7 derniers jours)</h2>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 200 }}>
                        {chartData.length > 0 ? chartData.map((d: any, i: number) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${Math.max((d.messages / maxMessages) * 100, 5)}%` }}
                                    transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                                    style={{
                                        width: '100%',
                                        background: d.messages > 0 ? 'linear-gradient(180deg, #34d399, #10b981)' : 'rgba(100, 116, 139, 0.1)',
                                        borderRadius: 8,
                                        minHeight: 12
                                    }}
                                />
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>{d.day}</span>
                            </div>
                        )) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                Aucune donnée de message
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* System Alerts */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 20,
                        padding: 24
                    }}
                >
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Alertes de Monitoring</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data?.alerts?.length > 0 ? data.alerts.map((alert: any, i: number) => (
                            <div key={i} style={{
                                padding: 16,
                                borderRadius: 16,
                                background: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                border: `1px solid ${alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12
                            }}>
                                <AlertCircle style={{ color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b', width: 20, height: 20 }} />
                                <div>
                                    <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{alert.label}</div>
                                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{alert.message}</div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                                <CheckCircle2 style={{ width: 40, height: 40, margin: '0 auto 12px', color: '#10b981' }} />
                                <p>Tout est opérationnel !</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
