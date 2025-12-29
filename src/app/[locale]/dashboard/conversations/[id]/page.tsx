'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, User, Bot, Clock, Loader2, RefreshCcw, Hand, Play } from 'lucide-react'

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
}

export default function ConversationDetailPage() {
    const params = useParams()
    const router = useRouter()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [conversation, setConversation] = useState<ConversationDetail | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [togglingPause, setTogglingPause] = useState(false)

    useEffect(() => {
        if (params.id) {
            fetchConversation()
        }
    }, [params.id])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const fetchConversation = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/conversations/${params.id}`)
            const data = await res.json()

            if (data.data) {
                setConversation(data.data.conversation)
                setMessages(data.data.messages)
            } else {
                setError(data.error || 'Conversation not found')
            }
        } catch (err) {
            setError('Erreur de chargement')
        } finally {
            setLoading(false)
        }
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
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
                <p style={{ color: '#f87171' }}>{error || 'Conversation introuvable'}</p>
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
                    Retour aux conversations
                </button>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', maxHeight: 800 }}>
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
                    title={conversation.bot_paused ? 'Réactiver le bot' : 'Prendre le contrôle (pause bot)'}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: conversation.bot_paused
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        border: 'none',
                        cursor: togglingPause ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: conversation.bot_paused ? '#34d399' : '#f59e0b',
                        opacity: togglingPause ? 0.6 : 1
                    }}
                >
                    {conversation.bot_paused ? (
                        <><Play size={16} /> Réactiver Bot</>
                    ) : (
                        <><Hand size={16} /> Prendre la main</>
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
                        Aucun message dans cette conversation
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

            {/* Footer */}
            <div style={{
                padding: 16,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '0 0 20px 20px',
                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                textAlign: 'center',
                color: '#64748b',
                fontSize: 13
            }}>
                {messages.length} messages • Conversation démarrée le {formatDate(conversation.created_at)}
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
