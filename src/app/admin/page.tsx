'use client'

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
    ArrowUpRight
} from 'lucide-react'

// Mock data for demonstration
const stats = [
    {
        label: 'Utilisateurs totaux',
        value: '12,847',
        change: '+12.5%',
        trend: 'up',
        icon: Users,
        gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    },
    {
        label: 'Agents actifs',
        value: '3,254',
        change: '+8.2%',
        trend: 'up',
        icon: Bot,
        gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    },
    {
        label: 'Messages ce mois',
        value: '2.4M',
        change: '+23.1%',
        trend: 'up',
        icon: MessageSquare,
        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
    },
    {
        label: 'Revenus du mois',
        value: '4.2M FCFA',
        change: '+15.3%',
        trend: 'up',
        icon: DollarSign,
        gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
    },
]

const recentUsers = [
    { name: 'Kouassi Jean', email: 'kouassi@email.com', plan: 'Pro', status: 'active', date: 'Il y a 2h' },
    { name: 'Aminata Diallo', email: 'aminata@email.com', plan: 'Starter', status: 'active', date: 'Il y a 4h' },
    { name: 'Mohamed Traoré', email: 'mohamed@email.com', plan: 'Business', status: 'active', date: 'Il y a 6h' },
    { name: 'Fatou Konaté', email: 'fatou@email.com', plan: 'Free', status: 'pending', date: 'Il y a 8h' },
    { name: 'Ibrahim Coulibaly', email: 'ibrahim@email.com', plan: 'Pro', status: 'active', date: 'Il y a 12h' },
]

const recentPayments = [
    { user: 'Kouassi Jean', amount: '35,000 FCFA', plan: 'Pro', status: 'completed', date: 'Il y a 1h' },
    { user: 'Société ABC', amount: '85,000 FCFA', plan: 'Business', status: 'completed', date: 'Il y a 3h' },
    { user: 'Aminata Diallo', amount: '15,000 FCFA', plan: 'Starter', status: 'pending', date: 'Il y a 5h' },
]

const systemStatus = [
    { name: 'API WhatsApp', status: 'operational', latency: '45ms' },
    { name: 'OpenAI Gateway', status: 'operational', latency: '120ms' },
    { name: 'Base de données', status: 'operational', latency: '12ms' },
    { name: 'CinetPay', status: 'warning', latency: '230ms' },
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

export default function AdminDashboard() {
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
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
                        borderRadius: 24,
                        gridColumn: 'span 2'
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
                                {recentUsers.map((user, index) => (
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
                                                    {user.name.split(' ').map(n => n[0]).join('')}
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
                                ))}
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
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Activity style={{ width: 20, height: 20, color: '#34d399' }} />
                            État du système
                        </h2>
                    </div>
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {systemStatus.map((service, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {service.status === 'operational' ? (
                                        <CheckCircle2 style={{ width: 20, height: 20, color: '#4ade80' }} />
                                    ) : (
                                        <AlertTriangle style={{ width: 20, height: 20, color: '#fbbf24' }} />
                                    )}
                                    <span style={{ color: 'white' }}>{service.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 14, color: '#94a3b8' }}>{service.latency}</span>
                                    <span style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: service.status === 'operational' ? '#4ade80' : '#fbbf24'
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: '0 24px 24px' }}>
                        <div style={{
                            padding: 16,
                            borderRadius: 16,
                            background: 'rgba(15, 23, 42, 0.5)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>99.9%</div>
                            <div style={{ fontSize: 14, color: '#94a3b8' }}>Uptime ce mois</div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Recent Payments */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
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
                            <CreditCard style={{ width: 20, height: 20, color: '#34d399' }} />
                            Paiements récents
                        </h2>
                        <a href="/admin/payments" style={{ fontSize: 14, color: '#34d399', textDecoration: 'none' }}>
                            Voir tout →
                        </a>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Client', 'Montant', 'Plan', 'Statut', 'Date'].map(h => (
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
                            {recentPayments.map((payment, index) => (
                                <tr key={index}>
                                    <td style={{ padding: '16px 24px', fontWeight: 500, color: 'white', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        {payment.user}
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#34d399', fontWeight: 600, borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        {payment.amount}
                                    </td>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            padding: '6px 14px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            borderRadius: 100,
                                            ...getBadgeStyle(payment.plan === 'Business' ? 'accent' : payment.plan === 'Pro' ? 'primary' : 'warning')
                                        }}>
                                            {payment.plan}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            padding: '6px 14px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            borderRadius: 100,
                                            ...getBadgeStyle(payment.status === 'completed' ? 'success' : 'warning')
                                        }}>
                                            {payment.status === 'completed' ? 'Complété' : 'En cours'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#94a3b8', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        {payment.date}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Quick Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16
            }}>
                {[
                    { label: 'Ajouter un utilisateur', icon: Users, href: '/admin/users/new' },
                    { label: 'Voir les logs', icon: Clock, href: '/admin/logs' },
                    { label: 'Paramètres système', icon: Activity, href: '/admin/settings' },
                    { label: 'Exporter les données', icon: ArrowUpRight, href: '/admin/export' },
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
        </div>
    )
}
