'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Send, Users, MessageSquare, Loader2, CheckCircle,
    ArrowLeft, AlertTriangle, Clock, Mail, Search, Bell,
    Sparkles, SpellCheck, Bold, Italic, Link2, History, Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

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

type TabId = 'whatsapp' | 'email' | 'push' | 'ai'

interface AiDraftEntry {
    id: string
    prompt: string
    channel: 'email' | 'push' | 'whatsapp'
    generated: Record<string, string>
    createdAt: string
}

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
    const toast = useToast()
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
    const [pushResult, setPushResult] = useState<{ sent: number; failed: number; total: number; userCount?: number; failedEmails?: string[] } | null>(null)
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

    // AI draft state
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiChannel, setAiChannel] = useState<'email' | 'push' | 'whatsapp'>('email')
    const [aiLoading, setAiLoading] = useState(false)
    const [aiGenerated, setAiGenerated] = useState<Record<string, string> | null>(null)
    const [aiError, setAiError] = useState<string | null>(null)
    const [aiHistory, setAiHistory] = useState<AiDraftEntry[]>([])

    // Spell check state
    const [spellChecking, setSpellChecking] = useState<string | null>(null) // field being checked

    // Email rich text ref
    const emailBodyRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        fetchAgents()
        fetchHistory().then((broadcasts: any[]) => {
            const inProgress = broadcasts?.find((b: any) => b.status === 'sending' && b.id)
            if (inProgress) {
                setActiveBroadcastId(inProgress.id)
                setBroadcastProgress({ total: inProgress.recipients_count || 0, sent: 0, failed: 0, pending: inProgress.recipients_count || 0 })
            }
        })
        // Charger historique IA depuis localStorage
        try {
            const stored = localStorage.getItem('broadcast_ai_history')
            if (stored) setAiHistory(JSON.parse(stored))
        } catch { /* ignore */ }
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
            const broadcasts = data.data?.broadcasts || []
            setHistory(broadcasts)
            return broadcasts
        } catch (err) {
            console.error('Error fetching history:', err)
            return []
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
            } else {
                toast.error(data.error || 'Échec de l\'envoi du broadcast WhatsApp')
            }
        } catch (err) {
            console.error('Error sending wa broadcast:', err)
            toast.error('Erreur réseau — le broadcast n\'a pas été envoyé')
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

    // IA — générer un brouillon
    const generateAiDraft = async () => {
        if (!aiPrompt.trim()) return
        setAiLoading(true)
        setAiError(null)
        setAiGenerated(null)
        try {
            const res = await fetch('/api/admin/broadcasts/ai-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, channel: aiChannel })
            })
            const data = await res.json()
            if (res.ok && data.data?.generated) {
                const generated = data.data.generated
                setAiGenerated(generated)
                // Sauvegarder dans l'historique
                const entry: AiDraftEntry = {
                    id: Date.now().toString(),
                    prompt: aiPrompt,
                    channel: aiChannel,
                    generated,
                    createdAt: new Date().toISOString()
                }
                const updated = [entry, ...aiHistory].slice(0, 30)
                setAiHistory(updated)
                try { localStorage.setItem('broadcast_ai_history', JSON.stringify(updated)) } catch { /* ignore */ }
            } else {
                setAiError(data.error || 'Erreur de génération')
            }
        } catch {
            setAiError('Erreur réseau')
        } finally {
            setAiLoading(false)
        }
    }

    // IA — utiliser un brouillon généré (injecter dans l'onglet correspondant)
    const useAiDraft = (entry?: AiDraftEntry) => {
        const src = entry || (aiGenerated ? { channel: aiChannel, generated: aiGenerated } : null)
        if (!src) return
        if (src.channel === 'email') {
            if (src.generated.subject) setEmailSubject(src.generated.subject)
            if (src.generated.body) setEmailMessage(src.generated.body)
            setActiveTab('email')
        } else if (src.channel === 'push') {
            if (src.generated.title) setPushTitle(src.generated.title)
            if (src.generated.body) setPushBody(src.generated.body)
            setActiveTab('push')
        } else {
            if (src.generated.body) setWaMessage(src.generated.body)
            setActiveTab('whatsapp')
        }
    }

    // IA — correcteur orthographique
    const spellCheck = async (field: string, text: string, setter: (v: string) => void) => {
        if (!text.trim() || spellChecking) return
        setSpellChecking(field)
        try {
            const res = await fetch('/api/admin/broadcasts/ai-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spellcheck: true, text })
            })
            const data = await res.json()
            if (res.ok && data.data?.corrected) setter(data.data.corrected)
        } catch { /* silencieux */ } finally {
            setSpellChecking(null)
        }
    }

    // Éditeur riche — insérer formatage autour de la sélection
    const insertFormat = (format: 'bold' | 'italic' | 'link') => {
        const ta = emailBodyRef.current
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const selected = emailMessage.slice(start, end)
        let replacement = ''
        if (format === 'bold') replacement = `**${selected || 'texte'}**`
        else if (format === 'italic') replacement = `_${selected || 'texte'}_`
        else if (format === 'link') replacement = `[${selected || 'texte'}](https://)`
        const next = emailMessage.slice(0, start) + replacement + emailMessage.slice(end)
        setEmailMessage(next)
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + replacement.length, start + replacement.length) }, 0)
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
                    { id: 'ai' as TabId, label: 'Rédiger avec l\'IA', icon: Sparkles, color: '#a78bfa' },
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Message (max 500 car.)</label>
                                <button onClick={() => spellCheck('wa', waMessage, setWaMessage)}
                                    disabled={!waMessage.trim() || spellChecking === 'wa'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'wa' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    {spellChecking === 'wa' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                                </button>
                            </div>
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

                        {/* Selected emails chips */}
                        {emailPlan === 'individual' && selectedEmails.size > 0 && (
                            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(96, 165, 250, 0.06)', border: '1px solid rgba(96, 165, 250, 0.15)', borderRadius: 10 }}>
                                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                                    {selectedEmails.size} destinataire{selectedEmails.size !== 1 ? 's' : ''} sélectionné{selectedEmails.size !== 1 ? 's' : ''} :
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {[...selectedEmails].map(email => (
                                        <span
                                            key={email}
                                            onClick={() => toggleUser(email)}
                                            title="Cliquer pour retirer"
                                            style={{ padding: '2px 8px', background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)', borderRadius: 5, color: '#93c5fd', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {email} <span style={{ opacity: 0.6 }}>×</span>
                                        </span>
                                    ))}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Sujet</label>
                                <button onClick={() => spellCheck('emailSubject', emailSubject, setEmailSubject)}
                                    disabled={!emailSubject.trim() || spellChecking === 'emailSubject'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'emailSubject' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                    {spellChecking === 'emailSubject' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                                </button>
                            </div>
                            <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Ex: Nouveauté WazzapAI — À ne pas manquer !" style={inputStyle} />
                        </div>

                        {/* Body */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Corps du message</label>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => insertFormat('bold')} title="Gras"
                                        style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                                        <Bold size={11} />
                                    </button>
                                    <button onClick={() => insertFormat('italic')} title="Italique"
                                        style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontStyle: 'italic' }}>
                                        <Italic size={11} />
                                    </button>
                                    <button onClick={() => insertFormat('link')} title="Lien"
                                        style={{ display: 'flex', alignItems: 'center', background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                        <Link2 size={11} />
                                    </button>
                                    <button onClick={() => spellCheck('emailBody', emailMessage, setEmailMessage)}
                                        disabled={!emailMessage.trim() || spellChecking === 'emailBody'}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'emailBody' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                        {spellChecking === 'emailBody' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                                    </button>
                                </div>
                            </div>
                            <textarea ref={emailBodyRef} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)}
                                placeholder={'Voici notre annonce...\n\nCordialement,\nL\'équipe WazzapAI'}
                                rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
                            <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                                "Bonjour [Nom]" est ajouté automatiquement. **texte** = gras · _texte_ = italique
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Titre</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: '#475569', fontSize: 11 }}>{pushTitle.length}/65</span>
                                    <button onClick={() => spellCheck('pushTitle', pushTitle, setPushTitle)}
                                        disabled={!pushTitle.trim() || spellChecking === 'pushTitle'}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'pushTitle' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                        {spellChecking === 'pushTitle' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                                    </button>
                                </div>
                            </div>
                            <input type="text" value={pushTitle} onChange={(e) => setPushTitle(e.target.value.slice(0, 65))}
                                placeholder="Ex: Nouvelle fonctionnalité disponible !" style={inputStyle} />
                        </div>

                        {/* Body */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label style={{ color: '#94a3b8', fontSize: 13 }}>Message</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: '#475569', fontSize: 11 }}>{pushBody.length}/240</span>
                                    <button onClick={() => spellCheck('pushBody', pushBody, setPushBody)}
                                        disabled={!pushBody.trim() || spellChecking === 'pushBody'}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: spellChecking === 'pushBody' ? '#64748b' : '#94a3b8', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                                        {spellChecking === 'pushBody' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <SpellCheck size={11} />} Corriger
                                    </button>
                                </div>
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
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ padding: '12px 14px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 10 }}>
                                    <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>✅ Notification envoyée</div>
                                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                        Push : {pushResult.sent} envoyé{pushResult.sent !== 1 ? 's' : ''}
                                        {pushResult.failed > 0 && <span style={{ color: '#f87171' }}> · {pushResult.failed} échec{pushResult.failed !== 1 ? 's' : ''}</span>}
                                    </div>
                                    {(pushResult.userCount ?? 0) > 0 && (
                                        <div style={{ color: '#94a3b8', fontSize: 12 }}>
                                            Cloche : {pushResult.userCount} utilisateur{pushResult.userCount !== 1 ? 's' : ''} notifié{pushResult.userCount !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                                {pushResult.failed > 0 && (
                                    <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10 }}>
                                        <div style={{ color: '#f87171', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                                            Appareils en échec ({pushResult.failed})
                                        </div>
                                        {(pushResult.failedEmails ?? []).length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                                {pushResult.failedEmails!.map(email => (
                                                    <span key={email} style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 5, color: '#fca5a5', fontSize: 11 }}>
                                                        {email}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
                                                Tokens invalides ou expirés (appareils non enregistrés)
                                            </div>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (pushResult.failedEmails && pushResult.failedEmails.length > 0) {
                                                    const users = allUsers.filter(u => pushResult.failedEmails!.includes(u.email))
                                                    setSelectedPushUserIds(new Set(users.map(u => u.id!).filter(Boolean)))
                                                    setPushPlan('individual')
                                                    if (allUsers.length === 0) fetchAllUsers()
                                                }
                                                setPushResult(null)
                                            }}
                                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 7, color: '#f87171', padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                            Relancer ces utilisateurs
                                        </button>
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

            {/* IA Tab */}
            {activeTab === 'ai' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    {/* Formulaire génération */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={18} style={{ color: '#a78bfa' }} /> Rédiger avec l'IA
                        </h2>
                        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                            Décrivez ce que vous voulez envoyer. L'IA rédige, vous relisez, vous envoyez.
                        </p>

                        {/* Canal */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Canal</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {([
                                    { value: 'email', label: 'Email', color: '#60a5fa' },
                                    { value: 'push', label: 'Push', color: '#f59e0b' },
                                    { value: 'whatsapp', label: 'WhatsApp', color: '#34d399' },
                                ] as const).map(opt => (
                                    <button key={opt.value} onClick={() => { setAiChannel(opt.value); setAiGenerated(null) }}
                                        style={{
                                            flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                                            border: aiChannel === opt.value ? `1px solid ${opt.color}` : '1px solid rgba(148,163,184,0.2)',
                                            background: aiChannel === opt.value ? `rgba(${opt.color === '#60a5fa' ? '96,165,250' : opt.color === '#f59e0b' ? '245,158,11' : '52,211,153'},0.1)` : 'rgba(15,23,42,0.5)',
                                            color: aiChannel === opt.value ? opt.color : '#94a3b8',
                                        }}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Prompt */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Votre instruction</label>
                            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                                placeholder={
                                    aiChannel === 'email'
                                        ? 'Ex: informe les utilisateurs que le paiement est de nouveau fonctionnel'
                                        : aiChannel === 'push'
                                        ? 'Ex: annonce une nouvelle fonctionnalité de tableau de bord'
                                        : 'Ex: rappelle aux utilisateurs de reconnecter leur agent WhatsApp'
                                }
                                rows={4} style={{ ...inputStyle, resize: 'none' }}
                                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generateAiDraft() }}
                            />
                            <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>Ctrl+Entrée pour générer</div>
                        </div>

                        {aiError && (
                            <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 13 }}>
                                {aiError}
                            </div>
                        )}

                        <button onClick={generateAiDraft} disabled={!aiPrompt.trim() || aiLoading}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                padding: '13px 20px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                opacity: (!aiPrompt.trim() || aiLoading) ? 0.5 : 1, marginBottom: 20
                            }}>
                            {aiLoading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Génération en cours...</> : <><Sparkles size={16} />Générer</>}
                        </button>

                        {/* Résultat généré */}
                        {aiGenerated && (
                            <div style={{ padding: 16, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 12 }}>
                                <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckCircle size={14} /> Brouillon généré
                                </div>
                                {aiGenerated.subject && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>SUJET</div>
                                        <textarea value={aiGenerated.subject} onChange={e => setAiGenerated(prev => ({ ...prev!, subject: e.target.value }))}
                                            rows={2} style={{ ...inputStyle, fontSize: 13, resize: 'none' }} />
                                    </div>
                                )}
                                {aiGenerated.title && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>TITRE</div>
                                        <input value={aiGenerated.title} onChange={e => setAiGenerated(prev => ({ ...prev!, title: e.target.value }))}
                                            style={{ ...inputStyle, fontSize: 13 }} />
                                    </div>
                                )}
                                {aiGenerated.body && (
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>MESSAGE</div>
                                        <textarea value={aiGenerated.body} onChange={e => setAiGenerated(prev => ({ ...prev!, body: e.target.value }))}
                                            rows={6} style={{ ...inputStyle, fontSize: 13, resize: 'vertical' }} />
                                    </div>
                                )}
                                <button onClick={() => useAiDraft()}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        padding: '11px 16px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                        border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600
                                    }}>
                                    <Send size={14} /> Utiliser ce brouillon → aller dans {aiChannel === 'email' ? 'Email' : aiChannel === 'push' ? 'Push' : 'WhatsApp'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Historique IA */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 14, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <History size={18} style={{ color: '#a78bfa' }} /> Historique IA
                            </h2>
                            {aiHistory.length > 0 && (
                                <button onClick={() => { setAiHistory([]); localStorage.removeItem('broadcast_ai_history') }}
                                    style={{ background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 6, color: '#64748b', padding: '3px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Trash2 size={11} /> Vider
                                </button>
                            )}
                        </div>
                        {aiHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                                <Sparkles size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                                <p style={{ fontSize: 13 }}>Aucun brouillon généré</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {aiHistory.map(entry => (
                                    <div key={entry.id} style={{ padding: 12, background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.08)', borderRadius: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
                                                background: entry.channel === 'email' ? 'rgba(96,165,250,0.15)' : entry.channel === 'push' ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)',
                                                color: entry.channel === 'email' ? '#60a5fa' : entry.channel === 'push' ? '#f59e0b' : '#34d399'
                                            }}>
                                                {entry.channel.toUpperCase()}
                                            </span>
                                            <span style={{ color: '#475569', fontSize: 11 }}>
                                                {new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            "{entry.prompt}"
                                        </p>
                                        {(entry.generated.subject || entry.generated.title) && (
                                            <p style={{ color: 'white', fontSize: 12, fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {entry.generated.subject || entry.generated.title}
                                            </p>
                                        )}
                                        <button onClick={() => useAiDraft(entry)}
                                            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, color: '#a78bfa', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                                            Réutiliser
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
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

