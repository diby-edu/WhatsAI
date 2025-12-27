'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Users, Bot, MessageSquare, CreditCard, TrendingUp, DollarSign,
    Activity, AlertTriangle, CheckCircle2, Clock, Zap, Loader2, RefreshCw,
    ShoppingCart, UserPlus, Eye, BarChart3, Wallet, Phone, Globe, Shield
} from 'lucide-react'

interface DashboardStats {
    totalUsers: number
    activeUsers: number
    newUsersToday: number
    totalAgents: number
    activeAgents: number
    connectedAgents: number
    totalMessages: number
    messagesToday: number
    totalConversations: number
    conversationsToday: number
    totalCreditsUsed: number
    revenue: number
    pendingOrders: number
    totalOrders: number
}

interface SystemService {
    name: string
    status: 'operational' | 'degraded' | 'down'
    latency?: string
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [recentUsers, setRecentUsers] = useState<any[]>([])
    const [systemStatus, setSystemStatus] = useState<SystemService[]>([])
    const [loading, setLoading] = useState(true)
    const [checkingSystem, setCheckingSystem] = useState(false)

    useEffect(() => {
        fetchDashboardData()
        checkSystemStatus()
    }, [])

    const fetchDashboardData = async () => {
        try {
            const res = await fetch('/api/admin/dashboard')
            const data = await res.json()
            if (data.data?.stats) {
                setStats(data.data.stats)
            }
            if (data.data?.recentUsers) {
                setRecentUsers(data.data.recentUsers.slice(0, 5))
            }
        } catch (err) {
            console.error('Error fetching dashboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const checkSystemStatus = async () => {
        setCheckingSystem(true)
        const services: SystemService[] = []

        try {
            const start = Date.now()
            const res = await fetch('/api/health')
            services.push({ name: 'API', status: res.ok ? 'operational' : 'down', latency: `${Date.now() - start}ms` })
        } catch {
            services.push({ name: 'API', status: 'down' })
        }

        try {
            const res = await fetch('/api/admin/diagnostics/database')
            const data = await res.json()
            services.push({ name: 'DB', status: data.success ? 'operational' : 'down', latency: data.latency ? `${data.latency}ms` : undefined })
        } catch {
            services.push({ name: 'DB', status: 'down' })
        }

        try {
            const res = await fetch('/api/admin/diagnostics/openai')
            const data = await res.json()
            services.push({ name: 'OpenAI', status: data.success ? 'operational' : 'degraded' })
        } catch {
            services.push({ name: 'OpenAI', status: 'degraded' })
        }

        setSystemStatus(services)
        setCheckingSystem(false)
    }

    const operationalCount = systemStatus.filter(s => s.status === 'operational').length

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 24, height: 24, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    const s = stats || {
        totalUsers: 0, activeUsers: 0, newUsersToday: 0, totalAgents: 0, activeAgents: 0, connectedAgents: 0,
        totalMessages: 0, messagesToday: 0, totalConversations: 0, conversationsToday: 0,
        totalCreditsUsed: 0, revenue: 0, pendingOrders: 0, totalOrders: 0
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Vue d'ensemble</h1>
                    <p style={{ color: '#64748b', fontSize: 13 }}>Dashboard WhatsAI</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* System Status Quick View */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 14px',
                        background: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: 10,
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        {systemStatus.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: s.status === 'operational' ? '#4ade80' : s.status === 'degraded' ? '#fbbf24' : '#f87171'
                                }} />
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.name}</span>
                            </div>
                        ))}
                        <button
                            onClick={checkSystemStatus}
                            disabled={checkingSystem}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        >
                            <RefreshCw style={{
                                width: 12, height: 12, color: '#64748b',
                                animation: checkingSystem ? 'spin 1s linear infinite' : 'none'
                            }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main KPIs - 8 cards in 2 rows */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KPICard icon={Users} label="Utilisateurs" value={s.totalUsers} subValue={`+${s.newUsersToday || 0} aujourd'hui`} color="#3b82f6" />
                <KPICard icon={Bot} label="Agents IA" value={s.totalAgents} subValue={`${s.connectedAgents || 0} connectés`} color="#8b5cf6" />
                <KPICard icon={MessageSquare} label="Messages" value={s.totalMessages} subValue={`+${s.messagesToday || 0} aujourd'hui`} color="#10b981" />
                <KPICard icon={DollarSign} label="Revenus" value={s.revenue || 0} subValue="FCFA ce mois" color="#f59e0b" isCurrency />

                <KPICard icon={Phone} label="Conversations" value={s.totalConversations || 0} subValue={`+${s.conversationsToday || 0} aujourd'hui`} color="#06b6d4" />
                <KPICard icon={Zap} label="Crédits" value={s.totalCreditsUsed || 0} subValue="utilisés ce mois" color="#ec4899" />
                <KPICard icon={ShoppingCart} label="Commandes" value={s.totalOrders || 0} subValue={`${s.pendingOrders || 0} en attente`} color="#14b8a6" />
                <KPICard icon={UserPlus} label="Actifs (30j)" value={s.activeUsers || 0} subValue={`${s.totalUsers > 0 ? Math.round((s.activeUsers / s.totalUsers) * 100) : 0}% du total`} color="#6366f1" />
            </div>

            {/* Two Columns Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                {/* Recent Users */}
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 14,
                    overflow: 'hidden'
                }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Dernières inscriptions</h2>
                        <a href="/admin/users" style={{ fontSize: 12, color: '#34d399', textDecoration: 'none' }}>Voir tout →</a>
                    </div>
                    <div style={{ padding: '0 6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Utilisateur', 'Plan', 'Date'].map(h => (
                                        <th key={h} style={{
                                            padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b'
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recentUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                            Aucun utilisateur
                                        </td>
                                    </tr>
                                ) : (
                                    recentUsers.map((user, i) => (
                                        <tr key={i} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: 8,
                                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'white', fontWeight: 600, fontSize: 12
                                                    }}>
                                                        {(user.full_name || user.email || 'U')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500, color: 'white', fontSize: 13 }}>
                                                            {user.full_name || 'Utilisateur'}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: '#64748b' }}>{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{
                                                    padding: '4px 10px', fontSize: 10, fontWeight: 600, borderRadius: 100,
                                                    background: 'rgba(51, 65, 85, 0.5)', color: '#cbd5e1'
                                                }}>
                                                    {user.subscription_plan || 'Free'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>
                                                {new Date(user.created_at).toLocaleDateString('fr-FR')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Actions + System */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Quick Actions */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 14,
                        padding: 16
                    }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 12 }}>Actions rapides</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                { label: 'Gérer utilisateurs', icon: Users, href: '/admin/users' },
                                { label: 'Voir diagnostics', icon: Activity, href: '/admin/diagnostics' },
                                { label: 'Gérer les plans', icon: CreditCard, href: '/admin/plans' },
                                { label: 'Voir les logs', icon: Clock, href: '/admin/logs' }
                            ].map((action, i) => (
                                <a
                                    key={i}
                                    href={action.href}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 12px', borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.3)',
                                        textDecoration: 'none', transition: 'all 0.2s'
                                    }}
                                >
                                    <action.icon style={{ width: 16, height: 16, color: '#34d399' }} />
                                    <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{action.label}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* System Health */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 14,
                        padding: 16
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>Santé système</h2>
                            <span style={{
                                padding: '4px 10px', borderRadius: 100,
                                background: operationalCount === systemStatus.length ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: operationalCount === systemStatus.length ? '#4ade80' : '#fbbf24',
                                fontSize: 11, fontWeight: 600
                            }}>
                                {operationalCount}/{systemStatus.length} OK
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {systemStatus.map((service, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {service.status === 'operational' ? (
                                            <CheckCircle2 style={{ width: 14, height: 14, color: '#4ade80' }} />
                                        ) : (
                                            <AlertTriangle style={{ width: 14, height: 14, color: service.status === 'degraded' ? '#fbbf24' : '#f87171' }} />
                                        )}
                                        <span style={{ color: '#e2e8f0', fontSize: 13 }}>{service.name}</span>
                                    </div>
                                    {service.latency && (
                                        <span style={{ fontSize: 11, color: '#64748b' }}>{service.latency}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
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

function KPICard({ icon: Icon, label, value, subValue, color, isCurrency = false }: {
    icon: any, label: string, value: number, subValue?: string, color: string, isCurrency?: boolean
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                padding: 16,
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 12
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Icon size={16} style={{ color }} />
                </div>
                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>
                {isCurrency ? value.toLocaleString('fr-FR') : value.toLocaleString('fr-FR')}
            </div>
            {subValue && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{subValue}</div>
            )}
        </motion.div>
    )
}
