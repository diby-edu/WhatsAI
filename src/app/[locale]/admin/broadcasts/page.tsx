'use client'

import { useState, useEffect, useRef } from 'react'
import {
    Send, Users, MessageSquare, Loader2, CheckCircle,
    ArrowLeft, AlertTriangle, Clock, Mail, Search, Bell
} from 'lucide-react'
import Link from 'next/link'

interface Agent {
    id: string
    name: string
    total_conversations: number
}

interface UserOption {
    id?: string
    email: string
    name: string
    plan: string
}

type TabId = 'whatsapp' | 'email' | 'push'

const SEGMENT_OPTIONS = [
    { value: 'all', label: 'Tous les utilisateurs' },
    { value: 'free', label: 'Free uniquement' },
    { value: 'starter', label: 'Starter uniquement' },
    { value: 'pro', label: 'Pro uniquement' },
    { value: 'business', label: 'Business uniquement' },
    { value: 'agent_connected', label: 'Au moins un agent connecte' },
    { value: 'agent_paused', label: 'Au moins un agent en pause' },
    { value: 'agent_reconnect_required', label: 'Au moins un agent a reconnecter' },
    { value: 'agent_qr_ready', label: 'Au moins un agent a connecter' },
    { value: 'individual', label: 'Sélection individuelle' },
]

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
    free: { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' },
    starter: { bg: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' },
    pro: { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399' },
    business: { bg: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' },
}

function isAgentStatusSegment(value: string) {
    return value.startsWith('agent_')
}

function getSegmentHint(value: string) {
    switch (value) {
        case 'agent_connected':
            return 'Cible les utilisateurs ayant au moins un agent actuellement connecte.'
        case 'agent_paused':
            return 'Cible les utilisateurs ayant au moins un agent en pause.'
        case 'agent_reconnect_required':
            return 'Cible les utilisateurs ayant au moins un agent a reconnecter.'
        case 'agent_qr_ready':
            return 'Cible les utilisateurs ayant au moins un agent en attente de premiere connexion.'
        default:
            return null
    }
}

export default function AdminBroadcastsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('whatsapp')

    // WhatsApp state
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<string>('')
    const [waRecipientType, setWaRecipientType] = useState<'agent_conversations' | 'escalation_phones'>('agent_conversations')
    const [waMessage, setWaMessage] = useState('')
    const [waSending, setWaSending] = useState(false)
    const [waSent, setWaSent] = useState(false)
    const [recipientCount, setRecipientCount] = useState(0)
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null)
    const [broadcastProgress, setBroadcastProgress] = useState<{ total: number, sent: number, failed: number, pending: number } | null>(null)
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Email state
    const [emailSubject, setEmailSubject] = useState('')
    const [emailMessage, setEmailMessage] = useState('')
    const [emailPlan, setEmailPlan] = useState('all')
    const [emailRecipients, setEmailRecipients] = useState(0)
    const [emailSending, setEmailSending] = useState(false)
    const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
    const [emailError, setEmailError] = useState<string | null>(null)

    // Push state
    const [pushTitle, setPushTitle] = useState('')
    const [pushBody, setPushBody] = useState('')
    const [pushPlan, setPushPlan] = useState('all')
    const [pushDeviceCount, setPushDeviceCount] = useState(0)
    const [pushUserCount, setPushUserCount] = useState(0)
    const [pushSending, setPushSending] = useState(false)
    const [pushResult, setPushResult] = useState<{ sent: number; failed: number; total: number; userCount?: number } | null>(null)
    const [pushError, setPushError] = useState<string | null>(null)

    // Individual selection state (shared user list)
    const [allUsers, setAllUsers] = useState<UserOption[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    // Email individual selection
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
    const [userSearch, setUserSearch] = useState('')
    // Push individual selection
    const [selectedPushUserIds, setSelectedPushUserIds] = useState<Set<string>>(new Set())
    const [pushUserSearch, setPushUserSearch] = useState('')

    useEffect(() => {
        fetchAgents()
        fetchHistory()
    }, [])

    // Comptage escalation_phones quand le type change
    useEffect(() => {
        if (waRecipientType === 'escalation_phones') {
            fetch('/api/admin/broadcasts/preview?recipientType=escalation_phones')
                .then(r => r.json())
                .then(d => setRecipientCount(d.data?.count || 0))
                .catch(() => setRecipientCount(0))
        } else if (selectedAgent) {
            fetchWaRecipientCount(selectedAgent)
        } else {
            setRecipientCount(0)
        }
    }, [waRecipientType])

    // Polling progression broadcast actif
    useEffect(() => {
        if (!activeBroadcastId) return
        if (broadcastProgress && broadcastProgress.pending === 0) return

        progressIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/admin/broadcasts/${activeBroadcastId}/progress`)
                const data = await res.json()
                if (data.data) {
                    setBroadcastProgress(data.data)
                    if (data.data.pending === 0 && progressIntervalRef.current) {
                        clearInterval(progressIntervalRef.current)
                    }
                }
            } catch { /* silencieux */ }
        }, 5000)

        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
        }
    }, [activeBroadcastId])

    useEffect(() => {
        if (pushPlan === 'individual') {
            if (allUsers.length === 0) fetchAllUsers()
            setPushDeviceCount(0)
            setPushUserCount(0)
        } else {
            setSelectedPushUserIds(new Set())
            setPushUserSearch('')
            fetchPushDeviceCount(pushPlan)
        }
    }, [pushPlan])

    useEffect(() => {
        if (emailPlan === 'individual') {
            fetchAllUsers()
        } else {
            setSelectedEmails(new Set())
            setUserSearch('')
            fetchEmailRecipients(emailPlan)
        }
    }, [emailPlan])

    const fetchAgents = async () => {
        try {
            const res = await fetch('/api/admin/agents')
            const data = await res.json()
            if (data.data?.agents) setAgents(data.data.agents)
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
            if (data.data?.broadcasts) setHistory(data.data.broadcasts)
        } catch (err) {
            console.error('Error fetching history:', err)
        }
    }

    const fetchWaRecipientCount = async (agentId: string) => {
        if (!agentId) { setRecipientCount(0); return }
        try {
            const res = await fetch(`/api/admin/broadcasts/preview?agentId=${agentId}`)
            const data = await res.json()
            setRecipientCount(data.data?.count || 0)
        } catch (err) {
            console.error('Error fetching wa recipient count:', err)
        }
    }

    const fetchEmailRecipients = async (plan: string) => {
        try {
            const res = await fetch(`/api/admin/broadcasts/email?targetSegment=${plan}`)
            const data = await res.json()
            setEmailRecipients(data.data?.count || 0)
        } catch (err) {
            console.error('Error fetching email recipients:', err)
        }
    }

    const fetchPushDeviceCount = async (plan: string) => {
        try {
            const res = await fetch(`/api/admin/broadcasts/push?targetSegment=${plan}`)
            const data = await res.json()
            setPushDeviceCount(data.data?.count || 0)
            setPushUserCount(data.data?.userCount || 0)
        } catch {
            setPushDeviceCount(0)
            setPushUserCount(0)
        }
    }

    const sendPushBroadcast = async () => {
        if (!pushTitle.trim() || !pushBody.trim()) return
        const isIndividual = pushPlan === 'individual'
        const pushCount = isIndividual ? selectedPushUserIds.size : pushUserCount
        if (pushCount === 0) return
        const deviceMsg = !isIndividual && pushDeviceCount > 0 ? ` (${pushDeviceCount} push FCM)` : ''
        if (!confirm(`Envoyer à ${pushCount} utilisateur${pushCount === 1 ? '' : 's'}${deviceMsg} + cloche ?`)) return
        setPushSending(true)
        setPushResult(null)
        setPushError(null)
        try {
            const bodyData: any = { title: pushTitle.trim(), body: pushBody.trim() }
            if (isIndividual) {
                bodyData.targetUserIds = [...selectedPushUserIds]
            } else {
                bodyData.targetSegment = pushPlan
            }
            const res = await fetch('/api/admin/broadcasts/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            })
            const data = await res.json()
            if (res.ok && data.data) {
                setPushResult(data.data)
                setPushTitle('')
                setPushBody('')
                if (isIndividual) setSelectedPushUserIds(new Set())
                fetchHistory()
            } else {
                setPushError(data.error || 'Erreur lors de l\'envoi')
            }
        } catch {
            setPushError('Erreur réseau')
        } finally {
            setPushSending(false)
        }
    }

    const fetchAllUsers = async () => {
        setLoadingUsers(true)
        try {
            const res = await fetch('/api/admin/users?export=emails')
            const data = await res.json()
            if (data.data?.emails) setAllUsers(data.data.emails)
        } catch (err) {
            console.error('Error fetching users:', err)
        } finally {
            setLoadingUsers(false)
        }
    }

    const toggleUser = (email: string) => {
        setSelectedEmails(prev => {
            const next = new Set(prev)
            if (next.has(email)) next.delete(email)
            else next.add(email)
            return next
        })
    }

    const togglePushUser = (id: string) => {
        setSelectedPushUserIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const filteredUsers = allUsers.filter(u => {
        if (!userSearch.trim()) return true
        const q = userSearch.toLowerCase()
        return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    })

    const filteredPushUsers = allUsers.filter(u => {
        if (!pushUserSearch.trim()) return true
        const q = pushUserSearch.toLowerCase()
        return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    })

    const handleAgentChange = (agentId: string) => {
        setSelectedAgent(agentId)
        fetchWaRecipientCount(agentId)
    }

    const sendWaBroadcast = async () => {
        if (!selectedAgent || !waMessage.trim()) return
        setWaSending(true)
        setActiveBroadcastId(null)
        setBroadcastProgress(null)
        try {
            const res = await fetch('/api/admin/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: selectedAgent,
                    message: waMessage.trim(),
                    recipientType: waRecipientType,
                })
            })
            const data = await res.json()
            if (data.data?.success) {
                setWaSent(true)
                setWaMessage('')
                fetchHistory()
                if (data.data.broadcastId) {
                    setActiveBroadcastId(data.data.broadcastId)
                    setBroadcastProgress({ total: data.data.recipientCount, sent: 0, failed: 0, pending: data.data.recipientCount })
                }
                setTimeout(() => setWaSent(false), 5000)
            }
        } catch (err) {
            console.error('Error sending wa broadcast:', err)
        } finally {
            setWaSending(false)
        }
    }

    const sendEmailBroadcast = async () => {
        if (!emailSubject.trim() || !emailMessage.trim()) return
        const count = emailPlan === 'individual' ? selectedEmails.size : emailRecipients
        if (count === 0) return
        if (!confirm(`Envoyer "${emailSubject}" à ${count} utilisateur${count === 1 ? '' : 's'} ?`)) return

        setEmailSending(true)
        setEmailResult(null)
        setEmailError(null)
        try {
            const body: any = { subject: emailSubject, message: emailMessage }
            if (emailPlan === 'individual') {
                body.targetEmails = [...selectedEmails]
            } else {
                body.targetSegment = emailPlan
            }

            const res = await fetch('/api/admin/broadcasts/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (res.ok && data.data) {
                setEmailResult(data.data)
                setEmailSubject('')
                setEmailMessage('')
                if (emailPlan === 'individual') setSelectedEmails(new Set())
                fetchHistory()
            } else {
                setEmailError(data.error || 'Erreur lors de l\'envoi')
            }
        } catch {
            setEmailError('Erreur réseau')
        } finally {
            setEmailSending(false)
        }
    }

    const inputStyle = {
        width: '100%', padding: '12px 14px',
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: 10, color: 'white', fontSize: 14,
        outline: 'none'
    }

    const effectiveRecipientCount = emailPlan === 'individual' ? selectedEmails.size : emailRecipients
    const sendDisabled = !emailSubject.trim() || !emailMessage.trim() || emailSending || effectiveRecipientCount === 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Link href="/admin" style={{ color: '#64748b' }}>
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Broadcasts</h1>
                    <p style={{ color: '#64748b', fontSize: 13 }}>Envoi de messages en masse — WhatsApp, Email ou Push</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="broadcasts-tabs" style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                {([
                    { id: 'whatsapp' as TabId, label: 'WhatsApp', icon: MessageSquare, color: '#34d399' },
                    { id: 'email' as TabId, label: 'Email', icon: Mail, color: '#60a5fa' },
                    { id: 'push' as TabId, label: 'Push', icon: Bell, color: '#f59e0b' },
                ]).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                            background: 'transparent', borderRadius: '8px 8px 0 0',
                            color: activeTab === tab.id ? tab.color : '#64748b',
                            borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent'
                        }}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* WhatsApp Tab */}
            {activeTab === 'whatsapp' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Send size={18} style={{ color: '#34d399' }} /> Nouveau Broadcast WhatsApp
                        </h2>

                        {/* Sélecteur type de destinataires */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Destinataires</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {([
                                    { value: 'agent_conversations', label: 'Contacts agent' },
                                    { value: 'escalation_phones', label: 'Numéros d\'escalade' },
                                ] as const).map(opt => (
                                    <button key={opt.value} onClick={() => setWaRecipientType(opt.value)}
                                        style={{
                                            flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                            border: waRecipientType === opt.value ? '1px solid #34d399' : '1px solid rgba(148,163,184,0.2)',
                                            background: waRecipientType === opt.value ? 'rgba(52,211,153,0.1)' : 'rgba(15,23,42,0.5)',
                                            color: waRecipientType === opt.value ? '#34d399' : '#94a3b8',
                                        }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {waRecipientType === 'escalation_phones' && (
                                <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                                    Envoie au numéro d'escalade configuré sur chaque agent de la plateforme.
                                </p>
                            )}
                        </div>

                        {/* Agent expéditeur (toujours requis pour la session WhatsApp) */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
                                Agent expéditeur
                            </label>
                            <select value={selectedAgent} onChange={(e) => handleAgentChange(e.target.value)} style={inputStyle}>
                                <option value="">-- Choisir un agent connecté --</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name} ({agent.total_conversations || 0} conversations)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {recipientCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 10 }}>
                                <Users size={16} style={{ color: '#34d399' }} />
                                <span style={{ color: '#34d399', fontSize: 13 }}>{recipientCount} destinataire{recipientCount > 1 ? 's' : ''}</span>
                                <span style={{ color: '#64748b', fontSize: 12, marginLeft: 'auto' }}>
                                    ~{Math.ceil(recipientCount / 50)}h d'envoi
                                </span>
                            </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Message (max 500 car.)</label>
                            <textarea value={waMessage} onChange={(e) => setWaMessage(e.target.value.slice(0, 500))}
                                placeholder="Votre message WhatsApp..." rows={5} style={{ ...inputStyle, resize: 'none' }} />
                            <div style={{ textAlign: 'right', color: '#64748b', fontSize: 12, marginTop: 4 }}>{waMessage.length}/500</div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 10 }}>
                            <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                            <span style={{ color: '#fbbf24', fontSize: 12 }}>Limite : 50 messages/heure par agent. L'envoi se fait progressivement.</span>
                        </div>

                        <button onClick={sendWaBroadcast}
                            disabled={!selectedAgent || !waMessage.trim() || waSending || recipientCount === 0}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                padding: '13px 20px',
                                background: waSent ? 'rgba(34, 197, 94, 0.2)' : 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                opacity: (!selectedAgent || !waMessage.trim() || waSending || recipientCount === 0) ? 0.5 : 1
                            }}>
                            {(() => {
                                if (waSending) return <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Mise en file...</>
                                if (waSent) return <><CheckCircle size={16} />En cours d'envoi !</>
                                return <><Send size={16} />Envoyer le Broadcast</>
                            })()}
                        </button>

                        {/* Barre de progression */}
                        {broadcastProgress && activeBroadcastId && (
                            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Progression</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: broadcastProgress.pending === 0 ? '#34d399' : '#60a5fa' }}>
                                        {broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total}
                                    </span>
                                </div>
                                <div style={{ height: 6, background: 'rgba(148,163,184,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                                        background: broadcastProgress.pending === 0 ? '#34d399' : 'linear-gradient(90deg, #10b981, #60a5fa)',
                                        width: `${broadcastProgress.total > 0 ? Math.round((broadcastProgress.sent + broadcastProgress.failed) / broadcastProgress.total * 100) : 0}%`,
                                    }} />
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                                    <span style={{ fontSize: 11, color: '#34d399' }}>{broadcastProgress.sent} envoyés</span>
                                    {broadcastProgress.failed > 0 && <span style={{ fontSize: 11, color: '#f87171' }}>{broadcastProgress.failed} échoués</span>}
                                    {broadcastProgress.pending > 0 && (
                                        <span style={{ fontSize: 11, color: '#64748b' }}>
                                            {broadcastProgress.pending} en attente · ~{Math.ceil(broadcastProgress.pending / 50 * 60)}min restantes
                                        </span>
                                    )}
                                    {broadcastProgress.pending === 0 && (
                                        <span style={{ fontSize: 11, color: '#34d399', marginLeft: 'auto' }}>Terminé</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <HistoryPanel history={history} activeTab="whatsapp" activeBroadcastId={activeBroadcastId} broadcastProgress={broadcastProgress} />
                </div>
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Mail size={18} style={{ color: '#60a5fa' }} /> Nouvelle Campagne Email
                        </h2>

                        {/* Segment */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Segment cible</label>
                            <select value={emailPlan} onChange={(e) => setEmailPlan(e.target.value)} style={inputStyle}>
                                {SEGMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {isAgentStatusSegment(emailPlan) && (
                                <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
                                    {getSegmentHint(emailPlan)}
                                </div>
                            )}
                        </div>

                        {/* Individual user picker */}
                        {emailPlan === 'individual' && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label style={{ color: '#94a3b8', fontSize: 13 }}>
                                        Choisir les destinataires
                                        {selectedEmails.size > 0 && (
                                            <span style={{ marginLeft: 8, color: '#60a5fa', fontWeight: 600 }}>
                                                ({selectedEmails.size} sélectionné{selectedEmails.size === 1 ? '' : 's'})
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            onClick={() => setSelectedEmails(new Set(filteredUsers.map(u => u.email)))}
                                            style={{ background: 'none', border: '1px solid rgba(96, 165, 250, 0.3)', borderRadius: 6, color: '#60a5fa', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                            Tous
                                        </button>
                                        <button
                                            onClick={() => setSelectedEmails(new Set())}
                                            style={{ background: 'none', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                            Aucun
                                        </button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div style={{ position: 'relative', marginBottom: 8 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                        placeholder="Rechercher par nom ou email..."
                                        style={{ ...inputStyle, paddingLeft: 34 }}
                                    />
                                </div>

                                {/* User list */}
                                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 10, background: 'rgba(15, 23, 42, 0.4)' }}>
                                    {loadingUsers ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement...
                                        </div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Aucun utilisateur trouvé</div>
                                    ) : filteredUsers.map((u, idx) => {
                                        const isSelected = selectedEmails.has(u.email)
                                        const pc = PLAN_COLORS[u.plan] || PLAN_COLORS.free
                                        const rowBorder = idx < filteredUsers.length - 1 ? '1px solid rgba(148, 163, 184, 0.06)' : 'none'
                                        return (
                                            <div
                                                key={u.email}
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                tabIndex={0}
                                                onClick={() => toggleUser(u.email)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleUser(u.email) } }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    padding: '9px 12px', cursor: 'pointer',
                                                    borderBottom: rowBorder,
                                                    background: isSelected ? 'rgba(96, 165, 250, 0.08)' : 'transparent',
                                                    transition: 'background 0.15s'
                                                }}>
                                                {/* Checkbox */}
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                                    border: isSelected ? '2px solid #60a5fa' : '2px solid rgba(148, 163, 184, 0.3)',
                                                    background: isSelected ? '#60a5fa' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.15s'
                                                }}>
                                                    {isSelected && <span style={{ color: 'white', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>âœ“</span>}
                                                </div>
                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ color: 'white', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {u.name || u.email.split('@')[0]}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {u.email}
                                                    </div>
                                                </div>
                                                {/* Plan badge */}
                                                <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: pc.bg, color: pc.color, flexShrink: 0 }}>
                                                    {u.plan || 'free'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Recipients preview */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: 10 }}>
                            <Users size={16} style={{ color: '#60a5fa' }} />
                            <span style={{ color: '#60a5fa', fontSize: 13 }}>
                                {effectiveRecipientCount} destinataire{effectiveRecipientCount === 1 ? '' : 's'} recevront cet email
                            </span>
                        </div>

                        {/* Subject */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Sujet</label>
                            <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Ex: Nouveauté WazzapAI — Ã€ ne pas manquer !" style={inputStyle} />
                        </div>

                        {/* Body */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Corps du message</label>
                            <textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)}
                                placeholder={'Voici notre annonce...\n\nCordialement,\nL\'équipe WazzapAI'}
                                rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
                            <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                                "Bonjour [Nom]" est ajouté automatiquement. Les sauts de ligne sont conservés.
                            </div>
                        </div>

                        {/* Warning */}
                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 10 }}>
                            <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                            <span style={{ color: '#fbbf24', fontSize: 12 }}>Hostinger â‰ˆ 500 emails/h. Pour &gt;500 utilisateurs, préférez Brevo ou Mailchimp.</span>
                        </div>

                        {/* Result */}
                        {emailResult && (
                            <div style={{ padding: '12px 14px', marginBottom: 16, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 10 }}>
                                <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>✅ Campagne envoyée</div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                    {emailResult.sent} envoyé{emailResult.sent !== 1 ? 's' : ''}
                                    {emailResult.failed > 0 && ` · ${emailResult.failed} échec${emailResult.failed !== 1 ? 's' : ''}`}
                                    {' / '}{emailResult.total} total
                                </div>
                            </div>
                        )}
                        {emailError && (
                            <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                                {emailError}
                            </div>
                        )}

                        {/* Send button */}
                        <button onClick={sendEmailBroadcast}
                            disabled={sendDisabled}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                padding: '13px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                opacity: sendDisabled ? 0.5 : 1
                            }}>
                            {emailSending
                                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Envoi en cours ({effectiveRecipientCount})...</>
                                : <><Send size={16} />Envoyer la Campagne Email</>}
                        </button>
                    </div>

                    <HistoryPanel history={history} activeTab="email" />
                </div>
            )}

            {/* Push Tab */}
            {activeTab === 'push' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Bell size={18} style={{ color: '#f59e0b' }} /> Notification Push
                        </h2>

                        {/* Segment */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Segment cible</label>
                            <select value={pushPlan} onChange={(e) => setPushPlan(e.target.value)} style={inputStyle}>
                                {SEGMENT_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                            {isAgentStatusSegment(pushPlan) && (
                                <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
                                    {getSegmentHint(pushPlan)}
                                </div>
                            )}
                        </div>

                        {/* Individual user picker */}
                        {pushPlan === 'individual' && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label style={{ color: '#94a3b8', fontSize: 13 }}>
                                        Choisir les destinataires
                                        {selectedPushUserIds.size > 0 && (
                                            <span style={{ marginLeft: 8, color: '#f59e0b', fontWeight: 600 }}>
                                                ({selectedPushUserIds.size} sélectionné{selectedPushUserIds.size === 1 ? '' : 's'})
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            onClick={() => setSelectedPushUserIds(new Set(filteredPushUsers.map(u => u.id!).filter(Boolean)))}
                                            style={{ background: 'none', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 6, color: '#f59e0b', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                            Tous
                                        </button>
                                        <button
                                            onClick={() => setSelectedPushUserIds(new Set())}
                                            style={{ background: 'none', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                            Aucun
                                        </button>
                                    </div>
                                </div>
                                <div style={{ position: 'relative', marginBottom: 8 }}>
                                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                                    <input
                                        type="text"
                                        value={pushUserSearch}
                                        onChange={e => setPushUserSearch(e.target.value)}
                                        placeholder="Rechercher par nom ou email..."
                                        style={{ ...inputStyle, paddingLeft: 34 }}
                                    />
                                </div>
                                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 10, background: 'rgba(15, 23, 42, 0.4)' }}>
                                    {loadingUsers ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Chargement...
                                        </div>
                                    ) : filteredPushUsers.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Aucun utilisateur trouvé</div>
                                    ) : filteredPushUsers.map((u, idx) => {
                                        const uid = u.id || u.email
                                        const isSelected = selectedPushUserIds.has(uid)
                                        const pc = PLAN_COLORS[u.plan] || PLAN_COLORS.free
                                        return (
                                            <div
                                                key={uid}
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                tabIndex={0}
                                                onClick={() => togglePushUser(uid)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePushUser(uid) } }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    padding: '9px 12px', cursor: 'pointer',
                                                    borderBottom: idx < filteredPushUsers.length - 1 ? '1px solid rgba(148, 163, 184, 0.06)' : 'none',
                                                    background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                                                    transition: 'background 0.15s'
                                                }}>
                                                <div style={{
                                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                                    border: isSelected ? '2px solid #f59e0b' : '2px solid rgba(148, 163, 184, 0.3)',
                                                    background: isSelected ? '#f59e0b' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.15s'
                                                }}>
                                                    {isSelected && <span style={{ color: 'white', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>âœ“</span>}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ color: 'white', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {u.name || u.email.split('@')[0]}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {u.email}
                                                    </div>
                                                </div>
                                                <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: pc.bg, color: pc.color, flexShrink: 0 }}>
                                                    {u.plan || 'free'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Device/user count preview */}
                        {pushPlan === 'individual' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 16, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8 }}>
                                <Users size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                <span style={{ color: '#f59e0b', fontSize: 13 }}>
                                    {selectedPushUserIds.size} utilisateur{selectedPushUserIds.size === 1 ? '' : 's'} sélectionné{selectedPushUserIds.size === 1 ? '' : 's'}
                                </span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8 }}>
                                    <Bell size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                    <span style={{ color: '#f59e0b', fontSize: 13 }}>
                                        {pushDeviceCount} appareil{pushDeviceCount === 1 ? '' : 's'} recevront la notification push
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: 8 }}>
                                    <Users size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
                                    <span style={{ color: '#60a5fa', fontSize: 13 }}>
                                        {pushUserCount} utilisateur{pushUserCount === 1 ? '' : 's'} verront la notification dans leur cloche
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Title */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Titre</label>
                                <span style={{ color: '#475569', fontSize: 11 }}>{pushTitle.length}/65</span>
                            </div>
                            <input type="text" value={pushTitle} onChange={(e) => setPushTitle(e.target.value.slice(0, 65))}
                                placeholder="Ex: Nouvelle fonctionnalité disponible !" style={inputStyle} />
                        </div>

                        {/* Body */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Message</label>
                                <span style={{ color: '#475569', fontSize: 11 }}>{pushBody.length}/240</span>
                            </div>
                            <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value.slice(0, 240))}
                                placeholder="Découvrez ce qui est nouveau sur WazzapAI..." rows={4}
                                style={{ ...inputStyle, resize: 'none' }} />
                        </div>

                        {/* Warning bypass preferences */}
                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 16, background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 10 }}>
                            <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
                            <span style={{ color: '#fbbf24', fontSize: 12 }}>La cloche est alimentée pour tous les utilisateurs du segment, même ceux sans permission push.</span>
                        </div>

                        {/* Result */}
                        {pushResult && (
                            <div style={{ padding: '12px 14px', marginBottom: 16, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 10 }}>
                                <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>✅ Notification envoyée</div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                    Push : {pushResult.sent} envoyé{pushResult.sent !== 1 ? 's' : ''}
                                    {pushResult.failed > 0 && ` · ${pushResult.failed} échec${pushResult.failed !== 1 ? 's' : ''}`}
                                </div>
                                {(pushResult.userCount ?? 0) > 0 && (
                                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                        Cloche : {pushResult.userCount} utilisateur{pushResult.userCount !== 1 ? 's' : ''} notifié{pushResult.userCount !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        )}
                        {pushError && (
                            <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                                {pushError}
                            </div>
                        )}

                        {/* Send button */}
                        <button onClick={sendPushBroadcast}
                            disabled={!pushTitle.trim() || !pushBody.trim() || pushSending || (pushPlan === 'individual' ? selectedPushUserIds.size === 0 : pushUserCount === 0)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                padding: '13px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                opacity: (!pushTitle.trim() || !pushBody.trim() || pushSending || (pushPlan === 'individual' ? selectedPushUserIds.size === 0 : pushUserCount === 0)) ? 0.5 : 1
                            }}>
                            {pushSending
                                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Envoi en cours...</>
                                : <><Bell size={16} />Envoyer la Notification</>}
                        </button>
                    </div>

                    <HistoryPanel history={history} activeTab="push" />
                </div>
            )}
        </div>
    )
}

function HistoryPanel({
    history, activeTab, activeBroadcastId = null, broadcastProgress = null
}: {
    history: any[]
    activeTab: TabId
    activeBroadcastId?: string | null
    broadcastProgress?: { total: number, sent: number, failed: number, pending: number } | null
}) {
    const filteredHistory = history.filter(b => {
        if (activeTab === 'whatsapp') return !b.message?.startsWith('[EMAIL]') && !b.message?.startsWith('[PUSH]')
        if (activeTab === 'email') return b.message?.startsWith('[EMAIL]')
        if (activeTab === 'push') return b.message?.startsWith('[PUSH]')
        return true
    })
    return (
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: '#60a5fa' }} /> Historique
            </h2>
            {filteredHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                    <MessageSquare size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <p>Aucun broadcast envoyé</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredHistory.slice(0, 15).map((b, i) => {
                        const isEmail = b.message?.startsWith('[EMAIL]')
                        const isPush = b.message?.startsWith('[PUSH]')
                        const isActive = b.id === activeBroadcastId && broadcastProgress !== null
                        const prog = isActive ? broadcastProgress! : null
                        const pct = prog && prog.total > 0
                            ? Math.round((prog.sent + prog.failed) / prog.total * 100)
                            : null
                        return (
                            <div key={i} style={{
                                padding: 12, borderRadius: 10,
                                background: isActive ? 'rgba(37,211,102,0.05)' : 'rgba(15, 23, 42, 0.3)',
                                border: isActive ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(148, 163, 184, 0.05)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {isEmail
                                            ? <Mail size={12} style={{ color: '#60a5fa' }} />
                                            : isPush
                                                ? <Bell size={12} style={{ color: '#f59e0b' }} />
                                                : <MessageSquare size={12} style={{ color: '#34d399' }} />}
                                        <span style={{ color: 'white', fontWeight: 500, fontSize: 12 }}>
                                            {isEmail ? b.message.replace('[EMAIL] ', '')
                                                : isPush ? b.message.replace('[PUSH] ', '')
                                                    : (b.agent_name || 'Agent')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {/* Badge statut */}
                                        {isActive && prog!.pending > 0 && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 600 }}>
                                                En cours
                                            </span>
                                        )}
                                        {isActive && prog!.pending === 0 && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(52,211,153,0.15)', color: '#34d399', fontWeight: 600 }}>
                                                Terminé
                                            </span>
                                        )}
                                        {!isActive && b.status === 'sending' && (
                                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 600 }}>
                                                En cours
                                            </span>
                                        )}
                                        <span style={{ color: '#64748b', fontSize: 11 }}>
                                            {new Date(b.created_at).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                </div>

                                {!isEmail && !isPush && (
                                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 6px 0', lineHeight: 1.4 }}>
                                        {b.message?.substring(0, 70)}{b.message?.length > 70 ? '...' : ''}
                                    </p>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b', fontSize: 11 }}>
                                        {b.recipients_count || 0} destinataires
                                    </span>
                                    {prog && (
                                        <span style={{ fontSize: 11, color: '#60a5fa' }}>
                                            {prog.sent}/{prog.total} envoyés
                                        </span>
                                    )}
                                </div>

                                {/* Mini barre de progression pour le broadcast actif */}
                                {prog && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ height: 4, background: 'rgba(148,163,184,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                                                background: prog.pending === 0 ? '#34d399' : 'linear-gradient(90deg, #10b981, #60a5fa)',
                                                width: `${pct}%`,
                                            }} />
                                        </div>
                                        {prog.pending > 0 && (
                                            <span style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'block' }}>
                                                ~{Math.ceil(prog.pending / 50 * 60)}min restantes
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

