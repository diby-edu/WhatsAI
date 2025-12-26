'use client'

import { motion } from 'framer-motion'
import {
    MessageSquare,
    Users,
    TrendingUp,
    Zap,
    ArrowUpRight,
    ArrowDownRight,
    Bot,
    Clock
} from 'lucide-react'
import Link from 'next/link'

// Mock data - will be replaced with real data from API
const stats = [
    {
        label: 'Messages ce mois',
        value: '1,234',
        change: '+12%',
        positive: true,
        icon: MessageSquare,
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
    },
    {
        label: 'Leads qualifiés',
        value: '89',
        change: '+8%',
        positive: true,
        icon: Users,
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
    },
    {
        label: 'Taux de conversion',
        value: '24%',
        change: '+3%',
        positive: true,
        icon: TrendingUp,
        color: '#a855f7',
        bgColor: 'rgba(168, 85, 247, 0.1)',
    },
    {
        label: 'Crédits restants',
        value: '1,850',
        change: '-15%',
        positive: false,
        icon: Zap,
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.1)',
    },
]

const recentConversations = [
    { id: 1, contact: 'Jean Dupont', lastMessage: 'Merci pour les informations !', time: 'Il y a 5 min', status: 'active' },
    { id: 2, contact: 'Marie Martin', lastMessage: 'Je souhaite prendre un rendez-vous', time: 'Il y a 12 min', status: 'active' },
    { id: 3, contact: '+225 07 XX XX XX', lastMessage: 'Bonjour, quels sont vos tarifs ?', time: 'Il y a 25 min', status: 'closed' },
    { id: 4, contact: 'Paul Bernard', lastMessage: 'Parfait, à vendredi alors !', time: 'Il y a 1h', status: 'closed' },
]

const agents = [
    { id: 1, name: 'Assistant Commercial', status: 'active', conversations: 45, lastActive: 'En ligne' },
    { id: 2, name: 'Support Client', status: 'active', conversations: 23, lastActive: 'En ligne' },
]

export default function DashboardPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Tableau de bord</h1>
                <p style={{ fontSize: 16, color: '#94a3b8' }}>
                    Bienvenue ! Voici un aperçu de votre activité.
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 24
            }}>
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        style={{
                            background: 'rgba(15, 23, 42, 0.6)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 24
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: stat.bgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <stat.icon style={{ width: 24, height: 24, color: stat.color }} />
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 14,
                                fontWeight: 500,
                                color: stat.positive ? '#34d399' : '#f87171'
                            }}>
                                {stat.positive ?
                                    <ArrowUpRight style={{ width: 16, height: 16 }} /> :
                                    <ArrowDownRight style={{ width: 16, height: 16 }} />
                                }
                                {stat.change}
                            </div>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 4 }}>{stat.value}</div>
                        <div style={{ fontSize: 14, color: '#94a3b8' }}>{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 24
            }}>
                {/* Recent Conversations */}
                <div style={{
                    gridColumn: 'span 2',
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 24
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>Conversations récentes</h2>
                        <Link href="/dashboard/conversations" style={{ fontSize: 14, color: '#34d399', textDecoration: 'none' }}>
                            Voir tout
                        </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {recentConversations.map((conv) => (
                            <div
                                key={conv.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    padding: 12,
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MessageSquare style={{ width: 20, height: 20, color: '#64748b' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 500, color: 'white' }}>{conv.contact}</span>
                                        <span style={{ fontSize: 12, color: '#64748b' }}>{conv.time}</span>
                                    </div>
                                    <p style={{ fontSize: 14, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {conv.lastMessage}
                                    </p>
                                </div>
                                <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: conv.status === 'active' ? '#10b981' : '#475569'
                                }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Agents */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 24
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>Vos Agents</h2>
                        <Link href="/dashboard/agents" style={{ fontSize: 14, color: '#34d399', textDecoration: 'none' }}>
                            Gérer
                        </Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {agents.map((agent) => (
                            <div
                                key={agent.id}
                                style={{
                                    padding: 16,
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 12
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Bot style={{ width: 20, height: 20, color: 'white' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'white' }}>{agent.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#34d399' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                            {agent.lastActive}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
                                    <span>{agent.conversations} conversations</span>
                                    <Link href={`/dashboard/agents/${agent.id}`} style={{ color: '#34d399', textDecoration: 'none' }}>
                                        Détails
                                    </Link>
                                </div>
                            </div>
                        ))}

                        <Link
                            href="/dashboard/agents/new"
                            style={{
                                display: 'block',
                                padding: 16,
                                border: '2px dashed rgba(148, 163, 184, 0.2)',
                                borderRadius: 12,
                                textAlign: 'center',
                                color: '#64748b',
                                textDecoration: 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            + Créer un nouvel agent
                        </Link>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 16,
                padding: 24
            }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 16 }}>Actions rapides</h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 16
                }}>
                    {[
                        { href: '/dashboard/agents/new', icon: Bot, label: 'Créer un agent', color: '#10b981' },
                        { href: '/dashboard/playground', icon: MessageSquare, label: 'Tester le chatbot', color: '#3b82f6' },
                        { href: '/dashboard/conversations', icon: Clock, label: 'Voir conversations', color: '#a855f7' },
                        { href: '/dashboard/billing', icon: Zap, label: 'Acheter des crédits', color: '#f97316' },
                    ].map((action) => (
                        <Link
                            key={action.href}
                            href={action.href}
                            style={{
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                textAlign: 'center',
                                textDecoration: 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <action.icon style={{ width: 32, height: 32, margin: '0 auto 8px', color: action.color }} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>{action.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
