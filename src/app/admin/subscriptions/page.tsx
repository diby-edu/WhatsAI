'use client'

import { motion } from 'framer-motion'
import { CreditCard, Users, TrendingUp, Calendar } from 'lucide-react'

const subscriptions = [
    { id: 1, user: 'Kouassi Jean', plan: 'Pro', amount: '35,000 FCFA', status: 'active', startDate: '2024-12-01', endDate: '2025-01-01' },
    { id: 2, user: 'Aminata Diallo', plan: 'Starter', amount: '15,000 FCFA', status: 'active', startDate: '2024-12-15', endDate: '2025-01-15' },
    { id: 3, user: 'Mohamed Traoré', plan: 'Business', amount: '85,000 FCFA', status: 'active', startDate: '2024-12-10', endDate: '2025-01-10' },
    { id: 4, user: 'Fatou Konaté', plan: 'Free', amount: '0 FCFA', status: 'active', startDate: '2024-12-20', endDate: '—' },
]

const stats = [
    { label: 'Abonnements actifs', value: '847', icon: Users, color: '#10b981' },
    { label: 'Revenus mensuels', value: '4.2M FCFA', icon: TrendingUp, color: '#a855f7' },
    { label: 'Nouveaux ce mois', value: '+124', icon: CreditCard, color: '#f59e0b' },
]

export default function AdminSubscriptionsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Abonnements</h1>
                <p style={{ color: '#94a3b8' }}>Gestion des abonnements utilisateurs</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                {stats.map((stat, i) => (
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
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Utilisateur', 'Plan', 'Montant', 'Statut', 'Début', 'Fin'].map(h => (
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
                        {subscriptions.map((sub) => (
                            <tr key={sub.id}>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: 'white', fontWeight: 500 }}>
                                    {sub.user}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                    <span style={{
                                        padding: '6px 14px',
                                        borderRadius: 100,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: sub.plan === 'Business' ? 'rgba(168, 85, 247, 0.15)' : sub.plan === 'Pro' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(51, 65, 85, 0.5)',
                                        color: sub.plan === 'Business' ? '#c084fc' : sub.plan === 'Pro' ? '#34d399' : '#94a3b8'
                                    }}>
                                        {sub.plan}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#34d399', fontWeight: 600 }}>
                                    {sub.amount}
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
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8' }}>
                                    {sub.endDate}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
