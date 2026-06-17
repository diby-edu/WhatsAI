'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Bot, ChevronLeft, ChevronRight, Eye, Loader2, MessageSquare, PauseCircle, Search, User, Users, X, Zap } from 'lucide-react'

const PAGE_SIZE = 50

function formatContactPhone(raw: string | null): { display: string; isLid: boolean } {
    if (!raw) return { display: 'Inconnu', isLid: false }
    if (raw.includes('@lid')) {
        return { display: raw.replace('@lid', ''), isLid: true }
    }
    if (raw.includes('@s.whatsapp.net')) {
        return { display: raw.replace('@s.whatsapp.net', ''), isLid: false }
    }
    return { display: raw, isLid: false }
}

type ConversationSummary = {
    id: string
    agent_id?: string | null
    user_id?: string | null
    bot_paused?: boolean | null
    contact_phone: string
    contact_push_name?: string | null
    created_at: string
    updated_at: string
    messages_count: number
    last_message: string
    last_message_at?: string
    agent?: { name?: string | null } | null
    profile?: { full_name?: string | null; email?: string | null } | null
}

type ConversationKpis = {
    totalConversations: number
    totalMessages: number
    activeLast24h: number
    pausedConversations: number
    pausedOver24h: number
    uniqueAgents: number
    uniqueContacts: number
}

type AgentBreakdown = {
    agentId: string | null
    agentName: string
    conversations: number
    messages: number
    paused: number
    activeLast24h: number
}

type OwnerBreakdown = {
    userId: string | null
    ownerName: string
    ownerEmail: string | null
    conversations: number
    messages: number
    paused: number
}

type PausedConversationAlert = {
    id: string
    contact_phone: string
    contact_push_name?: string | null
    agent_name: string
    last_message_at?: string | null
    hoursPaused: number
    messages_count: number
}

type ConversationBreakdowns = {
    byAgent: AgentBreakdown[]
    byOwner: OwnerBreakdown[]
    topAgentsByMessages: AgentBreakdown[]
    pausedOver24h: PausedConversationAlert[]
}

type ConversationDetail = {
    conversation: any
    messages: Array<{
        id: string
        role: 'user' | 'assistant' | 'system'
        content: string
        created_at: string
        message_type?: string | null
        media_url?: string | null
        status?: string | null
    }>
    pagination: {
        page: number
        limit: number
        total: number
        hasMore: boolean
    }
}

