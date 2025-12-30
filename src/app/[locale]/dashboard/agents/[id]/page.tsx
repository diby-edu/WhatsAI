'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    Save,
    Loader2,
    QrCode,
    Smartphone,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Settings,
    Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function AgentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap params using React.use()
    const { id: agentId } = use(params)
    const router = useRouter()
    const t = useTranslations('Agents')

    const [agent, setAgent] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'settings' | 'whatsapp'>('whatsapp')

    // WhatsApp connection state
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'>('idle')
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        systemPrompt: '',
        is_active: true,
        personality: 'friendly',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
        use_emojis: true,
        response_delay_seconds: 2,
        language: 'fr',
        enable_voice_responses: false,
        voice_id: 'alloy'
    })

    useEffect(() => {
        fetchAgent()
    }, [agentId])

    const fetchAgent = async () => {
        try {

            const res = await fetch(`/api/agents/${agentId}`, {
                cache: 'no-store'
            })


            const data = await res.json()


            if (!res.ok) throw new Error(data.error)

            // API returns { data: { agent: ... } }
            // So we need data.data.agent
            const fetchedAgent = data.data?.agent || data.agent // Fallback for safety

            setAgent(fetchedAgent)
            setFormData({
                name: fetchedAgent.name,
                description: fetchedAgent.description || '',
                systemPrompt: fetchedAgent.system_prompt,
                is_active: fetchedAgent.is_active,
                personality: fetchedAgent.personality || 'friendly',
                model: fetchedAgent.model || 'gpt-4o-mini',
                temperature: fetchedAgent.temperature || 0.7,
                max_tokens: fetchedAgent.max_tokens || 500,
                use_emojis: fetchedAgent.use_emojis ?? true,
                response_delay_seconds: fetchedAgent.response_delay_seconds || 2,
                language: fetchedAgent.language || 'fr',
                enable_voice_responses: fetchedAgent.enable_voice_responses ?? false,
                voice_id: fetchedAgent.voice_id || 'alloy'
            })

            // Set initial WhatsApp status
            if (data.agent.whatsapp_connected) {
                setWhatsappStatus('connected')
                setConnectedPhone(data.agent.whatsapp_phone)
            }
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    system_prompt: formData.systemPrompt,
                    is_active: formData.is_active,
                    personality: formData.personality,
                    model: formData.model,
                    temperature: formData.temperature,
                    max_tokens: formData.max_tokens,
                    use_emojis: formData.use_emojis,
                    response_delay_seconds: formData.response_delay_seconds,
                    language: formData.language,
                    enable_voice_responses: formData.enable_voice_responses,
                    voice_id: formData.voice_id
                })
            })

            if (!res.ok) throw new Error('Failed to update')

            // Refresh agent data
            fetchAgent()
            alert('Sauvegardé avec succès !')
        } catch (err) {
            alert('Erreur lors de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    // Connect WhatsApp
    const connectWhatsApp = async () => {

        setWhatsappStatus('connecting')
        // Reset old QR code
        setQrCode(null)
        setError(null)

        try {
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId }),
            })


            const data = await response.json()


            // Unwrapping the response: successResponse wraps in { data: ... }
            const result = data.data || data

            if (!response.ok) {
                throw new Error(data.error || t('connect.error'))
            }

            if (result.qrCode) {
                setQrCode(result.qrCode)
                setWhatsappStatus('qr_ready')
            } else if (result.status === 'connected') {
                setWhatsappStatus('connected')
                setConnectedPhone(result.phoneNumber)
            }
        } catch (err) {
            console.error('CONNECT ERROR:', err)
            setError((err as Error).message)
            setWhatsappStatus('error')
        }
    }

    // Disconnect WhatsApp
    const disconnectWhatsApp = async () => {
        if (!confirm('Voulez-vous vraiment déconnecter WhatsApp ?')) return

        try {
            const response = await fetch(`/api/whatsapp/connect?agentId=${agentId}&logout=true`, {
                method: 'DELETE'
            })

            if (response.ok) {
                setWhatsappStatus('idle')
                setQrCode(null)
                setConnectedPhone(null)
                fetchAgent() // Refresh DB state
            }
        } catch (err) {
            console.error('Disconnect error:', err)
        }
    }

    // Poll for connection status
    useEffect(() => {
        // Poll when connecting or waiting for QR
        if (whatsappStatus !== 'qr_ready' && whatsappStatus !== 'connecting') return

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/whatsapp/connect?agentId=${agentId}`)
                const data = await response.json()
                const result = data.data || data



                if (result.status === 'connected' || result.connected) {
                    setWhatsappStatus('connected')
                    setConnectedPhone(result.phoneNumber)
                    setQrCode(null)
                    clearInterval(interval)
                } else if (result.status === 'qr_ready' && result.qrCode) {
                    setQrCode(result.qrCode)
                    setWhatsappStatus('qr_ready')
                } else if (result.qrCode && result.qrCode !== qrCode) {
                    // QR code available from database
                    setQrCode(result.qrCode)
                    setWhatsappStatus('qr_ready')
                }
            } catch (err) {
                console.error('Polling error:', err)
            }
        }, 2000) // Poll every 2 seconds for faster QR display

        return () => clearInterval(interval)
    }, [whatsappStatus, agentId, qrCode])


    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    if (!agent) return <div style={{ color: 'white', padding: 40 }}>{t('Page.emptySearch.title')}</div>

    const personalities = [
        { id: 'professional', name: t('Form.personality.types.professional') },
        { id: 'friendly', name: t('Form.personality.types.friendly') },
        { id: 'casual', name: t('Form.personality.types.casual') },
        { id: 'formal', name: t('Form.personality.types.formal') }
    ]

    return (
        <div style={{ padding: 24, paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <Link
                    href="/dashboard/agents"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#94a3b8',
                        textDecoration: 'none',
                        marginBottom: 16
                    }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    {t('Wizard.back')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>
                        {agent.name}
                    </h1>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={() => setActiveTab('settings')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                background: activeTab === 'settings' ? 'rgba(51, 65, 85, 0.5)' : 'transparent',
                                color: activeTab === 'settings' ? 'white' : '#94a3b8',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500
                            }}
                        >
                            <Settings size={18} />
                            {t('Wizard.steps.settings')}
                        </button>
                        <button
                            onClick={() => setActiveTab('whatsapp')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                background: activeTab === 'whatsapp' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                color: activeTab === 'whatsapp' ? '#34d399' : '#94a3b8',
                                border: activeTab === 'whatsapp' ? '1px solid rgba(16, 185, 129, 0.2)' : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500
                            }}
                        >
                            <Smartphone size={18} />
                            {t('Wizard.steps.whatsapp')} ({t(`connect.status.${whatsappStatus === 'qr_ready' ? 'qrReady' : whatsappStatus}`)})
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>

                {activeTab === 'settings' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            padding: 24,
                            borderRadius: 16,
                            border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}
                    >
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('Form.name.label')}
                            </label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('Form.description.label')}
                            </label>
                            <input
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('Form.mission.systemPromptLabel')}
                            </label>
                            <textarea
                                value={formData.systemPrompt}
                                onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
                                rows={8}
                                style={{
                                    width: '100%',
                                    padding: 12,
                                    borderRadius: 8,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontFamily: 'monospace'
                                }}
                            />
                        </div>

                        {/* Advanced Settings Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('Form.personality.label')}
                                </label>
                                <select
                                    value={formData.personality}
                                    onChange={e => setFormData({ ...formData, personality: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                >
                                    {personalities.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('Form.settings.model')}
                                </label>
                                <select
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                >
                                    <option value="gpt-4o-mini">GPT-4o Mini (rapide, économique)</option>
                                    <option value="gpt-4o">GPT-4o (plus intelligent)</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('Form.settings.temperature')} ({formData.temperature})
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={formData.temperature}
                                    onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                    style={{ width: '100%' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                                    <span>Précis</span>
                                    <span>Créatif</span>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('Form.settings.maxTokens')}
                                </label>
                                <input
                                    type="number"
                                    min="100"
                                    max="2000"
                                    value={formData.max_tokens}
                                    onChange={e => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('Form.settings.responseDelay')} (sec)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={formData.response_delay_seconds}
                                    onChange={e => setFormData({ ...formData, response_delay_seconds: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('Form.settings.language')}
                                </label>
                                <select
                                    value={formData.language}
                                    onChange={e => setFormData({ ...formData, language: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                >
                                    <option value="fr">Français</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                        </div>



                        {/* Voice Settings (Premium) */}
                        <div style={{
                            padding: 20,
                            background: 'rgba(16, 185, 129, 0.05)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 12,
                            marginBottom: 20
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.enable_voice_responses ? 16 : 0 }}>
                                <div>
                                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        🎙️ Réponses Vocales (IA) <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fbbf24', color: 'black' }}>PREMIUM</span>
                                    </h3>
                                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                                        L'IA répondra par des notes vocales. (Coût: 5 crédits/réponse)
                                    </p>
                                </div>
                                <button
                                    onClick={() => setFormData({ ...formData, enable_voice_responses: !formData.enable_voice_responses })}
                                    style={{
                                        width: 48,
                                        height: 28,
                                        borderRadius: 14,
                                        background: formData.enable_voice_responses ? '#10b981' : '#334155',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: 3,
                                        left: formData.enable_voice_responses ? 23 : 3,
                                        transition: 'left 0.2s'
                                    }} />
                                </button>
                            </div>

                            {formData.enable_voice_responses && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Voix de l'assistant
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                        {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(voice => (
                                            <button
                                                key={voice}
                                                onClick={() => setFormData({ ...formData, voice_id: voice })}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: 8,
                                                    border: formData.voice_id === voice ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                                                    background: formData.voice_id === voice ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.3)',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize',
                                                    fontSize: 13
                                                }}
                                            >
                                                {voice}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Toggles */}
                        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, use_emojis: !formData.use_emojis })}
                                    style={{
                                        width: 48,
                                        height: 26,
                                        borderRadius: 13,
                                        background: formData.use_emojis ? '#10b981' : '#475569',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: 3,
                                        left: formData.use_emojis ? 25 : 3,
                                        transition: 'left 0.2s'
                                    }} />
                                </button>
                                <span style={{ color: '#e2e8f0' }}>{t('Form.personality.emojis')}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    style={{
                                        width: 48,
                                        height: 26,
                                        borderRadius: 13,
                                        background: formData.is_active ? '#10b981' : '#475569',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: 3,
                                        left: formData.is_active ? 25 : 3,
                                        transition: 'left 0.2s'
                                    }} />
                                </button>
                                <span style={{ color: '#e2e8f0' }}>{t('Form.settings.active')}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    padding: '12px 24px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    gap: 8,
                                    alignItems: 'center'
                                }}
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                {saving ? t('Form.settings.saving') : t('Form.settings.save')}
                            </button>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'whatsapp' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            padding: 32,
                            borderRadius: 16,
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center'
                        }}
                    >
                        {whatsappStatus === 'idle' && (
                            <>
                                <div style={{
                                    width: 80, height: 80, borderRadius: 20,
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 24
                                }}>
                                    <QrCode style={{ width: 40, height: 40, color: '#34d399' }} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 8 }}>
                                    {t('connect.title')}
                                </h3>
                                <p style={{ color: '#94a3b8', marginBottom: 24, maxWidth: 400 }}>
                                    {t('connect.scanPrompt')}
                                </p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'center',
                                        fontSize: 16
                                    }}
                                >
                                    <QrCode size={20} />
                                    {t('connect.actions.generateQr')}
                                </button>
                            </>
                        )}

                        {whatsappStatus === 'connecting' && (
                            <>
                                <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite', marginBottom: 24 }} />
                                <h3 style={{ color: 'white', fontSize: 18, marginBottom: 8 }}>{t('connect.initialization')}</h3>
                                <p style={{ color: '#94a3b8' }}>{t('connect.preparing')}</p>
                            </>
                        )}

                        {whatsappStatus === 'qr_ready' && qrCode && (
                            <>
                                <div style={{
                                    background: 'white',
                                    padding: 16,
                                    borderRadius: 16,
                                    marginBottom: 24
                                }}>
                                    <img src={qrCode} alt="QR Code" style={{ width: 280, height: 280 }} />
                                </div>
                                <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                                    {t('connect.openWhatsapp')}
                                </p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'rgba(51, 65, 85, 0.5)',
                                        color: 'white',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'center'
                                    }}
                                >
                                    <RefreshCw size={16} />
                                    {t('connect.actions.regenerate')}
                                </button>
                            </>
                        )}

                        {whatsappStatus === 'connected' && (
                            <>
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 24
                                }}>
                                    <CheckCircle2 style={{ width: 48, height: 48, color: '#34d399' }} />
                                </div>
                                <h3 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                                    {t('connect.connectedSuccess')}
                                </h3>
                                <p style={{ color: '#34d399', marginBottom: 32, fontSize: 18 }}>
                                    {connectedPhone}
                                </p>
                                <button
                                    onClick={disconnectWhatsApp}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#f87171',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'center'
                                    }}
                                >
                                    <Trash2 size={20} />
                                    {t('connect.actions.disconnect')}
                                </button>
                            </>
                        )}

                        {whatsappStatus === 'error' && (
                            <>
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 24
                                }}>
                                    <AlertCircle style={{ width: 48, height: 48, color: '#f87171' }} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>
                                    {t('connect.error')}
                                </h3>
                                <p style={{ color: '#94a3b8', marginBottom: 24 }}>{error}</p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#334155',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {t('Wizard.buttons.retry')}
                                </button>
                            </>
                        )}
                    </motion.div>
                )}
            </div>
        </div >
    )
}
