'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bot,
    ArrowLeft,
    Sparkles,
    Settings,
    Loader2,
    Smartphone,
    CheckCircle2,
    Save,
    Clock,
    Shield,
    Phone,
    ChevronRight,
    ChevronLeft,
    BookOpen,
    Users,
    CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import { GA } from '@/lib/analytics'
import {
    type AgentPaymentMode,
    normalizeAgentPaymentMode,
} from '@/lib/payments/payment-mode-display'
import type { AgentFormData } from './types'
import { QR_CONNECTION_ERROR_MESSAGE } from './constants'
import { StepInfo } from './components/StepInfo'
import { StepHours } from './components/StepHours'
import { StepMission } from './components/StepMission'
import { StepPersonality } from './components/StepPersonality'
import { StepRules } from './components/StepRules'
import { StepSettings } from './components/StepSettings'
import { StepPayment } from './components/StepPayment'
import { StepWhatsapp } from './components/StepWhatsapp'

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
    { id: 'payment', title: 'Paiement', icon: CreditCard },
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
    const stepTopRef = useRef<HTMLDivElement>(null)
    const [highlightEscalation, setHighlightEscalation] = useState(false)
    const [selectedMission, setSelectedMission] = useState('')
    const [isExternalSync, setIsExternalSync] = useState(false)
    const isSupportClient = selectedMission === 'support_client' || selectedMission === 'services'
    const isPhysicalProduct = selectedMission === 'ecommerce_physical'

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

    // Remonte en haut de l'étape à chaque changement — sans ça, on garde la
    // position de scroll de l'étape précédente et le début de l'étape suivante
    // reste hors écran.
    useEffect(() => {
        stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [currentStep])

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
    const [slowConnectionHint, setSlowConnectionHint] = useState(false)

    useEffect(() => {
        if (countdown === null || countdown <= 0) return
        const t = setTimeout(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : c)), 1000)
        return () => clearTimeout(t)
    }, [countdown])

    // Après ~25s sans code/QR, signaler que ça peut être un incident WhatsApp
    // ponctuel plutôt que de laisser le spinner tourner sans explication.
    useEffect(() => {
        if (whatsappStatus !== 'connecting') {
            setSlowConnectionHint(false)
            return
        }
        const t = setTimeout(() => setSlowConnectionHint(true), 25000)
        return () => clearTimeout(t)
    }, [whatsappStatus])

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
    const [formData, setFormData] = useState<AgentFormData>({
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
        delivery_fee_mode: 'none' as 'none' | 'free' | 'zones',
        delivery_zones: { communes: [], hors_abidjan: [], international: [] } as import('./types').DeliveryZonesConfig,
        escalation_phone: '',  // Phone number to display when escalating to human
        agent_context: '',
        welcome_message: '',
        // Leads
        lead_collection_enabled: false,
        lead_custom_fields: [] as string[],
        lead_redirect_message: '',
        lead_collect_fields: ['name', 'phone'] as string[],
        conversation_mode: 'structured',
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

            // Populate Form — reset init flag so the next formData change doesn't falsely mark dirty
            isInitializedRef.current = false
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
                delivery_fee_mode: agent.delivery_fee_mode || 'none',
                delivery_zones: agent.delivery_zones ? {
                    communes: agent.delivery_zones.communes || [],
                    // Ancien format (objet {fee,note}) -> liste vide : ces valeurs n'ont pas de nom exploitable.
                    hors_abidjan: Array.isArray(agent.delivery_zones.hors_abidjan) ? agent.delivery_zones.hors_abidjan : [],
                    international: Array.isArray(agent.delivery_zones.international) ? agent.delivery_zones.international : [],
                } : { communes: [], hors_abidjan: [], international: [] },
                escalation_phone: agent.escalation_phone || '',
                agent_context: agent.agent_context || '',
                welcome_message: agent.welcome_message || '',
                lead_collection_enabled: agent.lead_collection_enabled ?? false,
                lead_redirect_message: agent.lead_redirect_message || '',
                lead_collect_fields: Array.isArray(agent.lead_collect_fields) ? agent.lead_collect_fields : ['name', 'phone'],
                lead_custom_fields: Array.isArray(agent.lead_custom_fields) ? agent.lead_custom_fields : [],
                conversation_mode: agent.conversation_mode || 'structured',
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
            if (agent.mission === 'ecommerce_physical') {
                setSelectedMission('ecommerce_physical')
            }

            setLoading(false)
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    // Redirection après connexion WhatsApp selon type d'agent
    const redirectAfterWhatsappConnect = () => {
        if (isExternalSync) {
            router.push('/dashboard/developers')
        } else if (selectedMission === 'support_client') {
            router.push(`/dashboard/agents/${agentId}/knowledge`)
        } else {
            router.push('/dashboard/products')
        }
    }

    // Navigation helpers
    // STEPS: 0=info, 1=hours, 2=personality, 3=rules, 4=settings, 5=payment, 6=whatsapp
    const getNextStep = (from: number) => {
        if (isExternalSync && from === 0) return 4 // skip hours(1), personality(2), rules(3)
        if (isExternalSync && from === 4) return 6 // skip payment(5), sans objet en sync externe
        if (isSupportClient && from === 0) return 2 // skip hours (index 1)
        return Math.min(STEPS.length - 1, from + 1)
    }
    const getPrevStep = (from: number) => {
        if (isExternalSync && from === 4) return 0 // skip rules(3), personality(2), hours(1)
        if (isExternalSync && from === 6) return 4 // skip back par-dessus payment(5)
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
                redirectAfterWhatsappConnect()
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
                    GA.whatsappConnected(connectionMode)
                    clearInterval(interval)
                    redirectAfterWhatsappConnect()
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
                return (
                    <StepInfo formData={formData} setFormData={setFormData} toast={toast} highlightEscalation={highlightEscalation} setHighlightEscalation={setHighlightEscalation} />
                )

            case 'hours':
                return (
                    <StepHours formData={formData} setFormData={setFormData} isSupportClient={isSupportClient} />
                )

            case 'mission':
                return (
                    <StepMission formData={formData} setFormData={setFormData} toast={toast} setSelectedMission={setSelectedMission} isSupportClient={isSupportClient} />
                )

            case 'personality':
                return (
                    <StepPersonality formData={formData} setFormData={setFormData} isSupportClient={isSupportClient} />
                )

            case 'rules':
                return (
                    <StepRules formData={formData} setFormData={setFormData} isSupportClient={isSupportClient} conflictStatus={conflictStatus} setConflictStatus={setConflictStatus} conflictReason={conflictReason} checkConflict={checkConflict} />
                )

            case 'settings':
                return (
                    <StepSettings formData={formData} setFormData={setFormData} isSupportClient={isSupportClient || formData.conversation_mode === 'lead_only'} isExternalSync={isExternalSync} isPhysicalProduct={isPhysicalProduct} />
                )

            case 'payment':
                return (
                    <StepPayment formData={formData} setFormData={setFormData} isSupportClient={isSupportClient} />
                )

            case 'whatsapp':
                return (
                    <StepWhatsapp
                        formData={formData}
                        whatsappStatus={whatsappStatus}
                        connectionMode={connectionMode}
                        setConnectionMode={setConnectionMode}
                        pairingPhone={pairingPhone}
                        setPairingPhone={setPairingPhone}
                        connectWhatsApp={connectWhatsApp}
                        countdown={countdown}
                        cancelConnection={cancelConnection}
                        qrCode={qrCode}
                        pairingCode={pairingCode}
                        whatsappErrorMessage={whatsappErrorMessage}
                        connectedPhone={connectedPhone}
                        disconnectWhatsApp={disconnectWhatsApp}
                        slowConnectionHint={slowConnectionHint}
                    />
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
                            .filter(step => !isExternalSync || !['hours', 'personality', 'rules', 'payment'].includes(step.id))
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
            <div ref={stepTopRef} className="max-w-3xl mx-auto px-4 py-6 pb-52 scroll-mt-40">
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
