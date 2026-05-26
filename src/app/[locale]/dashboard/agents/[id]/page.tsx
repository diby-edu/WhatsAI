'use client'

import { useState, useEffect, use, useRef } from 'react'
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
import { useToast } from '@/components/ui/Toast'
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

function sanitizeEscalationPhone(value: string): string {
    const raw = value || ''
    const digits = raw.replace(/[^\d]/g, '')
    return raw.startsWith('+') ? '+' + digits : digits
}

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
    const toast = useToast()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const isInitializedRef = useRef(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [highlightEscalation, setHighlightEscalation] = useState(false)
    const [selectedMission, setSelectedMission] = useState('')
    const [isExternalSync, setIsExternalSync] = useState(false)
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
    const [countdown, setCountdown] = useState<number | null>(null)

    useEffect(() => {
        if (countdown === null || countdown <= 0) return
        const t = setTimeout(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : c)), 1000)
        return () => clearTimeout(t)
    }, [countdown])

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
        // External Sync — message envoyé quand un client répond
        external_sync_reply_message: '',
    })

    // Ctrl+S → save
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [formData])

    // Track unsaved changes — skip the initial load
    useEffect(() => {
        if (!isInitializedRef.current) {
            isInitializedRef.current = true
            return
        }
        setIsDirty(true)
    }, [formData])

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
                external_sync_reply_message: agent.external_sync_reply_message || '',
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
            if (agent.ecommerce_mode === 'external_sync') {
                setIsExternalSync(true)
            }

            setLoading(false)
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    // Navigation helpers
    // STEPS: 0=info, 1=hours, 2=personality, 3=rules, 4=settings, 5=whatsapp
    const getNextStep = (from: number) => {
        if (isExternalSync && from === 0) return 4 // skip hours(1), personality(2), rules(3)
        if (isExternalSync && from === 4) return 5
        if (isSupportClient && from === 0) return 2 // skip hours (index 1)
        return Math.min(STEPS.length - 1, from + 1)
    }
    const getPrevStep = (from: number) => {
        if (isExternalSync && from === 4) return 0 // skip rules(3), personality(2), hours(1)
        if (isExternalSync && from === 5) return 4
        if (isSupportClient && from === 2) return 0 // skip hours (index 1)
        return Math.max(0, from - 1)
    }

    const handleSave = async (silent = false) => {
        if (!agentId) return

        // Validation Rule: Escalation Phone is mandatory
        if (!silent && (!formData.escalation_phone || formData.escalation_phone.trim() === '')) {
            toast.error("Numéro d'Escalade / SAV obligatoire pour garantir le support client.")
            setCurrentStep(0)
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
            if (!silent) toast.success('Agent sauvegardé.')
            setIsDirty(false)
        } catch (err) {
            if (!silent) toast.error('Erreur lors de la sauvegarde.')
        } finally {
            if (!silent) setSaving(false)
        }
    }

    // --- WhatsApp Logic (Copied from previous) ---
    const connectWhatsApp = async () => {
        if (!formData.is_active) {
            toast.warning("Activez d'abord l'agent avant de connecter WhatsApp.")
            return
        }

        const normalizedPairingPhone = connectionMode === 'pairing_code'
            ? normalizePairingPhoneInput(pairingPhone)
            : null

        if (connectionMode === 'pairing_code' && !normalizedPairingPhone) {
            toast.error('Numéro mobile invalide. Exemple : +2250700000000')
            return
        }

        const shouldForceFreshQr = retryWithFreshQr || whatsappStatus === 'error'
        setWhatsappStatus('connecting')
        setCountdown(120)
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
                setCountdown(null)
                setRetryWithFreshQr(false)
            }
        } catch (err) {
            console.error(err)
            setWhatsappStatus('error')
            setCountdown(null)
            setQrCode(null)
            setPairingCode(null)
            setWhatsappErrorMessage((err as Error)?.message || 'Erreur de connexion WhatsApp')
            setRetryWithFreshQr(true)
        }
    }

    const disconnectWhatsApp = async () => {
        const ok = await toast.confirm({ title: 'Déconnecter WhatsApp ?', message: 'Le numéro sera déconnecté de cet agent.', confirmLabel: 'Déconnecter', danger: true })
        if (!ok) return
        try {
            await fetch(`/api/whatsapp/connect?agentId=${agentId}&logout=true`, { method: 'DELETE' })
            setWhatsappStatus('idle')
            setQrCode(null)
            setPairingCode(null)
            setConnectedPhone(null)
            toast.success('WhatsApp déconnecté.')
        } catch (err) { console.error(err) }
    }

    const cancelConnection = async () => {
        setWhatsappStatus('idle')
        setCountdown(null)
        setQrCode(null)
        setPairingCode(null)
        try { await fetch(`/api/whatsapp/connect?agentId=${agentId}&logout=true`, { method: 'DELETE' }) } catch {}
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
                    if (!navigator.geolocation) { toast.error('Géolocalisation non supportée'); return }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            setFormData(prev => ({
                                ...prev,
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude
                            }))
                        },
                        (err) => toast.error('Erreur de localisation : ' + err.message)
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
                                    onChange={e => setFormData({ ...formData, escalation_phone: sanitizeEscalationPhone(e.target.value) })}

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
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Notice Support Client */}
                        {isSupportClient && (
                            <div style={{ padding: 10, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 10, fontSize: 12, color: '#a5b4fc' }}>
                                ℹ️ Les horaires ne s'appliquent pas au mode Support Client. Vous pouvez ignorer cette étape.
                            </div>
                        )}
                        {/* 24/7 Quick Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 10, marginBottom: 4 }}>
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
                            <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', background: 'rgba(30, 41, 59, 0.3)', borderRadius: 8 }}>
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
                const applyTemplate = async (templateId: string) => {
                    const currentPrompt = formData.system_prompt
                    if (currentPrompt && currentPrompt.trim().length > 30) {
                        const ok = await toast.confirm({ title: 'Remplacer le prompt ?', message: 'Le prompt actuel sera remplacé par ce template.', confirmLabel: 'Remplacer', danger: true })
                        if (!ok) return
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

                if (isExternalSync) {
                    return (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: 10, fontSize: 13, color: '#bae6fd' }}>
                                <span>ℹ️</span>
                                <span>Ce canal ne génère pas de réponses IA. Configurez ici le message envoyé automatiquement quand un client répond à vos notifications.</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Message de redirection *
                                </label>
                                <textarea
                                    value={formData.external_sync_reply_message}
                                    onChange={e => setFormData({ ...formData, external_sync_reply_message: e.target.value })}
                                    placeholder={`Ex: Bonjour ! Pour toute question, contactez notre équipe au {{escalation_phone}}.`}
                                    rows={4}
                                    style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(30, 41, 59, 0.5)', color: 'white', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Utilisez <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>{'{{escalation_phone}}'}</code> pour insérer automatiquement le numéro d&apos;escalade configuré dans l&apos;onglet Identité.
                                </p>
                            </div>
                        </motion.div>
                    )
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

                        {/* Live Query API — section avancée (bientôt) */}
                        <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24, opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
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
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 20 }}>
                        {!formData.is_active && (
                            <div style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)', fontSize: 13, color: '#fde68a', width: '100%', maxWidth: 460 }}>
                                Agent désactivé. Activez-le d&apos;abord pour lancer ou reprendre un scan WhatsApp.
                            </div>
                        )}

                        {whatsappStatus !== 'connected' && (
                            <div style={{ width: '100%', maxWidth: 460, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(15,23,42,0.55)', borderRadius: 14, padding: 14 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 10 }}>Mode de connexion</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <button type="button" onClick={() => setConnectionMode('qr')} style={{ borderRadius: 10, border: connectionMode === 'qr' ? '1px solid rgba(52,211,153,0.7)' : '1px solid rgba(71,85,105,0.8)', background: connectionMode === 'qr' ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.7)', color: connectionMode === 'qr' ? '#a7f3d0' : '#cbd5e1', padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        QR code (ordinateur)
                                    </button>
                                    <button type="button" onClick={() => setConnectionMode('pairing_code')} style={{ borderRadius: 10, border: connectionMode === 'pairing_code' ? '1px solid rgba(52,211,153,0.7)' : '1px solid rgba(71,85,105,0.8)', background: connectionMode === 'pairing_code' ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.7)', color: connectionMode === 'pairing_code' ? '#a7f3d0' : '#cbd5e1', padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                        Code de liaison (mobile)
                                    </button>
                                </div>
                                {connectionMode === 'pairing_code' && (
                                    <div style={{ marginTop: 10 }}>
                                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Numéro WhatsApp (avec indicatif)</label>
                                        <input type="tel" value={pairingPhone} onChange={(e) => setPairingPhone(e.target.value)} placeholder="+2250700000000" style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(71,85,105,0.8)', background: 'rgba(30,41,59,0.7)', color: 'white', padding: '10px 12px', fontSize: 13, outline: 'none' }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {whatsappStatus === 'idle' && (
                            <>
                                <button onClick={connectWhatsApp} disabled={!formData.is_active} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, color: 'white', background: formData.is_active ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(51,65,85,0.5)', border: 'none', borderRadius: 12, cursor: formData.is_active ? 'pointer' : 'not-allowed', opacity: formData.is_active ? 1 : 0.5 }}>
                                    {connectionMode === 'pairing_code' ? <Smartphone style={{ width: 20, height: 20 }} /> : <QrCode style={{ width: 20, height: 20 }} />}
                                    {connectionMode === 'pairing_code' ? 'Générer le code de liaison' : 'Générer le QR Code'}
                                </button>
                                <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {connectionMode === 'pairing_code' ? <Smartphone style={{ width: 40, height: 40, color: '#34d399' }} /> : <QrCode style={{ width: 40, height: 40, color: '#34d399' }} />}
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white', textAlign: 'center' }}>Connexion WhatsApp</h3>
                                <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
                                    {connectionMode === 'pairing_code' ? 'Générez un code de liaison pour connecter cet agent depuis ce même téléphone.' : 'Scannez le QR code avec WhatsApp pour connecter ce numéro à votre agent.'}
                                </p>
                            </>
                        )}

                        {whatsappStatus === 'connecting' && (
                            <>
                                <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#94a3b8' }}>{connectionMode === 'pairing_code' ? 'Génération du code de liaison...' : 'Démarrage du service WhatsApp...'}</p>
                                {countdown !== null && (
                                    <div style={{ fontSize: 13, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center' }}>
                                        {countdown > 0 ? `${countdown}s` : 'Prend plus de temps que prévu...'}
                                    </div>
                                )}
                                <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                            </>
                        )}

                        {whatsappStatus === 'qr_ready' && (qrCode || pairingCode) && (
                            <>
                                {qrCode ? (
                                    <>
                                        <div style={{ background: 'white', padding: 16, borderRadius: 16 }}>
                                            <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 250, height: 250 }} />
                                        </div>
                                        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Scannez avec WhatsApp (Appareils connectés)</p>
                                        <p style={{ color: '#64748b', textAlign: 'center', fontSize: 12, maxWidth: 280 }}>Le QR se renouvelle automatiquement toutes les ~20 s.</p>
                                    </>
                                ) : (
                                    <div style={{ width: '100%', maxWidth: 380, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.12)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
                                        <p style={{ color: '#a7f3d0', fontSize: 13, marginBottom: 8 }}>Code de liaison WhatsApp</p>
                                        <p style={{ color: 'white', fontSize: 30, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>{pairingCode}</p>
                                        <p style={{ color: '#d1fae5', fontSize: 12, lineHeight: 1.5 }}>Sur votre téléphone : WhatsApp &gt; Appareils connectés &gt; Connecter un appareil &gt; Entrer le code.</p>
                                    </div>
                                )}
                                {countdown !== null && (
                                    <div style={{ fontSize: 12, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center', marginTop: 4 }}>
                                        {countdown > 0 ? `Expiration dans ${countdown}s` : 'Essayez de régénérer'}
                                    </div>
                                )}
                                <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '7px 18px', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                            </>
                        )}

                        {whatsappStatus === 'error' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                                <div style={{ width: 80, height: 80, background: 'rgba(239,68,68,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertCircle style={{ width: 40, height: 40, color: '#f87171' }} />
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>Connexion interrompue</div>
                                <div style={{ maxWidth: 400, fontSize: 14, color: '#fca5a5' }}>{whatsappErrorMessage || QR_CONNECTION_ERROR_MESSAGE}</div>
                                <div style={{ maxWidth: 400, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(71,85,105,0.5)', background: 'rgba(30,41,59,0.6)', fontSize: 13, color: '#cbd5e1' }}>
                                    Si WhatsApp affiche &quot;Impossible de connecter l&apos;appareil&quot;, régénérez un nouveau QR code puis rescannez-le.
                                </div>
                                <button onClick={connectWhatsApp} disabled={!formData.is_active} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 15, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 12, cursor: 'pointer' }}>
                                    <RefreshCw style={{ width: 20, height: 20 }} /> {connectionMode === 'pairing_code' ? 'Régénérer un nouveau code' : 'Régénérer un nouveau QR code'}
                                </button>
                            </div>
                        )}

                        {whatsappStatus === 'connected' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                <div style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle2 style={{ width: 40, height: 40, color: '#34d399' }} />
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>Connecté !</div>
                                <div style={{ color: '#94a3b8' }}>{connectedPhone}</div>
                                <button onClick={disconnectWhatsApp} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', marginTop: 8 }}>Déconnecter</button>
                            </div>
                        )}
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
                        {!isExternalSync && (
                            <Link
                                href={`/dashboard/agents/${agentId}/knowledge?from=whatsapp`}
                                className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
                            >
                                <BookOpen size={16} />
                                Base de connaissance
                            </Link>
                        )}
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

                        {STEPS
                            .map((step, index) => ({ ...step, originalIndex: index }))
                            .filter(step => !isExternalSync || !['hours', 'personality', 'rules'].includes(step.id))
                            .map((step) => {
                            const isActive = step.originalIndex === currentStep
                            const isCompleted = step.originalIndex < currentStep
                            return (
                                <button
                                    key={step.id}
                                    onClick={async () => {
                                        // Block navigation if rules conflict
                                        if (STEPS[currentStep].id === 'rules' && formData.custom_rules.length > 5 && conflictStatus !== 'safe') {
                                            toast.warning("Vérifiez la cohérence de vos règles (Cliquez sur 'Vérifier') avant de quitter cette étape.")
                                            return
                                        }
                                        if (isDirty) {
                                            const save = await toast.confirm({ title: 'Modifications non sauvegardées', message: 'Sauvegarder avant de continuer ?', confirmLabel: 'Sauvegarder', cancelLabel: 'Ignorer' })
                                            if (save) await handleSave(true)
                                            else setIsDirty(false)
                                        }
                                        setCurrentStep(step.originalIndex)
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
            <div className="max-w-3xl mx-auto px-4 py-6 pb-52">
                {renderStep()}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button
                        onClick={async () => {
                            if (isDirty) {
                                const save = await toast.confirm({ title: 'Modifications non sauvegardées', message: 'Sauvegarder avant de continuer ?', confirmLabel: 'Sauvegarder', cancelLabel: 'Ignorer' })
                                if (save) await handleSave(true)
                                else setIsDirty(false)
                            }
                            setCurrentStep(prev => getPrevStep(prev))
                        }}
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
                                    toast.warning("Vérifiez la cohérence de vos règles (Cliquez sur 'Vérifier') avant de continuer.")
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
                                    toast.warning("Vérifiez la cohérence des règles avant de terminer.")
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
