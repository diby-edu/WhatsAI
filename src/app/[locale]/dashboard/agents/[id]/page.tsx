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
    ChevronLeft,
    BookOpen,
    Users
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
    type AgentPaymentMode,
    AUTOMATIC_PAYMENT_MODE_DESCRIPTION,
    AUTOMATIC_PAYMENT_MODE_HINT,
    AUTOMATIC_PAYMENT_MODE_LABEL,
    MANUAL_PAYMENT_METHODS_LABEL,
    MANUAL_PAYMENT_MODE_DESCRIPTION,
    MANUAL_PAYMENT_MODE_HINT,
    MANUAL_PAYMENT_MODE_LABEL,
    normalizeAgentPaymentMode,
} from '@/lib/payments/payment-mode-display'

const QR_CONNECTION_ERROR_MESSAGE = 'Le scan a echoue avant la fin de la connexion. Generez un nouveau QR code puis rescanez depuis WhatsApp.'

function normalizePairingPhoneInput(value: string): string | null {
    const trimmed = (value || '').trim()
    if (!trimmed) return null
    let digits = trimmed.replace(/[^\d+]/g, '')
    if (digits.startsWith('+')) digits = digits.slice(1)
    if (digits.startsWith('00')) digits = digits.slice(2)
    digits = digits.replace(/\D/g, '')
    if (!digits) return null
    if (digits.length < 8 || digits.length > 15) return null
    return digits
}

