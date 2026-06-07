'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUpgradeModal } from '@/contexts/UpgradeModalContext'
import { motion } from 'framer-motion'
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
    Copy
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import { GA } from '@/lib/analytics'
import { Clock, Shield, MapPin, Globe } from 'lucide-react'
import {
    type AgentPaymentMode,
    AUTOMATIC_PAYMENT_MODE_DESCRIPTION,
    AUTOMATIC_PAYMENT_MODE_HINT,
    AUTOMATIC_PAYMENT_MODE_LABEL,
    MANUAL_PAYMENT_METHODS_LABEL,
    MANUAL_PAYMENT_MODE_DESCRIPTION,
    MANUAL_PAYMENT_MODE_HINT,
    MANUAL_PAYMENT_MODE_LABEL,
} from '@/lib/payments/payment-mode-display'

const QR_CONNECTION_ERROR_MESSAGE = 'Le scan a echoue avant la fin de la connexion. Generez un nouveau QR code puis rescanez depuis WhatsApp.'

function isValidEscalationPhone(value: string): boolean {
    return /^\+\d{6,15}$/.test((value || '').trim())
}

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

export default function NewAgentPage() {
    const t = useTranslations('Agents')
    const tCommon = useTranslations('Agents.connect') // specialized namespace if needed or just access via t('connect...')
    const router = useRouter()
    const { openUpgradeModal } = useUpgradeModal()
    const toast = useToast()
    const [currentStep, setCurrentStep] = useState(0)
    const [isCompact, setIsCompact] = useState(false)
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createdAgent, setCreatedAgent] = useState<any>(null)
    const [showSupportModal, setShowSupportModal] = useState(false)
    const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})
    const [apiAccessEnabled, setApiAccessEnabled] = useState(false)
    const [agentType, setAgentType] = useState<'' | 'conversationnel' | 'api'>('')

    useEffect(() => {
        fetch('/api/features')
            .then(r => r.json())
            .then(d => { if (d.data?.flags) setFeatureFlags(d.data.flags) })
            .catch(() => {}) // fallback : tout activé par défaut (featureFlags vide = aucune restriction)
    }, [])

    const pairingCodeShownRef = useRef(false)

    // WhatsApp connection state
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [pairingCode, setPairingCode] = useState<string | null>(null)
    const [connectionMode, setConnectionMode] = useState<'qr' | 'pairing_code'>('qr')
    const [pairingPhone, setPairingPhone] = useState('')
    const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'>('idle')
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null)
    const [retryWithFreshQr, setRetryWithFreshQr] = useState(false)
    const [countdown, setCountdown] = useState<number | null>(null)

    useEffect(() => {
        if (countdown === null || countdown <= 0) {
            if (countdown === 0 && connectionMode === 'pairing_code') {
                // Code expiré : reset propre pour permettre la regénération
                setPairingCode(null)
                setWhatsappStatus('idle')
                setRetryWithFreshQr(true)
                pairingCodeShownRef.current = false
            }
            return
        }
        const t = setTimeout(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : c)), 1000)
        return () => clearTimeout(t)
    }, [countdown, connectionMode])

    useEffect(() => {
        const checkViewport = () => setIsCompact(window.innerWidth < 768)
        checkViewport()
        window.addEventListener('resize', checkViewport)
        return () => window.removeEventListener('resize', checkViewport)
    }, [])

    // Redirect to billing if agent limit is already reached
    useEffect(() => {
        const checkLimit = async () => {
            try {
                const res = await fetch('/api/profile')
                const data = await res.json()
                const plan = data.data?.profile?.plan || 'free'
                setApiAccessEnabled(data.data?.profile?.api_access_enabled === true)
                const limits: Record<string, number> = { free: 1, starter: 1, pro: 3, business: 6, scale: -1 }
                const limit = limits[plan] ?? 1
                if (limit === -1) return // unlimited

                const agentsRes = await fetch('/api/agents')
                const agentsData = await agentsRes.json()
                const count = agentsData.data?.agents?.length ?? 0
                if (count >= limit) {
                    openUpgradeModal('agent_limit')
                    router.replace('/dashboard/agents')
                }
            } catch {
                // Non-critical — let user proceed if check fails
            }
        }
        checkLimit()
    }, [])

    // Conflict Detection State
    const [conflictStatus, setConflictStatus] = useState<'idle' | 'checking' | 'safe' | 'conflict' | 'error'>('idle')
    const [conflictReason, setConflictReason] = useState('')

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        mission: '',
        ecommerce_mode: 'native' as 'native' | 'external_sync',
        systemPrompt: '',
        personality: 'friendly',
        useEmojis: true,
        responseDelay: 2,
        language: 'fr',
        enableVoice: false,
        voiceId: 'alloy',
        // NEW FIELDS
        is_online_only: false,
        business_address: '',
        // contact_phone removed
        escalation_phone: '',
        site_url: '',
        latitude: '',
        longitude: '',
        custom_rules: '',
        business_hours: {
            monday: { open: '09:00', close: '18:00', closed: false },
            tuesday: { open: '09:00', close: '18:00', closed: false },
            wednesday: { open: '09:00', close: '18:00', closed: false },
            thursday: { open: '09:00', close: '18:00', closed: false },
            friday: { open: '09:00', close: '18:00', closed: false },
            saturday: { open: '10:00', close: '16:00', closed: false },
            sunday: { open: '00:00', close: '00:00', closed: true }
        },
        // PAYMENT SETTINGS
        payment_mode: 'cinetpay' as AgentPaymentMode,
        mobile_money_orange: '',
        mobile_money_mtn: '',
        mobile_money_wave: '',
        custom_payment_methods: [] as { name: string; details: string }[],
        restaurant_deposit_enabled: false,
        restaurant_deposit_mode: 'percentage' as 'percentage' | 'fixed',
        restaurant_deposit_percentage: 30,
        restaurant_deposit_fixed_amount_fcfa: 0,
        agent_context: '',
        welcome_message: '',
        // LEADS
        lead_collection_enabled: false,
        lead_redirect_message: '',
        lead_collect_fields: ['name', 'phone'] as string[],
        // SUPPORT
        fallback_contact_message: '',
        live_query_url: '',
        live_query_secret: '',
        // Agent API (external_sync)
        external_sync_reply_message: ''
    })

    const steps = [
        { id: 'mission', title: "Type d'agent", icon: Target },
        { id: 'info', title: t('Wizard.steps.info'), icon: Bot },
        { id: 'hours', title: 'Horaires', icon: Clock },
        { id: 'personality', title: t('Wizard.steps.personality'), icon: Sparkles },
        { id: 'rules', title: 'Règles', icon: Shield },
        { id: 'settings', title: t('Wizard.steps.settings'), icon: Settings },
        { id: 'whatsapp', title: t('Wizard.steps.whatsapp'), icon: Smartphone },
    ]

    const isSupportClient = formData.mission === 'support_client'
    const isExternalSync = formData.mission === 'ecommerce' && formData.ecommerce_mode === 'external_sync'

    const missionTemplates = [
        {
            id: 'support_client',
            title: 'Support Client',
            description: 'Répond aux questions de vos clients via une base de connaissances. Pour coachs, formateurs, experts, consultants, écoles et prestataires de services.',
            prompt: `Tu es l'assistant de ${'{name}'}.
Ton rôle est de répondre aux questions des clients en te basant uniquement sur les informations que tu connais.
Ne jamais inventer d'information. Si tu ne sais pas, collecte le contact du client et indique qu'un responsable le recontactera.`,
        },
        {
            id: 'ecommerce',
            title: t('Templates.ecommerce.title'),
            description: 'Vend vos produits sur WhatsApp, prend les commandes et gère votre catalogue en ligne. Pour boutiques, commerces et dropshipping.',
            prompt: `Tu es l'assistant commercial de notre boutique en ligne.

Ton rôle:
- Accueillir les clients et répondre à leurs questions
- Présenter les produits disponibles (voir liste des produits)
- Aider à choisir les bons produits selon leurs besoins
- Finaliser les commandes en respectant le type de produit vendu

Pour commander, tu dois toujours collecter:
1. Le(s) produit(s) souhaité(s) et quantités
2. Nom complet du client
3. Numéro de téléphone

Compléments selon le type de produit:
- Produit numérique : demander l'adresse email, jamais d'adresse de livraison physique
- Produit physique : demander l'adresse de livraison
- Paiement : suivre le mode prévu par le système et ne jamais promettre cash à la livraison pour un produit numérique

Règles:
- Sois courtois et serviable
- Propose toujours des produits complémentaires
- Confirme le total avant de valider la commande
- N'invente jamais un mode de livraison ou de paiement contraire au catalogue`,
        },
        {
            id: 'services',
            title: '🔧 Services / Artisan',
            description: 'Présente vos prestations, capte les demandes de devis et qualifie vos prospects. Pour artisans, techniciens, prestataires et indépendants.',
            prompt: `Tu es l'assistant de ${'{name}'}.

Ton rôle:
- Répondre aux questions sur nos services, tarifs et disponibilités
- Comprendre le besoin du client avant de proposer une intervention
- Collecter les informations nécessaires pour un devis ou une intervention
- Informer sur les délais et zones d'intervention

Pour une demande d'intervention ou de devis, collecte:
1. Nature du problème ou service demandé
2. Adresse ou zone géographique
3. Disponibilités du client
4. Nom et numéro de téléphone

Règles:
- Base-toi uniquement sur les informations que tu connais (tarifs, services, zones)
- Ne jamais inventer un prix ou une disponibilité
- Si la demande sort de tes compétences, collecte le contact et indique qu'un responsable rappellera
- Sois direct, professionnel et rassurant`,
        },
        {
            id: 'restaurant',
            title: t('Templates.restaurant.title'),
            description: 'Prend les commandes en ligne ou à livraison, gère les réservations de tables et présente votre menu en temps réel.',
            prompt: `Tu es l'assistant de notre restaurant.

Ton rôle:
- Présenter le menu et les plats du jour
- Prendre les commandes (sur place ou livraison)
- Gérer les réservations de tables
- Informer sur les allergènes et ingrédients

Pour une commande livraison, collecte:
1. Les plats et quantités
2. Adresse de livraison
3. Heure souhaitée
4. Numéro de téléphone

Pour une réservation:
1. Date et heure
2. Nombre de personnes
3. Nom de la réservation
4. Préférences (terrasse, salle, etc.)

Règles:
- Propose toujours des accompagnements et boissons
- Précise les temps de préparation
- Confirme le total de la commande`,
        },
        {
            id: 'hotel',
            title: t('Templates.hotel.title'),
            description: 'Renseigne sur les chambres et tarifs, effectue des réservations et informe sur vos services hôteliers.',
            prompt: `Tu es le concierge virtuel de notre hôtel.

Ton rôle:
- Renseigner sur les types de chambres et tarifs
- Effectuer des réservations
- Informer sur les services (restaurant, spa, piscine)
- Répondre aux questions des clients

Pour une réservation, collecte:
99. Dates d'arrivée et de départ
100. Type de chambre souhaité
101. Nombre d'adultes et d'enfants
102. Préférences (vue, étage, lit king, etc.)
103. Nom complet et téléphone
104. Heure d'arrivée approximative

Règles:
- Propose des surclassements si disponibles
- Mentionne les services inclus (petit-déjeuner, wifi, parking)
- Confirme le tarif total et les conditions d'annulation
- Sois accueillant et professionnel`,
        },
        {
            id: 'salon',
            title: t('Templates.salon.title'),
            description: 'Présente vos prestations beauté, prend les rendez-vous et gère votre planning. Pour salons de coiffure, esthétique et bien-être.',
            prompt: `Tu es l'assistant de notre salon de beauté/coiffure.

Ton rôle:
- Présenter nos services et tarifs
- Prendre les rendez-vous
- Conseiller sur les soins adaptés
- Gérer les annulations et modifications

Pour un rendez-vous, collecte:
1. Le(s) service(s) souhaité(s)
2. Date et heure préférées
3. Coiffeur/esthéticien préféré (si applicable)
4. Nom et numéro de téléphone

Règles:
- Indique la durée estimée des prestations
- Propose des services complémentaires
- Rappelle les consignes (arriver 10 min avant, etc.)
- Confirme le rendez-vous et le tarif estimé`,
        },
    ]

    const getMissionPrompt = (
        templateId: string,
        ecommerceMode: 'native' | 'external_sync' = formData.ecommerce_mode
    ) => {
        const basePrompt = missionTemplates.find(template => template.id === templateId)?.prompt || ''
        if (templateId !== 'ecommerce' || ecommerceMode !== 'external_sync') {
            return basePrompt
        }

        return `Tu es l'assistant commercial de notre boutique connectee a une plateforme externe.

Ton role:
- Accueillir les clients et repondre a leurs questions
- Presenter les produits connus via les donnees synchronisees
- Aider le client a choisir selon ses besoins
- Rediriger l'achat vers la plateforme externe lorsque le client veut commander

Regles:
- N'invente jamais un produit, un stock ou un prix
- Utilise les donnees synchronisees comme source principale
- N'ouvre jamais un panier ou un checkout natif WazzapAI
- Si l'information manque, dis que la verification est en cours ou redirige vers le SAV
- Si le client veut payer ou finaliser une commande, oriente-le vers la plateforme externe`
    }

    const personalities = [
        { id: 'professional', name: t('Form.personality.types.professional'), emoji: '👔', description: t('Form.personality.types.professional') },
        { id: 'friendly', name: t('Form.personality.types.friendly'), emoji: '😊', description: t('Form.personality.types.friendly') },
        { id: 'casual', name: t('Form.personality.types.casual'), emoji: '🤙', description: t('Form.personality.types.casual') },
        { id: 'formal', name: t('Form.personality.types.formal'), emoji: '🎩', description: t('Form.personality.types.formal') },
    ]

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const selectMissionTemplate = (template: typeof missionTemplates[0]) => {
        const nextEcommerceMode = template.id === 'ecommerce' ? formData.ecommerce_mode : 'native'
        const autoLeads = template.id === 'support_client' || template.id === 'services'
        setFormData(prev => ({
            ...prev,
            mission: template.id,
            ecommerce_mode: nextEcommerceMode,
            // Always force the secure template prompt, no manual override allowed
            systemPrompt: getMissionPrompt(template.id, nextEcommerceMode),
            // Auto-enable lead collection for KB-based missions
            lead_collection_enabled: autoLeads ? true : prev.lead_collection_enabled,
            lead_collect_fields: autoLeads && (!prev.lead_collect_fields || prev.lead_collect_fields.length === 0)
                ? ['name', 'phone']
                : prev.lead_collect_fields,
        }))
        // Auto-advance to step 1 on mission selection
        setCurrentStep(1)
    }

    const setEcommerceMode = (mode: 'native' | 'external_sync') => {
        setFormData(prev => ({
            ...prev,
            ecommerce_mode: mode,
            systemPrompt: prev.mission === 'ecommerce'
                ? getMissionPrompt('ecommerce', mode)
                : prev.systemPrompt
        }))
    }

    const canProceed = () => {
        switch (currentStep) {
            case 0:
                if (agentType === 'api') return formData.name.trim() !== '' && isValidEscalationPhone(formData.escalation_phone) && formData.external_sync_reply_message.trim() !== ''
                return agentType === 'conversationnel' && formData.mission !== ''
            case 1: // Info
                return formData.name.trim() !== '' && isValidEscalationPhone(formData.escalation_phone)
            case 2: // Hours
                return true
            case 3: // Personality
                return formData.personality !== ''
            case 4: // Rules
                return conflictStatus !== 'conflict'
            case 5: // Settings
                if (isExternalSync) return formData.external_sync_reply_message.trim() !== ''
                return true
            case 6: // WhatsApp
                return true
            default:
                return false
        }
    }

    // Calcul du prochain/précédent step en tenant compte des skips Support Client
    const getNextStep = (from: number) => {
        // Agent API : step 0 → WhatsApp directement (champs déjà dans step 0)
        if (isExternalSync && from === 0) return 6
        // Agent API : skip Horaires (2), Personnalité (3), Règles (4)
        if (isExternalSync && from === 1) return 5
        // Support Client : skip step 2 (Horaires)
        if (isSupportClient && from === 1) return 3
        return Math.min(steps.length - 1, from + 1)
    }

    const getPrevStep = (from: number) => {
        // Agent API : WhatsApp → step 0 directement
        if (isExternalSync && from === 6) return 0
        // Agent API : skip back par-dessus Horaires, Personnalité, Règles
        if (isExternalSync && from === 5) return 1
        // Support Client : skip step 2 (Horaires)
        if (isSupportClient && from === 3) return 1
        return Math.max(0, from - 1)
    }

    // AI Generation
    const handleGenerate = async () => {
        if (!formData.name) {
            toast.error("Nom requis")
            return
        }
        setGenerating(true)
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'agent_description',
                    name: formData.name,
                    context: missionTemplates.find(t => t.id === formData.mission)?.title || formData.mission
                })
            })
            const data = await res.json()
            if (res.ok && data.data?.text) {
                updateFormData('description', data.data.text)
            } else {
                toast.error(data.error || 'Erreur de génération')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setGenerating(false)
        }
    }

    // GPS Helper with better error handling
    const [gpsLoading, setGpsLoading] = useState(false)

    const getLocation = () => {
        if (!navigator.geolocation) {
            toast.error("La géolocalisation n'est pas supportée par votre navigateur")
            return
        }

        setGpsLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toString(),
                    longitude: pos.coords.longitude.toString()
                }))
                setGpsLoading(false)
            },
            (err) => {
                setGpsLoading(false)
                let msg = "Impossible de récupérer la position."
                let action = ""
                switch (err.code) {
                    case 1:
                        msg = "Accès refusé."
                        action = "\n\n💡 Conseil: Cliquez sur l'icône de cadenas dans la barre d'adresse, puis autorisez 'Localisation'."
                        break
                    case 2:
                        msg = "Position indisponible (vérifiez votre connexion ou GPS)."
                        break
                    case 3:
                        msg = "Délai d'attente dépassé. Réessayez."
                        break
                }
                toast.error(`Erreur GPS: ${msg}${action}`)
            },
            {
                enableHighAccuracy: false, // Lower accuracy for faster response
                timeout: 10000, // 10 seconds
                maximumAge: 60000 // Accept cached position up to 1 minute old
            }
        )
    }

    // Conflict Check Helper
    const checkConflict = async () => {
        if (!formData.custom_rules || formData.custom_rules.length < 10) return
        setConflictStatus('checking')
        try {
            const res = await fetch('/api/internal/analyze-conflict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structured_data: {
                        address: formData.business_address,
                        hours: formData.business_hours,
                        phone: formData.escalation_phone,
                        location: (formData.latitude && formData.longitude)
                            ? `${formData.latitude}, ${formData.longitude}`
                            : 'Non défini'
                    },
                    custom_rules_text: formData.custom_rules
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

    // Create agent via API - with duplicate prevention
    const handleCreateAgent = async () => {
        // Prevent duplicate clicks
        if (loading || createdAgent) {
            if (createdAgent) {
                setCurrentStep(6) // Just move to WhatsApp step
            }
            return
        }

        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    system_prompt: formData.systemPrompt,
                    personality: formData.personality,
                    use_emojis: formData.useEmojis,
                    response_delay_seconds: formData.responseDelay,
                    language: formData.language,
                    enable_voice_responses: formData.enableVoice,
                    voice_id: formData.voiceId,
                    // New Fields
                    is_online_only: formData.is_online_only,
                    business_address: formData.business_address,
                    // contact_phone removed
                    escalation_phone: formData.escalation_phone,
                    site_url: formData.site_url,
                    latitude: parseFloat(formData.latitude) || null,
                    longitude: parseFloat(formData.longitude) || null,
                    business_hours: formData.business_hours,
                    custom_rules: formData.custom_rules,
                    ecommerce_mode: formData.ecommerce_mode,
                    // Payment Settings
                    payment_mode: formData.payment_mode,
                    mobile_money_orange: formData.mobile_money_orange || null,
                    mobile_money_mtn: formData.mobile_money_mtn || null,
                    mobile_money_wave: formData.mobile_money_wave || null,
                    custom_payment_methods: formData.custom_payment_methods || [],
                    restaurant_deposit_enabled: formData.restaurant_deposit_enabled,
                    restaurant_deposit_mode: formData.restaurant_deposit_mode,
                    restaurant_deposit_percentage: formData.restaurant_deposit_enabled
                        ? formData.restaurant_deposit_percentage
                        : 0,
                    restaurant_deposit_fixed_amount_fcfa: formData.restaurant_deposit_enabled
                        ? formData.restaurant_deposit_fixed_amount_fcfa
                        : 0,
                    agent_context: formData.agent_context || null,
                    welcome_message: formData.welcome_message || null,
                    // Leads
                    lead_collection_enabled: formData.lead_collection_enabled,
                    lead_redirect_message: formData.lead_redirect_message || null,
                    lead_collect_fields: formData.lead_collect_fields,
                    fallback_contact_message: formData.fallback_contact_message || null,
                    live_query_url: formData.live_query_url || null,
                    live_query_secret: formData.live_query_secret || null,
                    external_sync_reply_message: formData.external_sync_reply_message || null,
                    mission: formData.mission || null,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création')
            }

            // FIX: Handle multiple possible response structures
            // API returns { data: { agent: {...} } } via successResponse
            // But sometimes might return { agent: {...} } or just {...}
            let agent = null
            if (data.data?.agent) {
                agent = data.data.agent
            } else if (data.agent) {
                agent = data.agent
            } else if (data.data && typeof data.data === 'object' && data.data.id) {
                // In case the agent is returned directly as data.data
                agent = data.data
            } else if (data.id) {
                // In case the agent is returned at root level
                agent = data
            }

            if (!agent || !agent.id) {
                console.error('[ERROR] Agent extraction failed. Full response:', data)
                throw new Error('Agent non retourné correctement par le serveur')
            }

            setCreatedAgent(agent)
            GA.agentCreated(agentType === 'api' ? 'api' : formData.mission, agentType)
            setCurrentStep(6) // Move to WhatsApp step
        } catch (err) {
            console.error('[ERROR] Agent creation error:', err)
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    // Connect WhatsApp
    const connectWhatsApp = async () => {
        // Prevent double-calls: block if already in progress
        if (whatsappStatus === 'connecting') return
        // En mode pairing_code, autoriser la regénération depuis qr_ready
        if (whatsappStatus === 'qr_ready' && connectionMode !== 'pairing_code') return

        if (!createdAgent) {
            setError(t('connect.errors.noAgent'))
            return
        }

        const normalizedPairingPhone = connectionMode === 'pairing_code'
            ? normalizePairingPhoneInput(pairingPhone)
            : null

        if (connectionMode === 'pairing_code' && !normalizedPairingPhone) {
            setError('Entrez un numero mobile valide avec indicatif pays (ex: +2250700000000).')
            return
        }

        const shouldForceFreshQr = retryWithFreshQr || whatsappStatus === 'error' || connectionMode === 'pairing_code'
        setWhatsappStatus('connecting')
        setCountdown(null)
        setQrCode(null)
        setPairingCode(null)
        setError(null)
        pairingCodeShownRef.current = false

        try {
            // Step 1: Initiate connection
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: createdAgent.id,
                    forceFreshQr: shouldForceFreshQr,
                    connectionMode,
                    pairingPhone: normalizedPairingPhone
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || t('connect.error'))
            }

            // If already connected
            if (data.data?.status === 'connected') {
                setWhatsappStatus('connected')
                setConnectedPhone(data.data.phoneNumber || '')
                setCountdown(null)
                setRetryWithFreshQr(false)
                if (formData.mission === 'support_client') setShowSupportModal(true)
                return
            }

            // Step 2: Poll for QR code and connection
            const pollForQR = async (attempts = 0): Promise<void> => {
                // 60 tentatives * 3 secondes = 3 minutes max
                if (attempts >= 60) throw new Error('Délai d\'attente dépassé')
                await new Promise(resolve => setTimeout(resolve, 3000))
                const statusRes = await fetch(`/api/whatsapp/connect?agentId=${createdAgent.id}`)
                const statusData = await statusRes.json()

                if (!statusRes.ok) {
                    throw new Error(statusData.error || 'Erreur de communication')
                }

                const status = statusData.data?.status || statusData.status
                const phoneNumber = statusData.data?.phoneNumber || statusData.phoneNumber
                const newQrCode = statusData.data?.qrCode || statusData.qrCode
                const newPairingCode = statusData.data?.pairingCode || statusData.pairingCode

                if (status === 'connected') {
                    setWhatsappStatus('connected')
                    setConnectedPhone(phoneNumber || '')
                    setQrCode(null)
                    setPairingCode(null)
                    setCountdown(null)
                    setRetryWithFreshQr(false)
                    if (formData.mission === 'support_client') setShowSupportModal(true)
                    return
                } else if (status === 'error' || status === 'disconnected' || status === 'reconnect_required') {
                    throw new Error(QR_CONNECTION_ERROR_MESSAGE)
                } else if (newPairingCode) {
                    if (!pairingCodeShownRef.current) {
                        pairingCodeShownRef.current = true
                        setCountdown(180)
                    }
                    setPairingCode(newPairingCode)
                    setQrCode(null)
                    setWhatsappStatus('qr_ready')
                    setRetryWithFreshQr(false)
                    return pollForQR(attempts + 1)
                } else if (newQrCode) {
                    setQrCode(newQrCode)
                    setPairingCode(null)
                    setWhatsappStatus('qr_ready')
                    setRetryWithFreshQr(false)
                    // Continuer le polling même si on a le QR code, pour détecter le scan
                    return pollForQR(attempts + 1)
                } else {
                    return pollForQR(attempts + 1)
                }
            }
            await pollForQR()
        } catch (err) {
            setError((err as Error).message)
            setWhatsappStatus('error')
            setCountdown(null)
            setQrCode(null)
            setPairingCode(null)
            setRetryWithFreshQr(true)
        }
    }

    const cancelConnection = async () => {
        setWhatsappStatus('idle')
        setCountdown(null)
        setQrCode(null)
        setPairingCode(null)
        if (createdAgent) {
            try { await fetch(`/api/whatsapp/connect?agentId=${createdAgent.id}&logout=true`, { method: 'DELETE' }) } catch {}
        }
    }

    // Le polling est désormais géré entièrement par pollForQR() pour éviter les conflits d'état React

    const goToKnowledgeBase = () => {
        if (!createdAgent?.id) return
        router.push(`/dashboard/agents/${createdAgent.id}/knowledge?from=whatsapp`)
    }

    const handleFinish = () => {
        if (isSupportClient && createdAgent?.id) {
            goToKnowledgeBase()
            return
        }

        router.push('/dashboard/agents')
    }

    const cardStyle = {
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 16,
        padding: 24
    }

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        fontSize: 15,
        color: 'white',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 12,
        outline: 'none'
    }

    const buttonPrimaryStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        fontSize: 15,
        fontWeight: 600,
        color: 'white',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer'
    }

    const buttonSecondaryStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        fontSize: 15,
        fontWeight: 500,
        color: '#94a3b8',
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 12,
        cursor: 'pointer'
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // TYPE D'AGENT
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Choix du type */}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                Quel type d&apos;agent souhaitez-vous créer ?
                            </label>
                            <div className="agent-grid-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAgentType('conversationnel')
                                        setFormData(prev => ({ ...prev, mission: '', ecommerce_mode: 'native' }))
                                    }}
                                    style={{
                                        padding: 20,
                                        border: `2px solid ${agentType === 'conversationnel' ? '#10b981' : 'rgba(148, 163, 184, 0.1)'}`,
                                        borderRadius: 12,
                                        textAlign: 'left',
                                        background: agentType === 'conversationnel' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <h3 style={{ fontWeight: 600, color: 'white', marginBottom: 6 }}>Agent Conversationnel</h3>
                                    <p style={{ fontSize: 13, color: '#94a3b8' }}>
                                        Votre IA répond à vos clients sur WhatsApp 24h/24 — prend des commandes, répond aux questions, capture des leads. Choisissez votre secteur à l&apos;étape suivante.
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!apiAccessEnabled) return
                                        setAgentType('api')
                                        setFormData(prev => ({
                                            ...prev,
                                            mission: 'ecommerce',
                                            ecommerce_mode: 'external_sync',
                                            systemPrompt: getMissionPrompt('ecommerce', 'external_sync')
                                        }))
                                    }}
                                    disabled={!apiAccessEnabled}
                                    title={!apiAccessEnabled ? 'Nécessite un abonnement API' : undefined}
                                    style={{
                                        padding: 20,
                                        border: `2px solid ${!apiAccessEnabled ? 'rgba(148, 163, 184, 0.08)' : agentType === 'api' ? '#0ea5e9' : 'rgba(148, 163, 184, 0.1)'}`,
                                        borderRadius: 12,
                                        textAlign: 'left',
                                        background: !apiAccessEnabled ? 'rgba(255,255,255,0.02)' : agentType === 'api' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                                        cursor: apiAccessEnabled ? 'pointer' : 'not-allowed',
                                        opacity: apiAccessEnabled ? 1 : 0.45,
                                        position: 'relative' as const
                                    }}
                                >
                                    <h3 style={{ fontWeight: 600, color: apiAccessEnabled ? 'white' : '#64748b', marginBottom: 6 }}>
                                        Canal Notification API
                                        {!apiAccessEnabled && <span style={{ fontSize: 11, fontWeight: 400, color: '#f59e0b', marginLeft: 8 }}>Abonnement API requis</span>}
                                    </h3>
                                    <p style={{ fontSize: 13, color: '#94a3b8' }}>
                                        Connectez votre boutique Shopify, WooCommerce ou autre plateforme pour envoyer automatiquement confirmations et mises à jour via WhatsApp. Nécessite un abonnement API.
                                    </p>
                                </button>
                            </div>
                        </div>

                        {/* Champs inline — agent API */}
                        {agentType === 'api' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ padding: 14, background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: 12, color: '#bae6fd', fontSize: 13, lineHeight: 1.6 }}>
                                    Votre agent servira uniquement de canal de notification WhatsApp. Les commandes et paiements restent gérés sur votre plateforme (Chariow, Shopify, WooCommerce...).
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Nom de l'agent *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateFormData('name', e.target.value)}
                                        placeholder="Ex: Boutique Chez Marie"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Numéro d'escalade / SAV * <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(format : +225XXXXXXXXX)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.escalation_phone}
                                        onChange={(e) => updateFormData('escalation_phone', sanitizeEscalationPhone(e.target.value))}
                                        placeholder="+2250701010101"
                                        style={{
                                            ...inputStyle,
                                            border: formData.escalation_phone && !isValidEscalationPhone(formData.escalation_phone) ? '1px solid #f87171' : inputStyle.border
                                        }}
                                    />
                                    {formData.escalation_phone && !isValidEscalationPhone(formData.escalation_phone) && (
                                        <p style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                                            Format invalide. Exemple : +2250701010101 (+ indicatif + numéro, chiffres uniquement)
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Message de redirection * <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(envoyé quand un client vous répond)</span>
                                    </label>
                                    <textarea
                                        value={formData.external_sync_reply_message}
                                        onChange={(e) => updateFormData('external_sync_reply_message', e.target.value)}
                                        placeholder={`Merci pour votre message. Pour toute assistance, contactez notre équipe au ${formData.escalation_phone || '+225XXXXXXXXX'}.`}
                                        rows={4}
                                        style={{ ...inputStyle, resize: 'vertical' as const }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Grille des missions — conversationnel uniquement */}
                        {agentType === 'conversationnel' && (
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                    {t('Form.mission.label')}
                                </label>
                                <div className="agent-grid-3">
                                    {missionTemplates.map((template) => {
                                        const flagKey = `agent_${template.id}`
                                        const isEnabled = template.id === 'support_client' || template.id === 'services' || Object.keys(featureFlags).length === 0 || featureFlags[flagKey] !== false
                                        return (
                                            <button
                                                key={template.id}
                                                onClick={() => isEnabled && selectMissionTemplate(template)}
                                                disabled={!isEnabled}
                                                style={{
                                                    padding: 16,
                                                    border: `2px solid ${formData.mission === template.id ? '#10b981' : isEnabled ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.05)'}`,
                                                    borderRadius: 12,
                                                    textAlign: 'left',
                                                    background: formData.mission === template.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                                                    opacity: isEnabled ? 1 : 0.45,
                                                    position: 'relative' as const
                                                }}
                                            >
                                                {!isEnabled && (
                                                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, color: '#64748b', background: 'rgba(100,116,139,0.15)', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>
                                                        BIENTÔT
                                                    </span>
                                                )}
                                                <h3 style={{ fontWeight: 600, color: isEnabled ? 'white' : '#64748b', marginBottom: 4 }}>{template.title}</h3>
                                                <p style={{ fontSize: 13, color: '#64748b' }}>{template.description}</p>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {formData.mission && agentType === 'conversationnel' && (
                            <div style={{
                                padding: 16,
                                background: 'rgba(16, 185, 129, 0.05)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12
                            }}>
                                <Shield size={20} color="#34d399" />
                                <div>
                                    <h4 style={{ color: '#34d399', fontWeight: 600, fontSize: 14 }}>Mode Sécurisé Activé</h4>
                                    <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                        L&apos;IA est maintenant configurée pour suivre strictement le scénario <strong>{missionTemplates.find(tmpl => tmpl.id === formData.mission)?.title}</strong>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {isSupportClient && (
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Contexte supplémentaire (optionnel)
                                </label>
                                <textarea
                                    value={formData.agent_context}
                                    onChange={(e) => updateFormData('agent_context', e.target.value)}
                                    placeholder="Informations complémentaires sur votre activité, produits ou politiques que l'IA doit connaître..."
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: 16,
                                        borderRadius: 12,
                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                        background: 'rgba(99, 102, 241, 0.05)',
                                        color: 'white',
                                        outline: 'none',
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
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Message d&apos;accueil (optionnel)
                                </label>
                                <textarea
                                    value={formData.welcome_message}
                                    onChange={(e) => updateFormData('welcome_message', e.target.value)}
                                    placeholder="Ex: Je peux vous renseigner sur nos formations, les tarifs et le processus d'inscription."
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: 16,
                                        borderRadius: 12,
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        background: 'rgba(16, 185, 129, 0.05)',
                                        color: 'white',
                                        outline: 'none',
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                    }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Affiché après le nom de l&apos;agent lors du premier message.
                                </p>
                            </div>
                        )}
                        {isSupportClient && (
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Message de redirection (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={formData.fallback_contact_message}
                                    onChange={(e) => updateFormData('fallback_contact_message', e.target.value)}
                                    placeholder="Ex: Pour plus de détails, appelez le +225 07 00 00 00 ou visitez notre site."
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Phrase ajoutée automatiquement quand l&apos;agent n&apos;a pas l&apos;information. Laissez vide pour un comportement par défaut.
                                </p>
                            </div>
                        )}
                    </div>
                )

            case 1: // INFO
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {isExternalSync && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: 10, fontSize: 13, color: '#bae6fd' }}>
                                <span>ℹ️</span>
                                <span>Définissez ici l&apos;identité de votre agent. Il servira de canal de notification WhatsApp pour votre plateforme.</span>
                            </div>
                        )}
                        {isSupportClient && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10, fontSize: 13, color: '#a5b4fc' }}>
                                <span>ℹ️</span>
                                <span>En mode Support Client, la description et l'adresse s'activent automatiquement si vous ajoutez des produits à cet agent.</span>
                            </div>
                        )}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('Form.name.label')} *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateFormData('name', e.target.value)}
                                placeholder={t('Form.name.placeholder')}
                                style={inputStyle}
                            />
                        </div>

                        {!isExternalSync && (
                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('Form.description.label')}
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        fontSize: 12,
                                        color: '#10b981',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        padding: '4px 8px',
                                        borderRadius: 6,
                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {generating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                                    Générer (1 crédit)
                                </button>
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => updateFormData('description', e.target.value)}
                                placeholder={t('Form.description.placeholder')}
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
                        )}

                        {/* Toggle boutique en ligne */}
                        {!isExternalSync && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10 }}>
                            <input
                                type="checkbox"
                                id="is_online_only"
                                checked={formData.is_online_only}
                                onChange={(e) => updateFormData('is_online_only', e.target.checked)}
                                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#818cf8' }}
                            />
                            <label htmlFor="is_online_only" style={{ cursor: 'pointer', color: '#e2e8f0', fontSize: 14 }}>
                                Boutique 100% en ligne (pas d'adresse physique)
                                <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>L'IA ne mentionnera jamais d'adresse physique.</span>
                            </label>
                        </div>}

                        {/* NEW FIELDS: Address & Contact */}
                        {!isExternalSync && <div style={{ display: formData.is_online_only ? 'none' : undefined }}>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Adresse Physique
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={formData.business_address}
                                    onChange={(e) => updateFormData('business_address', e.target.value)}
                                    placeholder="Ex: Abidjan, Cocody..."
                                    style={inputStyle}
                                />
                                <MapPin size={16} style={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8' }} />
                            </div>
                        </div>}

                        {!isExternalSync && <div className="agent-grid-2" style={{ display: formData.is_online_only ? 'none' : undefined }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Latitude
                                </label>
                                <input
                                    type="number"
                                    value={formData.latitude}
                                    onChange={(e) => updateFormData('latitude', e.target.value)}
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
                                    value={formData.longitude}
                                    onChange={(e) => updateFormData('longitude', e.target.value)}
                                    placeholder="0.0000"
                                    style={inputStyle}
                                />
                            </div>
                        </div>}

                        <div className="agent-grid-2">
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Numéro d'Escalade / SAV * <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(+indicatif)</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.escalation_phone}
                                    onChange={(e) => updateFormData('escalation_phone', e.target.value)}
                                    placeholder="+2250701010101"
                                    style={{
                                        ...inputStyle,
                                        border: !isValidEscalationPhone(formData.escalation_phone) ? '1px solid #f87171' : inputStyle.border
                                    }}
                                />
                                <p style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                                    {!isValidEscalationPhone(formData.escalation_phone) ? 'Format : +225XXXXXXXXX (+ indicatif obligatoire, chiffres uniquement)' : ''}
                                </p>
                            </div>
                            {!isExternalSync && (
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Site Web
                                </label>
                                <input
                                    type="text"
                                    value={formData.site_url}
                                    onChange={(e) => updateFormData('site_url', e.target.value)}
                                    placeholder="https://"
                                    style={inputStyle}
                                />
                            </div>
                            )}
                        </div>
                    </div>
                )

            case 2: // HOURS
                const set24_7 = () => {
                    const allOpen: typeof formData.business_hours = {
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

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Notice Support Client */}
                        {isSupportClient && (
                            <div style={{ padding: 14, background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 12, fontSize: 13, color: '#a5b4fc' }}>
                                ℹ️ Les horaires ne s'appliquent pas au mode Support Client. Vous pouvez ignorer cette étape.
                            </div>
                        )}
                        {/* 24/7 Quick Toggle */}
                        <div className="agent-hours-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, marginBottom: 8 }}>
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
                            <div className="agent-hours-row" key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(30, 41, 59, 0.3)', borderRadius: 8 }}>
                                <span className="agent-hours-day" style={{ textTransform: 'capitalize', color: 'white', width: 100 }}>{t(`WeekDays.${day}`)}</span>
                                <div className="agent-hours-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                                className="agent-hours-time"
                                                style={{ ...inputStyle, padding: '4px 8px', width: 100 }}
                                            />
                                            <span style={{ color: '#94a3b8' }}>-</span>
                                            <input
                                                type="time"
                                                value={hours.close}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    business_hours: { ...formData.business_hours, [day]: { ...hours, close: e.target.value } }
                                                })}
                                                className="agent-hours-time"
                                                style={{ ...inputStyle, padding: '4px 8px', width: 100 }}
                                            />
                                        </>
                                    ) : (
                                        <span className="agent-hours-closed" style={{ color: '#64748b', fontStyle: 'italic', width: 216, textAlign: 'center' }}>Fermé</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )


            case 3: // PERSONALITY
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {!isSupportClient && (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                        {t('Form.personality.label')}
                                    </label>
                                    <div className="agent-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                        {personalities.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => updateFormData('personality', p.id)}
                                                style={{
                                                    padding: 20,
                                                    border: `2px solid ${formData.personality === p.id ? '#10b981' : 'rgba(148, 163, 184, 0.1)'}`,
                                                    borderRadius: 12,
                                                    textAlign: 'center',
                                                    background: formData.personality === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
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

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 16,
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 12
                                }}>
                                    <div>
                                        <h3 style={{ fontWeight: 500, color: 'white' }}>{t('Form.personality.emojis')}</h3>
                                        <p style={{ fontSize: 13, color: '#64748b' }}>{t('Form.personality.emojisHint')}</p>
                                    </div>
                                    <button
                                        onClick={() => updateFormData('useEmojis', !formData.useEmojis)}
                                        style={{
                                            width: 48,
                                            height: 28,
                                            borderRadius: 14,
                                            background: formData.useEmojis ? '#10b981' : '#334155',
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
                                            left: formData.useEmojis ? 23 : 3,
                                            transition: 'left 0.2s'
                                        }} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )

            case 4: // RULES
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Règles spécifiques
                            </label>
                            <textarea
                                value={formData.custom_rules}
                                onChange={(e) => updateFormData('custom_rules', e.target.value)}
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
- Renvoyer vers le conseiller au +225 07 XX XX XX XX pour toute demande complexe` : isExternalSync ? `Exemples de règles pour une boutique connectée à une plateforme externe:

🌐 PLATEFORME:
- Toutes les commandes et paiements se font sur notre site/plateforme
- Ne jamais ouvrir un panier WazzapAI ni proposer le checkout interne

📦 PRODUITS:
- Ne présenter que les produits disponibles dans le catalogue synchronisé
- Ne jamais inventer un prix, un stock ou une référence produit
- En cas de doute sur la disponibilité, demander de vérifier sur le site

📥 PRODUITS NUMÉRIQUES:
- Après paiement confirmé, le fichier/lien est envoyé automatiquement
- En cas de problème de téléchargement, orienter vers le SAV

📞 ESCALADE:
- Renvoyer vers le support au +225 07 XX XX XX XX pour toute réclamation` : `Exemples de règles que l'IA doit respecter:

📦 LIVRAISON:
- Livraison gratuite à partir de 50.000 FCFA
- Zones de livraison: Abidjan uniquement
- Délai de livraison: 24-48h

💳 PAIEMENT:
- Paiement à la livraison accepté
- Mobile Money préféré (Orange, MTN, Wave)
- Pas de carte bancaire

🚫 RESTRICTIONS:
- Pas de remboursement sur articles soldés
- Échange uniquement dans les 48h
- Quantité max par commande: 5 articles

📞 ESCALADE:
- Renvoyer vers le support au +225 07 XX XX XX XX si problème complexe`}
                                rows={10}
                                style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace' }}
                            />
                        </div>

                        <div style={{
                            padding: 16,
                            background: conflictStatus === 'conflict' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.05)',
                            border: `1px solid ${conflictStatus === 'conflict' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <h4 style={{ color: conflictStatus === 'conflict' ? '#fca5a5' : '#6ee7b7', fontWeight: 600, marginBottom: 4 }}>
                                    {conflictStatus === 'conflict' ? '⚠️ Conflit Détecté' : '🛡️ Vérification de cohérence'}
                                </h4>
                                <p style={{ fontSize: 13, color: '#94a3b8' }}>
                                    {conflictStatus === 'conflict' ? conflictReason : "L'IA analyse si vos règles sont cohérentes avec les horaires, l'adresse et les autres paramètres du wizard."}
                                </p>
                            </div>
                            <button
                                onClick={checkConflict}
                                disabled={(formData.custom_rules || '').length < 3 || conflictStatus === 'checking'}
                                style={{
                                    ...buttonSecondaryStyle,
                                    background: 'rgba(30, 41, 59, 0.8)',
                                    opacity: (formData.custom_rules || '').length < 3 ? 0.5 : 1,
                                    cursor: (formData.custom_rules || '').length < 3 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {conflictStatus === 'checking' ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                Vérifier
                            </button>
                        </div>
                    </div>
                )

            case 5: // SETTINGS
                if (isExternalSync) return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ padding: 14, background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: 12, color: '#bae6fd', fontSize: 13, lineHeight: 1.6 }}>
                            Quand un client répond à une notification, votre agent enverra ce message automatiquement puis redirigera vers le numéro de support.
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Message de redirection <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <textarea
                                value={formData.external_sync_reply_message}
                                onChange={(e) => updateFormData('external_sync_reply_message', e.target.value)}
                                placeholder={`Merci pour votre message. Pour toute assistance, contactez notre équipe au ${formData.escalation_phone || '[numéro d\'escalade]'}.`}
                                rows={4}
                                style={{ ...inputStyle, resize: 'vertical' as const }}
                            />
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                Ce message est envoyé une seule fois quand le client écrit à votre agent.
                            </p>
                        </div>
                    </div>
                )
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('Form.settings.language')}
                            </label>
                            <select
                                value={formData.language}
                                onChange={(e) => updateFormData('language', e.target.value)}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="fr">Français</option>
                                <option value="en">English</option>
                                <option value="es">Español</option>
                                <option value="ar">العربية</option>
                            </select>
                        </div>

                        {/* Voice Settings (Premium) — hidden, text-only responses */}
                        <div style={{ display: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.enableVoice ? 16 : 0 }}>
                                <div>
                                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        🎙️ {t('Form.settings.voiceResponse')} <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fbbf24', color: 'black' }}>PREMIUM</span>
                                    </h3>
                                    <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                                        {t('Form.settings.voiceDescription')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => updateFormData('enableVoice', !formData.enableVoice)}
                                    style={{
                                        width: 48,
                                        height: 28,
                                        borderRadius: 14,
                                        background: formData.enableVoice ? '#10b981' : '#334155',
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
                                        left: formData.enableVoice ? 23 : 3,
                                        transition: 'left 0.2s'
                                    }} />
                                </button>
                            </div>

                            {formData.enableVoice && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        {t('Form.settings.voiceId')}
                                    </label>
                                    <div className="agent-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                        {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(voice => (
                                            <button
                                                key={voice}
                                                onClick={() => updateFormData('voiceId', voice)}
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: 8,
                                                    border: formData.voiceId === voice ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                                                    background: formData.voiceId === voice ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.3)',
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
                                    <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 12 }}>
                                        ⚠️ {t('Form.settings.voiceCostWarning', { cost: 5 })}
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        {formData.mission === 'restaurant' && <div style={{
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
                                    onClick={() => updateFormData('restaurant_deposit_enabled', !formData.restaurant_deposit_enabled)}
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
                                                onClick={() => updateFormData('restaurant_deposit_mode', 'percentage')}
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
                                                onClick={() => updateFormData('restaurant_deposit_mode', 'fixed')}
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
                                                    onChange={(e) => updateFormData('restaurant_deposit_percentage', parseInt(e.target.value))}
                                                    style={{ width: '100%', accentColor: '#10b981' }}
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={formData.restaurant_deposit_percentage}
                                                onChange={(e) => updateFormData('restaurant_deposit_percentage', Math.max(0, Math.min(100, parseInt(e.target.value || '0'))))}
                                                style={inputStyle}
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
                                                    onChange={(e) => updateFormData('restaurant_deposit_fixed_amount_fcfa', Math.max(0, parseInt(e.target.value || '0')))}
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                                Exemple: 5000 demande toujours 5 000 FCFA d&apos;acompte. Si le total est inferieur, l&apos;acompte sera plafonne au total.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>}

                        {/* Summary */}
                        <div style={{
                            padding: 20,
                            background: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: 12
                        }}>
                            <h3 style={{ fontWeight: 600, color: 'white', marginBottom: 16 }}>{t('Form.summary.title')}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>{t('Form.summary.name')}</span>
                                    <span style={{ color: 'white', fontWeight: 500 }}>{formData.name}</span>
                                </div>
                                {!isSupportClient && (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>{t('Form.summary.personality')}</span>
                                            <span style={{ color: 'white', fontWeight: 500 }}>
                                                {personalities.find(p => p.id === formData.personality)?.name}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>{t('Form.summary.emojis')}</span>
                                            <span style={{ color: 'white', fontWeight: 500 }}>{formData.useEmojis ? 'Oui' : 'Non'}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Payment Settings Section */}
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 12 }}>
                                Mode de Paiement
                            </label>
                            {isExternalSync ? (
                                <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)', lineHeight: 1.6 }}>
                                    Les commandes et paiements sont geres par votre plateforme externe. Le checkout natif WazzapAI est desactive pour cet agent.
                                </div>
                            ) : isSupportClient ? (
                                <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)' }}>
                                    Paiement manuel activé automatiquement (mode Support Client).
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div
                                        onClick={() => updateFormData('payment_mode', 'cinetpay')}
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
                                        onClick={() => updateFormData('payment_mode', 'mobile_money_direct')}
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

                        {/* Mobile Money Numbers (only if direct mode or support client) */}
                        {!isExternalSync && (formData.payment_mode === 'mobile_money_direct' || isSupportClient) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
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
                                            onChange={(e) => updateFormData('mobile_money_orange', e.target.value)}
                                            placeholder="+225 07 XX XX XX XX"
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                            🟡 MTN Money
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.mobile_money_mtn}
                                            onChange={(e) => updateFormData('mobile_money_mtn', e.target.value)}
                                            placeholder="+225 05 XX XX XX XX"
                                            style={inputStyle}
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
                                            onChange={(e) => updateFormData('mobile_money_wave', e.target.value)}
                                            placeholder="+225 01 XX XX XX XX"
                                            style={inputStyle}
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
                                            <div className="agent-inline-fields" key={index} style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    type="text"
                                                    value={method.name}
                                                    onChange={e => {
                                                        const updated = [...formData.custom_payment_methods]
                                                        updated[index].name = e.target.value
                                                        updateFormData('custom_payment_methods', updated)
                                                    }}
                                                    placeholder="Nom (ex: PayPal)"
                                                    style={{ ...inputStyle, flex: 1 }}
                                                />
                                                <input
                                                    type="text"
                                                    value={method.details}
                                                    onChange={e => {
                                                        const updated = [...formData.custom_payment_methods]
                                                        updated[index].details = e.target.value
                                                        updateFormData('custom_payment_methods', updated)
                                                    }}
                                                    placeholder="Détails (ex: email@paypal.com)"
                                                    style={{ ...inputStyle, flex: 1 }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = formData.custom_payment_methods.filter((_, i) => i !== index)
                                                        updateFormData('custom_payment_methods', updated)
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
                                                updateFormData('custom_payment_methods', [...formData.custom_payment_methods, { name: '', details: '' }])
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

                        {isExternalSync && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Live Query URL (optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.live_query_url}
                                        onChange={(e) => updateFormData('live_query_url', e.target.value)}
                                        placeholder="https://votre-plateforme.com/api/wazzap/live-query"
                                        style={inputStyle}
                                    />
                                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                        Utilise pour interroger votre plateforme en temps reel pendant une conversation entrante.
                                    </p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Live Query Secret (optionnel)
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.live_query_secret}
                                        onChange={(e) => updateFormData('live_query_secret', e.target.value)}
                                        placeholder="secret interne pour signer les requetes"
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Section Collecte de Leads (support client + services) */}
                        {isSupportClient && (
                            <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                                        Collecte de leads
                                    </label>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                        Recommandé
                                    </span>
                                </div>
                                {!formData.lead_collection_enabled && (
                                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                                        <p style={{ color: '#f87171', fontWeight: 600, fontSize: 13, margin: '0 0 4px 0' }}>Les leads sont désactivés — vous perdez des prospects.</p>
                                        <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Chaque client qui contacte votre agent est un prospect. Sans collecte, vous ne saurez jamais qui a écrit.</p>
                                    </div>
                                )}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 16, border: `1px solid ${formData.lead_collection_enabled ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.1)'}`, borderRadius: 12, background: formData.lead_collection_enabled ? 'rgba(16,185,129,0.06)' : 'rgba(30,41,59,0.5)', marginBottom: 16
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>Activer la collecte de leads</div>
                                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                                            L'agent collecte le contact du client intéressé et vous notifie
                                        </div>
                                    </div>
                                    <button type="button"
                                        onClick={() => updateFormData('lead_collection_enabled', !formData.lead_collection_enabled)}
                                        style={{ width: 48, height: 28, borderRadius: 14, background: formData.lead_collection_enabled ? '#10b981' : '#334155', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                                    >
                                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: formData.lead_collection_enabled ? 23 : 3, transition: 'left 0.2s' }} />
                                    </button>
                                </div>

                                {formData.lead_collection_enabled && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                                Informations à collecter
                                            </label>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {[{ key: 'name', label: 'Prénom/Nom' }, { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'Email' }, { key: 'location', label: 'Localisation' }, { key: 'company', label: 'Entreprise' }].map(f => (
                                                    <button key={f.key} type="button"
                                                        onClick={() => {
                                                            const cur = formData.lead_collect_fields
                                                            updateFormData('lead_collect_fields', cur.includes(f.key) ? cur.filter(x => x !== f.key) : [...cur, f.key])
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
                                                onChange={e => updateFormData('lead_redirect_message', e.target.value)}
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
                                            onChange={e => updateFormData('lead_redirect_message', e.target.value)}
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
                )

            case 6: // WHATSAPP
                // If agent not created yet, show prompt to create it
                if (!createdAgent) {
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 40, textAlign: 'center' }}>
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: 20,
                                background: 'rgba(251, 191, 36, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <AlertCircle style={{ width: 40, height: 40, color: '#fbbf24' }} />
                            </div>
                            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                                Créez d'abord votre agent
                            </h3>
                            <p style={{ color: '#94a3b8', maxWidth: 400 }}>
                                Cliquez sur le bouton <strong style={{ color: '#10b981' }}>"Créer l'agent"</strong> en bas de page pour finaliser la configuration, puis vous pourrez connecter WhatsApp.
                            </p>
                        </div>
                    )
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 20 }}>
                        {whatsappStatus !== 'connected' && (
                            <div style={{
                                width: '100%',
                                maxWidth: 460,
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'rgba(15, 23, 42, 0.55)',
                                borderRadius: 14,
                                padding: 14
                            }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 10 }}>
                                    Mode de connexion
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setConnectionMode('qr')}
                                        style={{
                                            borderRadius: 10,
                                            border: connectionMode === 'qr' ? '1px solid rgba(52, 211, 153, 0.7)' : '1px solid rgba(71, 85, 105, 0.8)',
                                            background: connectionMode === 'qr' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                                            color: connectionMode === 'qr' ? '#a7f3d0' : '#cbd5e1',
                                            padding: '10px 12px',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        QR code (ordinateur)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConnectionMode('pairing_code')}
                                        style={{
                                            borderRadius: 10,
                                            border: connectionMode === 'pairing_code' ? '1px solid rgba(52, 211, 153, 0.7)' : '1px solid rgba(71, 85, 105, 0.8)',
                                            background: connectionMode === 'pairing_code' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                                            color: connectionMode === 'pairing_code' ? '#a7f3d0' : '#cbd5e1',
                                            padding: '10px 12px',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Code de liaison (mobile)
                                    </button>
                                </div>
                                {connectionMode === 'pairing_code' && (
                                    <div style={{ marginTop: 10 }}>
                                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                                            Numero WhatsApp (avec indicatif)
                                        </label>
                                        <input
                                            type="tel"
                                            value={pairingPhone}
                                            onChange={(e) => setPairingPhone(e.target.value)}
                                            placeholder="+2250700000000"
                                            style={{
                                                width: '100%',
                                                borderRadius: 10,
                                                border: '1px solid rgba(71, 85, 105, 0.8)',
                                                background: 'rgba(30, 41, 59, 0.7)',
                                                color: 'white',
                                                padding: '10px 12px',
                                                fontSize: 13,
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {whatsappStatus === 'idle' && (
                            <>
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonPrimaryStyle}
                                >
                                    {connectionMode === 'pairing_code'
                                        ? <Smartphone style={{ width: 20, height: 20 }} />
                                        : <QrCode style={{ width: 20, height: 20 }} />}
                                    {connectionMode === 'pairing_code' ? 'Generer le code de liaison' : t('Wizard.buttons.generateQr')}
                                </button>
                                <div style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 20,
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {connectionMode === 'pairing_code'
                                        ? <Smartphone style={{ width: 40, height: 40, color: '#34d399' }} />
                                        : <QrCode style={{ width: 40, height: 40, color: '#34d399' }} />}
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white', textAlign: 'center' }}>
                                    {t('connect.title')}
                                </h3>
                                <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
                                    {connectionMode === 'pairing_code'
                                        ? 'Generez un code de liaison pour connecter cet agent depuis ce meme telephone.'
                                        : t('connect.scanPrompt')}
                                </p>
                                {!isSupportClient && (
                                    <button onClick={handleFinish} style={{ ...buttonSecondaryStyle, marginTop: 8 }}>
                                        {t('Wizard.buttons.skip')}
                                    </button>
                                )}
                            </>
                        )}

                        {whatsappStatus === 'connecting' && (
                            <>
                                <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#94a3b8' }}>
                                    {connectionMode === 'pairing_code' ? 'Generation du code de liaison...' : t('connect.initialization')}
                                </p>
                                {countdown !== null && (
                                    <div style={{ fontSize: 13, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center' }}>
                                        {countdown > 0 ? `${countdown}s` : 'Prend plus de temps que prévu...'}
                                    </div>
                                )}
                                <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                                    Annuler
                                </button>
                            </>
                        )}

                        {whatsappStatus === 'qr_ready' && (qrCode || pairingCode) && (
                            <>
                                {qrCode ? (
                                    <>
                                        <div style={{
                                            background: 'white',
                                            padding: 16,
                                            borderRadius: 16
                                        }}>
                                            <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 250, height: 250 }} />
                                        </div>
                                        <p style={{ color: '#94a3b8', textAlign: 'center' }}>
                                            {t('connect.qrInstructions.step3')}
                                        </p>
                                        <p style={{ color: '#64748b', textAlign: 'center', fontSize: 12, maxWidth: 280 }}>
                                            Le QR se renouvelle automatiquement toutes les ~20 s.<br />
                                            Si votre téléphone charge sans fin, attendez le nouveau QR et rescannez.
                                        </p>
                                    </>
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: 380,
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                        background: 'rgba(16, 185, 129, 0.12)',
                                        borderRadius: 14,
                                        padding: 16,
                                        textAlign: 'center'
                                    }}>
                                        <p style={{ color: '#a7f3d0', fontSize: 13, marginBottom: 8 }}>Code de liaison WhatsApp</p>
                                        <p style={{ color: 'white', fontSize: 30, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
                                            {pairingCode}
                                        </p>
                                        <p style={{ color: '#d1fae5', fontSize: 12, lineHeight: 1.5 }}>
                                            Sur votre telephone: WhatsApp &gt; Appareils connectes &gt; Connecter un appareil &gt; Entrer le code.
                                        </p>
                                    </div>
                                )}
                                {countdown !== null && (
                                    <div style={{ fontSize: 12, color: countdown > 0 ? '#64748b' : '#f59e0b', textAlign: 'center', marginTop: 4 }}>
                                        {countdown > 0 ? `Expiration dans ${countdown}s` : 'Essayez de régénérer'}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={connectWhatsApp} style={buttonSecondaryStyle}>
                                        <RefreshCw style={{ width: 18, height: 18 }} />
                                        {connectionMode === 'pairing_code' ? 'Regenerer le code' : t('connect.actions.regenerate')}
                                    </button>
                                    <button onClick={cancelConnection} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
                                        Annuler
                                    </button>
                                </div>
                            </>
                        )}

                        {whatsappStatus === 'connected' && (
                            <>
                                <div style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <CheckCircle2 style={{ width: 48, height: 48, color: '#34d399' }} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                                    {t('connect.connectedSuccess')} 🎉
                                </h3>
                                <p style={{ color: '#94a3b8' }}>
                                    Numéro: {connectedPhone}
                                </p>
                                {!isSupportClient && (
                                    <>
                                        {isExternalSync ? (
                                            <>
                                                <button
                                                    onClick={() => router.push('/dashboard/developers?tab=platform_connections')}
                                                    style={buttonPrimaryStyle}
                                                >
                                                    <Globe style={{ width: 18, height: 18 }} />
                                                    Configurer la connexion plateforme
                                                </button>
                                                <button
                                                    onClick={handleFinish}
                                                    style={buttonSecondaryStyle}
                                                >
                                                    {t('Wizard.buttons.finish')}
                                                    <ArrowRight style={{ width: 20, height: 20 }} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={goToKnowledgeBase}
                                                    style={buttonSecondaryStyle}
                                                >
                                                    <Bot style={{ width: 18, height: 18 }} />
                                                    Ajouter une base de connaissance
                                                </button>
                                                <button
                                                    onClick={handleFinish}
                                                    style={buttonPrimaryStyle}
                                                >
                                                    {t('Wizard.buttons.finish')}
                                                    <ArrowRight style={{ width: 20, height: 20 }} />
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {whatsappStatus === 'error' && (
                            <>
                                <div style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <AlertCircle style={{ width: 48, height: 48, color: '#f87171' }} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                                    {t('connect.error')}
                                </h3>
                                <p style={{ color: '#f87171' }}>{error}</p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonPrimaryStyle}
                                >
                                    <RefreshCw style={{ width: 18, height: 18 }} />
                                    {connectionMode === 'pairing_code' ? 'Regenerer le code de liaison' : t('Wizard.buttons.retry')}
                                </button>
                            </>
                        )}
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="agent-wizard-root" style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 150 }}>
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
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    {t('Wizard.title')}
                </h1>
                <p style={{ color: '#94a3b8' }}>
                    {t('Wizard.subtitle')}
                </p>
            </div>

            {/* Progress steps */}
            <div className="agent-stepper" style={{ display: 'flex', alignItems: 'center', justifyContent: isCompact ? 'flex-start' : 'center', marginBottom: 32, gap: 8 }}>
                {steps
                    .map((step, index) => ({ ...step, originalIndex: index }))
                    .filter(step => !isExternalSync || !['hours', 'personality', 'rules'].includes(step.id))
                    .map((step, visIndex, visArr) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                            width: isCompact ? 34 : 40,
                            height: isCompact ? 34 : 40,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: step.originalIndex < currentStep
                                ? '#10b981'
                                : step.originalIndex === currentStep
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : 'rgba(51, 65, 85, 0.5)',
                            color: step.originalIndex <= currentStep ? '#34d399' : '#64748b'
                        }}>
                            {step.originalIndex < currentStep ? (
                                <Check style={{ width: 20, height: 20, color: 'white' }} />
                            ) : (
                                <step.icon style={{ width: 20, height: 20 }} />
                            )}
                        </div>
                        {visIndex < visArr.length - 1 && (
                            <div style={{
                                width: isCompact ? 24 : 40,
                                height: 4,
                                background: step.originalIndex < currentStep ? '#10b981' : 'rgba(51, 65, 85, 0.5)',
                                borderRadius: 2
                            }} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step title */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                    {steps[currentStep].title}
                </h2>
            </div>

            {/* Error message */}
            {error && currentStep !== 4 && (
                <div style={{
                    marginBottom: 24,
                    padding: 16,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 12,
                    color: '#f87171',
                    fontSize: 14
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <AlertCircle size={16} />
                        <strong>Erreur</strong>
                    </div>
                    {error}
                </div>
            )}

            {/* Step content */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={cardStyle}
            >
                {renderStepContent()}
            </motion.div>

            {/* Navigation buttons */}
            <div className="agent-nav" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button
                    onClick={() => setCurrentStep(prev => getPrevStep(prev))}
                    disabled={currentStep === 0}
                    style={{
                        ...buttonSecondaryStyle,
                        opacity: currentStep === 0 ? 0 : 1,
                        pointerEvents: currentStep === 0 ? 'none' : 'auto'
                    }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    {t('Wizard.buttons.prev')}
                </button>

                {currentStep < 6 ? (
                    <button
                        onClick={() => setCurrentStep(prev => getNextStep(prev))}
                        disabled={!canProceed()}
                        style={{
                            ...buttonPrimaryStyle,
                            opacity: canProceed() ? 1 : 0.5,
                            cursor: canProceed() ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {t('Wizard.buttons.next')}
                        <ArrowRight style={{ width: 16, height: 16 }} />
                    </button>
                ) : currentStep === 6 ? (
                    <button
                        onClick={handleCreateAgent}
                        disabled={loading}
                        style={{
                            ...buttonPrimaryStyle,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                                {t('Wizard.buttons.loading')}
                            </>
                        ) : (
                            <>
                                <Check style={{ width: 18, height: 18 }} />
                                {t('Wizard.buttons.create')}
                            </>
                        )}
                    </button>
                ) : null}
            </div>

            {/* Modal post-création agent Support Client */}
            {showSupportModal && createdAgent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: '#0f172a', border: '1px solid #ef4444', borderRadius: 24, padding: 32, maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

                        {/* En-tête alerte */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>⚠️</div>
                                <div>
                                    <div style={{ color: '#f87171', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Action requise</div>
                                    <h2 style={{ color: 'white', fontWeight: 700, fontSize: 20, margin: 0 }}>Votre agent ne peut pas encore répondre</h2>
                                </div>
                            </div>
                        </div>

                        {/* Explication centrale */}
                        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>Qu'est-ce que la base de connaissances ?</div>
                            <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                                C'est le <strong style={{ color: 'white' }}>cerveau de votre agent</strong>. Vous y écrivez tout ce qu'il doit savoir sur votre activité : vos services, vos tarifs, vos horaires, votre FAQ, vos conditions...
                            </div>
                            <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6 }}>
                                <strong style={{ color: '#f87171' }}>Sans base de connaissances, votre agent est vide.</strong> Il ne connaît rien de votre activité et sera incapable de répondre correctement à vos clients.
                            </div>
                        </div>

                        {/* Exemples concrets */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Exemples de ce que vous pouvez ajouter</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                {[
                                    { icon: '💰', text: 'Vos tarifs et offres' },
                                    { icon: '🕐', text: 'Vos horaires d\'ouverture' },
                                    { icon: '❓', text: 'Questions fréquentes (FAQ)' },
                                    { icon: '📍', text: 'Localisation / contact' },
                                    { icon: '🛠️', text: 'Description de vos services' },
                                    { icon: '📋', text: 'Conditions et politiques' },
                                ].map((item, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(148,163,184,0.08)' }}>
                                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                                        <span style={{ color: '#cbd5e1', fontSize: 13 }}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CTAs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <button
                                onClick={() => { setShowSupportModal(false); router.push(`/dashboard/agents/${createdAgent.id}/knowledge`) }}
                                style={{ width: '100%', padding: '16px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
                            >
                                Alimenter la base de connaissances maintenant
                            </button>
                            <button
                                onClick={() => { setShowSupportModal(false); router.push('/dashboard/agents') }}
                                style={{ width: '100%', padding: '10px', background: 'transparent', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                            >
                                Je le ferai plus tard (l'agent ne fonctionnera pas)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
