'use client'

import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Users, MessageCircle, DollarSign } from 'lucide-react'

const stats = [
    { label: 'Utilisateurs actifs', value: '2,847', change: '+12%', icon: Users },
    { label: 'Messages aujourd\'hui', value: '45,821', change: '+23%', icon: MessageCircle },
    { label: 'Taux de conversion', value: '4.2%', change: '+0.5%', icon: TrendingUp },
    { label: 'Revenus du jour', value: '285,000 FCFA', change: '+8%', icon: DollarSign },
]

const chartData = [
    { day: 'Lun', messages: 8500, users: 420 },
    { day: 'Mar', messages: 9200, users: 480 },
    { day: 'Mer', messages: 10100, users: 520 },
    { day: 'Jeu', messages: 9800, users: 510 },
    { day: 'Ven', messages: 11200, users: 590 },
    { day: 'Sam', messages: 7800, users: 380 },
    { day: 'Dim', messages: 6200, users: 310 },
]

export default function AdminAnalyticsPage() {
    const maxMessages = Math.max(...chartData.map(d => d.messages))

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
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#4ade80'
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
                                animate={{ height: `${(d.messages / maxMessages) * 100}%` }}
                                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                                style={{
                                    width: '100%',
                                    background: 'linear-gradient(180deg, #10b981, #059669)',
                                    borderRadius: 8,
                                    minHeight: 20
                                }}
                            />
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{d.day}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    )
}