// Wizard Steps - Matching the new wizard design exactly
const STEPS = [
    { id: 'mission', title: 'Mission', icon: Target },
    { id: 'info', title: 'Identité', icon: Bot },
    { id: 'hours', title: 'Horaires', icon: Clock },
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
    const [highlightEscalation, setHighlightEscalation] = useState(false)
    const [selectedMission, setSelectedMission] = useState('')
    const isSupportClient = selectedMission === 'support_client'

    // Handle deep linking to tabs or focus fields
    useEffect(() => {
        if (sp?.tab === 'whatsapp') {
            const whatsappIndex = STEPS.findIndex(s => s.id === 'whatsapp')
            if (whatsappIndex !== -1) setCurrentStep(whatsappIndex)
        }
        if (sp?.focus === 'escalation') {
            setCurrentStep(1) // Ensure we are on Identity step (index 1 after reorder)
            // Small delay to allow render
            setTimeout(() => {
                setHighlightEscalation(true)
                // Remove highlight after 5 seconds
                setTimeout(() => setHighlightEscalation(false), 5000)
            }, 500)
        }
    }, [sp])

    // WhatsApp State
    const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'>('idle')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [pairingCode, setPairingCode] = useState<string | null>(null)
    const [connectionMode, setConnectionMode] = useState<'qr' | 'pairing_code'>('qr')
    const [pairingPhone, setPairingPhone] = useState('')
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null)
    const [whatsappErrorMessage, setWhatsappErrorMessage] = useState<string | null>(null)
    const [retryWithFreshQr, setRetryWithFreshQr] = useState(false)

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
                        phone: formData.escalation_phone,
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
        is_online_only: false,
        business_address: '',
        // contact_phone removed in favor of escalation_phone
        social_links: {
            website: '',
            facebook: '',
            email: ''
        },
        latitude: null as number | null,
        longitude: null as number | null,

        // Step 2: Hours (structured like creation wizard)
        business_hours: {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '10:00', close: '16:00', closed: false },
            sunday: { open: '00:00', close: '00:00', closed: true }
        } as { [key: string]: { open: string; close: string; closed: boolean } },

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
        payment_mode: 'cinetpay' as AgentPaymentMode,
        mobile_money_orange: '',
        mobile_money_mtn: '',
        mobile_money_wave: '',
        custom_payment_methods: [] as { name: string; details: string }[],
        restaurant_deposit_enabled: false,
        restaurant_deposit_mode: 'percentage' as 'percentage' | 'fixed',
        restaurant_deposit_percentage: 30,
        restaurant_deposit_fixed_amount_fcfa: 0,
        escalation_phone: '',  // Phone number to display when escalating to human
        agent_context: '',
        welcome_message: '',
        // Leads
        lead_collection_enabled: false,
        lead_redirect_message: '',
        lead_collect_fields: ['name', 'phone'] as string[],
        // Support
        fallback_contact_message: '',
        // Live Query API
        live_query_url: '',
        live_query_secret: '',
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
            const agentConnectionMode = agent.whatsapp_pairing_mode === 'pairing_code' ? 'pairing_code' : 'qr'
            setConnectionMode(agentConnectionMode)
            setPairingPhone(agent.whatsapp_pairing_phone ? `+${agent.whatsapp_pairing_phone}` : '')

            // Initial WhatsApp State
            if (!agent.is_active) {
                setWhatsappStatus('idle')
                setQrCode(null)
                setPairingCode(null)
                setConnectedPhone(null)
                setWhatsappErrorMessage(null)
                setRetryWithFreshQr(false)
            } else if (agent.whatsapp_connected) {
                setWhatsappStatus('connected')
                setConnectedPhone(agent.whatsapp_phone)
                setQrCode(null)
                setPairingCode(null)
                setWhatsappErrorMessage(null)
                setRetryWithFreshQr(false)
            } else if (agent.whatsapp_status === 'qr_ready' && (agent.whatsapp_qr_code || agent.whatsapp_pairing_code)) {
                setWhatsappStatus('qr_ready')
                setQrCode(agent.whatsapp_qr_code || null)
                setPairingCode(agent.whatsapp_pairing_code || null)
                setConnectedPhone(null)
                setWhatsappErrorMessage(null)
                setRetryWithFreshQr(false)
            } else if (agent.whatsapp_status === 'connecting') {
                setWhatsappStatus('connecting')
                setQrCode(null)
                setPairingCode(null)
                setConnectedPhone(null)
                setWhatsappErrorMessage(null)
            } else {
                setWhatsappStatus('idle')
                setQrCode(null)
                setPairingCode(null)
                setConnectedPhone(null)
                setWhatsappErrorMessage(null)
                setRetryWithFreshQr(false)
            }

            // Populate Form
            setFormData({
                name: agent.name || '',
                description: agent.description || '',
                is_active: agent.is_active,

                is_online_only: agent.is_online_only || false,
                business_address: agent.business_address || '',
                // contact_phone map removed
                social_links: agent.social_links || { website: '', facebook: '', email: '' },
                latitude: agent.latitude || null,
                longitude: agent.longitude || null,

                // Parse business_hours - support both object and legacy string format
                business_hours: (typeof agent.business_hours === 'object' && agent.business_hours !== null)
                    ? agent.business_hours
                    : {
                        monday: { open: '09:00', close: '18:00', closed: false },
                        tuesday: { open: '09:00', close: '18:00', closed: false },
                        wednesday: { open: '09:00', close: '18:00', closed: false },
                        thursday: { open: '09:00', close: '18:00', closed: false },
                        friday: { open: '09:00', close: '18:00', closed: false },
                        saturday: { open: '10:00', close: '16:00', closed: false },
                        sunday: { open: '00:00', close: '00:00', closed: true }
                    },

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
                payment_mode: normalizeAgentPaymentMode(agent.payment_mode),
                mobile_money_orange: agent.mobile_money_orange || '',
                mobile_money_mtn: agent.mobile_money_mtn || '',
                mobile_money_wave: agent.mobile_money_wave || '',
                custom_payment_methods: agent.custom_payment_methods || [],
                restaurant_deposit_enabled: agent.restaurant_deposit_enabled ?? false,
                restaurant_deposit_mode: agent.restaurant_deposit_mode || 'percentage',
                restaurant_deposit_percentage: agent.restaurant_deposit_percentage ?? 30,
                restaurant_deposit_fixed_amount_fcfa: agent.restaurant_deposit_fixed_amount_fcfa ?? 0,
                escalation_phone: agent.escalation_phone || '',
                agent_context: agent.agent_context || '',
                welcome_message: agent.welcome_message || '',
                lead_collection_enabled: agent.lead_collection_enabled ?? false,
                lead_redirect_message: agent.lead_redirect_message || '',
                lead_collect_fields: Array.isArray(agent.lead_collect_fields) ? agent.lead_collect_fields : ['name', 'phone'],
                fallback_contact_message: agent.fallback_contact_message || '',
                live_query_url: agent.live_query_url || '',
                live_query_secret: agent.live_query_secret || '',
            })

            // Detect mission type for UX
            if (
                agent.agent_context ||
                agent.lead_collection_enabled ||
                agent.fallback_contact_message ||
                (agent.system_prompt || '').includes('en te basant uniquement')
            ) {
                setSelectedMission('support_client')
            }

            setLoading(false)
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    // Navigation helpers — Support Client skips step 2 (Horaires)
    // STEPS: 0=mission, 1=info, 2=hours, 3=personality, 4=rules, 5=settings, 6=whatsapp
    const getNextStep = (from: number) => {
        if (isSupportClient && from === 1) return 3 // skip hours (index 2)
        return Math.min(STEPS.length - 1, from + 1)
    }
    const getPrevStep = (from: number) => {
        if (isSupportClient && from === 3) return 1 // skip hours (index 2)
        return Math.max(0, from - 1)
    }

    const handleSave = async (silent = false) => {
        if (!agentId) return

        // Validation Rule: Escalation Phone is mandatory
        if (!silent && (!formData.escalation_phone || formData.escalation_phone.trim() === '')) {
            alert("⚠️ Le Numéro d'Escalade / SAV est obligatoire pour garantir le support client.")
            setCurrentStep(1) // Go to Identity tab (index 1 after reorder)
            setHighlightEscalation(true)
            setTimeout(() => setHighlightEscalation(false), 5000)
            return
        }

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
        if (!formData.is_active) {
            alert("Activez d'abord l'agent avant de connecter WhatsApp.")
            return
        }

        const normalizedPairingPhone = connectionMode === 'pairing_code'
            ? normalizePairingPhoneInput(pairingPhone)
            : null

        if (connectionMode === 'pairing_code' && !normalizedPairingPhone) {
            alert('Entrez un numero mobile valide avec indicatif pays (ex: +2250700000000).')
            return
        }

        const shouldForceFreshQr = retryWithFreshQr || whatsappStatus === 'error'
        setWhatsappStatus('connecting')
        setQrCode(null)
        setPairingCode(null)
        setWhatsappErrorMessage(null)
        try {
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId,
                    forceFreshQr: shouldForceFreshQr,
                    connectionMode,
                    pairingPhone: normalizedPairingPhone
                }),
            })
            const data = await response.json()
            const result = data.data || data
            if (!response.ok) throw new Error(data.error)

            if (result.qrCode) {
                setQrCode(result.qrCode)
                setPairingCode(null)
                setWhatsappStatus('qr_ready')
                setRetryWithFreshQr(false)
            } else if (result.pairingCode) {
                setPairingCode(result.pairingCode)
                setQrCode(null)
                setWhatsappStatus('qr_ready')
                setRetryWithFreshQr(false)
            } else if (result.status === 'connected') {
                setWhatsappStatus('connected')
                setConnectedPhone(result.phoneNumber)
                setQrCode(null)
                setPairingCode(null)
                setRetryWithFreshQr(false)
            }
        } catch (err) {
            console.error(err)
            setWhatsappStatus('error')
            setQrCode(null)
            setPairingCode(null)
            setWhatsappErrorMessage((err as Error)?.message || 'Erreur de connexion WhatsApp')
            setRetryWithFreshQr(true)
        }
    }

    const disconnectWhatsApp = async () => {
        if (!confirm('Déconnecter WhatsApp ?')) return
        try {
            await fetch(`/api/whatsapp/connect?agentId=${agentId}&logout=true`, { method: 'DELETE' })
            setWhatsappStatus('idle')
            setQrCode(null)
            setPairingCode(null)
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
                    setPairingCode(null)
                    setWhatsappErrorMessage(null)
                    setRetryWithFreshQr(false)
                    clearInterval(interval)
                } else if (result.status === 'paused' || result.paused) {
                    setWhatsappStatus('idle')
                    setQrCode(null)
                    setPairingCode(null)
                    setWhatsappErrorMessage(null)
                    setRetryWithFreshQr(false)
                    clearInterval(interval)
                } else if (result.status === 'error' || result.status === 'disconnected' || result.status === 'reconnect_required') {
                    setWhatsappStatus('error')
                    setQrCode(null)
                    setPairingCode(null)
                    setConnectedPhone(null)
                    setWhatsappErrorMessage(QR_CONNECTION_ERROR_MESSAGE)
                    setRetryWithFreshQr(true)
                    clearInterval(interval)
                } else if (result.pairingCode && result.pairingCode !== pairingCode) {
                    setPairingCode(result.pairingCode)
                    setQrCode(null)
                    setWhatsappStatus('qr_ready')
                    setWhatsappErrorMessage(null)
                    setRetryWithFreshQr(false)
                } else if (result.qrCode && result.qrCode !== qrCode) {
                    setQrCode(result.qrCode)
                    setPairingCode(null)
                    setWhatsappStatus('qr_ready')
                    setWhatsappErrorMessage(null)
                    setRetryWithFreshQr(false)
                }
            } catch (err) { }
        }, 2000)
        return () => clearInterval(interval)
    }, [whatsappStatus, agentId, qrCode, pairingCode])


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

                const getLocation = () => {
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
                }

                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Name */}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Nom du Bot / Agent *
                            </label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Marius le Vendeur"
                                style={inputStyle}
                            />
                        </div>

                        {/* Description with examples */}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Description / Personnalité
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Décrivez brièvement la personnalité de votre agent..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'none' }}
                            />
                            <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', background: 'rgba(30, 41, 59, 0.3)', padding: 12, borderRadius: 8 }}>
                                <p style={{ fontWeight: 600, marginBottom: 4 }}>Dites-moi qui je suis ! Exemples :</p>
                                <ul style={{ listStyle: 'disc', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <li>"Assistant chaleureux pour une pizzeria, je tutoie les clients et je propose toujours le supplément fromage."</li>
                                    <li>"Réceptionniste d'hôtel de luxe, poli et distingué, je demande toujours les dates de séjour."</li>
                                    <li>"Vendeur expert en smartphone, technique mais accessible, je pousse à l'achat."</li>
                                </ul>
                            </div>
                        </div>

                        {/* Toggle boutique en ligne */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10 }}>
                            <input
                                type="checkbox"
                                id="is_online_only"
                                checked={formData.is_online_only}
                                onChange={(e) => setFormData({ ...formData, is_online_only: e.target.checked })}
                                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#818cf8' }}
                            />
                            <label htmlFor="is_online_only" style={{ cursor: 'pointer', color: '#e2e8f0', fontSize: 14 }}>
                                Boutique 100% en ligne (pas d'adresse physique)
                                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>L'IA ne mentionnera jamais d'adresse physique.</span>
                            </label>
                        </div>

                        {/* Address with MapPin icon */}
                        <div style={{ display: formData.is_online_only ? 'none' : undefined }}>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Adresse Physique
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    value={formData.business_address}
                                    onChange={e => setFormData({ ...formData, business_address: e.target.value })}
                                    placeholder="Ex: Abidjan, Cocody..."
                                    style={inputStyle}
                                />
                                <MapPin size={16} style={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8' }} />
                            </div>
                        </div>

                        {/* Lat/Lon with Ma position link */}
                        <div className="agent-grid-2" style={{ display: formData.is_online_only ? 'none' : undefined }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Latitude
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.latitude || ''}
                                    onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                                    placeholder="0.0000"
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Longitude
                                    <span onClick={getLocation} style={{ color: '#10b981', cursor: 'pointer', fontSize: 12 }}>Ma position</span>
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.longitude || ''}
                                    onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                                    placeholder="0.0000"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Phone + Site Web */}
                        <div className="agent-grid-2">
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Numéro d'Escalade / SAV
                                </label>
                                <input
                                    value={formData.escalation_phone}
                                    onChange={e => setFormData({ ...formData, escalation_phone: e.target.value })}

                                    placeholder="+225 07 XX XX XX XX"
                                    style={{
                                        ...inputStyle,
                                        border: highlightEscalation ? '2px solid #fbbf24' : inputStyle.border,
                                        boxShadow: highlightEscalation ? '0 0 15px rgba(251, 191, 36, 0.3)' : 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                                {highlightEscalation && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-amber-400 text-xs font-bold mt-1"
                                    >
                                        👈 C'est ici !
                                    </motion.div>
                                )}
                                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                    Numéro donné au client en cas de problème (SAV).
                                </p>
                            </div>
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
                        </div>
                    </motion.div>
                )

            case 'hours':
                const set24_7 = () => {
                    const allOpen = {
                        monday: { open: '00:00', close: '23:59', closed: false },
                        tuesday: { open: '00:00', close: '23:59', closed: false },
                        wednesday: { open: '00:00', close: '23:59', closed: false },
                        thursday: { open: '00:00', close: '23:59', closed: false },
                        friday: { open: '00:00', close: '23:59', closed: false },
                        saturday: { open: '00:00', close: '23:59', closed: false },
                        sunday: { open: '00:00', close: '23:59', closed: false }
                    }
                    setFormData({ ...formData, business_hours: allOpen })
                }

                const dayNames: { [key: string]: string } = {
                    monday: 'Lundi',
                    tuesday: 'Mardi',
                    wednesday: 'Mercredi',
                    thursday: 'Jeudi',
                    friday: 'Vendredi',
                    saturday: 'Samedi',
                    sunday: 'Dimanche'
                }

                const timeInputStyle = {
                    padding: '4px 8px',
                    width: 100,
                    borderRadius: 8,
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    background: 'rgba(30, 41, 59, 0.5)',
                    color: 'white',
                    outline: 'none'
                }

                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Notice Support Client */}
                        {isSupportClient && (
                            <div style={{ padding: 14, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 12, fontSize: 13, color: '#a5b4fc' }}>
                                ℹ️ Les horaires ne s'appliquent pas au mode Support Client. Vous pouvez ignorer cette étape.
                            </div>
                        )}
                        {/* 24/7 Quick Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, marginBottom: 8 }}>
                            <div>
                                <span style={{ fontWeight: 600, color: '#10b981' }}>🌐 Ouvert 24h/24, 7j/7</span>
                                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Service disponible en permanence</p>
                            </div>
                            <button
                                type="button"
                                onClick={set24_7}
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

                        {Object.entries(formData.business_hours).map(([day, hours]) => (
                            <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(30, 41, 59, 0.3)', borderRadius: 8 }}>
                                <span style={{ textTransform: 'capitalize', color: 'white', width: 100 }}>{dayNames[day] || day}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={!hours.closed}
                                        onChange={e => setFormData({
                                            ...formData,
                                            business_hours: { ...formData.business_hours, [day]: { ...hours, closed: !e.target.checked } }
                                        })}
                                        style={{ accentColor: '#10b981', width: 16, height: 16 }}
                                    />
                                    {!hours.closed ? (
                                        <>
                                            <input
                                                type="time"
                                                value={hours.open}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    business_hours: { ...formData.business_hours, [day]: { ...hours, open: e.target.value } }
                                                })}
                                                style={timeInputStyle}
                                            />
                                            <span style={{ color: '#94a3b8' }}>-</span>
                                            <input
                                                type="time"
                                                value={hours.close}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                                })}
                                                style={timeInputStyle}
                                            />
                                        </>
                                    ) : (
                                        <span style={{ color: '#64748b', fontStyle: 'italic', width: 216, textAlign: 'center' }}>Fermé</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )

            case 'mission': {
                const missionTemplates = [
                    { id: 'ecommerce', emoji: '🛍️', title: 'E-commerce / Boutique', description: 'Vendre des produits, gérer les commandes et livraisons' },
                    { id: 'restaurant', emoji: '🍽️', title: 'Restaurant / Fast-food', description: 'Prendre commandes, gérer réservations et menus' },
                    { id: 'hotel', emoji: '🏨', title: 'Hôtel / Hébergement', description: 'Réservations de chambres, services et concierge' },
                    { id: 'salon', emoji: '💇', title: 'Salon / Beauté', description: 'Rendez-vous, prestations et conseils beauté' },
                    { id: 'services', emoji: '🔧', title: 'Services / Artisan', description: 'Devis, interventions et rendez-vous techniques' },
                    { id: 'support_client', emoji: '📚', title: 'Support Client', description: 'Répondre aux questions via une base de connaissance' },
                    { id: 'custom', emoji: '✏️', title: 'Personnalisé', description: 'Configurer librement la mission de votre agent' },
                ]
                const missionPrompts: Record<string, string> = {
                    ecommerce: `Tu es l'assistant commercial de notre boutique en ligne.\n\nTon rôle:\n- Accueillir les clients et répondre à leurs questions\n- Présenter les produits disponibles (voir liste des produits)\n- Aider à choisir les bons produits selon leurs besoins\n- Finaliser les commandes en respectant le type de produit vendu\n\nPour commander, tu dois toujours collecter:\n1. Le(s) produit(s) souhaité(s) et quantités\n2. Nom complet du client\n3. Numéro de téléphone\n\nCompléments selon le type de produit:\n- Produit numérique : demander l'adresse email, jamais d'adresse de livraison physique\n- Produit physique : demander l'adresse de livraison\n- Paiement : suivre le mode prévu par le système et ne jamais promettre cash à la livraison pour un produit numérique\n\nRègles:\n- Sois courtois et serviable\n- Propose toujours des produits complémentaires\n- Confirme le total avant de valider la commande\n- N'invente jamais un mode de livraison ou de paiement contraire au catalogue`,
                    restaurant: `Tu es l'assistant de notre restaurant.\n\nTon rôle:\n- Présenter le menu et les plats du jour\n- Prendre les commandes (sur place ou livraison)\n- Gérer les réservations de tables\n- Informer sur les allergènes et ingrédients\n\nPour une commande livraison, collecte:\n1. Les plats et quantités\n2. Adresse de livraison\n3. Heure souhaitée\n4. Numéro de téléphone\n\nRègles:\n- Propose toujours des accompagnements et boissons\n- Précise les temps de préparation\n- Confirme le total de la commande`,
                    hotel: `Tu es le concierge virtuel de notre hôtel.\n\nTon rôle:\n- Renseigner sur les types de chambres et tarifs\n- Effectuer des réservations\n- Informer sur les services (restaurant, spa, piscine)\n- Répondre aux questions des clients\n\nPour une réservation, collecte:\n1. Dates d'arrivée et de départ\n2. Type de chambre souhaité\n3. Nombre d'adultes et d'enfants\n4. Nom complet et téléphone\n\nRègles:\n- Propose des surclassements si disponibles\n- Mentionne les services inclus\n- Confirme le tarif total et les conditions d'annulation`,
                    salon: `Tu es l'assistant de notre salon de beauté/coiffure.\n\nTon rôle:\n- Présenter nos services et tarifs\n- Prendre les rendez-vous\n- Conseiller sur les soins adaptés\n\nPour un rendez-vous, collecte:\n1. Le(s) service(s) souhaité(s)\n2. Date et heure préférées\n3. Nom et numéro de téléphone\n\nRègles:\n- Indique la durée estimée des prestations\n- Propose des services complémentaires\n- Confirme le rendez-vous et le tarif estimé`,
                    services: `Tu es l'assistant de notre entreprise de services.\n\nTon rôle:\n- Comprendre les besoins du client\n- Expliquer nos services et tarifs\n- Prendre les demandes d'intervention ou de devis\n\nPour une intervention, collecte:\n1. Nature du problème ou service demandé\n2. Adresse complète\n3. Disponibilités du client\n4. Nom et téléphone\n\nRègles:\n- Pose des questions pour bien comprendre le besoin\n- Donne une fourchette de prix si possible\n- Confirme tous les détails avant de valider`,
                    support_client: `Tu es l'assistant de ${formData.name || '[Nom de l\'entreprise]'}.\nTon rôle est de répondre aux questions des clients en te basant uniquement sur les informations que tu connais.\nNe jamais inventer d'information. Si tu ne sais pas, renvoie vers le contact direct.`,
                    custom: `Tu es un assistant virtuel professionnel et polyvalent. Ton rôle est d'accueillir les visiteurs, de répondre à leurs questions sur l'entreprise et de noter leurs coordonnées si nécessaire. Sois toujours courtois, bref et précis.`,
                }
                const applyTemplate = (templateId: string) => {
                    const currentPrompt = formData.system_prompt
                    if (currentPrompt && currentPrompt.trim().length > 30) {
                        if (!window.confirm('Remplacer le prompt actuel par ce template ?')) return
                    }
                    setSelectedMission(templateId)
                    setFormData({ ...formData, system_prompt: missionPrompts[templateId] || '' })
                }
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 14 }}>
                                Choisissez un template pour pré-remplir la mission, puis personnalisez librement.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                {missionTemplates.map(tpl => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => applyTemplate(tpl.id)}
                                        style={{
                                            padding: '14px 16px',
                                            border: '1px solid rgba(148, 163, 184, 0.15)',
                                            borderRadius: 12,
                                            background: 'rgba(30, 41, 59, 0.5)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.4)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)')}
                                    >
                                        <div style={{ fontSize: 20, marginBottom: 6 }}>{tpl.emoji}</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>{tpl.title}</div>
                                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{tpl.description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                                Prompt système (modifiable)
                            </label>
                            <textarea
                                value={formData.system_prompt}
                                onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                                placeholder={isSupportClient ? "Tu es l'assistant de [Nom de l'entreprise]. Ton rôle est de répondre aux questions des clients en te basant uniquement sur les informations que tu connais..." : "Tu es l'assistant commercial de [Nom de l'entreprise]..."}
                                style={{
                                    width: '100%',
                                    padding: 16,
                                    borderRadius: 12,
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    color: 'white',
                                    outline: 'none',
                                    height: 220,
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                }}
                            />
                        </div>
                        {isSupportClient && (
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                                    Contexte supplémentaire (Support Client)
                                </label>
                                <textarea
                                    value={formData.agent_context}
                                    onChange={e => setFormData({ ...formData, agent_context: e.target.value })}
                                    placeholder="Informations complémentaires sur votre activité, produits ou politiques que l'IA doit connaître..."
                                    style={{
                                        width: '100%',
                                        padding: 16,
                                        borderRadius: 12,
                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                        background: 'rgba(99, 102, 241, 0.05)',
                                        color: 'white',
                                        outline: 'none',
                                        height: 120,
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                    }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Ce contexte est injecté dans chaque réponse du mode Support Client.
                                </p>
                            </div>
                        )}
                        {isSupportClient && (
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                                    Message d'accueil (optionnel)
                                </label>
                                <textarea
                                    value={formData.welcome_message}
                                    onChange={e => setFormData({ ...formData, welcome_message: e.target.value })}
                                    placeholder="Ex: Je peux vous renseigner sur nos formations, les tarifs et le processus d'inscription."
                                    style={{
                                        width: '100%',
                                        padding: 16,
                                        borderRadius: 12,
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        background: 'rgba(16, 185, 129, 0.05)',
                                        color: 'white',
                                        outline: 'none',
                                        height: 100,
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                    }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Affiché après le nom de l'agent lors du premier message. Ex: "Bonjour ! Je suis l'assistant de X. <i>votre texte ici</i>"
                                </p>
                            </div>
                        )}
                        {isSupportClient && (
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                                    Message de redirection (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={formData.fallback_contact_message}
                                    onChange={e => setFormData({ ...formData, fallback_contact_message: e.target.value })}
                                    placeholder="Ex: Pour plus de détails, appelez le +225 07 00 00 00 ou visitez notre site."
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 13 }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Ajoutée automatiquement quand l'agent n'a pas l'information. Laissez vide pour un comportement par défaut.
                                </p>
                            </div>
                        )}
                    </motion.div>
                )
            }

            case 'personality':
                const personalities = [
                    { id: 'friendly', name: 'Amical', emoji: '😊', description: 'Chaleureux et accessible' },
                    { id: 'professional', name: 'Professionnel', emoji: '👔', description: 'Formel et efficace' },
                    { id: 'casual', name: 'Décontracté', emoji: '🎉', description: 'Fun et relaxé' },
                    { id: 'expert', name: 'Expert', emoji: '🎓', description: 'Technique et précis' }
                ]
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {isSupportClient && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10, fontSize: 13, color: '#a5b4fc' }}>
                                <span>ℹ️</span>
                                <span>En mode Support Client, la personnalité s'active automatiquement si vous ajoutez des produits à cet agent.</span>
                            </div>
                        )}
                        {!isSupportClient && (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                        Personnalité de l'agent
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                        {personalities.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => setFormData({ ...formData, agent_tone: p.id })}
                                                style={{
                                                    padding: 20,
                                                    border: `2px solid ${formData.agent_tone === p.id ? '#10b981' : 'rgba(148, 163, 184, 0.1)'}`,
                                                    borderRadius: 12,
                                                    textAlign: 'center',
                                                    background: formData.agent_tone === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ fontSize: 32, marginBottom: 8 }}>{p.emoji}</div>
                                                <h3 style={{ fontWeight: 600, color: 'white' }}>{p.name}</h3>
                                                <p style={{ fontSize: 12, color: '#64748b' }}>{p.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Emoji Toggle with animated switch */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 16,
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 12
                                }}>
                                    <div>
                                        <h3 style={{ fontWeight: 500, color: 'white' }}>Utiliser des emojis</h3>
                                        <p style={{ fontSize: 13, color: '#64748b' }}>L'agent utilisera des emojis dans ses réponses</p>
                                    </div>
                                    <button
                                        onClick={() => setFormData({ ...formData, use_emojis: !formData.use_emojis })}
                                        style={{
                                            width: 48,
                                            height: 28,
                                            borderRadius: 14,
                                            background: formData.use_emojis ? '#10b981' : '#334155',
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
                                            left: formData.use_emojis ? 23 : 3,
                                            transition: 'left 0.2s'
                                        }} />
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                )

            case 'rules':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {isSupportClient && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10, fontSize: 13, color: '#a5b4fc' }}>
                                <span>ℹ️</span>
                                <span>En mode Support Client, les règles s'activent automatiquement si vous ajoutez des produits à cet agent.</span>
                            </div>
                        )}
                        <p style={{ fontSize: 14, color: '#94a3b8' }}>
                            Ajoutez ici TOUTES vos règles spécifiques que le bot doit respecter absolument.
                            {isSupportClient
                                ? <><br />Périmètre d&apos;intervention, Procédures, Restrictions, Escalade...</>
                                : <><br />Politique de retour, Livraison, Paiement, Promos...</>
                            }
                        </p>

                        <textarea
                            value={formData.custom_rules}
                            onChange={e => {
                                setFormData({ ...formData, custom_rules: e.target.value })
                                setConflictStatus('idle')
                            }}
                            placeholder={isSupportClient ? `Exemples de règles que l'IA doit respecter:

🔍 PÉRIMÈTRE:
- Répondre uniquement aux questions liées à nos véhicules/produits/services
- Ne pas donner d'avis personnel sur la concurrence

📋 PROCÉDURES:
- Pour un essai: demander nom, téléphone et disponibilité
- Pour un devis: orienter vers notre formulaire en ligne

🚫 RESTRICTIONS:
- Ne pas promettre de prix sans validation du responsable
- Ne pas communiquer les stocks exacts

📞 ESCALADE:
- Renvoyer vers le conseiller au +225 07 XX XX XX XX pour toute demande complexe` : `Exemples de règles que l'IA doit respecter:

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
                        {/* Settings - Only Temperature and Language */}
                        <div className="agent-grid-2">
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
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Plus élevé = réponses plus créatives</p>
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
                        </div>

                        {/* Payment Settings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 12 }}>
                                    Mode de Paiement
                                </label>
                                {isSupportClient ? (
                                    <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)' }}>
                                        Paiement manuel activé automatiquement (mode Support Client).
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div
                                            onClick={() => setFormData({ ...formData, payment_mode: 'cinetpay' })}
                                            style={{
                                                padding: 16,
                                                border: `1px solid ${formData.payment_mode === 'cinetpay' ? '#6366f1' : 'rgba(148,163,184,0.1)'}`,
                                                borderRadius: 12,
                                                background: formData.payment_mode === 'cinetpay' ? 'rgba(99,102,241,0.1)' : 'rgba(30,41,59,0.5)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{AUTOMATIC_PAYMENT_MODE_LABEL}</div>
                                            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{AUTOMATIC_PAYMENT_MODE_DESCRIPTION}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{AUTOMATIC_PAYMENT_MODE_HINT}</div>
                                        </div>
                                        <div
                                            onClick={() => setFormData({ ...formData, payment_mode: 'mobile_money_direct' })}
                                            style={{
                                                padding: 16,
                                                border: `1px solid ${formData.payment_mode === 'mobile_money_direct' ? '#10b981' : 'rgba(148,163,184,0.1)'}`,
                                                borderRadius: 12,
                                                background: formData.payment_mode === 'mobile_money_direct' ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.5)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{MANUAL_PAYMENT_MODE_LABEL}</div>
                                            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{MANUAL_PAYMENT_MODE_DESCRIPTION}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{MANUAL_PAYMENT_MODE_HINT}</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(formData.payment_mode === 'mobile_money_direct' || isSupportClient) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                                        {MANUAL_PAYMENT_METHODS_LABEL}
                                    </label>
                                    <div className="agent-grid-2">
                                        <div>
                                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                🟠 Orange Money
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.mobile_money_orange}
                                                onChange={e => setFormData({ ...formData, mobile_money_orange: e.target.value })}
                                                placeholder="+225 07 XX XX XX XX"
                                                style={selectStyle}
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
                                                style={selectStyle}
                                            />
                                        </div>
                                    </div>
                                    <div className="agent-grid-2">
                                        <div>
                                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                🔵 Wave
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.mobile_money_wave}
                                                onChange={e => setFormData({ ...formData, mobile_money_wave: e.target.value })}
                                                placeholder="+225 01 XX XX XX XX"
                                                style={selectStyle}
                                            />
                                        </div>
                                    </div>

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
                                                            updated[index] = { ...updated[index], name: e.target.value }
                                                            setFormData({ ...formData, custom_payment_methods: updated })
                                                        }}
                                                        placeholder="Nom (ex: PayPal)"
                                                        style={{ ...selectStyle, flex: 1 }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={method.details}
                                                        onChange={e => {
                                                            const updated = [...formData.custom_payment_methods]
                                                            updated[index] = { ...updated[index], details: e.target.value }
                                                            setFormData({ ...formData, custom_payment_methods: updated })
                                                        }}
                                                        placeholder="Détails (ex: email@paypal.com)"
                                                        style={{ ...selectStyle, flex: 1 }}
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
                                                onClick={() => setFormData({ ...formData, custom_payment_methods: [...formData.custom_payment_methods, { name: '', details: '' }] })}
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

                            <div style={{
                                padding: 16,
                                borderRadius: 12,
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                background: formData.restaurant_deposit_enabled
                                    ? 'rgba(16, 185, 129, 0.08)'
                                    : 'rgba(15, 23, 42, 0.3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                                    <div>
                                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                                            Acompte reservations restaurant
                                        </h3>
                                        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                                            Utilise uniquement pour les reservations restaurant avec precommande.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, restaurant_deposit_enabled: !formData.restaurant_deposit_enabled })}
                                        style={{
                                            width: 48,
                                            height: 28,
                                            borderRadius: 14,
                                            background: formData.restaurant_deposit_enabled ? '#10b981' : '#334155',
                                            border: 'none',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            flexShrink: 0
                                        }}
                                    >
                                        <div style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: 3,
                                            left: formData.restaurant_deposit_enabled ? 23 : 3,
                                            transition: 'left 0.2s'
                                        }} />
                                    </button>
                                </div>

                                {formData.restaurant_deposit_enabled && (
                                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                Type d&apos;acompte
                                            </label>
                                            <div className="agent-grid-2" style={{ gap: 12 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, restaurant_deposit_mode: 'percentage' })}
                                                    style={{
                                                        padding: '12px 14px',
                                                        borderRadius: 10,
                                                        border: formData.restaurant_deposit_mode === 'percentage' ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                                        background: formData.restaurant_deposit_mode === 'percentage' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                                        color: formData.restaurant_deposit_mode === 'percentage' ? '#d1fae5' : '#cbd5e1',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Pourcentage
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, restaurant_deposit_mode: 'fixed' })}
                                                    style={{
                                                        padding: '12px 14px',
                                                        borderRadius: 10,
                                                        border: formData.restaurant_deposit_mode === 'fixed' ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                                        background: formData.restaurant_deposit_mode === 'fixed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                                        color: formData.restaurant_deposit_mode === 'fixed' ? '#d1fae5' : '#cbd5e1',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Montant fixe
                                                </button>
                                            </div>
                                        </div>
                                        {formData.restaurant_deposit_mode === 'percentage' ? (
                                            <>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                        Pourcentage d&apos;acompte: {formData.restaurant_deposit_percentage}%
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="5"
                                                        value={formData.restaurant_deposit_percentage}
                                                        onChange={e => setFormData({ ...formData, restaurant_deposit_percentage: parseInt(e.target.value) })}
                                                        style={{ width: '100%', accentColor: '#10b981' }}
                                                    />
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    value={formData.restaurant_deposit_percentage}
                                                    onChange={e => setFormData({ ...formData, restaurant_deposit_percentage: Math.max(0, Math.min(100, parseInt(e.target.value || '0'))) })}
                                                    style={selectStyle}
                                                />
                                                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                                    Exemple: 30% demande un acompte de 30% avant confirmation finale de la reservation.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                        Montant fixe de l&apos;acompte (FCFA)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="500"
                                                        value={formData.restaurant_deposit_fixed_amount_fcfa}
                                                        onChange={e => setFormData({ ...formData, restaurant_deposit_fixed_amount_fcfa: Math.max(0, parseInt(e.target.value || '0')) })}
                                                        style={selectStyle}
                                                    />
                                                </div>
                                                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                                    Exemple: 5000 demande toujours 5 000 FCFA d&apos;acompte. Si le total est inferieur, l&apos;acompte sera plafonne au total.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section Collecte de Leads (support client uniquement) */}
                            {isSupportClient && (
                                <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24, marginTop: 8 }}>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 12 }}>
                                        Collecte de leads
                                    </label>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: 16, border: '1px solid rgba(148,163,184,0.1)', borderRadius: 12, background: 'rgba(30,41,59,0.5)', marginBottom: 16
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>Activer la collecte de leads</div>
                                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                                                L'agent collecte le contact du client intéressé
                                            </div>
                                        </div>
                                        <button type="button"
                                            onClick={() => setFormData({ ...formData, lead_collection_enabled: !formData.lead_collection_enabled })}
                                            style={{ width: 48, height: 28, borderRadius: 14, background: formData.lead_collection_enabled ? '#10b981' : '#334155', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                                        >
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: formData.lead_collection_enabled ? 23 : 3, transition: 'left 0.2s' }} />
                                        </button>
                                    </div>

                                    {formData.lead_collection_enabled && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                    Informations à collecter
                                                </label>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    {[{ key: 'name', label: 'Prénom/Nom' }, { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'Email' }].map(f => (
                                                        <button key={f.key} type="button"
                                                            onClick={() => {
                                                                const cur = formData.lead_collect_fields
                                                                setFormData({ ...formData, lead_collect_fields: cur.includes(f.key) ? cur.filter((x: string) => x !== f.key) : [...cur, f.key] })
                                                            }}
                                                            style={{
                                                                padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none',
                                                                background: formData.lead_collect_fields.includes(f.key) ? '#10b981' : 'rgba(30,41,59,0.8)',
                                                                color: formData.lead_collect_fields.includes(f.key) ? 'white' : '#94a3b8'
                                                            }}
                                                        >{f.label}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                    Message après enregistrement du lead
                                                </label>
                                                <input type="text" value={formData.lead_redirect_message}
                                                    onChange={e => setFormData({ ...formData, lead_redirect_message: e.target.value })}
                                                    placeholder="Ex: Merci ! Nos équipes vous recontacteront sous 24h."
                                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {!formData.lead_collection_enabled && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                Message de redirection (optionnel)
                                            </label>
                                            <input type="text" value={formData.lead_redirect_message}
                                                onChange={e => setFormData({ ...formData, lead_redirect_message: e.target.value })}
                                                placeholder="Ex: Pour commander, appelez le +225 07 00 00 00"
                                                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                                            />
                                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                                Ce message sera affiché si un client exprime un intérêt commercial.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Live Query API — section avancée */}
                        <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24 }}>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                                Live Query URL <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>(Avancé — API)</span>
                            </label>
                            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                                URL appelée en temps réel pour récupérer des données dynamiques (stock, statut commande...). Réponse attendue : <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>{`{ "answer": "..." }`}</code>
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <input
                                    type="url"
                                    value={formData.live_query_url}
                                    onChange={e => setFormData({ ...formData, live_query_url: e.target.value })}
                                    placeholder="https://monsite.com/wazzap-live-query"
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' as const }}
                                />
                                <input
                                    type="text"
                                    value={formData.live_query_secret}
                                    onChange={e => setFormData({ ...formData, live_query_secret: e.target.value })}
                                    placeholder="Secret HMAC (optionnel) — pour vérifier la signature X-Wazzap-Signature"
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 13, boxSizing: 'border-box' as const }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )

            case 'whatsapp':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6 text-center">
                        <div className="bg-slate-800/50 p-8 rounded-xl border border-slate-700/50 flex flex-col items-center">
                            <h2 className="text-2xl font-bold text-white mb-6">Connexion WhatsApp</h2>

                            {!formData.is_active && (
                                <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                    Agent desactive. Activez-le d'abord pour lancer ou reprendre un scan WhatsApp.
                                </div>
                            )}

                            {whatsappStatus !== 'connected' && (
                                <div className="mb-6 w-full max-w-xl rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 text-left">
                                    <div className="mb-3 text-sm font-semibold text-slate-200">Mode de connexion</div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setConnectionMode('qr')}
                                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${connectionMode === 'qr'
                                                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                                                : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-500'}`}
                                        >
                                            QR code (ordinateur)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConnectionMode('pairing_code')}
                                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${connectionMode === 'pairing_code'
                                                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                                                : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-500'}`}
                                        >
                                            Code de liaison (mobile)
                                        </button>
                                    </div>
                                    {connectionMode === 'pairing_code' && (
                                        <div className="mt-3">
                                            <label className="mb-1 block text-xs text-slate-400">Numero WhatsApp (avec indicatif)</label>
                                            <input
                                                type="tel"
                                                value={pairingPhone}
                                                onChange={(e) => setPairingPhone(e.target.value)}
                                                placeholder="+2250700000000"
                                                className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/60"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {whatsappStatus === 'idle' && (
                                <button
                                    onClick={connectWhatsApp}
                                    disabled={!formData.is_active}
                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                                >
                                    {connectionMode === 'pairing_code' ? <Smartphone size={20} /> : <QrCode size={20} />}
                                    {connectionMode === 'pairing_code' ? 'Generer le code de liaison' : 'Generer le QR Code'}
                                </button>
                            )}

                            {whatsappStatus === 'connecting' && (
                                <div className="text-emerald-400 flex flex-col items-center gap-4">
                                    <Loader2 className="w-10 h-10 animate-spin" />
                                    <span>{connectionMode === 'pairing_code' ? 'Generation du code de liaison...' : 'Demarrage du service WhatsApp...'}</span>
                                    <div className="text-sm text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 max-w-xs text-center">
                                        La premiere connexion peut prendre jusqu&apos;a <strong className="text-amber-400">60 secondes</strong>.<br />
                                        {connectionMode === 'pairing_code'
                                            ? 'Patientez, le code apparaitra automatiquement.'
                                            : 'Patientez, le QR code apparaitra automatiquement.'}
                                    </div>
                                </div>
                            )}

                            {whatsappStatus === 'qr_ready' && (qrCode || pairingCode) && (
                                <>
                                    {qrCode ? (
                                        <div className="bg-white p-4 rounded-xl animate-in zoom-in duration-300">
                                            <img src={qrCode} alt="QR" className="w-64 h-64" />
                                            <p className="text-slate-500 mt-2 text-sm">Scannez avec WhatsApp (Appareils connectes)</p>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-md rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center animate-in zoom-in duration-300">
                                            <p className="mb-2 text-sm text-emerald-200">Code de liaison WhatsApp</p>
                                            <p className="mb-4 text-3xl font-bold tracking-wider text-white">{pairingCode}</p>
                                            <p className="text-xs text-emerald-100/80">
                                                Ouvrez WhatsApp sur votre telephone: Appareils connectes &gt; Connecter un appareil &gt; Entrer le code.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {whatsappStatus === 'error' && (
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-400">
                                        <AlertCircle size={40} />
                                    </div>
                                    <div className="text-xl font-bold text-white">Connexion interrompue</div>
                                    <div className="max-w-md text-sm text-red-300">
                                        {whatsappErrorMessage || QR_CONNECTION_ERROR_MESSAGE}
                                    </div>
                                    <div className="max-w-md rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-3 text-sm text-slate-300">
                                        Si WhatsApp affiche "Impossible de connecter l'appareil", regenerez un nouveau QR code puis rescanez-le.
                                    </div>
                                    <button
                                        onClick={connectWhatsApp}
                                        disabled={!formData.is_active}
                                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                                    >
                                        <RefreshCw size={20} /> {connectionMode === 'pairing_code' ? 'Regenerer un nouveau code' : 'Regenerer un nouveau QR code'}
                                    </button>
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
                        <Link
                            href={`/dashboard/agents/${agentId}/knowledge?from=whatsapp`}
                            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
                        >
                            <BookOpen size={16} />
                            Base de connaissance
                        </Link>
                        {isSupportClient && (
                            <Link
                                href={`/dashboard/agents/${agentId}/leads`}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
                            >
                                <Users size={16} />
                                Leads
                            </Link>
                        )}
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
            <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
                {renderStep()}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => setCurrentStep(prev => getPrevStep(prev))}
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
                                setCurrentStep(prev => getNextStep(prev))
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
