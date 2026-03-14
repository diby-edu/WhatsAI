'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Bot,
    Plus,
    Search,
    MoreVertical,
    Trash2,
    Edit,
    Power,
    MessageSquare,
    CheckCircle,
    XCircle,
    Loader2,
    Smartphone,
    Crown
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

interface Agent {
    id: string
    name: string
    description: string | null
    personality: string
    whatsapp_connected: boolean
    whatsapp_phone: string | null
    whatsapp_status: string | null
    is_active: boolean
    total_messages: number
    total_conversations: number
    created_at: string
    archived_at: string | null
    archived_reason: string | null
}

export default function AgentsPage() {
    const t = useTranslations('Agents.Page')
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [menuOpen, setMenuOpen] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [agentLimit, setAgentLimit] = useState<number>(-1)

    useEffect(() => {
        fetchAgents()
        fetchPlanLimit()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/agents')
            const data = await res.json()
            if (data.data?.agents) {
                setAgents(data.data.agents)
            }
        } catch (err) {
            console.error('Error fetching agents:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchPlanLimit = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            const plan = (data.data?.profile?.plan || data.data?.plan || data.plan || 'free').toLowerCase()
            const limits: Record<string, number> = { free: 1, starter: 1, pro: 3, business: 6, scale: -1 }
            setAgentLimit(limits[plan] ?? 1)
        } catch {
            // Keep default (-1 = show button as always active)
        }
    }

    const activeAgents = agents.filter(a => !a.archived_at)
    const archivedAgents = agents.filter(a => !!a.archived_at)
    const atLimit = agentLimit !== -1 && activeAgents.length >= agentLimit

    const filteredAgents = activeAgents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (agent.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )

    const toggleAgentStatus = async (id: string) => {
        const agent = agents.find(a => a.id === id)
        if (!agent) return

        setActionLoading(id)
        try {
            const res = await fetch(`/api/agents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !agent.is_active }),
            })

            if (res.ok) {
                setAgents(agents.map(a =>
                    a.id === id ? { ...a, is_active: !a.is_active } : a
                ))
            }
        } catch (err) {
            console.error('Error toggling agent:', err)
        } finally {
            setActionLoading(null)
            setMenuOpen(null)
        }
    }

    const deleteAgent = async (id: string) => {
        if (!confirm(t('card.deleteConfirm'))) {
            setMenuOpen(null)
            return
        }

        setActionLoading(id)
        try {
            const res = await fetch(`/api/agents/${id}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                setAgents(agents.filter(a => a.id !== id))
            }
        } catch (err) {
            console.error('Error deleting agent:', err)
        } finally {
            setActionLoading(null)
            setMenuOpen(null)
        }
    }

    const cardStyle = {
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 16,
        padding: 24
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                    <p style={{ color: '#94a3b8' }}>{t('subtitle')}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    {agentLimit !== -1 && (
                        <span style={{ fontSize: 12, color: atLimit ? '#f87171' : '#64748b' }}>
                            {activeAgents.length}/{agentLimit} agent{agentLimit > 1 ? 's' : ''}
                        </span>
                    )}
                    {atLimit ? (
                        <Link
                            href="/dashboard/billing"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '12px 24px',
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: 'white',
                                fontWeight: 600,
                                textDecoration: 'none',
                                fontSize: 14
                            }}
                        >
                            <Plus style={{ width: 20, height: 20 }} />
                            Passer au plan supérieur
                        </Link>
                    ) : (
                        <Link
                            href="/dashboard/agents/new"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '12px 24px',
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                fontWeight: 600,
                                textDecoration: 'none'
                            }}
                        >
                            <Plus style={{ width: 20, height: 20 }} />
                            {t('createButton')}
                        </Link>
                    )}
                </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
                <Search style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 20,
                    height: 20,
                    color: '#64748b'
                }} />
                <input
                    type="text"
                    placeholder={t('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '14px 16px 14px 52px',
                        fontSize: 15,
                        color: 'white',
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 12,
                        outline: 'none'
                    }}
                />
            </div>

            {/* Agents Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                {filteredAgents.map((agent, index) => (
                    <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        style={{ ...cardStyle, position: 'relative' }}
                    >
                        {/* Status indicator */}
                        <div style={{ position: 'absolute', top: 16, right: 16 }}>
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 500,
                                background: agent.is_active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(51, 65, 85, 0.5)',
                                color: agent.is_active ? '#34d399' : '#64748b'
                            }}>
                                {agent.is_active ? (
                                    <>
                                        <CheckCircle style={{ width: 12, height: 12 }} />
                                        {t('card.active')}
                                    </>
                                ) : (
                                    <>
                                        <XCircle style={{ width: 12, height: 12 }} />
                                        {t('card.inactive')}
                                    </>
                                )}
                            </span>
                        </div>

                        {/* Agent info */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Bot style={{ width: 28, height: 28, color: 'white' }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 4 }}>
                                    {agent.name}
                                </h3>
                                <p style={{
                                    fontSize: 14,
                                    color: '#94a3b8',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {agent.description || ''}
                                </p>
                            </div>
                        </div>

                        {/* WhatsApp status */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: 12,
                            background: 'rgba(51, 65, 85, 0.3)',
                            borderRadius: 10,
                            marginBottom: 16
                        }}>
                            {agent.whatsapp_connected ? (
                                <>
                                    <Smartphone style={{ width: 16, height: 16, color: '#34d399' }} />
                                    <span style={{ fontSize: 14, color: '#34d399' }}>
                                        {agent.whatsapp_phone || t('card.connected')}
                                    </span>
                                </>
                            ) : (agent.whatsapp_phone || agent.whatsapp_status === 'disconnected') ? (
                                <>
                                    <Smartphone style={{ width: 16, height: 16, color: '#f97316' }} />
                                    <span style={{ fontSize: 14, color: '#f97316' }}>
                                        À reconnecter
                                    </span>
                                </>
                            ) : (
                                <>
                                    <MessageSquare style={{ width: 16, height: 16, color: '#64748b' }} />
                                    <span style={{ fontSize: 14, color: '#64748b' }}>
                                        QR à scanner
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{
                                textAlign: 'center',
                                padding: 12,
                                background: 'rgba(51, 65, 85, 0.3)',
                                borderRadius: 10
                            }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
                                    {agent.total_conversations || 0}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{t('card.conversations')}</div>
                            </div>
                            <div style={{
                                textAlign: 'center',
                                padding: 12,
                                background: 'rgba(51, 65, 85, 0.3)',
                                borderRadius: 10
                            }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
                                    {agent.total_messages || 0}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{t('card.messages')}</div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            {/* Quick action icons */}
                            <Link
                                href={`/dashboard/agents/${agent.id}`}
                                title={t('card.menu.edit')}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'
                                    e.currentTarget.style.transform = 'scale(1.05)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
                                    e.currentTarget.style.transform = 'scale(1)'
                                }}
                            >
                                <Edit style={{ width: 18, height: 18, color: '#3b82f6' }} />
                            </Link>
                            <button
                                onClick={() => toggleAgentStatus(agent.id)}
                                disabled={actionLoading === agent.id}
                                title={agent.is_active ? t('card.menu.deactivate') : t('card.menu.activate')}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    backgroundColor: agent.is_active ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = agent.is_active ? 'rgba(251, 191, 36, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                                    e.currentTarget.style.transform = 'scale(1.05)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = agent.is_active ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)'
                                    e.currentTarget.style.transform = 'scale(1)'
                                }}
                            >
                                <Power style={{ width: 18, height: 18, color: agent.is_active ? '#fbbf24' : '#10b981' }} />
                            </button>
                            <button
                                onClick={() => deleteAgent(agent.id)}
                                disabled={actionLoading === agent.id}
                                title={t('card.menu.delete')}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'
                                    e.currentTarget.style.transform = 'scale(1.05)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'
                                    e.currentTarget.style.transform = 'scale(1)'
                                }}
                            >
                                <Trash2 style={{ width: 18, height: 18, color: '#ef4444' }} />
                            </button>
                        </div>

                        {/* Main action buttons */}
                        <div style={{ display: 'flex', gap: 12 }}>
                            <Link
                                href={`/dashboard/playground?agent=${agent.id}`}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    color: 'white',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    textDecoration: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('card.test')}
                            </Link>
                            <Link
                                href={`/dashboard/agents/${agent.id}?tab=whatsapp`}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                    color: 'white',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    textDecoration: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('card.showQRCode')}
                            </Link>
                        </div>
                    </motion.div>
                ))}

                {/* Create new agent card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: filteredAgents.length * 0.1 }}
                >
                    <Link
                        href={atLimit ? '/dashboard/billing' : '/dashboard/agents/new'}
                        style={{
                            ...cardStyle,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 320,
                            border: atLimit
                                ? '2px dashed rgba(245, 158, 11, 0.4)'
                                : '2px dashed rgba(148, 163, 184, 0.2)',
                            textDecoration: 'none'
                        }}
                    >
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: atLimit ? 'rgba(245, 158, 11, 0.15)' : 'rgba(51, 65, 85, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16
                        }}>
                            {atLimit
                                ? <Crown style={{ width: 32, height: 32, color: '#f59e0b' }} />
                                : <Plus style={{ width: 32, height: 32, color: '#64748b' }} />}
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 500, color: atLimit ? '#f59e0b' : '#94a3b8' }}>
                            {atLimit ? 'Passer au plan supérieur' : t('emptyState.button')}
                        </span>
                        <span style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                            {atLimit
                                ? `Limite de ${agentLimit} agent${agentLimit > 1 ? 's' : ''} atteinte`
                                : t('emptyState.description')}
                        </span>
                    </Link>
                </motion.div>
            </div>

            {/* Archived agents section */}
            {archivedAgents.length > 0 && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <div style={{
                            width: 20, height: 20, borderRadius: 4,
                            background: 'rgba(100, 116, 139, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Crown style={{ width: 12, height: 12, color: '#64748b' }} />
                        </div>
                        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#64748b', margin: 0 }}>
                            Agents désactivés ({archivedAgents.length})
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                        {archivedAgents.map((agent) => {
                            const deleteDate = agent.archived_at
                                ? new Date(new Date(agent.archived_at).getTime() + 7 * 24 * 3600000).toLocaleDateString('fr-FR')
                                : null
                            return (
                                <div
                                    key={agent.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.4)',
                                        border: '1px solid rgba(100, 116, 139, 0.15)',
                                        borderRadius: 16,
                                        padding: 20,
                                        opacity: 0.7,
                                        position: 'relative'
                                    }}
                                >
                                    {/* Archived badge */}
                                    <div style={{ position: 'absolute', top: 14, right: 14 }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            padding: '3px 8px',
                                            borderRadius: 100,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            background: 'rgba(100, 116, 139, 0.2)',
                                            color: '#64748b'
                                        }}>
                                            ⏸ Désactivé
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            background: 'rgba(100, 116, 139, 0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Bot style={{ width: 22, height: 22, color: '#64748b' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>{agent.name}</div>
                                            {agent.description && (
                                                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                                    {agent.description.substring(0, 60)}{agent.description.length > 60 ? '…' : ''}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {deleteDate && (
                                        <div style={{
                                            fontSize: 11, color: '#ef4444', marginBottom: 12,
                                            display: 'flex', alignItems: 'center', gap: 4
                                        }}>
                                            ⚠️ Suppression définitive le {deleteDate}
                                        </div>
                                    )}

                                    <Link
                                        href="/dashboard/billing"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            padding: '9px 16px',
                                            borderRadius: 10,
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            border: '1px solid rgba(245, 158, 11, 0.25)',
                                            color: '#f59e0b',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <Crown style={{ width: 14, height: 14 }} />
                                        Réactiver — Renouvelez votre abonnement
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {filteredAgents.length === 0 && searchQuery && (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <Bot style={{ width: 48, height: 48, margin: '0 auto 16px', color: '#64748b' }} />
                    <h3 style={{ fontSize: 18, fontWeight: 500, color: 'white', marginBottom: 8 }}>
                        {t('emptySearch.title')}
                    </h3>
                    <p style={{ color: '#64748b' }}>
                        {t('emptySearch.description', { query: searchQuery })}
                    </p>
                </div>
            )}

            {/* Empty state - no agents */}
            {agents.length === 0 && !searchQuery && (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <Bot style={{ width: 64, height: 64, margin: '0 auto 24px', color: '#34d399' }} />
                    <h3 style={{ fontSize: 24, fontWeight: 600, color: 'white', marginBottom: 8 }}>
                        {t('emptyState.title')}
                    </h3>
                    <p style={{ color: '#94a3b8', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                        {t('emptyState.description')}
                    </p>
                    <Link
                        href="/dashboard/agents/new"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 28px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        <Plus style={{ width: 20, height: 20 }} />
                        {t('createButton')}
                    </Link>
                </div>
            )}
        </div>
    )
}
