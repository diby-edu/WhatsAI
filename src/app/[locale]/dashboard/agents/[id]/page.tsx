'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot,
    ArrowLeft,
    ArrowRight,
    Check,
    Target,
    Sparkles,
    Settings,
    Loader2,
    QrCode,
    Smartphone,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Save,
    Trash2,
    Clock,
    Shield,
    MapPin,
    Globe,
    Phone,
    ChevronRight,
    ChevronLeft
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

// Wizard Steps - Matching the new wizard design exactly
const STEPS = [
    { id: 'info', title: 'Identité', icon: Bot },
    { id: 'hours', title: 'Horaires', icon: Clock },
    { id: 'mission', title: 'Mission', icon: Target },
    { id: 'personality', title: 'Personnalité', icon: Sparkles },
    { id: 'rules', title: 'Règles', icon: Shield },
    { id: 'settings', title: 'Paramètres', icon: Settings },
    { id: 'whatsapp', title: 'WhatsApp', icon: Smartphone }
]

export default function AgentWizardPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { id: agentId } = use(params)
    const sp = use(searchParams)
    const router = useRouter()
    const t = useTranslations('Agents')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)

    // Handle deep linking to tabs
    useEffect(() => {
        if (sp?.tab === 'whatsapp') {
            const whatsappIndex = STEPS.findIndex(s => s.id === 'whatsapp')
            if (whatsappIndex !== -1) setCurrentStep(whatsappIndex)
        }
    }, [sp])

    // WhatsApp State
    const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'>('idle')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null)

    // Conflict Detection
    const [conflictStatus, setConflictStatus] = useState<'idle' | 'checking' | 'safe' | 'conflict' | 'error'>('idle')
    const [conflictReason, setConflictReason] = useState('')

    const checkConflict = async () => {
        if (!formData.custom_rules || formData.custom_rules.length < 10) return
        setConflictStatus('checking')
        try {
            const res = await fetch('/api/internal/analyze-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structuredData: {
                        hours: formData.business_hours,
                        address: formData.business_address,
                        phone: formData.contact_phone,
                    },
                    customRules: formData.custom_rules
                })
            })
            const data = await res.json()
            if (data.conflict) {
                setConflictStatus('conflict')
                setConflictReason(data.reason)
            } else {
                setConflictStatus('safe')
            }
        } catch (e) {
            setConflictStatus('error')
        }
    }


    // Form Data
    const [formData, setFormData] = useState({
        // Basic
        name: '',
        description: '', // Old field, kept for compatibility/SEO
        is_active: true,

        // Step 1: Identity
        business_address: '',
        contact_phone: '',
        social_links: {
            website: '',
            facebook: '',
            email: ''
        },
        latitude: null as number | null,
        longitude: null as number | null,

        // Step 2: Hours
        business_hours: '',

        // Step 3: Personality
        agent_tone: 'friendly',
        agent_goal: 'sales',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
        use_emojis: true,
        language: 'fr',
        enable_voice_responses: false,
        voice_id: 'alloy',

        // Step 4: Rules
        custom_rules: '',
        system_prompt: '', // Legacy/Internal use

        // Step 5: Payment Settings
        payment_mode: 'cinetpay' as 'cinetpay' | 'mobile_money_direct',
        mobile_money_orange: '',
        mobile_money_mtn: '',
        mobile_money_wave: '',
        custom_payment_methods: [] as { name: string; details: string }[],
    })

    useEffect(() => {
        fetchAgent()
    }, [agentId])

    const fetchAgent = async () => {
        try {
            const res = await fetch(`/api/agents/${agentId}`, { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            const agent = data.data?.agent || data.agent

            // Initial WhatsApp State
            if (agent.whatsapp_connected) {
                setWhatsappStatus('connected')
                setConnectedPhone(agent.whatsapp_phone)
            }

            // Populate Form
            setFormData({
                name: agent.name || '',
                description: agent.description || '',
                is_active: agent.is_active,

                business_address: agent.business_address || '',
                contact_phone: agent.contact_phone || '',
                social_links: agent.social_links || { website: '', facebook: '', email: '' },
                latitude: agent.latitude || null,
                longitude: agent.longitude || null,

                business_hours: agent.business_hours || "Lundi-Vendredi: 08:00 - 18:00\nSamedi: 09:00 - 13:00",

                agent_tone: agent.agent_tone || 'friendly',
                agent_goal: agent.agent_goal || 'sales',
                model: agent.model || 'gpt-4o-mini',
                temperature: agent.temperature || 0.7,
                max_tokens: agent.max_tokens || 500,
                use_emojis: agent.use_emojis ?? true,
                language: agent.language || 'fr',
                enable_voice_responses: agent.enable_voice_responses ?? false,
                voice_id: agent.voice_id || 'alloy',

                custom_rules: agent.custom_rules || '',
                system_prompt: agent.system_prompt || '',

                // Payment Settings
                payment_mode: agent.payment_mode || 'cinetpay',
                mobile_money_orange: agent.mobile_money_orange || '',
                mobile_money_mtn: agent.mobile_money_mtn || '',
                mobile_money_wave: agent.mobile_money_wave || '',
                custom_payment_methods: agent.custom_payment_methods || [],
            })

            setLoading(false)
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    const handleSave = async (silent = false) => {
        if (!silent) setSaving(true)
        try {
            const res = await fetch(`/api/agents/${agentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (!res.ok) throw new Error('Failed to save')
            if (!silent) alert('Sauvegardé avec succès !')
        } catch (err) {
            if (!silent) alert('Erreur lors de la sauvegarde')
        } finally {
            if (!silent) setSaving(false)
        }
    }

    // --- WhatsApp Logic (Copied from previous) ---
    const connectWhatsApp = async () => {
        setWhatsappStatus('connecting')
        setQrCode(null)
        try {
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId }),
            })
            const data = await response.json()
            const result = data.data || data
            if (!response.ok) throw new Error(data.error)

            if (result.qrCode) {
                setQrCode(result.qrCode)
                setWhatsappStatus('qr_ready')
            } else if (result.status === 'connected') {
                setWhatsappStatus('connected')
                setConnectedPhone(result.phoneNumber)
            }
        } catch (err) {
            console.error(err)
            setWhatsappStatus('error')
        }
    }

    const disconnectWhatsApp = async () => {
        if (!confirm('Déconnecter WhatsApp ?')) return
        try {
            await fetch(`/api/whatsapp/connect?agentId=${agentId}&logout=true`, { method: 'DELETE' })
            setWhatsappStatus('idle')
            setQrCode(null)
            setConnectedPhone(null)
        } catch (err) { console.error(err) }
    }

    // Polling
    useEffect(() => {
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
                } else if (result.qrCode && result.qrCode !== qrCode) {
                    setQrCode(result.qrCode)
                    setWhatsappStatus('qr_ready')
                }
            } catch (err) { }
        }, 2000)
        return () => clearInterval(interval)
    }, [whatsappStatus, agentId, qrCode])


    if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-900"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /></div>

    // Render Steps
    const renderStep = () => {
        const step = STEPS[currentStep].id

        switch (step) {
            case 'info':
                const inputStyle = {
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    background: 'rgba(30, 41, 59, 0.5)',
                    color: 'white',
                    outline: 'none'
                }
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Nom du Bot / Agent
                            </label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Marius le Vendeur"
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Adresse Physique (Complète)
                            </label>
                            <input
                                value={formData.business_address}
                                onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                                placeholder="Ex: Cocody Rivera 2, Abidjan, Côte d'Ivoire"
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Latitude (Optionnel)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.latitude || ''}
                                    onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    placeholder="Ex: 5.3599517"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Longitude (Optionnel)
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.longitude || ''}
                                    onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    placeholder="Ex: -4.0082563"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!navigator.geolocation) return alert('Géolocalisation non supportée')
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                latitude: pos.coords.latitude,
                                                longitude: pos.coords.longitude
                                            }))
                                        },
                                        (err) => alert('Erreur de localisation : ' + err.message)
                                    )
                                }}
                                style={{ fontSize: 14, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                📍 Utiliser ma position actuelle
                            </button>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Téléphone Support / Escalade (Humain)
                            </label>
                            <input
                                value={formData.contact_phone}
                                onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                placeholder="Ex: +225 07 07 ..."
                                style={inputStyle}
                            />
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Le bot donnera ce numéro si le client veut parler à un humain.</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Site Web
                                </label>
                                <input
                                    value={formData.social_links.website}
                                    onChange={e => setFormData({ ...formData, social_links: { ...formData.social_links, website: e.target.value } })}
                                    placeholder="https://..."
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Facebook
                                </label>
                                <input
                                    value={formData.social_links.facebook}
                                    onChange={e => setFormData({ ...formData, social_links: { ...formData.social_links, facebook: e.target.value } })}
                                    placeholder="Page Facebook"
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    </motion.div>
                )

            case 'hours':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* 24/7 Quick Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, marginBottom: 8 }}>
                            <div>
                                <span style={{ fontWeight: 600, color: '#10b981' }}>🌐 Ouvert 24h/24, 7j/7</span>
                                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Service disponible en permanence</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, business_hours: "Ouvert 24h/24, 7j/7\n(Service disponible à tout moment)" })}
                                style={{
                                    padding: '8px 16px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Appliquer
                            </button>
                        </div>

                        <textarea
                            value={formData.business_hours}
                            onChange={e => setFormData({ ...formData, business_hours: e.target.value })}
                            placeholder={"Lundi - Vendredi : 08:00 - 18:00\nSamedi : 09:00 - 14:00\nDimanche : Fermé\n\nOU\n\nOuvert 24h/24, 7j/7"}
                            style={{
                                width: '100%',
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                background: 'rgba(30, 41, 59, 0.5)',
                                color: 'white',
                                outline: 'none',
                                height: 200,
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                    </motion.div>
                )

            case 'mission':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ fontSize: 14, color: '#94a3b8' }}>
                            Décrivez la mission de votre agent et ses instructions générales. C'est le "cerveau" de votre bot.
                        </p>
                        <textarea
                            value={formData.system_prompt}
                            onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                            placeholder="Tu es l'assistant commercial de [Nom de l'entreprise]..."
                            style={{
                                width: '100%',
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                background: 'rgba(30, 41, 59, 0.5)',
                                color: 'white',
                                outline: 'none',
                                height: 280,
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />
                    </motion.div>
                )

            case 'personality':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                            {/* Tone Selection */}
                            <div>
                                <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 12 }}>Ton de Voix</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { id: 'professional', label: '👔 Professionnel', desc: 'Vouvoiement, sérieux, précis' },
                                        { id: 'friendly', label: '😊 Amical', desc: 'Tutoiement respectueux, emojis, chaleureux' },
                                        { id: 'energetic', label: '⚡ Énergique', desc: 'Dynamique, exclamation, très vendeur' },
                                        { id: 'luxury', label: '💎 Luxe', desc: 'Raffiné, très poli, vocabulaire soutenu' }
                                    ].map(tone => (
                                        <div
                                            key={tone.id}
                                            onClick={() => setFormData({ ...formData, agent_tone: tone.id })}
                                            style={{
                                                padding: 16,
                                                borderRadius: 12,
                                                border: formData.agent_tone === tone.id ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.1)',
                                                background: formData.agent_tone === tone.id ? 'rgba(16,185,129,0.1)' : 'rgba(30, 41, 59, 0.5)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, color: 'white' }}>{tone.label}</div>
                                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{tone.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Goal Selection */}
                            <div>
                                <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 12 }}>Objectif Principal</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {[
                                        { id: 'sales', label: '💰 Vendeur', desc: 'Priorité absolue : conclure la vente' },
                                        { id: 'support', label: '🛡️ Support', desc: 'Priorité : rassurer et aider le client' },
                                        { id: 'info', label: 'ℹ️ Informatif', desc: 'Donner les infos sans pousser à l\'achat' }
                                    ].map(goal => (
                                        <div
                                            key={goal.id}
                                            onClick={() => setFormData({ ...formData, agent_goal: goal.id })}
                                            style={{
                                                padding: 16,
                                                borderRadius: 12,
                                                border: formData.agent_goal === goal.id ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.1)',
                                                background: formData.agent_goal === goal.id ? 'rgba(16,185,129,0.1)' : 'rgba(30, 41, 59, 0.5)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, color: 'white' }}>{goal.label}</div>
                                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{goal.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Model Settings Toggles */}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 12 }}>Paramètres Avancés</label>
                            <div style={{ display: 'flex', gap: 32 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.use_emojis}
                                        onChange={e => setFormData({ ...formData, use_emojis: e.target.checked })}
                                        style={{ width: 20, height: 20, accentColor: '#10b981' }}
                                    />
                                    <span style={{ color: 'white' }}>Utiliser des Emojis</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'not-allowed' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.enable_voice_responses}
                                        onChange={e => setFormData({ ...formData, enable_voice_responses: e.target.checked })}
                                        disabled
                                        style={{ width: 20, height: 20, accentColor: '#10b981', opacity: 0.5 }}
                                    />
                                    <span style={{ color: '#64748b' }}>Réponses Vocales (Bientôt)</span>
                                </label>
                            </div>
                        </div>
                    </motion.div>
                )

            case 'rules':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ fontSize: 14, color: '#94a3b8' }}>
                            Ajoutez ici TOUTES vos règles spécifiques que le bot doit respecter absolument.
                            <br />Politique de retour, Livraison, Paiement, Promos...
                        </p>

                        <textarea
                            value={formData.custom_rules}
                            onChange={e => {
                                setFormData({ ...formData, custom_rules: e.target.value })
                                setConflictStatus('idle')
                            }}
                            placeholder={`Exemples de règles que l'IA doit respecter:

📦 LIVRAISON:
- Livraison gratuite à partir de 50.000 FCFA
- Zones de livraison: Abidjan uniquement

💳 PAIEMENT:
- Mobile Money préféré (Orange, MTN, Wave)
- Paiement à la livraison accepté

🚫 RESTRICTIONS:
- Pas de remboursement sur articles soldés
- Échange uniquement dans les 48h

📞 ESCALADE:
- Renvoyer vers le support si problème complexe`}
                            style={{
                                width: '100%',
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                background: 'rgba(30, 41, 59, 0.5)',
                                color: 'white',
                                outline: 'none',
                                height: 240,
                                resize: 'vertical',
                                fontFamily: 'inherit'
                            }}
                        />

                        {/* AI Conflict Detector */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                {conflictStatus === 'checking' && <div style={{ color: '#10b981', fontSize: 14, animation: 'pulse 2s infinite' }}>Analyse IA en cours...</div>}
                                {conflictStatus === 'safe' && <div style={{ color: '#10b981', fontSize: 14 }}>✅ Aucune contradiction détectée.</div>}
                                {conflictStatus === 'conflict' && (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: 12, borderRadius: 8, color: '#fca5a5', fontSize: 14 }}>
                                        <div style={{ fontWeight: 600 }}>⚠️ Conflit Détecté</div>
                                        {conflictReason}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={checkConflict}
                                style={{
                                    background: 'rgba(71, 85, 105, 0.5)',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                🛡️ Vérifier la cohérence
                            </button>
                        </div>
                    </motion.div>
                )

            case 'settings':
                const selectStyle = {
                    width: '100%',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    background: 'rgba(30, 41, 59, 0.5)',
                    color: 'white',
                    outline: 'none'
                }
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* AI Model Settings */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Modèle IA</label>
                                <select
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    style={selectStyle}
                                >
                                    <option value="gpt-4o-mini">GPT-4o-mini (Rapide)</option>
                                    <option value="gpt-4o">GPT-4o (Puissant)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Température: {formData.temperature}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={formData.temperature}
                                    onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                    style={{ width: '100%', accentColor: '#10b981' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Langue</label>
                                <select
                                    value={formData.language}
                                    onChange={e => setFormData({ ...formData, language: e.target.value })}
                                    style={selectStyle}
                                >
                                    <option value="fr">Français</option>
                                    <option value="en">Anglais</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>Max Tokens</label>
                                <input
                                    type="number"
                                    value={formData.max_tokens}
                                    onChange={e => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 12,
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        background: 'rgba(30, 41, 59, 0.5)',
                                        color: 'white',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Payment Settings Section */}
                        <div style={{ marginTop: 24 }}>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Mode de Paiement
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div
                                    onClick={() => setFormData({ ...formData, payment_mode: 'cinetpay' })}
                                    style={{
                                        padding: 16,
                                        borderRadius: 12,
                                        border: formData.payment_mode === 'cinetpay' ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.1)',
                                        background: formData.payment_mode === 'cinetpay' ? 'rgba(16,185,129,0.1)' : 'rgba(30, 41, 59, 0.5)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: 'white' }}>🔄 CinetPay (Automatique)</div>
                                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Lien de paiement sécurisé</div>
                                </div>
                                <div
                                    onClick={() => setFormData({ ...formData, payment_mode: 'mobile_money_direct' })}
                                    style={{
                                        padding: 16,
                                        borderRadius: 12,
                                        border: formData.payment_mode === 'mobile_money_direct' ? '2px solid #10b981' : '1px solid rgba(148,163,184,0.1)',
                                        background: formData.payment_mode === 'mobile_money_direct' ? 'rgba(16,185,129,0.1)' : 'rgba(30, 41, 59, 0.5)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: 'white' }}>📱 Mobile Money Direct</div>
                                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Vérification manuelle</div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Money Numbers (only if direct mode) */}
                        {formData.payment_mode === 'mobile_money_direct' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                                    Vos Numéros Mobile Money
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                            🟠 Orange Money
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.mobile_money_orange}
                                            onChange={e => setFormData({ ...formData, mobile_money_orange: e.target.value })}
                                            placeholder="+225 07 XX XX XX XX"
                                            style={{
                                                width: '100%',
                                                padding: 12,
                                                borderRadius: 12,
                                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                                background: 'rgba(30, 41, 59, 0.5)',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                            🟡 MTN Money
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.mobile_money_mtn}
                                            onChange={e => setFormData({ ...formData, mobile_money_mtn: e.target.value })}
                                            placeholder="+225 05 XX XX XX XX"
                                            style={{
                                                width: '100%',
                                                padding: 12,
                                                borderRadius: 12,
                                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                                background: 'rgba(30, 41, 59, 0.5)',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                            🔵 Wave
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.mobile_money_wave}
                                            onChange={e => setFormData({ ...formData, mobile_money_wave: e.target.value })}
                                            placeholder="+225 01 XX XX XX XX"
                                            style={{
                                                width: '100%',
                                                padding: 12,
                                                borderRadius: 12,
                                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                                background: 'rgba(30, 41, 59, 0.5)',
                                                color: 'white',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Custom Payment Methods */}
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Autres Moyens de Paiement
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {formData.custom_payment_methods.map((method, index) => (
                                            <div key={index} style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={method.name}
                                                    onChange={e => {
                                                        const updated = [...formData.custom_payment_methods]
                                                        updated[index].name = e.target.value
                                                        setFormData({ ...formData, custom_payment_methods: updated })
                                                    }}
                                                    placeholder="Nom (ex: PayPal)"
                                                    style={{
                                                        flex: 1,
                                                        padding: 12,
                                                        borderRadius: 12,
                                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                                        background: 'rgba(30, 41, 59, 0.5)',
                                                        color: 'white',
                                                        outline: 'none'
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    value={method.details}
                                                    onChange={e => {
                                                        const updated = [...formData.custom_payment_methods]
                                                        updated[index].details = e.target.value
                                                        setFormData({ ...formData, custom_payment_methods: updated })
                                                    }}
                                                    placeholder="Détails (ex: email@paypal.com)"
                                                    style={{
                                                        flex: 1,
                                                        padding: 12,
                                                        borderRadius: 12,
                                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                                        background: 'rgba(30, 41, 59, 0.5)',
                                                        color: 'white',
                                                        outline: 'none'
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = formData.custom_payment_methods.filter((_, i) => i !== index)
                                                        setFormData({ ...formData, custom_payment_methods: updated })
                                                    }}
                                                    style={{
                                                        padding: '12px 16px',
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        border: 'none',
                                                        borderRadius: 12,
                                                        color: '#f87171',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData({
                                                    ...formData,
                                                    custom_payment_methods: [...formData.custom_payment_methods, { name: '', details: '' }]
                                                })
                                            }}
                                            style={{
                                                padding: '12px 16px',
                                                background: 'rgba(30, 41, 59, 0.5)',
                                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                                borderRadius: 12,
                                                color: '#94a3b8',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8
                                            }}
                                        >
                                            ➕ Ajouter un moyen de paiement
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: 12, borderRadius: 8 }}>
                                    ⚠️ Avec ce mode, les clients enverront une capture d'écran après paiement. Vous devrez vérifier manuellement dans Commandes.
                                </div>
                            </div>
                        )}
                    </motion.div>
                )

            case 'whatsapp':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-center">
                        <div className="bg-slate-800/50 p-8 rounded-xl border border-slate-700/50 flex flex-col items-center">
                            <h2 className="text-2xl font-bold text-white mb-6">Connexion WhatsApp</h2>

                            {whatsappStatus === 'idle' && (
                                <button onClick={connectWhatsApp} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 transition-all">
                                    <QrCode size={20} /> Générer le QR Code
                                </button>
                            )}

                            {whatsappStatus === 'connecting' && (
                                <div className="text-emerald-400 flex flex-col items-center gap-2">
                                    <Loader2 className="w-10 h-10 animate-spin" />
                                    <span>Préparation...</span>
                                </div>
                            )}

                            {whatsappStatus === 'qr_ready' && qrCode && (
                                <div className="bg-white p-4 rounded-xl animate-in zoom-in duration-300">
                                    <img src={qrCode} alt="QR" className="w-64 h-64" />
                                    <p className="text-slate-500 mt-2 text-sm">Scannez avec WhatsApp (Appareils connectés)</p>
                                </div>
                            )}

                            {whatsappStatus === 'connected' && (
                                <div className="text-emerald-400 flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    <div className="text-xl font-bold">Connecté !</div>
                                    <div className="text-slate-300">{connectedPhone}</div>
                                    <button onClick={disconnectWhatsApp} className="mt-4 text-red-400 hover:text-red-300 text-sm underline">
                                        Déconnecter
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )
        }
    }

    // --- Main Layout ---
    return (
        <div className="min-h-screen bg-slate-900 pb-20">
            {/* Top Bar */}
            <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/agents" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">{formData.name || 'Configuration Agent'}</h1>
                            <p className="text-xs text-slate-400">{STEPS[currentStep].title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={saving}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Sauvegarder
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="max-w-4xl mx-auto px-4 mt-2 mb-0">
                    <div className="flex justify-between items-center relative">
                        {/* Line */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -z-0 rounded-full"></div>
                        <div
                            className="absolute top-1/2 left-0 h-1 bg-emerald-500/50 -z-0 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                        ></div>

                        {STEPS.map((step, index) => {
                            const isActive = index === currentStep
                            const isCompleted = index < currentStep
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => {
                                        // Block navigation if rules conflict
                                        if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') {
                                            alert("🛡️ SÉCURITÉ : Veuillez vérifier la cohérence de vos règles (Cliquez sur 'Vérifier') avant de quitter cette étape.")
                                            return
                                        }
                                        setCurrentStep(index)
                                    }}
                                    className={`relative z-10 flex flex-col items-center gap-2 group focus:outline-none`}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                        ${isActive ? 'bg-slate-900 border-emerald-400 text-emerald-400 scale-110 shadow-[0_0_15px_rgba(52,211,153,0.3)]' :
                                            isCompleted ? 'bg-emerald-500 border-emerald-500 text-slate-900' :
                                                'bg-slate-800 border-slate-700 text-slate-500 group-hover:border-slate-500'}
                                    `}>
                                        <step.icon size={18} />
                                    </div>
                                    <span className={`text-xs font-medium transition-colors ${isActive ? 'text-emerald-400' : isCompleted ? 'text-emerald-500/70' : 'text-slate-600'}`}>
                                        {step.title}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-8">
                {renderStep()}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                        disabled={currentStep === 0}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <ChevronLeft size={20} /> Précédent
                    </button>

                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={() => {
                                // Block if rules conflict
                                if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') {
                                    alert("🛡️ SÉCURITÉ : Veuillez vérifier la cohérence de vos règles (Cliquez sur 'Vérifier') avant de continuer.")
                                    return
                                }
                                handleSave(true) // Auto-save
                                setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))
                            }}
                            className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                        >
                            Suivant <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') {
                                    alert("🛡️ SÉCURITÉ : Veuillez vérifier la cohérence des règles avant de terminer.")
                                    return
                                }
                                router.push('/dashboard/agents')
                            }}
                            className="px-6 py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                        >
                            <CheckCircle2 size={20} /> Terminer
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
