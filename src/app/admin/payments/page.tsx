'use client'

import { motion } from 'framer-motion'
import { DollarSign, CheckCircle, Clock, XCircle, Download } from 'lucide-react'

const payments = [
    { id: 1, user: 'Kouassi Jean', amount: '35,000 FCFA', method: 'Mobile Money', status: 'completed', date: '2024-12-25 14:30', reference: 'PAY-001234' },
    { id: 2, user: 'Société ABC', amount: '85,000 FCFA', method: 'Carte bancaire', status: 'completed', date: '2024-12-25 12:15', reference: 'PAY-001233' },
    { id: 3, user: 'Aminata Diallo', amount: '15,000 FCFA', method: 'Mobile Money', status: 'pending', date: '2024-12-25 11:00', reference: 'PAY-001232' },
    { id: 4, user: 'TechCorp CI', amount: '85,000 FCFA', method: 'Wave', status: 'completed', date: '2024-12-24 16:45', reference: 'PAY-001231' },
    { id: 5, user: 'Marie Bamba', amount: '15,000 FCFA', method: 'Orange Money', status: 'failed', date: '2024-12-24 10:20', reference: 'PAY-001230' },
]

const stats = [
    { label: 'Total aujourd\'hui', value: '135,000 FCFA', icon: DollarSign, color: '#10b981' },
    { label: 'Transactions réussies', value: '12', icon: CheckCircle, color: '#22c55e' },
    { label: 'En attente', value: '3', icon: Clock, color: '#f59e0b' },
    { label: 'Échouées', value: '1', icon: XCircle, color: '#ef4444' },
]

export default function AdminPaymentsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Paiements</h1>
                    <p style={{ color: '#94a3b8' }}>Historique des transactions</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        fontWeight: 600,
                        borderRadius: 14,
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        cursor: 'pointer',
                        background: 'rgba(30, 41, 59, 0.5)',
                        color: 'white'
                    }}
                >
                    <Download style={{ width: 20, height: 20 }} />
                    Exporter
                </motion.button>
            </div>

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
                            padding: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}
                    >
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: `${stat.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <stat.icon style={{ width: 22, height: 22, color: stat.color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{stat.label}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Référence', 'Client', 'Montant', 'Méthode', 'Statut', 'Date'].map(h => (
                                <th key={h} style={{
                                    padding: '16px 24px',
                                    textAlign: 'left',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((payment) => (
                            <tr key={payment.id}>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8', fontFamily: 'monospace' }}>
                                    {payment.reference}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: 'white', fontWeight: 500 }}>
                                    {payment.user}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#34d399', fontWeight: 600 }}>
                                    {payment.amount}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8' }}>
                                    {payment.method}
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                    <span style={{
                                        padding: '6px 14px',
                                        borderRadius: 100,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: payment.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' : payment.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: payment.status === 'completed' ? '#4ade80' : payment.status === 'pending' ? '#fbbf24' : '#f87171'
                                    }}>
                                        {payment.status === 'completed' ? 'Réussi' : payment.status === 'pending' ? 'En attente' : 'Échoué'}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#64748b' }}>
                                    {payment.date}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
