'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    ArrowLeft, MessageSquare, Mail, Bell, Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { WhatsappTab } from './components/WhatsappTab'
import { EmailTab } from './components/EmailTab'
import { PushTab } from './components/PushTab'
import { AiTab } from './components/AiTab'
import type { Agent, UserOption, TabId, AiDraftEntry } from './types'

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
                <WhatsappTab
                    selectedAgent={selectedAgent}
                    waRecipientType={waRecipientType}
                    setWaRecipientType={setWaRecipientType}
                    agents={agents}
                    handleAgentChange={handleAgentChange}
                    recipientCount={recipientCount}
                    waMessage={waMessage}
                    setWaMessage={setWaMessage}
                    spellCheck={spellCheck}
                    spellChecking={spellChecking}
                    sendWaBroadcast={sendWaBroadcast}
                    waSending={waSending}
                    waSent={waSent}
                    broadcastProgress={broadcastProgress}
                    activeBroadcastId={activeBroadcastId}
                    inputStyle={inputStyle}
                    history={history}
                />
            )}

            {/* Email Tab */}
            {activeTab === 'email' && (
                <EmailTab
                    emailPlan={emailPlan}
                    setEmailPlan={setEmailPlan}
                    selectedEmails={selectedEmails}
                    setSelectedEmails={setSelectedEmails}
                    filteredUsers={filteredUsers}
                    userSearch={userSearch}
                    setUserSearch={setUserSearch}
                    loadingUsers={loadingUsers}
                    toggleUser={toggleUser}
                    effectiveRecipientCount={effectiveRecipientCount}
                    emailSubject={emailSubject}
                    setEmailSubject={setEmailSubject}
                    spellCheck={spellCheck}
                    spellChecking={spellChecking}
                    emailMessage={emailMessage}
                    setEmailMessage={setEmailMessage}
                    insertFormat={insertFormat}
                    emailBodyRef={emailBodyRef}
                    emailResult={emailResult}
                    emailError={emailError}
                    sendDisabled={sendDisabled}
                    sendEmailBroadcast={sendEmailBroadcast}
                    emailSending={emailSending}
                    inputStyle={inputStyle}
                    history={history}
                />
            )}

            {/* Push Tab */}
            {activeTab === 'push' && (
                <PushTab
                    pushPlan={pushPlan}
                    setPushPlan={setPushPlan}
                    selectedPushUserIds={selectedPushUserIds}
                    setSelectedPushUserIds={setSelectedPushUserIds}
                    filteredPushUsers={filteredPushUsers}
                    pushUserSearch={pushUserSearch}
                    setPushUserSearch={setPushUserSearch}
                    loadingUsers={loadingUsers}
                    togglePushUser={togglePushUser}
                    pushDeviceCount={pushDeviceCount}
                    pushUserCount={pushUserCount}
                    pushTitle={pushTitle}
                    setPushTitle={setPushTitle}
                    pushBody={pushBody}
                    setPushBody={setPushBody}
                    spellCheck={spellCheck}
                    spellChecking={spellChecking}
                    pushResult={pushResult}
                    setPushResult={setPushResult}
                    pushError={pushError}
                    sendPushBroadcast={sendPushBroadcast}
                    pushSending={pushSending}
                    allUsers={allUsers}
                    fetchAllUsers={fetchAllUsers}
                    inputStyle={inputStyle}
                    history={history}
                />
            )}

            {/* IA Tab */}
            {activeTab === 'ai' && (
                <AiTab
                    aiChannel={aiChannel}
                    setAiChannel={setAiChannel}
                    aiGenerated={aiGenerated}
                    setAiGenerated={setAiGenerated}
                    aiPrompt={aiPrompt}
                    setAiPrompt={setAiPrompt}
                    aiError={aiError}
                    generateAiDraft={generateAiDraft}
                    aiLoading={aiLoading}
                    useAiDraft={useAiDraft}
                    aiHistory={aiHistory}
                    setAiHistory={setAiHistory}
                    inputStyle={inputStyle}
                />
            )}
        </div>
    )
}
