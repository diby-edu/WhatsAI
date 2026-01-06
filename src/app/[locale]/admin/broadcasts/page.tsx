'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Send, Users, MessageSquare, Bot, Loader2, CheckCircle,
    ArrowLeft, AlertTriangle, Clock, Search
} from 'lucide-react'
import Link from 'next/link'

interface Agent {
    id: string
    name: string
    total_conversations: number
}

export default function AdminBroadcastsPage() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<string>('')
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [recipientCount, setRecipientCount] = useState(0)
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAgents()
        fetchHistory()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/admin/agents')
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

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/admin/broadcasts')
            const data = await res.json()
            if (data.data?.broadcasts) {
                setHistory(data.data.broadcasts)
            }
        } catch (err) {
            console.error('Error fetching history:', err)
        }
    }

    const fetchRecipientCount = async (agentId: string) => {
        if (!agentId) {
            setRecipientCount(0)
            return
        }
        try {
            const res = await fetch(`/api/admin/broadcasts/preview?agentId=${agentId}`)
            const data = await res.json()
            setRecipientCount(data.data?.count || 0)
        } catch (err) {
            console.error('Error fetching recipient count:', err)
        }
    }

    const handleAgentChange = (agentId: string) => {
        setSelectedAgent(agentId)
        fetchRecipientCount(agentId)
    }

    const sendBroadcast = async () => {
        if (!selectedAgent || !message.trim()) return

        setSending(true)
        try {
            const res = await fetch('/api/admin/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: selectedAgent,
                    message: message.trim()
                })
            })
            const data = await res.json()
            if (data.data?.success) {
                setSent(true)
                setMessage('')
                fetchHistory()
                setTimeout(() => setSent(false), 5000)
            }
        } catch (err) {
            console.error('Error sending broadcast:', err)
        } finally {
            setSending(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Link href="/admin" style={{ color: '#64748b' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                        Broadcasts WhatsApp
                    </h1>
                    <p style={{ color: '#64748b', fontSize: 13 }}>
                        Envoyer des messages marketing à tous les clients d'un agent
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Compose Section */}
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 14, padding: 20
                }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Send size={18} style={{ color: '#34d399' }} />
                        Nouveau Broadcast
                    </h2>

                    {/* Agent Selection */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                            Sélectionner un Agent
                        </label>
                        <select
                            value={selectedAgent}
                            onChange={(e) => handleAgentChange(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 14px',
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: 10, color: 'white', fontSize: 14
                            }}
                        >
                            <option value="">-- Choisir un agent --</option>
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name} ({agent.total_conversations || 0} conversations)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Recipient Count */}
                    {selectedAgent && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 14px', marginBottom: 16,
                            background: 'rgba(52, 211, 153, 0.1)',
                            border: '1px solid rgba(52, 211, 153, 0.2)',
                            borderRadius: 10
                        }}>
                            <Users size={18} style={{ color: '#34d399' }} />
                            <span style={{ color: '#34d399', fontSize: 14 }}>
                                {recipientCount} destinataires seront contactés
                            </span>
                        </div>
                    )}

                    {/* Message */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                            Message (max 500 caractères)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                            placeholder="Écrivez votre message marketing ici..."
                            rows={5}
                            style={{
                                width: '100%', padding: '12px 14px',
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: 10, color: 'white', fontSize: 14,
                                resize: 'none'
                            }}
                        />
                        <div style={{ textAlign: 'right', color: '#64748b', fontSize: 12, marginTop: 4 }}>
                            {message.length}/500
                        </div>
                    </div>

                    {/* Warning */}
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 14px', marginBottom: 16,
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid rgba(251, 191, 36, 0.2)',
                        borderRadius: 10
                    }}>
                        <AlertTriangle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: '#fbbf24', fontSize: 13 }}>
                            Attention : Cette action enverra un message WhatsApp à tous les clients.
                            Utilisez avec modération pour éviter les signalements de spam.
                        </span>
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={sendBroadcast}
                        disabled={!selectedAgent || !message.trim() || sending || recipientCount === 0}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            padding: '14px 20px',
                            background: sent ? 'rgba(34, 197, 94, 0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none', borderRadius: 10,
                            color: 'white', cursor: 'pointer', fontSize: 15, fontWeight: 600,
                            opacity: (!selectedAgent || !message.trim() || sending || recipientCount === 0) ? 0.5 : 1
                        }}
                    >
                        {sending ? (
                            <>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                Envoi en cours...
                            </>
                        ) : sent ? (
                            <>
                                <CheckCircle size={18} />
                                Broadcast envoyé !
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                Envoyer le Broadcast
                            </>
                        )}
                    </button>
                </div>

                {/* History Section */}
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 14, padding: 20
                }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} style={{ color: '#60a5fa' }} />
                        Historique des Broadcasts
                    </h2>

                    {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                            <MessageSquare size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                            <p>Aucun broadcast envoyé</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {history.slice(0, 10).map((broadcast, i) => (
                                <div key={i} style={{
                                    padding: 14,
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    borderRadius: 10,
                                    border: '1px solid rgba(148, 163, 184, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>
                                            {broadcast.agent_name || 'Agent'}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: 12 }}>
                                            {new Date(broadcast.created_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                                        {broadcast.message?.substring(0, 100)}...
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                        <Users size={12} style={{ color: '#64748b' }} />
                                        <span style={{ color: '#64748b', fontSize: 12 }}>
                                            {broadcast.recipients_count || 0} destinataires
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
