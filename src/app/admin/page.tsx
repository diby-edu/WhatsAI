'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Users,
    Bot,
    MessageSquare,
    CreditCard,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    Zap,
    Database,
    Server,
    Loader2,
    RefreshCw
} from 'lucide-react'

const statsConfig = [
    {
        id: 'users',
        label: 'Utilisateurs totaux',
        icon: Users,
        gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    },
    {
        id: 'agents',
        label: 'Agents actifs',
        icon: Bot,
        gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    },
    {
        id: 'messages',
        label: 'Messages ce mois',
        icon: MessageSquare,
        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
    },
    {
        id: 'revenue',
        label: 'Revenus du mois',
        icon: DollarSign,
        gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
    },
]

const getBadgeStyle = (type: string) => {
    const styles: Record<string, React.CSSProperties> = {
        primary: { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' },
        accent: { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' },
        warning: { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' },
        success: { background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' },
        default: { background: 'rgba(51, 65, 85, 0.5)', color: '#cbd5e1', border: '1px solid rgba(148, 163, 184, 0.2)' },
    }
    return styles[type] || styles.default
}

interface SystemService {
    name: string
    status: 'operational' | 'degraded' | 'down'
    latency?: string
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<any[]>([])
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
                const s = data.data.stats
                const mappedStats = statsConfig.map(config => {
                    let value = '0'
                    let change = '+0%'

                    if (config.id === 'users') value = s.totalUsers.toLocaleString()
                    if (config.id === 'agents') value = s.activeAgents.toLocaleString()
                    if (config.id === 'messages') value = s.totalMessages.toLocaleString()
                    if (config.id === 'revenue') value = (s.revenue || 0).toLocaleString() + ' FCFA'

                    return { ...config, value, change, trend: 'up' }
                })
                setStats(mappedStats)
            }

            if (data.data?.recentUsers) {
                const mappedUsers = data.data.recentUsers.map((u: any) => ({
                    name: u.full_name || u.email?.split('@')[0] || 'Utilisateur',
                    email: u.email,
                    plan: u.subscription_plan || 'Free',
                    status: 'active',
                    date: new Date(u.created_at).toLocaleDateString('fr-FR')
                }))
                setRecentUsers(mappedUsers)
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

        // Check API
        try {
            const start = Date.now()
            const res = await fetch('/api/health')
            const latency = Date.now() - start
            services.push({
                name: 'API Backend',
                status: res.ok ? 'operational' : 'down',
                latency: `${latency}ms`
            })
        } catch {
            services.push({ name: 'API Backend', status: 'down' })
        }

        // Check Database
        try {
            const start = Date.now()
            const res = await fetch('/api/admin/diagnostics/database')
            const data = await res.json()
            services.push({
                name: 'Base de données',
                status: data.success ? 'operational' : 'down',
                latency: data.latency ? `${data.latency}ms` : undefined
            })
        } catch {
            services.push({ name: 'Base de données', status: 'down' })
        }

        // Check OpenAI
        try {
            const res = await fetch('/api/admin/diagnostics/openai')
            const data = await res.json()
            services.push({
                name: 'OpenAI API',
                status: data.success ? 'operational' : 'degraded'
            })
        } catch {
            services.push({ name: 'OpenAI API', status: 'degraded' })
        }

        // Check Storage
        try {
            const res = await fetch('/api/admin/diagnostics/storage')
            const data = await res.json()
            services.push({
                name: 'Stockage Supabase',
                status: data.success ? 'operational' : 'degraded'
            })
        } catch {
            services.push({ name: 'Stockage Supabase', status: 'degraded' })
        }

        setSystemStatus(services)
        setCheckingSystem(false)
    }

    const operationalCount = systemStatus.filter(s => s.status === 'operational').length
    const uptimePercentage = systemStatus.length > 0
        ? Math.round((operationalCount / systemStatus.length) * 100)
        : 0

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Page Header */}
            <div>
                <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Tableau de bord Admin</h1>
                <p style={{ color: '#94a3b8' }}>Vue d'ensemble de WhatsAI</p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 24
            }}>
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        style={{
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24,
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: stat.gradient,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16
                        }}>
                            <stat.icon style={{ width: 24, height: 24, color: 'white' }} />
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1 }}>{stat.value}</div>
                        <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>{stat.label}</div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: 100,
                            marginTop: 12,
                            background: stat.trend === 'up' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: stat.trend === 'up' ? '#4ade80' : '#f87171'
                        }}>
                            {stat.trend === 'up' ? (
                                <TrendingUp style={{ width: 12, height: 12 }} />
                            ) : (
                                <TrendingDown style={{ width: 12, height: 12 }} />
                            )}
                            {stat.change}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 24
            }}>
                {/* Recent Users */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24
                    }}
                >
                    <div style={{ padding: 24, borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>Nouveaux utilisateurs</h2>
                            <a href="/admin/users" style={{ fontSize: 14, color: '#34d399', textDecoration: 'none' }}>
                                Voir tout →
                            </a>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Utilisateur', 'Plan', 'Statut', 'Inscrit'].map(h => (
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
                                {recentUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                            Aucun utilisateur récent
                                        </td>
                                    </tr>
                                ) : (
                                    recentUsers.map((user, index) => (
                                        <tr key={index}>
                                            <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 12,
                                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: 700,
                                                        fontSize: 14
                                                    }}>
                                                        {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500, color: 'white' }}>{user.name}</div>
                                                        <div style={{ fontSize: 14, color: '#64748b' }}>{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    padding: '6px 14px',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    borderRadius: 100,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    ...getBadgeStyle(user.plan === 'Business' ? 'accent' : user.plan === 'Pro' ? 'primary' : user.plan === 'Starter' ? 'warning' : 'default')
                                                }}>
                                                    {user.plan}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    padding: '6px 14px',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    borderRadius: 100,
                                                    ...getBadgeStyle(user.status === 'active' ? 'success' : 'warning')
                                                }}>
                                                    {user.status === 'active' ? 'Actif' : 'En attente'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8' }}>
                                                {user.date}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* System Status */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 24
                    }}
                >
                    <div style={{ padding: 24, borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Activity style={{ width: 20, height: 20, color: '#34d399' }} />
                                État du système
                            </h2>
                            <button
                                onClick={checkSystemStatus}
                                disabled={checkingSystem}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: 'none',
                                    color: '#34d399',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <RefreshCw style={{
                                    width: 14,
                                    height: 14,
                                    animation: checkingSystem ? 'spin 1s linear infinite' : 'none'
                                }} />
                            </button>
                        </div>
                    </div>
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {systemStatus.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#64748b', padding: 20 }}>
                                <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                                <p>Vérification en cours...</p>
                            </div>
                        ) : (
                            systemStatus.map((service, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {service.status === 'operational' ? (
                                            <CheckCircle2 style={{ width: 20, height: 20, color: '#4ade80' }} />
                                        ) : service.status === 'degraded' ? (
                                            <AlertTriangle style={{ width: 20, height: 20, color: '#fbbf24' }} />
                                        ) : (
                                            <AlertTriangle style={{ width: 20, height: 20, color: '#f87171' }} />
                                        )}
                                        <span style={{ color: 'white', fontSize: 14 }}>{service.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {service.latency && (
                                            <span style={{ fontSize: 13, color: '#64748b' }}>{service.latency}</span>
                                        )}
                                        <span style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            backgroundColor: service.status === 'operational' ? '#4ade80' :
                                                service.status === 'degraded' ? '#fbbf24' : '#f87171'
                                        }} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div style={{ padding: '0 24px 24px' }}>
                        <div style={{
                            padding: 16,
                            borderRadius: 16,
                            background: 'rgba(15, 23, 42, 0.5)',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: uptimePercentage >= 75 ? '#4ade80' : uptimePercentage >= 50 ? '#fbbf24' : '#f87171',
                                marginBottom: 4
                            }}>
                                {uptimePercentage}%
                            </div>
                            <div style={{ fontSize: 14, color: '#94a3b8' }}>Services opérationnels</div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Quick Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16
            }}>
                {[
                    { label: 'Gérer les utilisateurs', icon: Users, href: '/admin/users' },
                    { label: 'Voir les logs', icon: Clock, href: '/admin/logs' },
                    { label: 'Diagnostic système', icon: Zap, href: '/admin/diagnostics' },
                    { label: 'Paramètres', icon: Activity, href: '/admin/settings' },
                ].map((action, index) => (
                    <motion.a
                        key={action.label}
                        href={action.href}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 16,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            textDecoration: 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 16,
                            background: 'rgba(51, 65, 85, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <action.icon style={{ width: 24, height: 24, color: '#34d399' }} />
                        </div>
                        <span style={{ fontWeight: 500, color: 'white' }}>{action.label}</span>
                    </motion.a>
                ))}
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
