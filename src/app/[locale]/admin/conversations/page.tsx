'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Eye, Loader2, MessageSquare, Search, User, X } from 'lucide-react'

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
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ConversationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)

    useEffect(() => {
        fetchConversations()
    }, [])

    async function fetchConversations() {
        try {
            const res = await fetch('/api/admin/conversations')
            const data = await res.json()
            if (data.data?.conversations) {
                setConversations(data.data.conversations)
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

    const filteredConversations = useMemo(() => {
        return conversations.filter((conversation) => {
            const contact = formatContactPhone(conversation.contact_phone).display.toLowerCase()
            const pushName = (conversation.contact_push_name || '').toLowerCase()
            const agentName = (conversation.agent?.name || '').toLowerCase()
            const lastMessage = (conversation.last_message || '').toLowerCase()
            const query = searchQuery.toLowerCase()
            return contact.includes(query) || pushName.includes(query) || agentName.includes(query) || lastMessage.includes(query)
        })
    }, [conversations, searchQuery])

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
                    <p style={{ color: '#94a3b8' }}>{conversations.length} conversations suivies</p>
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
                            {['Contact', 'Agent', 'Messages', 'Dernier message', 'Date', 'Action'].map((header) => (
                                <th key={header} style={{
                                    padding: '16px 24px',
                                    textAlign: 'left',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                                }}>
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredConversations.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                    Aucune conversation trouvee
                                </td>
                            </tr>
                        ) : (
                            filteredConversations.map((conversation) => {
                                const { display, isLid } = formatContactPhone(conversation.contact_phone)
                                return (
                                    <tr key={conversation.id}>
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
