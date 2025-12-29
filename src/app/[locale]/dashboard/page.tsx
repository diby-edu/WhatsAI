'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    MessageSquare,
    Users,
    TrendingUp,
    Zap,
    ArrowUpRight,
    ArrowDownRight,
    Bot,
    Clock,
    CreditCard,
    Bell
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function DashboardPage() {
    const t = useTranslations('Dashboard.overview')
    const [stats, setStats] = useState<any[]>([])
    const [agents, setAgents] = useState<any[]>([])
    const [recentConversations, setRecentConversations] = useState<any[]>([])
    const [userName, setUserName] = useState<string>('')
    const [loading, setLoading] = useState(true)

    // Base stats config - rebuilt inside component to access safe t function or at least keys
    const statsConfig = [
        {
            id: 'messages',
            label: t('stats.messages'),
            icon: MessageSquare,
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.1)',
        },
        {
            id: 'agents',
            label: t('stats.agents'),
            icon: Users, // Or Bot
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)',
        },
        {
            id: 'conversations',
            label: t('stats.conversations'),
            icon: TrendingUp,
            color: '#a855f7',
            bgColor: 'rgba(168, 85, 247, 0.1)',
        },
        {
            id: 'credits',
            label: t('stats.credits'),
            icon: Zap,
            color: '#f97316',
            bgColor: 'rgba(249, 115, 22, 0.1)',
        },
        {
            id: 'plan',
            label: t('stats.currentPlan'),
            icon: CreditCard,
            color: '#ec4899',
            bgColor: 'rgba(236, 72, 153, 0.1)',
        },
    ]

    useEffect(() => {
        fetchDashboardData()
    }, [])

    const fetchDashboardData = async () => {
        try {
            const res = await fetch('/api/dashboard/overview')
            const data = await res.json()

            if (data.data?.stats) {
                const s = data.data.stats
                const mappedStats = statsConfig.map(config => {
                    let value = '0'
                    let change = '' // Placeholder
                    let positive = true

                    if (config.id === 'messages') value = s.totalMessages.toLocaleString()
                    if (config.id === 'agents') value = s.activeAgents.toLocaleString()
                    if (config.id === 'conversations') value = s.totalConversations.toLocaleString()
                    if (config.id === 'credits') value = s.credits.toLocaleString()
                    if (config.id === 'plan') {
                        value = (s.plan || 'Free').toUpperCase()
                        if (s.subscriptionExpiry) {
                            const date = new Date(s.subscriptionExpiry)
                            change = `Exp: ${date.toLocaleDateString()}`
                            positive = true
                        }
                    }

                    return { ...config, value, change, positive }
                })
                setStats(mappedStats)
            } else {
                // Fallback / Initial state
                setStats(statsConfig.map(config => ({ ...config, value: '0', change: '', positive: true })))
            }

            if (data.data?.agents) {
                const mappedAgents = data.data.agents.slice(0, 3).map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    status: a.is_active ? 'active' : 'inactive',
                    conversations: a.total_conversations || 0,
                    lastActive: a.is_active ? t('agentStatus.online') : t('agentStatus.offline')
                }))
                setAgents(mappedAgents)
            }

            // Recent conversations are returned as empty array for now from API
            setRecentConversations(data.data?.recentConversations || [])

            // Set user name from profile
            if (data.data?.stats?.userName) {
                setUserName(data.data.stats.userName)
            }

        } catch (err) {
            console.error('Error fetching dashboard:', err)
        } finally {
            setLoading(false)
        }
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Header with user name and notification bell */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                    <p style={{ fontSize: 16, color: '#94a3b8' }}>
                        {userName ? `Bonjour ${userName} ! Voici un aperçu de votre activité.` : t('subtitle')}
                    </p>
                </div>
                <button style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                }}>
                    <Bell style={{ width: 20, height: 20, color: '#94a3b8' }} />
                    <span style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#10b981'
                    }} />
                </button>
            </div>

            {/* Stats Grid - 5 columns on desktop */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 16
            }}>
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.id}
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
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{t('recentConversations')}</h2>
                        <Link href="/dashboard/conversations" style={{ fontSize: 14, color: '#34d399', textDecoration: 'none' }}>
                            {t('viewAll')}
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
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{t('yourAgents')}</h2>
                        <Link href="/dashboard/agents" style={{ fontSize: 14, color: '#34d399', textDecoration: 'none' }}>
                            {t('manage')}
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
                                    <span>{agent.conversations} {t('stats.conversations').toLowerCase()}</span>
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
                            {t('createAgent')}
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
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 16 }}>{t('quickActions')}</h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 16
                }}>
                    {[
                        { href: '/dashboard/agents/new', icon: Bot, label: t('actions.createAgent'), color: '#10b981' },
                        { href: '/dashboard/playground', icon: MessageSquare, label: t('actions.testChatbot'), color: '#3b82f6' },
                        { href: '/dashboard/conversations', icon: Clock, label: t('actions.viewConversations'), color: '#a855f7' },
                        { href: '/dashboard/billing', icon: Zap, label: t('actions.buyCredits'), color: '#f97316' },
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
