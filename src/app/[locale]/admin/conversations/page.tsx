'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Search, Filter, Eye, User, Bot, Loader2 } from 'lucide-react'

export default function AdminConversationsPage() {
    const [conversations, setConversations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchConversations()
    }, [])

    const fetchConversations = async () => {
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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Conversations</h1>
                <p style={{ color: '#94a3b8' }}>{conversations.length} conversations actives</p>
            </div>

            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Contact', 'Agent', 'Messages', 'Dernier message', 'Date'].map(h => (
                                <th key={h} style={{
                                    padding: '16px 24px',
                                    textAlign: 'left',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {conversations.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                    Aucune conversation trouvée
                                </td>
                            </tr>
                        ) : (
                            conversations.map((conv) => (
                                <tr key={conv.id}>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 12,
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <User style={{ width: 20, height: 20, color: 'white' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500, color: 'white' }}>{conv.contact_phone}</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>{conv.contact_push_name || 'Inconnu'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Bot style={{ width: 16, height: 16, color: '#a855f7' }} />
                                            <span style={{ color: '#e2e8f0' }}>{conv.agent?.name || 'Agent supprimé'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: 'white', fontWeight: 500 }}>
                                        {conv.messages_count || 0}
                                    </td>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#94a3b8', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {conv.last_message || '-'}
                                    </td>
                                    <td style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#64748b' }}>
                                        {new Date(conv.last_message_at || conv.created_at).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

