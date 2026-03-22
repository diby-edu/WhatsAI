'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Activity,
    Bot,
    Eye,
    Loader2,
    MessageCircle,
    MessageSquare,
    Power,
    RefreshCw,
    Search,
    Smartphone,
    Trash2,
    X,
} from 'lucide-react'
import {
    getAgentOperationalColors,
    getAgentOperationalDetail,
    getAgentOperationalLabel,
    getAgentOperationalStatus,
} from '@/lib/admin/agent-status'

type AdminAgent = {
    id: string
    name: string
    user: string
    userEmail: string
    messages: number
    created: string
    model?: string | null
    system_prompt?: string | null
    is_active: boolean
    whatsapp_connected: boolean
    whatsapp_status?: string | null
    whatsapp_phone?: string | null
    whatsapp_ever_connected?: boolean | null
    operationalStatus: string
    operationalLabel: string
    operationalDetail: string
    operationalColors: {
        badgeBg: string
        badgeText: string
        iconBg: string
    }
}

function normalizeAgent(agent: any): AdminAgent {
    const operationalStatus = getAgentOperationalStatus(agent)
    return {
        ...agent,
        operationalStatus,
        operationalLabel: getAgentOperationalLabel(operationalStatus),
        operationalDetail: getAgentOperationalDetail(agent),
        operationalColors: getAgentOperationalColors(operationalStatus),
        user: agent.profiles?.full_name || agent.profiles?.email || 'Inconnu',
        userEmail: agent.profiles?.email || '',
        messages: agent.total_messages || 0,
        created: new Date(agent.created_at).toLocaleDateString('fr-FR'),
    }
}

