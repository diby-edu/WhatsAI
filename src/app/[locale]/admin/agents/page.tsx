'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot, Search, Power, MessageCircle, Activity, Trash2,
    Loader2, X, Eye, RefreshCw
} from 'lucide-react'

export default function AdminAgentsPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [viewAgent, setViewAgent] = useState<any>(null)

    useEffect(() => { fetchAgents() }, [])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/admin/agents')
            const data = await res.json()
            if (data.data?.agents) {
                setAgents(data.data.agents.map((a: any) => ({
                    ...a,
                    status: a.is_active ? 'active' : 'paused',
                    user: a.profiles?.full_name || a.profiles?.email || 'Inconnu',
                    userEmail: a.profiles?.email || '',
                    messages: a.total_messages || 0,
                    created: new Date(a.created_at).toLocaleDateString('fr-FR')
                })))
            }
        } catch (err) {
            console.error('Error fetching agents:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleAgent = async (id: string) => {
        setActionLoading(id)
        try {
            const res = await fetch(`/api/admin/agents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle' })
            })
            if ((await res.json()).success) await fetchAgents()
        } catch { } finally { setActionLoading(null) }
    }

    const deleteAgent = async (id: string, name: string) => {
        if (!confirm(`Supprimer définitivement l'agent "${name}" ?`)) return
        setActionLoading(id)
        try {
            const res = await fetch(`/api/admin/agents/${id}`, { method: 'DELETE' })
            if ((await res.json()).success) await fetchAgents()
        } catch { } finally { setActionLoading(null) }
    }

    const filtered = agents.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.user.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Agents IA</h1>
                    <p style={{ color: '#94a3b8' }}>{agents.length} agents — {agents.filter(a => a.status === 'active').length} actifs</p>
                </div>
                <button onClick={fetchAgents} style={{
                    padding: '10px 16px', borderRadius: 10, background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)', color: '#94a3b8', cursor: 'pointer'
                }}>
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: 400 }}>
                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                <input type="text" placeholder="Rechercher un agent..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 12px 12px 44px', borderRadius: 12,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: 'white', fontSize: 14, outline: 'none'
                    }} />
            </div>

            {/* Agents Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map((agent, index) => (
                    <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16, padding: 20, position: 'relative'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 12,
                                    background: agent.status === 'active'
                                        ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                                        : 'linear-gradient(135deg, #475569, #334155)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Bot style={{ width: 22, height: 22, color: 'white' }} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{agent.name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>{agent.user}</div>
                                </div>
                            </div>
                            <span style={{
                                padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                                background: agent.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: agent.status === 'active' ? '#4ade80' : '#fbbf24'
                            }}>
                                {agent.status === 'active' ? 'Actif' : 'Pause'}
                            </span>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MessageCircle style={{ width: 14, height: 14, color: '#64748b' }} />
                                <span style={{ fontSize: 13, color: '#94a3b8' }}>{agent.messages.toLocaleString()} msgs</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Activity style={{ width: 14, height: 14, color: '#64748b' }} />
                                <span style={{ fontSize: 13, color: '#94a3b8' }}>{agent.created}</span>
                            </div>
                        </div>

                        {/* Model + description */}
                        {agent.model && (
                            <div style={{ fontSize: 11, color: '#475569', marginBottom: 12, padding: '4px 8px', background: 'rgba(15,23,42,0.5)', borderRadius: 6, display: 'inline-block' }}>
                                {agent.model}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid rgba(148, 163, 184, 0.08)', paddingTop: 12 }}>
                            <button onClick={() => toggleAgent(agent.id)} disabled={actionLoading === agent.id}
                                style={{
                                    flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    background: agent.status === 'active' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                    color: agent.status === 'active' ? '#fbbf24' : '#4ade80',
                                    opacity: actionLoading === agent.id ? 0.5 : 1
                                }}>
                                <Power size={13} /> {agent.status === 'active' ? 'Pause' : 'Activer'}
                            </button>
                            <button onClick={() => setViewAgent(agent)}
                                style={{
                                    flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                    background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa'
                                }}>
                                <Eye size={13} /> Voir
                            </button>
                            <button onClick={() => deleteAgent(agent.id, agent.name)} disabled={actionLoading === agent.id}
                                style={{
                                    padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: 'rgba(239, 68, 68, 0.1)', color: '#f87171',
                                    opacity: actionLoading === agent.id ? 0.5 : 1
                                }}>
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {filtered.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                    <Bot style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                    <p>Aucun agent trouvé</p>
                </div>
            )}

            {/* View Agent Modal */}
            <AnimatePresence>
                {viewAgent && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setViewAgent(null)}
                            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            style={{
                                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                zIndex: 101, width: 500, maxHeight: '85vh', overflowY: 'auto',
                                background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                            }}>
                            <button onClick={() => setViewAgent(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>{viewAgent.name}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <InfoRow label="Propriétaire" value={`${viewAgent.user} (${viewAgent.userEmail})`} />
                                <InfoRow label="Statut" value={viewAgent.status === 'active' ? '✅ Actif' : '⏸ En pause'} />
                                <InfoRow label="Messages" value={viewAgent.messages.toLocaleString()} />
                                <InfoRow label="Modèle" value={viewAgent.model || 'Par défaut'} />
                                <InfoRow label="Créé le" value={viewAgent.created} />
                                <InfoRow label="ID" value={viewAgent.id} mono />
                                {viewAgent.system_prompt && (
                                    <div>
                                        <span style={{ color: '#64748b', fontSize: 12 }}>System Prompt</span>
                                        <div style={{
                                            marginTop: 4, padding: 12, borderRadius: 8,
                                            background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)',
                                            color: '#94a3b8', fontSize: 12, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap'
                                        }}>
                                            {viewAgent.system_prompt}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <style jsx global>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
            <span style={{ color: '#e2e8f0', fontSize: mono ? 11 : 13, fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
        </div>
    )
}
