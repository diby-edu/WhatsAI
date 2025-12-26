'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Plus, Search, MoreVertical, Power, Activity, MessageCircle } from 'lucide-react'

export default function AdminAgentsPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAgents()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/admin/agents')
            const data = await res.json()
            if (data.data?.agents) {
                const mappedAgents = data.data.agents.map((a: any) => ({
                    id: a.id,
                    name: a.name,
                    status: a.is_active ? 'active' : 'paused',
                    user: a.profiles?.full_name || a.profiles?.email || 'Inconnu',
                    messages: a.total_messages || 0,
                    created: new Date(a.created_at).toLocaleDateString('fr-FR')
                }))
                setAgents(mappedAgents)
            }
        } catch (err) {
            console.error('Error fetching admin agents:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>Agents IA</h1>
                    <p style={{ color: '#94a3b8' }}>{agents.length} agents configurés</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        fontWeight: 600,
                        borderRadius: 14,
                        border: 'none',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white'
                    }}
                >
                    <Plus style={{ width: 20, height: 20 }} />
                    Créer un agent
                </motion.button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 24
            }}>
                {agents.map((agent, index) => (
                    <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Bot style={{ width: 24, height: 24, color: 'white' }} />
                            </div>
                            <span style={{
                                padding: '6px 12px',
                                borderRadius: 100,
                                fontSize: 12,
                                fontWeight: 600,
                                background: agent.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: agent.status === 'active' ? '#4ade80' : '#fbbf24'
                            }}>
                                {agent.status === 'active' ? 'Actif' : 'En pause'}
                            </span>
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 8 }}>{agent.name}</h3>
                        <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>Propriétaire: {agent.user}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <MessageCircle style={{ width: 16, height: 16, color: '#64748b' }} />
                                <span style={{ fontSize: 14, color: '#94a3b8' }}>{agent.messages.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Activity style={{ width: 16, height: 16, color: '#64748b' }} />
                                <span style={{ fontSize: 14, color: '#94a3b8' }}>{agent.created}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