export default function AdminAgentsPage() {
    const [agents, setAgents] = useState<AdminAgent[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [viewAgent, setViewAgent] = useState<AdminAgent | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchAgents()
    }, [])

    async function fetchAgents() {
        try {
            const res = await fetch('/api/admin/agents')
            const data = await res.json()
            if (data.data?.agents) {
                setAgents(data.data.agents.map(normalizeAgent))
            }
        } catch (err) {
            console.error('Error fetching agents:', err)
        } finally {
            setLoading(false)
        }
    }

    async function disconnectWhatsApp(id: string, name: string) {
        if (!confirm(`Deconnecter WhatsApp de l'agent "${name}" ? Le bot ne repondra plus jusqu'au prochain scan QR.`)) return
        setActionLoading(id)
        setError(null)
        try {
            const res = await fetch(`/api/admin/agents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disconnect_whatsapp' }),
            })
            const json = await res.json()
            if (res.ok && json.success) {
                await fetchAgents()
            } else {
                setError(json.error || 'Erreur lors de la deconnexion WhatsApp')
            }
        } catch {
            setError('Erreur reseau')
        } finally {
            setActionLoading(null)
        }
    }

    async function toggleAgent(id: string) {
        setActionLoading(id)
        setError(null)
        try {
            const res = await fetch(`/api/admin/agents/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle' }),
            })
            const json = await res.json()
            if (res.ok && json.success) {
                await fetchAgents()
            } else {
                setError(json.error || 'Erreur lors de la modification de l agent')
            }
        } catch {
            setError('Erreur lors de la modification de l agent')
        } finally {
            setActionLoading(null)
        }
    }

    async function deleteAgent(id: string, name: string) {
        if (!confirm(`Supprimer definitivement l'agent "${name}" ?`)) return
        setActionLoading(id)
        setError(null)
        try {
            const res = await fetch(`/api/admin/agents/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (res.ok && json.success) {
                await fetchAgents()
            } else {
                setError(json.error || 'Erreur lors de la suppression de l agent')
            }
        } catch {
            setError('Erreur lors de la suppression de l agent')
        } finally {
            setActionLoading(null)
        }
    }

    const filtered = useMemo(() => {
        return agents.filter((agent) =>
            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            agent.user.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [agents, searchQuery])

    const statusCounts = useMemo(() => {
        return agents.reduce((acc, agent) => {
            acc[agent.operationalStatus] = (acc[agent.operationalStatus] || 0) + 1
            return acc
        }, {
            connected: 0,
            qr_ready: 0,
            reconnect_required: 0,
            paused: 0,
        } as Record<string, number>)
    }, [agents])

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Agents IA</h1>
                    <p style={{ color: '#94a3b8' }}>
                        {agents.length} agents â€¢ {statusCounts.connected} connectes â€¢ {statusCounts.qr_ready} a connecter â€¢ {statusCounts.reconnect_required} a reconnecter â€¢ {statusCounts.paused} en pause
                    </p>
                </div>
                <button
                    onClick={fetchAgents}
                    style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8',
                        cursor: 'pointer',
                    }}
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {error && (
                <div style={{
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 10,
                    color: '#f87171',
                    fontSize: 14,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    {error}
                    <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}>
                        <X size={16} />
                    </button>
                </div>
            )}

            <div style={{ position: 'relative', maxWidth: 400 }}>
                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                <input
                    type="text"
                    placeholder="Rechercher un agent..."
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filtered.map((agent, index) => (
                    <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 20,
                            position: 'relative',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    background: agent.operationalColors.iconBg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Bot style={{ width: 22, height: 22, color: 'white' }} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{agent.name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>{agent.user}</div>
                                </div>
                            </div>
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: 100,
                                fontSize: 11,
                                fontWeight: 600,
                                background: agent.operationalColors.badgeBg,
                                color: agent.operationalColors.badgeText,
                            }}>
                                {agent.operationalLabel}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(51, 65, 85, 0.3)', borderRadius: 8, marginBottom: 12 }}>
                            {agent.operationalStatus === 'connected' || agent.operationalStatus === 'reconnect_required' ? (
                                <Smartphone style={{ width: 14, height: 14, color: agent.operationalColors.badgeText }} />
                            ) : (
                                <MessageSquare style={{ width: 14, height: 14, color: agent.operationalColors.badgeText }} />
                            )}
                            <span style={{ fontSize: 12, color: agent.operationalColors.badgeText }}>{agent.operationalDetail}</span>
                        </div>

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

                        {agent.model && (
                            <div style={{
                                fontSize: 11,
                                color: '#475569',
                                marginBottom: 12,
                                padding: '4px 8px',
                                background: 'rgba(15,23,42,0.5)',
                                borderRadius: 6,
                                display: 'inline-block',
                            }}>
                                {agent.model}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid rgba(148, 163, 184, 0.08)', paddingTop: 12 }}>
                            <button
                                onClick={() => toggleAgent(agent.id)}
                                disabled={actionLoading === agent.id}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: 8,
                                    border: 'none',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    background: agent.is_active ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                    color: agent.is_active ? '#fbbf24' : '#4ade80',
                                    opacity: actionLoading === agent.id ? 0.5 : 1,
                                }}
                            >
                                <Power size={13} /> {agent.is_active ? 'Pause' : 'Activer'}
                            </button>
                            {agent.whatsapp_connected && (
                                <button
                                    onClick={() => disconnectWhatsApp(agent.id, agent.name)}
                                    disabled={actionLoading === agent.id}
                                    title="Deconnecter WhatsApp"
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        borderRadius: 8,
                                        border: 'none',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 4,
                                        background: 'rgba(249, 115, 22, 0.1)',
                                        color: '#f97316',
                                        opacity: actionLoading === agent.id ? 0.5 : 1,
                                    }}
                                >
                                    <Smartphone size={13} /> Deco. WA
                                </button>
                            )}
                            <button
                                onClick={() => setViewAgent(agent)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: 8,
                                    border: 'none',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4,
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: '#60a5fa',
                                }}
                            >
                                <Eye size={13} /> Voir
                            </button>
                            <button
                                onClick={() => deleteAgent(agent.id, agent.name)}
                                disabled={actionLoading === agent.id}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#f87171',
                                    opacity: actionLoading === agent.id ? 0.5 : 1,
                                }}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {filtered.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                    <Bot style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                    <p>Aucun agent trouve</p>
                </div>
            )}

            <AnimatePresence>
                {viewAgent && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setViewAgent(null)}
                            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            style={{
                                position: 'fixed',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 101,
                                width: 'min(500px, 92vw)',
                                maxHeight: '85vh',
                                overflowY: 'auto',
                                background: '#1e293b',
                                border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 16,
                                padding: 24,
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                            }}
                        >
                            <button onClick={() => setViewAgent(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>{viewAgent.name}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <InfoRow label="Proprietaire" value={`${viewAgent.user} (${viewAgent.userEmail})`} />
                                <InfoRow label="Statut operationnel" value={viewAgent.operationalLabel} />
                                <InfoRow label="WhatsApp" value={viewAgent.operationalDetail} />
                                <InfoRow label="Messages" value={viewAgent.messages.toLocaleString()} />
                                <InfoRow label="Modele" value={viewAgent.model || 'Par defaut'} />
                                <InfoRow label="Cree le" value={viewAgent.created} />
                                <InfoRow label="ID" value={viewAgent.id} mono />
                                {viewAgent.system_prompt && (
                                    <div>
                                        <span style={{ color: '#64748b', fontSize: 12 }}>System Prompt</span>
                                        <div style={{
                                            marginTop: 4,
                                            padding: 12,
                                            borderRadius: 8,
                                            background: 'rgba(15,23,42,0.5)',
                                            border: '1px solid rgba(148,163,184,0.1)',
                                            color: '#94a3b8',
                                            fontSize: 12,
                                            maxHeight: 200,
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap',
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
        </div>
    )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
            <span style={{ color: '#e2e8f0', fontSize: mono ? 11 : 13, fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>
                {value}
            </span>
        </div>
    )
}

