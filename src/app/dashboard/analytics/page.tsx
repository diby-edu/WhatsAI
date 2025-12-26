'use client'

import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, MessageCircle, Users, Clock } from 'lucide-react'

const stats = [
    { label: 'Messages envoyés', value: '1,247', change: '+18%', icon: MessageCircle },
    { label: 'Conversations', value: '89', change: '+12%', icon: Users },
    { label: 'Temps moyen de réponse', value: '2.3s', change: '-15%', icon: Clock },
    { label: 'Taux de conversion', value: '4.8%', change: '+0.8%', icon: TrendingUp },
]

const weeklyData = [
    { day: 'Lun', value: 120 },
    { day: 'Mar', value: 180 },
    { day: 'Mer', value: 150 },
    { day: 'Jeu', value: 220 },
    { day: 'Ven', value: 280 },
    { day: 'Sam', value: 140 },
    { day: 'Dim', value: 90 },
]

export default function DashboardAnalyticsPage() {
    const maxValue = Math.max(...weeklyData.map(d => d.value))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Analytics</h1>
                <p style={{ color: '#94a3b8' }}>Performances de vos agents</p>
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
                            padding: 20
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'rgba(16, 185, 129, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <stat.icon style={{ width: 20, height: 20, color: '#34d399' }} />
                            </div>
                            <span style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: stat.change.startsWith('-') ? '#4ade80' : '#4ade80'
                            }}>{stat.change}</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                        <div style={{ fontSize: 13, color: '#94a3b8' }}>{stat.label}</div>
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
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>Messages cette semaine</h2>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
                    {weeklyData.map((d, i) => (
                        <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${(d.value / maxValue) * 100}%` }}
                                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                                style={{
                                    width: '100%',
                                    background: 'linear-gradient(180deg, #10b981, #059669)',
                                    borderRadius: 6,
                                    minHeight: 10
                                }}
                            />
                            <span style={{ fontSize: 11, color: '#64748b' }}>{d.day}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
