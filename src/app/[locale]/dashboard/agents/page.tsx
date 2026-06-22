'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
    Loader2,
    Smartphone,
    Crown,
    BookOpen,
    Users,
    Download,
    Upload,
    Headphones,
    ShoppingBag,
    Wrench,
    Utensils,
    Building2,
    Scissors,
    Package,
    UserCheck,
    RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { useToast } from '@/components/ui/Toast'
import {
    getAgentOperationalColors,
    getAgentOperationalDetail,
    getAgentOperationalLabel,
    getAgentOperationalStatus,
} from '@/lib/admin/agent-status'

const MISSION_LABELS: Record<string, string> = {
    ecommerce:          'E-commerce / Boutique',
    ecommerce_physical: 'Produit Physique',
    ecommerce_digital:  'Produit Numérique',
    restaurant:         'Restaurant / Fast-food',
    hotel:              'Hotel / Hebergement',
    salon:              'Support Client',
    services:           'Support Client',
    support_client:     'Support Client',
    custom:             'Personnalisé',
}

const MISSION_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
    support_client:     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: Headphones },
    ecommerce:          { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: ShoppingBag },
    ecommerce_physical: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: Package },
    ecommerce_digital:  { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: ShoppingBag },
    services:           { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: Headphones },
    restaurant:         { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: Utensils },
    hotel:              { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   icon: Building2 },
    salon:              { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: Headphones },
    custom:             { color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: Bot },
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
    physical: 'Physique',
    digital: 'Numerique',
    service: 'Service',
}

interface Agent {
    id: string
    name: string
    description: string | null
    personality: string
    whatsapp_connected: boolean
    whatsapp_phone: string | null
    whatsapp_status: string | null
    whatsapp_ever_connected?: boolean | null
    is_active: boolean
    total_messages: number
    total_conversations: number
    created_at: string
    archived_at: string | null
    archived_reason: string | null
    lead_collection_enabled?: boolean | null
    agent_context?: string | null
    fallback_contact_message?: string | null
    system_prompt?: string | null
    mission?: string | null
    product_types?: string[]
    knowledge_count?: number
    lead_count?: number
    product_count?: number
    ecommerce_mode?: string | null
}

