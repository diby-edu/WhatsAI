'use client'

import { motion } from 'framer-motion'
import { CreditCard, Users, TrendingUp, Calendar, FileText } from 'lucide-react'

// Empty state until real subscription data API is created
const subscriptions: any[] = []

const stats = [
    { label: 'Abonnements actifs', value: '0', icon: Users, color: '#10b981' },
    { label: 'Revenus mensuels', value: '0 FCFA', icon: TrendingUp, color: '#a855f7' },
    { label: 'Nouveaux ce mois', value: '0', icon: CreditCard, color: '#f59e0b' },
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
                overflow: 'hidden',
                minHeight: 300
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
                        {subscriptions.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <div style={{
                                            width: 64, height: 64, borderRadius: '50%', background: 'rgba(148, 163, 184, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <FileText style={{ width: 32, height: 32, color: '#64748b' }} />
                                        </div>
                                        <div>
                                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Aucun abonnement</h3>
                                            <p style={{ color: '#64748b', fontSize: 14 }}>Les abonnements apparaîtront ici une fois créés.</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            subscriptions.map((sub) => (
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
                                            background: 'rgba(51, 65, 85, 0.5)',
                                            color: '#94a3b8'
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
