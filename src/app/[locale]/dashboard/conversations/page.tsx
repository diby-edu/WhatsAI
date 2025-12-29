'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MessageCircle, User, Clock, Search, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Conversation {
    id: string
    contact_phone: string
    contact_push_name: string | null
    agent: { id: string; name: string } | null
    messages_count: number
    last_message: string
    last_message_at: string
}

export default function DashboardConversationsPage() {
    const t = useTranslations('Conversations.List')
    const router = useRouter()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchConversations()
    }, [])

    const fetchConversations = async () => {
        try {
            const res = await fetch('/api/conversations')
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

    const filteredConversations = conversations.filter(c =>
        c.contact_phone.includes(searchTerm) ||
        c.contact_push_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.agent?.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return t('card.justNow')
        if (diffMins < 60) return t('card.ago', { time: `${diffMins} ${t('card.minutes')}` })
        if (diffMins < 1440) return t('card.ago', { time: `${Math.floor(diffMins / 60)}${t('card.hours')}` })
        return date.toLocaleDateString()
    }

    const formatPhoneNumber = (phone: string) => {
        if (!phone) return t('card.unknown')
        // Clean WhatsApp suffixes
        const clean = phone.replace(/@s\.whatsapp\.net|@lid|@g\.us/g, '')
        // Format with proper spacing
        if (clean.length >= 11) {
            const countryCode = clean.substring(0, 3)
            const rest = clean.substring(3)
            const formatted = rest.replace(/(\d{3})(?=\d)/g, '$1 ')
            return '+' + countryCode + ' ' + formatted.trim()
        }
        return '+' + clean
    }

    const getDisplayName = (conv: Conversation) => {
        if (conv.contact_push_name && conv.contact_push_name !== 'undefined') {
            return conv.contact_push_name
        }
        return formatPhoneNumber(conv.contact_phone)
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                    <p style={{ color: '#94a3b8' }}>{t('subtitle', { count: conversations.length })}</p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                    <input
                        placeholder={t('searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: '12px 12px 12px 44px',
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 14,
                            color: 'white',
                            width: 280
                        }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredConversations.length === 0 ? (
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        padding: 48,
                        textAlign: 'center'
                    }}>
                        <MessageCircle style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 16px' }} />
                        <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{t('empty.title')}</h3>
                        <p style={{ color: '#64748b', fontSize: 14 }}>
                            {searchTerm ? t('empty.noResults') : t('empty.description')}
                        </p>
                    </div>
                ) : (
                    filteredConversations.map((conv, i) => (
                        <motion.div
                            key={conv.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => router.push(`/dashboard/conversations/${conv.id}`)}
                            whileHover={{ scale: 1.01, borderColor: 'rgba(16, 185, 129, 0.3)' }}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                padding: 20,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: 14,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <User style={{ width: 24, height: 24, color: 'white' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, color: 'white' }}>{getDisplayName(conv)}</span>
                                        {conv.agent && (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                background: 'rgba(168, 85, 247, 0.15)',
                                                color: '#c084fc'
                                            }}>{conv.agent.name}</span>
                                        )}
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 400 }}>
                                        {conv.last_message || t('empty.description')}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                                        <Clock style={{ width: 12, height: 12 }} />
                                        {formatDate(conv.last_message_at)}
                                    </div>
                                    <span style={{
                                        padding: '4px 10px',
                                        borderRadius: 100,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#34d399'
                                    }}>{conv.messages_count} msg</span>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
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
