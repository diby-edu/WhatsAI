'use client'

import { useState, useEffect } from 'react'
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
    email: string
    name: string
    plan: string
}

type TabId = 'whatsapp' | 'email' | 'push'

const PLAN_OPTIONS = [
    { value: 'all', label: 'Tous les utilisateurs' },
    { value: 'free', label: 'Free uniquement' },
    { value: 'starter', label: 'Starter uniquement' },
    { value: 'pro', label: 'Pro uniquement' },
    { value: 'business', label: 'Business uniquement' },
    { value: 'individual', label: 'Sélection individuelle' },
]

const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
    free: { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' },
    starter: { bg: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' },
    pro: { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399' },
    business: { bg: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' },
}

export default function AdminBroadcastsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('whatsapp')

    // WhatsApp state
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<string>('')
    const [waMessage, setWaMessage] = useState('')
    const [waSending, setWaSending] = useState(false)
    const [waSent, setWaSent] = useState(false)
    const [recipientCount, setRecipientCount] = useState(0)
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

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

    // Individual selection state
    const [allUsers, setAllUsers] = useState<UserOption[]>([])
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
    const [userSearch, setUserSearch] = useState('')
    const [loadingUsers, setLoadingUsers] = useState(false)

    useEffect(() => {
        fetchAgents()
        fetchHistory()
    }, [])

    useEffect(() => {
        fetchPushDeviceCount(pushPlan)
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
            const res = await fetch(`/api/admin/broadcasts/email?targetPlan=${plan}`)
            const data = await res.json()
            setEmailRecipients(data.data?.count || 0)
        } catch (err) {
            console.error('Error fetching email recipients:', err)
        }
    }

    const fetchPushDeviceCount = async (plan: string) => {
        try {
            const res = await fetch(`/api/admin/broadcasts/push?targetPlan=${plan}`)
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
        if (!confirm(`Envoyer à ${pushDeviceCount} appareil${pushDeviceCount === 1 ? '' : 's'} push + ${pushUserCount} utilisateur${pushUserCount === 1 ? '' : 's'} dans la cloche ?`)) return
        setPushSending(true)
        setPushResult(null)
        setPushError(null)
        try {
            const res = await fetch('/api/admin/broadcasts/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: pushTitle.trim(), body: pushBody.trim(), targetPlan: pushPlan })
            })
            const data = await res.json()
            if (res.ok && data.data) {
                setPushResult(data.data)
                setPushTitle('')
                setPushBody('')
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

    const filteredUsers = allUsers.filter(u => {
        if (!userSearch.trim()) return true
        const q = userSearch.toLowerCase()
        return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    })

    const handleAgentChange = (agentId: string) => {
        setSelectedAgent(agentId)
        fetchWaRecipientCount(agentId)
    }

    const sendWaBroadcast = async () => {
        if (!selectedAgent || !waMessage.trim()) return
        setWaSending(true)
        try {
            const res = await fetch('/api/admin/broadcasts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: selectedAgent, message: waMessage.trim() })
            })
            const data = await res.json()
            if (data.data?.success) {
                setWaSent(true)
                setWaMessage('')
                fetchHistory()
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
                body.targetPlan = emailPlan
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
                    <p style={{ color: '#64748b', fontSize: 13 }}>Envoi de messages en masse — WhatsApp ou Email</p>
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

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Agent</label>
                            <select value={selectedAgent} onChange={(e) => handleAgentChange(e.target.value)} style={inputStyle}>
                                <option value="">-- Choisir un agent --</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name} ({agent.total_conversations || 0} conversations)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedAgent && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16, background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: 10 }}>
                                <Users size={16} style={{ color: '#34d399' }} />
                                <span style={{ color: '#34d399', fontSize: 13 }}>{recipientCount} destinataires</span>
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
                            <span style={{ color: '#fbbf24', fontSize: 12 }}>Envoi à tous les contacts de cet agent. Utilisez avec modération.</span>
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
                                if (waSending) return <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Envoi...</>
                                if (waSent) return <><CheckCircle size={16} />Envoyé !</>
                                return <><Send size={16} />Envoyer le Broadcast</>
                            })()}
                        </button>
                    </div>

                    <HistoryPanel history={history} activeTab="whatsapp" />
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
                                {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
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
                                                    {isSelected && <span style={{ color: 'white', fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</span>}
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
                                placeholder="Ex: Nouveauté WazzapAI — À ne pas manquer !" style={inputStyle} />
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
                            <span style={{ color: '#fbbf24', fontSize: 12 }}>Hostinger ≈ 500 emails/h. Pour &gt;500 utilisateurs, préférez Brevo ou Mailchimp.</span>
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
                                {PLAN_OPTIONS.filter(o => o.value !== 'individual').map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Device count preview */}
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
                            disabled={!pushTitle.trim() || !pushBody.trim() || pushSending || pushUserCount === 0}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                padding: '13px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                opacity: (!pushTitle.trim() || !pushBody.trim() || pushSending || pushUserCount === 0) ? 0.5 : 1
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

function HistoryPanel({ history, activeTab }: { history: any[]; activeTab: TabId }) {
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
                        return (
                            <div key={i} style={{ padding: 12, background: 'rgba(15, 23, 42, 0.3)', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.05)' }}>
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
                                    <span style={{ color: '#64748b', fontSize: 11 }}>
                                        {new Date(b.created_at).toLocaleDateString('fr-FR')}
                                    </span>
                                </div>
                                {!isEmail && !isPush && (
                                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 6px 0', lineHeight: 1.4 }}>
                                        {b.message?.substring(0, 70)}{b.message?.length > 70 ? '...' : ''}
                                    </p>
                                )}
                                <span style={{ color: '#64748b', fontSize: 11 }}>
                                    {b.recipients_count || 0} destinataires
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
