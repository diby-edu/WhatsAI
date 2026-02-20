'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    BarChart3, TrendingUp, Users, MessageCircle, DollarSign,
    AlertCircle, Loader2, CheckCircle2, Calendar, Download
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Legend, Cell
} from 'recharts'
import { CardSkeleton, ChartSkeleton } from '@/components/admin/AdminSkeletons'

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div style={{ height: 80, width: 300, background: 'rgba(148, 163, 184, 0.1)', borderRadius: 12 }} />
                <CardSkeleton count={4} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
            </div>
        )
    }

    // Format dates for charts
    const formatDay = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    }

    const revenueData = data?.revenueSeries?.map((d: any) => ({
        date: formatDay(d.date),
        Plateforme: d.platform_revenue,
        Marchands: d.merchant_revenue,
    })) || []

    const userData = data?.userSeries?.map((d: any) => ({
        date: formatDay(d.date),
        Utilisateurs: d.new_users
    })) || []

    const messageData = data?.messageSeries?.map((d: any) => ({
        day: d.day, // Already formatted usually or needs formatting
        Messages: parseInt(d.total_messages)
    })) || []

    const stats = [
        {
            label: 'Revenu Plateforme (30j)',
            value: `${revenueData.reduce((sum: number, d: any) => sum + d.Plateforme, 0).toLocaleString()} FCFA`,
            icon: DollarSign, color: '#34d399'
        },
        {
            label: 'Volume Marchands (30j)',
            value: `${revenueData.reduce((sum: number, d: any) => sum + d.Marchands, 0).toLocaleString()} FCFA`,
            icon: TrendingUp, color: '#60a5fa'
        },
        {
            label: 'Nouv. Utilisateurs (30j)',
            value: userData.reduce((sum: number, d: any) => sum + d.Utilisateurs, 0),
            icon: Users, color: '#a78bfa'
        },
        {
            label: 'Messages (7j)',
            value: messageData.reduce((sum: number, d: any) => sum + d.Messages, 0),
            icon: MessageCircle, color: '#fb7185'
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line {
                    stroke: rgba(148, 163, 184, 0.1);
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: 32, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 8 }}>
                        Analytics & Performance
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 16 }}>Suivez la croissance et la santé financière de WhatsAI en temps réel.</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        onClick={() => window.print()}
                        style={{
                            padding: '10px 18px',
                            borderRadius: 12,
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: '#e2e8f0',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 500
                        }}
                    >
                        <Download size={18} /> Export PDF
                    </button>
                    <button
                        onClick={fetchAnalytics}
                        style={{
                            padding: '10px 18px',
                            borderRadius: 12,
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 14,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        Actualiser
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        style={{
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 24,
                            padding: 24,
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: -20,
                            right: -20,
                            width: 100,
                            height: 100,
                            background: `${stat.color}10`,
                            borderRadius: '50%',
                            filter: 'blur(40px)'
                        }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 16,
                                background: `${stat.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <stat.icon style={{ width: 24, height: 24, color: stat.color }} />
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>{stat.label}</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{stat.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                {/* Revenue Evolution */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24,
                        padding: 24,
                        minHeight: 400
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Évolution des Revenus</h2>
                        <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(100, 116, 139, 0.1)', padding: '4px 10px', borderRadius: 8 }}>30 Derniers Jours</div>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorPlatform" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMerchant" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12, color: 'white' }}
                                    itemStyle={{ color: 'white' }}
                                />
                                <Legend verticalAlign="top" height={36} align="right" />
                                <Area type="monotone" dataKey="Plateforme" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorPlatform)" />
                                <Area type="monotone" dataKey="Marchands" stroke="#60a5fa" strokeWidth={3} fillOpacity={1} fill="url(#colorMerchant)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* User Growth */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24,
                        padding: 24,
                        minHeight: 400
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Nouveaux Utilisateurs</h2>
                        <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(100, 116, 139, 0.1)', padding: '4px 10px', borderRadius: 8 }}>Croissance Quotidienne</div>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userData}>
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }}
                                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12 }}
                                />
                                <Bar dataKey="Utilisateurs" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Message Volume */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24,
                        padding: 24,
                        minHeight: 400
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Activité Messages (7 jours)</h2>
                        <MessageCircle size={20} color="#fb7185" />
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={messageData}>
                                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 12 }} />
                                <Area type="stepAfter" dataKey="Messages" stroke="#fb7185" strokeWidth={3} fill="rgba(251, 113, 133, 0.1)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* System Health / Alerts */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24,
                        padding: 24,
                        minHeight: 400
                    }}
                >
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 24 }}>Alertes de Monitoring</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                        {data?.alerts?.length > 0 ? data.alerts.map((alert: any, i: number) => (
                            <div key={i} style={{
                                padding: 16,
                                borderRadius: 18,
                                background: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                border: `1px solid ${alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <AlertCircle style={{ color: alert.severity === 'critical' ? '#ef4444' : '#f59e0b', width: 22, height: 22 }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>{alert.label}</div>
                                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{alert.message}</div>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{alert.days_since_active}j</div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: "60px 40px", color: '#64748b' }}>
                                <CheckCircle2 style={{ width: 56, height: 56, margin: '0 auto 20px', color: '#10b981', opacity: 0.5 }} />
                                <p style={{ fontSize: 16, fontWeight: 500 }}>Tout est opérationnel !</p>
                                <p style={{ fontSize: 13, marginTop: 4 }}>Aucune anomalie détectée sur le système.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