export default function AgentsPage() {
    const t = useTranslations('Agents.Page')
    const toast = useToast()
    const router = useRouter()
    const { openUpgradeModal } = useUpgradeModal()
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [menuOpen, setMenuOpen] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [agentLimit, setAgentLimit] = useState<number>(-1)

    useEffect(() => {
        fetchAgents()
        fetchPlanLimit()
        const interval = setInterval(fetchAgents, 10000)
        return () => clearInterval(interval)
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/agents', { cache: 'no-store' })
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
                const data = await res.json()
                const updatedAgent = data.data?.agent
                setAgents(agents.map(a =>
                    a.id === id ? { ...a, ...(updatedAgent || { is_active: !a.is_active }) } : a
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
        const agent = agents.find(a => a.id === id)
        const ok = await toast.confirm({
            title: 'Supprimer cet agent ?',
            message: agent?.name
                ? `L'agent "${agent.name}" sera définitivement supprimé. Exportez sa configuration (bouton télécharger) avant de le supprimer si vous souhaitez le recréer facilement.`
                : t('card.deleteConfirm'),
            confirmLabel: 'Supprimer',
            danger: true,
        })
        if (!ok) { setMenuOpen(null); return }

        setActionLoading(id)
        try {
            const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setAgents(agents.filter(a => a.id !== id))
                toast.success('Agent supprimé.')
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'Suppression échouée. Veuillez réessayer.')
            }
        } catch (err) {
            console.error('Error deleting agent:', err)
            toast.error('Erreur réseau. Veuillez réessayer.')
        } finally {
            setActionLoading(null)
            setMenuOpen(null)
        }
    }

    const exportAgent = async (id: string) => {
        try {
            const res = await fetch(`/api/agents/${id}/export`)
            if (!res.ok) { toast.error('Erreur lors de l\'export'); return }
            const blob = await res.blob()
            const cd = res.headers.get('Content-Disposition') || ''
            const match = cd.match(/filename="([^"]+)"/)
            const filename = match ? match[1] : `agent-${id}-config.json`
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = filename; a.click()
            URL.revokeObjectURL(url)
        } catch { toast.error('Erreur réseau lors de l\'export') }
    }

    const importAgent = async (file: File) => {
        try {
            const text = await file.text()
            const json = JSON.parse(text)
            const res = await fetch('/api/agents/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json),
            })
            const result = await res.json()
            if (!res.ok) { toast.error(result.error || 'Erreur lors de l\'import'); return }
            const note = result.data?.connections_note
            toast.success(`Agent "${result.data?.agent?.name}" importé avec succès${note ? ` — ${note}` : ''}`)
            fetchAgents()
        } catch { toast.error('Fichier invalide ou corrompu') }
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Bouton Importer */}
                        <label title="Importer une configuration d'agent" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#818cf8', fontWeight: 600, fontSize: 14
                        }}>
                            <Upload style={{ width: 16, height: 16 }} />
                            Importer
                            <input
                                type="file" accept=".json" style={{ display: 'none' }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) importAgent(f); e.target.value = '' }}
                            />
                        </label>

                        {atLimit ? (
                            <button
                                onClick={() => openUpgradeModal('agent_limit')}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '12px 24px', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    color: 'white', fontWeight: 600, border: 'none',
                                    cursor: 'pointer', fontSize: 14
                                }}
                            >
                                <Plus style={{ width: 20, height: 20 }} />
                                Passer au plan supérieur
                            </button>
                        ) : (
                            <Link
                                href="/dashboard/agents/new"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '12px 24px', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white', fontWeight: 600, textDecoration: 'none'
                                }}
                            >
                                <Plus style={{ width: 20, height: 20 }} />
                                {t('createButton')}
                            </Link>
                        )}
                    </div>
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

            {/* Astuce export/import — visible uniquement quand il y a des agents */}
            {agents.length > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', borderRadius: 10,
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                }}>
                    <Download style={{ width: 15, height: 15, color: '#818cf8', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>
                        <span style={{ color: '#c7d2fe', fontWeight: 600 }}>Astuce :</span>{' '}
                        Exportez la configuration d'un agent (bouton <span style={{ color: '#818cf8' }}>↓</span> sur la carte) avant de le supprimer.
                        Vous pourrez la réimporter en un clic avec le bouton <span style={{ color: '#818cf8', fontWeight: 600 }}>Importer</span> ci-dessus — sans tout reconfigurer.
                    </span>
                </div>
            )}

            {/* Agents Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                {filteredAgents.map((agent, index) => {
                    const operationalStatus = getAgentOperationalStatus(agent)
                    const operationalLabel = getAgentOperationalLabel(operationalStatus)
                    const operationalDetail = getAgentOperationalDetail(agent)
                    const operationalColors = getAgentOperationalColors(operationalStatus)
                    const StatusIcon = operationalStatus === 'qr_ready' ? MessageSquare : Smartphone
                    const isExternalSync = agent.ecommerce_mode === 'external_sync'
                    const isProductAgent = ['ecommerce', 'ecommerce_physical', 'ecommerce_digital', 'restaurant', 'hotel', 'salon'].includes(agent.mission || '')
                    const isServiceAgent = ['support_client', 'services', 'salon'].includes(agent.mission || '')
                    const isBookingAgent = ['restaurant', 'hotel', 'salon', 'services'].includes(agent.mission || '')
                    // KB est critique pour support_client/services/salon/custom — pas pour les agents produits ni external_sync
                    const kbEmpty = agent.knowledge_count === 0 && !isExternalSync && !isProductAgent
                    const missionCfg = (agent.mission && MISSION_CONFIG[agent.mission]) || MISSION_CONFIG['custom']
                    const MissionIcon = missionCfg.icon

                    return (
                    <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        style={{ ...cardStyle, position: 'relative', borderLeft: `3px solid ${missionCfg.color}` }}
                    >
                        {/* Agent info */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 14,
                                background: missionCfg.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1px solid ${missionCfg.color}40`,
                            }}>
                                <MissionIcon style={{ width: 28, height: 28, color: missionCfg.color }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 2 }}>
                                    {agent.name}
                                </h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                                    {agent.mission && MISSION_LABELS[agent.mission] && (
                                        <span style={{
                                            fontSize: 11, fontWeight: 600,
                                            color: missionCfg.color, background: missionCfg.bg,
                                            padding: '2px 8px', borderRadius: 4,
                                            border: `1px solid ${missionCfg.color}30`,
                                        }}>
                                            {MISSION_LABELS[agent.mission]}
                                        </span>
                                    )}
                                    {(agent.product_types || []).map(type => (
                                        <span key={type} style={{
                                            fontSize: 11, fontWeight: 500,
                                            color: '#94a3b8', background: 'rgba(148,163,184,0.1)',
                                            padding: '2px 6px', borderRadius: 4
                                        }}>
                                            {PRODUCT_TYPE_LABELS[type] || type}
                                        </span>
                                    ))}
                                </div>
                                <p style={{
                                    fontSize: 13,
                                    color: '#64748b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {agent.description || ''}
                                </p>
                            </div>
                            <span style={{
                                padding: '6px 10px',
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 600,
                                background: operationalColors.badgeBg,
                                color: operationalColors.badgeText,
                                whiteSpace: 'nowrap',
                                alignSelf: 'flex-start',
                            }}>
                                {operationalLabel}
                            </span>
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
                            <StatusIcon style={{ width: 16, height: 16, color: operationalColors.badgeText }} />
                            <span style={{ fontSize: 14, color: operationalColors.badgeText }}>
                                {operationalDetail}
                            </span>
                        </div>

                        {/* Stats — KPIs contextuels par mission */}
                        {agent.ecommerce_mode === 'external_sync' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10 }}>
                                <RefreshCw style={{ width: 14, height: 14, color: '#38bdf8', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: '#7dd3fc' }}>Canal de notifications — pas de réponses IA</span>
                            </div>
                        ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                            {/* Colonne 1 : toujours Conversations */}
                            <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(51,65,85,0.3)', borderRadius: 10 }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{agent.total_conversations || 0}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Conversations</div>
                            </div>
                            {/* Colonne 2 : Produits (ecommerce local) ou KB (support/services/custom) */}
                            {(agent.mission === 'ecommerce' || agent.mission === 'restaurant' || agent.mission === 'hotel' || agent.mission === 'salon') ? (
                                <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(51,65,85,0.3)', borderRadius: 10 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: missionCfg.color }}>{agent.product_count || 0}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                        <Package style={{ width: 10, height: 10 }} /> Produits
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(51,65,85,0.3)', borderRadius: 10 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: missionCfg.color }}>{agent.knowledge_count || 0}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                        <BookOpen style={{ width: 10, height: 10 }} /> Articles KB
                                    </div>
                                </div>
                            )}
                            {/* Colonne 3 : Leads (support/services/salon) ou Messages (ecommerce/resto/hotel) */}
                            {isServiceAgent ? (
                                <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(51,65,85,0.3)', borderRadius: 10 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{agent.lead_count || 0}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                                        <UserCheck style={{ width: 10, height: 10 }} /> Leads
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(51,65,85,0.3)', borderRadius: 10 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{agent.total_messages || 0}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>Messages</div>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>

                            {/* Modifier — tous */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <Link href={`/dashboard/agents/${agent.id}`} title={t('card.menu.edit')}
                                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                    <Edit style={{ width: 18, height: 18, color: '#3b82f6' }} />
                                </Link>
                                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Modifier</span>
                            </div>

                            {/* Connaissances — caché pour external_sync */}
                            {!isExternalSync && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <Link href={`/dashboard/agents/${agent.id}/knowledge`} title="Base de connaissances"
                                        style={{ width: 40, height: 40, borderRadius: 10, position: 'relative', backgroundColor: kbEmpty ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', border: kbEmpty ? '1px solid rgba(239, 68, 68, 0.4)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = kbEmpty ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = kbEmpty ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                        <BookOpen style={{ width: 18, height: 18, color: kbEmpty ? '#f87171' : '#10b981' }} />
                                        {kbEmpty && (
                                            <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #0f172a' }}>!</span>
                                        )}
                                    </Link>
                                    <span style={{ fontSize: 9, color: kbEmpty ? '#f87171' : '#64748b', fontWeight: kbEmpty ? 700 : 500 }}>
                                        {kbEmpty ? 'Vide !' : 'Connaissances'}
                                    </span>
                                </div>
                            )}

                            {/* Produits — ecommerce / restaurant / hotel / salon */}
                            {isProductAgent && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <Link href={`/dashboard/products?agent=${agent.id}`} title="Produits & catalogue"
                                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(245,158,11,0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                        <Package style={{ width: 18, height: 18, color: '#f59e0b' }} />
                                    </Link>
                                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Produits</span>
                                </div>
                            )}

                            {/* Commandes — ecommerce uniquement */}
                            {agent.mission === 'ecommerce' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <Link href="/dashboard/orders" title="Commandes"
                                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(16,185,129,0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                        <ShoppingBag style={{ width: 18, height: 18, color: '#10b981' }} />
                                    </Link>
                                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Commandes</span>
                                </div>
                            )}

                            {/* Réservations — restaurant / hotel / salon / services */}
                            {isBookingAgent && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <Link href="/dashboard/orders?tab=bookings" title="Réservations"
                                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(14,165,233,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(14,165,233,0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(14,165,233,0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                        <UserCheck style={{ width: 18, height: 18, color: '#0ea5e9' }} />
                                    </Link>
                                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Réservations</span>
                                </div>
                            )}

                            {/* Leads — support_client / services / salon + lead_collection_enabled */}
                            {(isServiceAgent || agent.lead_collection_enabled) && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <Link href={`/dashboard/agents/${agent.id}/leads`} title="Leads"
                                        style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(139, 92, 246, 0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                        <Users style={{ width: 18, height: 18, color: '#8b5cf6' }} />
                                    </Link>
                                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Leads</span>
                                </div>
                            )}

                            {/* Activer/Désactiver — tous */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <button onClick={() => toggleAgentStatus(agent.id)} disabled={actionLoading === agent.id}
                                    title={agent.is_active ? t('card.menu.deactivate') : t('card.menu.activate')}
                                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: agent.is_active ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = agent.is_active ? 'rgba(251, 191, 36, 0.3)' : 'rgba(16, 185, 129, 0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = agent.is_active ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                    <Power style={{ width: 18, height: 18, color: agent.is_active ? '#fbbf24' : '#10b981' }} />
                                </button>
                                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>{agent.is_active ? 'Désactiver' : 'Activer'}</span>
                            </div>

                            {/* Exporter config — tous */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <button onClick={() => exportAgent(agent.id)}
                                    title="Exporter la configuration de cet agent"
                                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(99, 102, 241, 0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                    <Download style={{ width: 18, height: 18, color: '#818cf8' }} />
                                </button>
                                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Exporter</span>
                            </div>

                            {/* Supprimer — tous */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <button onClick={() => deleteAgent(agent.id)} disabled={actionLoading === agent.id}
                                    title={t('card.menu.delete')}
                                    style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.transform = 'scale(1)' }}>
                                    <Trash2 style={{ width: 18, height: 18, color: '#ef4444' }} />
                                </button>
                                <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>Supprimer</span>
                            </div>
                        </div>

                        {/* Alerte base de connaissances vide — agents service (support, services, salon) */}
                        {isServiceAgent && agent.knowledge_count === 0 && (
                            <Link href={`/dashboard/agents/${agent.id}/knowledge`}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 10, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', textDecoration: 'none' }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                                <div>
                                    <div style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Base de connaissances vide — agent non fonctionnel</div>
                                    <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.4 }}>Cet agent ne connaît rien de votre activité. Ajoutez vos informations (tarifs, services, FAQ…) pour qu'il puisse répondre à vos clients. → Cliquez pour alimenter</div>
                                </div>
                            </Link>
                        )}

                        {/* Main action buttons */}
                        <div style={{ display: 'flex', gap: 12 }}>
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
                    )
                })}

                {/* Create new agent card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: filteredAgents.length * 0.1 }}
                >
                    <div
                        onClick={() => atLimit ? openUpgradeModal('agent_limit') : router.push('/dashboard/agents/new')}
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
                            cursor: 'pointer',
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
                    </div>
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
                            Agents dÃ©sactivÃ©s ({archivedAgents.length})
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
                                            â¸ DÃ©sactivÃ©
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
                                                    {agent.description.substring(0, 60)}{agent.description.length > 60 ? 'â€¦' : ''}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {deleteDate && (
                                        <div style={{
                                            fontSize: 11, color: '#ef4444', marginBottom: 12,
                                            display: 'flex', alignItems: 'center', gap: 4
                                        }}>
                                            âš ï¸ Suppression dÃ©finitive le {deleteDate}
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
                                        RÃ©activer â€” Renouvelez votre abonnement
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

