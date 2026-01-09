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
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <MapPin className="text-emerald-400" size={24} /> Identité de l'Entreprise
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Nom du Bot / Agent</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Ex: Marius le Vendeur"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Adresse Physique (Complète)</label>
                                    <input
                                        value={formData.business_address}
                                        onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Ex: Cocody Rivera 2, Abidjan, Côte d'Ivoire"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-300 font-medium mb-1">Latitude (Optionnel)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.latitude || ''}
                                            onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                                            placeholder="Ex: 5.3599517"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 font-medium mb-1">Longitude (Optionnel)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.longitude || ''}
                                            onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                                            placeholder="Ex: -4.0082563"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
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
                                        className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
                                    >
                                        📍 Utiliser ma position actuelle
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Téléphone Support / Escalade (Humain)</label>
                                    <input
                                        value={formData.contact_phone}
                                        onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Ex: +225 07 07 ..."
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Le bot donnera ce numéro si le client veut parler à un humain.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Globe className="text-blue-400" size={20} /> Liens & Réseaux
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-300 text-sm mb-1">Site Web</label>
                                    <input
                                        value={formData.social_links.website}
                                        onChange={e => setFormData({ ...formData, social_links: { ...formData.social_links, website: e.target.value } })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 text-sm mb-1">Facebook</label>
                                    <input
                                        value={formData.social_links.facebook}
                                        onChange={e => setFormData({ ...formData, social_links: { ...formData.social_links, facebook: e.target.value } })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                        placeholder="Page Facebook"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 'hours':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Clock className="text-emerald-400" size={24} /> Horaires d'Ouverture
                            </h2>
                            <p className="text-slate-400 mb-4 text-sm">Indiquez clairement vos horaires. Le bot les utilisera pour informer les clients.</p>

                            {/* 24/7 Quick Toggle */}
                            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg mb-4">
                                <div>
                                    <span className="font-semibold text-emerald-400">🌐 Ouvert 24h/24, 7j/7</span>
                                    <p className="text-xs text-slate-400 mt-1">Service disponible en permanence</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, business_hours: "Ouvert 24h/24, 7j/7\n(Service disponible à tout moment)" })}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                >
                                    Appliquer
                                </button>
                            </div>

                            <textarea
                                value={formData.business_hours}
                                onChange={e => setFormData({ ...formData, business_hours: e.target.value })}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-white font-mono h-48 focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder={"Lundi - Vendredi : 08:00 - 18:00\nSamedi : 09:00 - 14:00\nDimanche : Fermé\n\nOU\n\nOuvert 24h/24, 7j/7"}
                            />
                        </div>
                    </motion.div>
                )

            case 'mission':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Target className="text-emerald-400" size={24} /> Mission & Instructions IA
                            </h2>
                            <p className="text-slate-400 mb-4 text-sm">
                                Décrivez la mission de votre agent et ses instructions générales. C'est le "cerveau" de votre bot.
                            </p>
                            <textarea
                                value={formData.system_prompt}
                                onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-white font-mono h-64 focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="Tu es l'assistant commercial de [Nom de l'entreprise]..."
                            />
                        </div>
                    </motion.div>
                )

            case 'personality':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Tone Selection */}
                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                                <h2 className="text-lg font-bold text-white mb-4">Ton de Voix</h2>
                                <div className="space-y-3">
                                    {[
                                        { id: 'professional', label: '👔 Professionnel', desc: 'Vouvoiement, sérieux, précis' },
                                        { id: 'friendly', label: '😊 Amical', desc: 'Tutoiement respectueux, emojis, chaleureux' },
                                        { id: 'energetic', label: '⚡ Énergique', desc: 'Dynamique, exclamation, très vendeur' },
                                        { id: 'luxury', label: '💎 Luxe', desc: 'Raffiné, très poli, vocabulaire soutenu' }
                                    ].map(tone => (
                                        <div
                                            key={tone.id}
                                            onClick={() => setFormData({ ...formData, agent_tone: tone.id })}
                                            className={`p-4 rounded-lg border cursor-pointer transition-all ${formData.agent_tone === tone.id ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-900/30 border-slate-700 hover:border-slate-500'}`}
                                        >
                                            <div className="font-bold text-white">{tone.label}</div>
                                            <div className="text-xs text-slate-400">{tone.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Goal Selection */}
                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                                <h2 className="text-lg font-bold text-white mb-4">Objectif Principal</h2>
                                <div className="space-y-3">
                                    {[
                                        { id: 'sales', label: '💰 Vendeur', desc: 'Priorité absolue : conclure la vente' },
                                        { id: 'support', label: '🛡️ Support', desc: 'Priorité : rassurer et aider le client' },
                                        { id: 'info', label: 'ℹ️ Informatif', desc: 'Donner les infos sans pousser à l\'achat' }
                                    ].map(goal => (
                                        <div
                                            key={goal.id}
                                            onClick={() => setFormData({ ...formData, agent_goal: goal.id })}
                                            className={`p-4 rounded-lg border cursor-pointer transition-all ${formData.agent_goal === goal.id ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-900/30 border-slate-700 hover:border-slate-500'}`}
                                        >
                                            <div className="font-bold text-white">{goal.label}</div>
                                            <div className="text-xs text-slate-400">{goal.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Model Settings Toggles */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-lg font-bold text-white mb-4">Paramètres Avancés</h2>
                            <div className="flex gap-8">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.use_emojis}
                                        onChange={e => setFormData({ ...formData, use_emojis: e.target.checked })}
                                        className="w-5 h-5 accent-emerald-500"
                                    />
                                    <span className="text-white">Utiliser des Emojis</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.enable_voice_responses}
                                        onChange={e => setFormData({ ...formData, enable_voice_responses: e.target.checked })}
                                        className="w-5 h-5 accent-emerald-500 opacity-50 cursor-not-allowed" // Disabled for now or premium
                                        disabled
                                    />
                                    <span className="text-slate-400">Réponses Vocales (Bientôt)</span>
                                </label>
                            </div>
                        </div>
                    </motion.div>
                )

            case 'rules':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Shield className="text-emerald-400" size={24} /> Règles Spécifiques & Politique
                            </h2>
                            <p className="text-slate-400 mb-4 text-sm">
                                Ajoutez ici TOUTES vos règles spécifiques que le bot doit respecter absolument.
                                <br />Politique de retour, Livraison, Paiement, Promos...
                            </p>

                            <textarea
                                value={formData.custom_rules}
                                onChange={e => {
                                    setFormData({ ...formData, custom_rules: e.target.value })
                                    setConflictStatus('idle') // Reset on change
                                }}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-white font-mono h-56 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                            />

                            {/* AI Conflict Detector */}
                            <div className="flex items-start justify-between gap-4 pt-2">
                                <div className="flex-1">
                                    {conflictStatus === 'checking' && <div className="text-emerald-400 text-sm animate-pulse">Analye IA en cours...</div>}
                                    {conflictStatus === 'safe' && <div className="text-emerald-400 text-sm flex items-center gap-2">✅ Aucune contradiction détectée.</div>}
                                    {conflictStatus === 'conflict' && (
                                        <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg text-red-300 text-sm">
                                            <div className="font-bold flex items-center gap-2">⚠️ Conflit Détecté</div>
                                            {conflictReason}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={checkConflict}
                                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                                >
                                    🛡️ Vérifier la cohérence
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )

            case 'settings':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Settings className="text-emerald-400" size={24} /> Paramètres Avancés
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Modèle IA</label>
                                    <select
                                        value={formData.model}
                                        onChange={e => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                    >
                                        <option value="gpt-4o-mini">GPT-4o-mini (Rapide)</option>
                                        <option value="gpt-4o">GPT-4o (Puissant)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Température: {formData.temperature}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={formData.temperature}
                                        onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                        className="w-full accent-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Langue</label>
                                    <select
                                        value={formData.language}
                                        onChange={e => setFormData({ ...formData, language: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                    >
                                        <option value="fr">Français</option>
                                        <option value="en">Anglais</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Max Tokens</label>
                                    <input
                                        type="number"
                                        value={formData.max_tokens}
                                        onChange={e => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Settings Section */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mt-6">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                💳 Mode de Paiement
                            </h2>

                            {/* Payment Mode Toggle */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <label
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.payment_mode === 'cinetpay'
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-slate-700 hover:border-slate-600'
                                        }`}
                                    onClick={() => setFormData({ ...formData, payment_mode: 'cinetpay' })}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="payment_mode"
                                            checked={formData.payment_mode === 'cinetpay'}
                                            onChange={() => setFormData({ ...formData, payment_mode: 'cinetpay' })}
                                            className="accent-emerald-500"
                                        />
                                        <div>
                                            <div className="font-bold text-white">🔄 CinetPay (Automatique)</div>
                                            <div className="text-slate-400 text-sm">Lien de paiement sécurisé. L'argent arrive sur votre compte.</div>
                                        </div>
                                    </div>
                                </label>
                                <label
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.payment_mode === 'mobile_money_direct'
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : 'border-slate-700 hover:border-slate-600'
                                        }`}
                                    onClick={() => setFormData({ ...formData, payment_mode: 'mobile_money_direct' })}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="payment_mode"
                                            checked={formData.payment_mode === 'mobile_money_direct'}
                                            onChange={() => setFormData({ ...formData, payment_mode: 'mobile_money_direct' })}
                                            className="accent-emerald-500"
                                        />
                                        <div>
                                            <div className="font-bold text-white">📱 Mobile Money Direct</div>
                                            <div className="text-slate-400 text-sm">Paiement sur vos numéros. Vérification manuelle requise.</div>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Mobile Money Numbers (only if direct mode) */}
                            {formData.payment_mode === 'mobile_money_direct' && (
                                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                                    <h3 className="text-lg font-medium text-white">📱 Vos Numéros Mobile Money</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-slate-300 font-medium mb-1">🟠 Orange Money</label>
                                            <input
                                                type="text"
                                                value={formData.mobile_money_orange}
                                                onChange={e => setFormData({ ...formData, mobile_money_orange: e.target.value })}
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-orange-500"
                                                placeholder="+225 07 XX XX XX XX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-300 font-medium mb-1">🟡 MTN Money</label>
                                            <input
                                                type="text"
                                                value={formData.mobile_money_mtn}
                                                onChange={e => setFormData({ ...formData, mobile_money_mtn: e.target.value })}
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-yellow-500"
                                                placeholder="+225 05 XX XX XX XX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-300 font-medium mb-1">🔵 Wave</label>
                                            <input
                                                type="text"
                                                value={formData.mobile_money_wave}
                                                onChange={e => setFormData({ ...formData, mobile_money_wave: e.target.value })}
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="+225 01 XX XX XX XX"
                                            />
                                        </div>
                                    </div>

                                    {/* Custom Payment Methods */}
                                    <div className="mt-6">
                                        <h3 className="text-lg font-medium text-white mb-3">➕ Autres Moyens de Paiement</h3>
                                        <div className="space-y-2">
                                            {formData.custom_payment_methods.map((method, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={method.name}
                                                        onChange={e => {
                                                            const updated = [...formData.custom_payment_methods]
                                                            updated[index].name = e.target.value
                                                            setFormData({ ...formData, custom_payment_methods: updated })
                                                        }}
                                                        className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                                        placeholder="Nom (ex: PayPal)"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={method.details}
                                                        onChange={e => {
                                                            const updated = [...formData.custom_payment_methods]
                                                            updated[index].details = e.target.value
                                                            setFormData({ ...formData, custom_payment_methods: updated })
                                                        }}
                                                        className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                                        placeholder="Détails (ex: email@paypal.com)"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const updated = formData.custom_payment_methods.filter((_, i) => i !== index)
                                                            setFormData({ ...formData, custom_payment_methods: updated })
                                                        }}
                                                        className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        custom_payment_methods: [...formData.custom_payment_methods, { name: '', details: '' }]
                                                    })
                                                }}
                                                className="w-full p-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                                            >
                                                ➕ Ajouter un moyen de paiement
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4">
                                        <p className="text-amber-400 text-sm">
                                            ⚠️ Avec ce mode, les clients enverront une capture d'écran après paiement.
                                            Vous devrez vérifier manuellement dans le module Commandes.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
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