export default function AdminConversationsPage() {
    const [conversations, setConversations] = useState<ConversationSummary[]>([])
    const [kpis, setKpis] = useState<ConversationKpis>({
        totalConversations: 0,
        totalMessages: 0,
        activeLast24h: 0,
        pausedConversations: 0,
        pausedOver24h: 0,
        uniqueAgents: 0,
        uniqueContacts: 0,
    })
    const [breakdowns, setBreakdowns] = useState<ConversationBreakdowns>({
        byAgent: [],
        byOwner: [],
        topAgentsByMessages: [],
        pausedOver24h: [],
    })
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortField, setSortField] = useState<'date' | 'messages' | 'contact' | 'agent'>('date')
    const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
    const [page, setPage] = useState(1)
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ConversationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)

    useEffect(() => { fetchConversations() }, [])
    useEffect(() => { setPage(1) }, [searchQuery, sortField, sortDir])

    async function fetchConversations() {
        try {
            const res = await fetch('/api/admin/conversations')
            const data = await res.json()
            if (data.data?.conversations) {
                setConversations(data.data.conversations)
                setKpis(data.data.kpis || {
                    totalConversations: data.data.conversations.length,
                    totalMessages: 0,
                    activeLast24h: 0,
                    pausedConversations: 0,
                    pausedOver24h: 0,
                    uniqueAgents: 0,
                    uniqueContacts: 0,
                })
                setBreakdowns(data.data.breakdowns || {
                    byAgent: [],
                    byOwner: [],
                    topAgentsByMessages: [],
                    pausedOver24h: [],
                })
            }
        } catch (err) {
            console.error('Error fetching conversations:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchConversationDetail(id: string, page = 1, append = false) {
        setDetailLoading(true)
        setDetailError(null)
        try {
            const res = await fetch(`/api/admin/conversations/${id}?page=${page}&limit=50`)
            const json = await res.json()
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Erreur lors du chargement de la conversation')
            }

            setDetail((prev) => {
                if (!append || !prev) return json.data
                return {
                    ...json.data,
                    messages: [...json.data.messages, ...prev.messages],
                }
            })
        } catch (err: any) {
            console.error('Error fetching conversation detail:', err)
            setDetailError(err.message || 'Erreur lors du chargement de la conversation')
        } finally {
            setDetailLoading(false)
        }
    }

    async function openConversation(id: string) {
        setSelectedConversationId(id)
        setDetail(null)
        await fetchConversationDetail(id)
    }

    const filteredAndSorted = useMemo(() => {
        const q = searchQuery.toLowerCase()
        const filtered = conversations.filter((c) => {
            const contact = formatContactPhone(c.contact_phone).display.toLowerCase()
            const pushName = (c.contact_push_name || '').toLowerCase()
            const agentName = (c.agent?.name || '').toLowerCase()
            const lastMessage = (c.last_message || '').toLowerCase()
            return contact.includes(q) || pushName.includes(q) || agentName.includes(q) || lastMessage.includes(q)
        })
        filtered.sort((a, b) => {
            let cmp = 0
            if (sortField === 'date') {
                cmp = new Date(a.last_message_at || a.updated_at).getTime() - new Date(b.last_message_at || b.updated_at).getTime()
            } else if (sortField === 'messages') {
                cmp = (a.messages_count || 0) - (b.messages_count || 0)
            } else if (sortField === 'contact') {
                const ca = formatContactPhone(a.contact_phone).display
                const cb = formatContactPhone(b.contact_phone).display
                cmp = ca.localeCompare(cb, 'fr')
            } else if (sortField === 'agent') {
                cmp = (a.agent?.name || '').localeCompare(b.agent?.name || '', 'fr')
            }
            return sortDir === 'desc' ? -cmp : cmp
        })
        return filtered
    }, [conversations, searchQuery, sortField, sortDir])

    const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE)
    const pagedConversations = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const kpiCards = [
        {
            label: 'Conversations',
            value: kpis.totalConversations,
            icon: MessageSquare,
            color: '#60a5fa',
            bg: 'rgba(96, 165, 250, 0.12)',
        },
        {
            label: 'Messages',
            value: kpis.totalMessages,
            icon: Bot,
            color: '#a78bfa',
            bg: 'rgba(167, 139, 250, 0.12)',
        },
        {
            label: 'Actives 24h',
            value: kpis.activeLast24h,
            icon: Zap,
            color: '#34d399',
            bg: 'rgba(52, 211, 153, 0.12)',
        },
        {
            label: 'En pause',
            value: kpis.pausedConversations,
            icon: PauseCircle,
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.12)',
        },
        {
            label: 'Pause >24h',
            value: kpis.pausedOver24h,
            icon: PauseCircle,
            color: '#fb7185',
            bg: 'rgba(251, 113, 133, 0.12)',
        },
        {
            label: 'Agents impliques',
            value: kpis.uniqueAgents,
            icon: Bot,
            color: '#f472b6',
            bg: 'rgba(244, 114, 182, 0.12)',
        },
        {
            label: 'Contacts uniques',
            value: kpis.uniqueContacts,
            icon: Users,
            color: '#22d3ee',
            bg: 'rgba(34, 211, 238, 0.12)',
        },
    ]

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Conversations</h1>
                    <p style={{ color: '#94a3b8' }}>
                        {filteredAndSorted.length} conversation{filteredAndSorted.length === 1 ? '' : 's'}
                        {searchQuery.trim() ? ` filtrées sur ${conversations.length}` : ' suivies'}
                    </p>
                </div>
                <div style={{ position: 'relative', minWidth: 280 }}>
                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Rechercher une conversation..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 44px',
                            borderRadius: 12,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: 'white',
                            fontSize: 14,
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14,
            }}>
                {kpiCards.map((card) => (
                    <div
                        key={card.label}
                        style={{
                            background: 'rgba(15, 23, 42, 0.65)',
                            border: '1px solid rgba(148, 163, 184, 0.12)',
                            borderRadius: 18,
                            padding: 18,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                {card.label}
                            </span>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: card.bg,
                                color: card.color,
                            }}>
                                <card.icon size={18} />
                            </div>
                        </div>
                        <div style={{ color: 'white', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                            {card.value.toLocaleString('fr-FR')}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
            }}>
                <InsightPanel title="Repartition par agent" subtitle="Volume de conversations, messages et activite recente">
                    <BreakdownTable
                        headers={['Agent', 'Conv.', 'Msgs', '24h']}
                        emptyLabel="Aucune donnee agent"
                        rows={breakdowns.byAgent.slice(0, 8).map((row) => ({
                            key: row.agentId || row.agentName,
                            cells: [
                                <div key="agent" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ color: 'white', fontWeight: 600 }}>{row.agentName}</span>
                                    <span style={{ color: '#64748b', fontSize: 11 }}>{row.paused} pausee(s)</span>
                                </div>,
                                row.conversations.toLocaleString('fr-FR'),
                                row.messages.toLocaleString('fr-FR'),
                                row.activeLast24h.toLocaleString('fr-FR'),
                            ]
                        }))}
                    />
                </InsightPanel>

                <InsightPanel title="Repartition par proprietaire" subtitle="Qui porte le plus de conversations cote clients">
                    <BreakdownTable
                        headers={['Proprietaire', 'Conv.', 'Msgs', 'Pause']}
                        emptyLabel="Aucune donnee proprietaire"
                        rows={breakdowns.byOwner.slice(0, 8).map((row) => ({
                            key: row.userId || row.ownerName,
                            cells: [
                                <div key="owner" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ color: 'white', fontWeight: 600 }}>{row.ownerName}</span>
                                    <span style={{ color: '#64748b', fontSize: 11 }}>{row.ownerEmail || 'Email inconnu'}</span>
                                </div>,
                                row.conversations.toLocaleString('fr-FR'),
                                row.messages.toLocaleString('fr-FR'),
                                row.paused.toLocaleString('fr-FR'),
                            ]
                        }))}
                    />
                </InsightPanel>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
            }}>
                <InsightPanel title="Conversations en pause >24h" subtitle="Priorite de reprise humaine ou relance">
                    {breakdowns.pausedOver24h.length === 0 ? (
                        <EmptyInsight message="Aucune conversation en pause depuis plus de 24h." />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {breakdowns.pausedOver24h.map((row) => {
                                const { display } = formatContactPhone(row.contact_phone)
                                return (
                                    <button
                                        key={row.id}
                                        onClick={() => openConversation(row.id)}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.55)',
                                            border: '1px solid rgba(148, 163, 184, 0.12)',
                                            borderRadius: 14,
                                            padding: 14,
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                            <div>
                                                <div style={{ color: 'white', fontWeight: 600 }}>{row.contact_push_name || display}</div>
                                                <div style={{ color: '#64748b', fontSize: 12 }}>{row.agent_name}</div>
                                            </div>
                                            <div style={{
                                                padding: '4px 8px',
                                                borderRadius: 999,
                                                background: 'rgba(251, 113, 133, 0.12)',
                                                color: '#fb7185',
                                                fontSize: 12,
                                                fontWeight: 700,
                                            }}>
                                                {row.hoursPaused}h
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
                                            {display} • {row.messages_count} message(s)
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </InsightPanel>

                <InsightPanel title="Top agents par volume" subtitle="Ceux qui absorbent le plus de messages">
                    <BreakdownTable
                        headers={['Agent', 'Msgs', 'Conv.', 'Pause']}
                        emptyLabel="Aucun agent a afficher"
                        rows={breakdowns.topAgentsByMessages.map((row) => ({
                            key: `${row.agentId || row.agentName}-messages`,
                            cells: [
                                <span key="agent" style={{ color: 'white', fontWeight: 600 }}>{row.agentName}</span>,
                                row.messages.toLocaleString('fr-FR'),
                                row.conversations.toLocaleString('fr-FR'),
                                row.paused.toLocaleString('fr-FR'),
                            ]
                        }))}
                    />
                </InsightPanel>
            </div>

            <div className="admin-table-wrap" style={{
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflowX: 'auto',
            }}>
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                        <tr>
                            {([['Contact', 'contact'], ['Agent', 'agent']] as const).map(([label, field]) => (
                                <th key={field} onClick={() => { setSortField(field); setSortDir(s => sortField === field ? (s === 'desc' ? 'asc' : 'desc') : 'asc') }}
                                    style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: sortField === field ? '#60a5fa' : '#64748b', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        {label} {sortField === field ? (sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : null}
                                    </span>
                                </th>
                            ))}
                            <th onClick={() => { setSortField('messages'); setSortDir(s => sortField === 'messages' ? (s === 'desc' ? 'asc' : 'desc') : 'desc') }}
                                style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: sortField === 'messages' ? '#60a5fa' : '#64748b', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    Messages {sortField === 'messages' ? (sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : null}
                                </span>
                            </th>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(148,163,184,0.1)', whiteSpace: 'nowrap' }}>Dernier message</th>
                            <th onClick={() => { setSortField('date'); setSortDir(s => sortField === 'date' ? (s === 'desc' ? 'asc' : 'desc') : 'desc') }}
                                style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: sortField === 'date' ? '#60a5fa' : '#64748b', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(148,163,184,0.1)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    Date {sortField === 'date' ? (sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : null}
                                </span>
                            </th>
                            <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: 'rgba(15,23,42,0.5)', borderBottom: '1px solid rgba(148,163,184,0.1)', whiteSpace: 'nowrap' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedConversations.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                    Aucune conversation trouvée
                                </td>
                            </tr>
                        ) : (
                            pagedConversations.map((conversation) => {
                                const { display, isLid } = formatContactPhone(conversation.contact_phone)
                                return (
                                    <tr key={conversation.id} onClick={() => openConversation(conversation.id)} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.04)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 12,
                                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <User style={{ width: 20, height: 20, color: 'white' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {display}
                                                        {isLid && (
                                                            <span style={{
                                                                fontSize: 9,
                                                                padding: '1px 5px',
                                                                borderRadius: 4,
                                                                background: 'rgba(251, 191, 36, 0.15)',
                                                                color: '#fbbf24',
                                                                fontWeight: 600,
                                                                letterSpacing: '0.05em',
                                                            }}>
                                                                LID
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{conversation.contact_push_name || 'Inconnu'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Bot style={{ width: 16, height: 16, color: '#a855f7' }} />
                                                <span style={{ color: '#e2e8f0' }}>{conversation.agent?.name || 'Agent supprime'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: 'white', fontWeight: 500 }}>
                                            {conversation.messages_count || 0}
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {conversation.last_message || '-'}
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#64748b' }}>
                                            {new Date(conversation.last_message_at || conversation.created_at).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </td>
                                        <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <button
                                                onClick={() => openConversation(conversation.id)}
                                                style={{
                                                    padding: '10px 14px',
                                                    borderRadius: 10,
                                                    border: 'none',
                                                    background: 'rgba(59, 130, 246, 0.12)',
                                                    color: '#60a5fa',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <Eye size={14} /> Lire
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.12)', color: page === 1 ? '#475569' : '#e2e8f0', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                        <ChevronLeft size={15} /> Précédent
                    </button>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                        Page <span style={{ color: 'white', fontWeight: 600 }}>{page}</span> / {totalPages}
                        <span style={{ color: '#475569', marginLeft: 8 }}>({filteredAndSorted.length} conv.)</span>
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.12)', color: page === totalPages ? '#475569' : '#e2e8f0', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                        Suivant <ChevronRight size={15} />
                    </button>
                </div>
            )}

            <AnimatePresence>
                {selectedConversationId && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setSelectedConversationId(null)
                                setDetail(null)
                                setDetailError(null)
                            }}
                            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(4px)' }}
                        />
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 30 }}
                            style={{
                                position: 'fixed',
                                top: 24,
                                right: 24,
                                bottom: 24,
                                width: 'min(720px, calc(100vw - 32px))',
                                zIndex: 101,
                                background: '#0f172a',
                                border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 20,
                                padding: 24,
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
                                <div>
                                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>Lecture conversation</h2>
                                    {detail?.conversation && (
                                        <div style={{ color: '#94a3b8', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span>Agent: {detail.conversation.agent?.name || 'Inconnu'}</span>
                                            <span>Contact: {formatContactPhone(detail.conversation.contact_phone).display}</span>
                                            <span>Proprietaire: {detail.conversation.owner?.full_name || detail.conversation.owner?.email || 'Inconnu'}</span>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedConversationId(null)
                                        setDetail(null)
                                        setDetailError(null)
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {detailError && (
                                <div style={{
                                    padding: 14,
                                    borderRadius: 12,
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#fca5a5',
                                    marginBottom: 16,
                                }}>
                                    {detailError}
                                </div>
                            )}

                            <div style={{
                                flex: 1,
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                                paddingRight: 6,
                            }}>
                                {detailLoading && !detail ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 160 }}>
                                        <Loader2 style={{ width: 28, height: 28, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                                    </div>
                                ) : detail?.messages?.length ? (
                                    detail.messages.map((message) => (
                                        <div
                                            key={message.id}
                                            style={{
                                                alignSelf: message.role === 'assistant' ? 'flex-end' : 'flex-start',
                                                maxWidth: '82%',
                                                padding: '14px 16px',
                                                borderRadius: 16,
                                                background: message.role === 'assistant'
                                                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.12))'
                                                    : message.role === 'system'
                                                        ? 'rgba(148, 163, 184, 0.12)'
                                                        : 'rgba(30, 41, 59, 0.7)',
                                                border: '1px solid rgba(148, 163, 184, 0.12)',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                <span style={{
                                                    fontSize: 11,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em',
                                                    color: message.role === 'assistant' ? '#86efac' : '#94a3b8',
                                                    fontWeight: 700,
                                                }}>
                                                    {message.role === 'assistant' ? 'Assistant' : message.role === 'user' ? 'Client' : 'Systeme'}
                                                </span>
                                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                                    {new Date(message.created_at).toLocaleDateString('fr-FR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                {message.content || '[message vide]'}
                                            </div>
                                            {(message.message_type && message.message_type !== 'text') || message.media_url ? (
                                                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                                                    Type: {message.message_type || 'media'}
                                                    {message.media_url ? ' • Media jointe' : ''}
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#64748b', paddingTop: 80 }}>
                                        Aucun message trouve pour cette conversation.
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18 }}>
                                <div style={{ color: '#64748b', fontSize: 13 }}>
                                    {detail?.pagination ? `${detail.pagination.total} message(s)` : ''}
                                </div>
                                {detail?.pagination?.hasMore && selectedConversationId && (
                                    <button
                                        onClick={() => fetchConversationDetail(selectedConversationId, (detail.pagination.page || 1) + 1, true)}
                                        disabled={detailLoading}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            border: '1px solid rgba(148, 163, 184, 0.15)',
                                            background: 'rgba(30, 41, 59, 0.6)',
                                            color: 'white',
                                            cursor: detailLoading ? 'wait' : 'pointer',
                                            opacity: detailLoading ? 0.7 : 1,
                                        }}
                                    >
                                        {detailLoading ? 'Chargement...' : 'Charger plus'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}

function InsightPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <div style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: 20,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
        }}>
            <div>
                <h2 style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
                <p style={{ color: '#64748b', fontSize: 13 }}>{subtitle}</p>
            </div>
            {children}
        </div>
    )
}

function EmptyInsight({ message }: { message: string }) {
    return (
        <div style={{
            borderRadius: 14,
            border: '1px dashed rgba(148, 163, 184, 0.18)',
            padding: 18,
            color: '#64748b',
            fontSize: 13,
            textAlign: 'center',
        }}>
            {message}
        </div>
    )
}

function BreakdownTable({
    headers,
    rows,
    emptyLabel,
}: {
    headers: string[]
    rows: Array<{ key: string; cells: ReactNode[] }>
    emptyLabel: string
}) {
    if (rows.length === 0) {
        return <EmptyInsight message={emptyLabel} />
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
                <thead>
                    <tr>
                        {headers.map((header) => (
                            <th
                                key={header}
                                style={{
                                    textAlign: 'left',
                                    padding: '0 0 10px 0',
                                    color: '#64748b',
                                    fontSize: 11,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    fontWeight: 700,
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                                }}
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key}>
                            {row.cells.map((cell, index) => (
                                <td
                                    key={`${row.key}-${index}`}
                                    style={{
                                        padding: '12px 0',
                                        color: index === 0 ? '#e2e8f0' : '#cbd5e1',
                                        fontSize: 13,
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.06)',
                                        verticalAlign: 'top',
                                    }}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
