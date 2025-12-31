'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, User, Bot, Clock, Loader2, RefreshCcw, Hand, Play, Send, Trash2, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
    message_type: string
    status: string
}

interface ConversationDetail {
    id: string
    contact_phone: string
    contact_push_name: string | null
    bot_paused: boolean
    agent: { id: string; name: string } | null
    created_at: string
    updated_at: string
    status: string
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: conversationId } = use(params)
    const t = useTranslations('Conversations.Detail')
    const router = useRouter()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [conversation, setConversation] = useState<ConversationDetail | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [togglingPause, setTogglingPause] = useState(false)
    const [newMessage, setNewMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (conversationId) {
            fetchConversation()
        }
    }, [conversationId])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const fetchConversation = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/conversations/${conversationId}`)
            const data = await res.json()

            if (data.data) {
                setConversation(data.data.conversation)
                setMessages(data.data.messages)
            } else {
                setError(data.error || t('notFound'))
            }
        } catch (err) {
            setError(t('error'))
        } finally {
            setLoading(false)
        }
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        })
    }

    const toggleBotPause = async () => {
        if (!conversation) return
        setTogglingPause(true)
        try {
            const res = await fetch(`/api/conversations/${conversation.id}/pause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paused: !conversation.bot_paused })
            })
            const data = await res.json()
            if (data.data) {
                setConversation({ ...conversation, bot_paused: data.data.bot_paused })
            }
        } catch (err) {
            console.error('Error toggling pause:', err)
        } finally {
            setTogglingPause(false)
        }
    }

    const handleSendMessage = async () => {
        if (!newMessage.trim() || sending) return

        setSending(true)
        try {
            const res = await fetch(`/api/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newMessage })
            })
            const data = await res.json()

            if (res.ok) {
                setNewMessage('')
                // Refresh messages
                fetchConversation()
            } else {
                console.error(data.error)
            }
        } catch (err) {
            console.error('Error sending message:', err)
        } finally {
            setSending(false)
        }
    }

    const handleDeleteConversation = async () => {
        setDeleting(true)
        try {
            const res = await fetch(`/api/conversations/${conversationId}`, {
                method: 'DELETE'
            })

            if (res.ok) {
                router.push('/dashboard/conversations')
            }
        } catch (err) {
            console.error('Error deleting conversation:', err)
        } finally {
            setDeleting(false)
            setShowDeleteConfirm(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    if (error || !conversation) {
        return (
            <div style={{ textAlign: 'center', padding: 48 }}>
                <p style={{ color: '#f87171' }}>{error || t('notFound')}</p>
                <button
                    onClick={() => router.push('/dashboard/conversations')}
                    style={{
                        marginTop: 16,
                        padding: '12px 24px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer'
                    }}
                >
                    {t('back')}
                </button>
            </div>
        )
    }

    const isEscalated = conversation.status === 'escalated'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', maxHeight: 800 }}>
            {/* Status Banner */}
            {isEscalated && (
                <div style={{
                    background: '#ef4444', color: 'white', padding: '12px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontWeight: 600
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertTriangle size={20} />
                        <span>ATTENTION REQUISE: Client mécontent ou demande d'humain.</span>
                    </div>
                    <button
                        onClick={() => {
                            // Resolve escalation -> set to active and resume bot
                            // For MVP, just resume bot via existing toggle, or we can add specific "Resolve" API
                            toggleBotPause()
                        }}
                        style={{
                            background: 'white', color: '#ef4444', border: 'none', padding: '6px 16px', borderRadius: 8,
                            fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        ✅ Résoudre & Relancer IA
                    </button>
                </div>
            )}
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 20,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '20px 20px 0 0',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
            }}>
                <button
                    onClick={() => router.push('/dashboard/conversations')}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.1)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <ArrowLeft style={{ width: 20, height: 20, color: '#94a3b8' }} />
                </button>

                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8
                    }}
                >
                    <Trash2 style={{ width: 18, height: 18, color: '#ef4444' }} />
                </button>

                <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <User style={{ width: 24, height: 24, color: 'white' }} />
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'white', fontSize: 16 }}>
                        {conversation.contact_push_name || conversation.contact_phone}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                        {conversation.contact_phone}
                        {conversation.agent && (
                            <span style={{
                                marginLeft: 8,
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc'
                            }}>{conversation.agent.name}</span>
                        )}
                    </div>
                </div>

                <button
                    onClick={fetchConversation}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <RefreshCcw style={{ width: 18, height: 18, color: '#34d399' }} />
                </button>

                {/* Bot Pause Toggle */}
                <button
                    onClick={toggleBotPause}
                    disabled={togglingPause}
                    title={conversation.bot_paused ? t('bot.resume') : t('bot.pause')}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: conversation.bot_paused
                            ? (isEscalated ? '#ef4444' : '#f59e0b')
                            : 'rgba(16, 185, 129, 0.15)',
                        border: 'none',
                        cursor: togglingPause ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: conversation.bot_paused ? 'white' : '#34d399',
                        opacity: togglingPause ? 0.6 : 1,
                        boxShadow: conversation.bot_paused ? '0 4px 12px rgba(239, 68, 68, 0.2)' : 'none'
                    }}
                >
                    {conversation.bot_paused ? (
                        <><Play size={16} fill="white" /> {isEscalated ? 'RÉSOUDRE' : 'RELANCER IA'}</>
                    ) : (
                        <><Hand size={16} /> PAUSE (HUMAIN)</>
                    )}
                </button>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 20,
                background: 'rgba(15, 23, 42, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
            }}>
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                        {t('emptyMessages')}
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                            style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
                                gap: 8
                            }}
                        >
                            {msg.role === 'user' && (
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'rgba(148, 163, 184, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <User style={{ width: 16, height: 16, color: '#94a3b8' }} />
                                </div>
                            )}

                            <div style={{
                                maxWidth: '70%',
                                padding: '12px 16px',
                                borderRadius: msg.role === 'user' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                                background: msg.role === 'user'
                                    ? 'rgba(148, 163, 184, 0.15)'
                                    : 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white'
                            }}>
                                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {msg.content}
                                </p>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: msg.role === 'user' ? '#64748b' : 'rgba(255,255,255,0.7)'
                                }}>
                                    <Clock style={{ width: 10, height: 10 }} />
                                    {formatTime(msg.created_at)}
                                </div>
                            </div>

                            {msg.role === 'assistant' && (
                                <div style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Bot style={{ width: 16, height: 16, color: 'white' }} />
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input Function Area */}
            <div style={{
                padding: 16,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '0 0 20px 20px',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                display: 'flex',
                gap: 12,
                alignItems: 'center'
            }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder={t('inputPlaceholder')}
                        disabled={sending}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: 12,
                            color: 'white',
                            outline: 'none',
                            fontSize: 14
                        }}
                    />
                </div>
                <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    style={{
                        padding: '12px 20px',
                        background: newMessage.trim() && !sending ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(51, 65, 85, 0.5)',
                        color: newMessage.trim() && !sending ? 'white' : '#94a3b8',
                        border: 'none',
                        borderRadius: 12,
                        cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s'
                    }}
                >
                    {sending ? (
                        <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <>
                            {t('send')} <Send size={16} />
                        </>
                    )}
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            background: '#1e293b',
                            padding: 32,
                            borderRadius: 20,
                            width: 400,
                            maxWidth: '90%',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <Trash2 size={32} />
                        </div>
                        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 12 }}>
                            {t('delete.title')}
                        </h3>
                        <p style={{ color: '#94a3b8', marginBottom: 24, lineHeight: 1.5 }}>
                            {t('delete.confirm')}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    padding: '12px',
                                    borderRadius: 12,
                                    background: 'rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                {t('delete.cancel')}
                            </button>
                            <button
                                onClick={handleDeleteConversation}
                                disabled={deleting}
                                style={{
                                    padding: '12px',
                                    borderRadius: 12,
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                {deleting ? t('delete.deleting') : t('delete.confirmBtn')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
