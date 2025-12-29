'use client'

import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, MessageCircle, DollarSign } from 'lucide-react'

// Empty state - will be populated from API when analytics backend is implemented
const stats = [
    { label: 'Utilisateurs actifs', value: '0', change: '--', icon: Users },
    { label: 'Messages aujourd\'hui', value: '0', change: '--', icon: MessageCircle },
    { label: 'Taux de conversion', value: '--', change: '--', icon: TrendingUp },
    { label: 'Revenus du jour', value: '0 FCFA', change: '--', icon: DollarSign },
]

const chartData = [
    { day: 'Lun', messages: 0, users: 0 },
    { day: 'Mar', messages: 0, users: 0 },
    { day: 'Mer', messages: 0, users: 0 },
    { day: 'Jeu', messages: 0, users: 0 },
    { day: 'Ven', messages: 0, users: 0 },
    { day: 'Sam', messages: 0, users: 0 },
    { day: 'Dim', messages: 0, users: 0 },
]

export default function AdminAnalyticsPage() {
    const maxMessages = Math.max(...chartData.map(d => d.messages), 1)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Analytics</h1>
                <p style={{ color: '#94a3b8' }}>Vue d'ensemble des performances</p>
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
                                background: 'rgba(16, 185, 129, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <stat.icon style={{ width: 24, height: 24, color: '#34d399' }} />
                            </div>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 600,
                                background: 'rgba(100, 116, 139, 0.15)',
                                color: '#64748b'
                            }}>
                                {stat.change}
                            </span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                        <div style={{ fontSize: 14, color: '#94a3b8' }}>{stat.label}</div>
                    </motion.div>
                ))}
            </div>

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
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>Messages cette semaine</h2>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 200 }}>
                    {chartData.map((d, i) => (
                        <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max((d.messages / maxMessages) * 100, 5)}%` }}
                                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                                style={{
                                    width: '100%',
                                    background: d.messages > 0 ? 'linear-gradient(180deg, #10b981, #059669)' : 'rgba(100, 116, 139, 0.3)',
                                    borderRadius: 8,
                                    minHeight: 20
                                }}
                            />
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.day}</span>
                        </div>
                    ))}
                </div>
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 14, marginTop: 24 }}>
                    Les données s'afficheront une fois que le système d'analytics sera implémenté.
                </p>
            </motion.div>
        </div>
    )
}

