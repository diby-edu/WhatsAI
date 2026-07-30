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
    Smartphone,
    AlertCircle,
    Copy,
    CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import { GA } from '@/lib/analytics'
import { Clock, Shield } from 'lucide-react'
import { type AgentPaymentMode } from '@/lib/payments/payment-mode-display'
import type { NewAgentFormData } from './types'
import { isValidEscalationPhone } from './helpers'
import { StepMission } from './components/StepMission'
import { StepInfo } from './components/StepInfo'
import { StepHours } from './components/StepHours'
import { StepPersonality } from './components/StepPersonality'
import { StepRules } from './components/StepRules'
import { StepSettings } from './components/StepSettings'
import { StepPayment } from './components/StepPayment'
import { StepWhatsapp } from './components/StepWhatsapp'

const QR_CONNECTION_ERROR_MESSAGE = 'La connexion ne s\'est pas terminee (QR ou code de liaison). Cela peut etre un incident ponctuel cote WhatsApp au moment d\'enregistrer un nouvel appareil — reessayez, et si ca persiste, patientez quelques minutes avant de retenter.'

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
    const stepTopRef = useRef<HTMLDivElement>(null)
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
    const [slowConnectionHint, setSlowConnectionHint] = useState(false)

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

    // Remonte en haut de l'étape à chaque changement — sans ça, on garde la
    // position de scroll de l'étape précédente et le début de l'étape suivante
    // reste hors écran.
    useEffect(() => {
        stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [currentStep])

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
    const [formData, setFormData] = useState<NewAgentFormData>({
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
        delivery_fee_mode: 'none' as 'none' | 'free' | 'zones',
        delivery_zones: { communes: [], hors_abidjan: [], international: [] } as import('./types').DeliveryZonesConfig,
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
        { id: 'payment', title: 'Paiement', icon: CreditCard },
        { id: 'whatsapp', title: t('Wizard.steps.whatsapp'), icon: Smartphone },
    ]

    const isSupportClient = formData.mission === 'support_client' || formData.mission === 'services' || formData.mission === 'salon'
    const isEcommerce = formData.mission === 'ecommerce' || formData.mission === 'ecommerce_physical' || formData.mission === 'ecommerce_digital'
    const isExternalSync = isEcommerce && formData.ecommerce_mode === 'external_sync'

    const missionTemplates = [
        {
            id: 'support_client',
            title: 'Support Client',
            description: 'Collecte des leads, les informations et prend des rendez-vous. Pour service client, artisans, coachs, consultants, salons, formateurs, experts. Pas de catalogue ni de panier.',
            prompt: `Tu es l'assistant de ${'{name}'}.

Ton rôle:
- Répondre aux questions des clients sur les services, tarifs et disponibilités
- Comprendre leur besoin et les conseiller
- Collecter leurs informations de contact et les détails de leur demande
- Prendre des rendez-vous si applicable

Règles:
- Base-toi uniquement sur les informations que tu connais
- Ne jamais inventer un prix, un délai ou une disponibilité
- Si tu ne sais pas répondre, collecte le contact du client et indique qu'un responsable le recontactera
- Sois professionnel, chaleureux et rassurant`,
        },
        {
            id: 'ecommerce_physical',
            title: 'Produit Physique',
            description: 'Vend des produits physiques sur WhatsApp, gère le catalogue, les commandes et la livraison. Pour commerçants en ligne, boutiques et dropshipping.',
            prompt: `Tu es l'assistant commercial de notre boutique.

Ton rôle:
- Accueillir les clients et répondre à leurs questions
- Présenter les produits disponibles avec leurs prix
- Aider à choisir le bon produit selon les besoins du client
- Prendre les commandes et organiser la livraison

Pour commander, collecte dans cet ordre:
1. Le(s) produit(s) souhaité(s) et quantités
2. Nom complet du client
3. Numéro de téléphone
4. Adresse de livraison complète

Livraison:
- Confirme les frais et délais de livraison selon la zone
- Propose le retrait en boutique si disponible
- Pour le paiement à la livraison (COD), confirme bien l'adresse

Règles:
- Sois courtois et serviable
- Propose des produits complémentaires pertinents
- Confirme le total + frais de livraison avant de valider
- Ne promets jamais un délai ou une zone non confirmés`,
        },
        {
            id: 'ecommerce_digital',
            title: 'Produit Numérique',
            description: 'Vend des formations, ebooks, templates, logiciels ou tout contenu digital. Livraison instantanée par email ou lien.',
            prompt: `Tu es l'assistant commercial de notre boutique de produits numériques.

Ton rôle:
- Accueillir les clients et présenter notre catalogue digital
- Expliquer le contenu et les avantages de chaque produit
- Finaliser les commandes et assurer la livraison digitale

Pour commander, collecte dans cet ordre:
1. Le(s) produit(s) souhaité(s)
2. Nom complet du client
3. Adresse email (pour la livraison du produit)

Livraison:
- La livraison est instantanée par email après paiement confirmé
- Ne demande JAMAIS d'adresse postale physique
- Si le client ne reçoit pas son produit, demande-lui de vérifier ses spams

Règles:
- Sois enthousiaste et mets en valeur les bénéfices des produits
- Confirme le total avant de valider
- Ne promets jamais de remboursement sans vérifier la politique en vigueur`,
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
        const autoLeads = template.id === 'support_client'
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
            systemPrompt: (prev.mission === 'ecommerce' || prev.mission === 'ecommerce_physical' || prev.mission === 'ecommerce_digital')
                ? getMissionPrompt(prev.mission, mode)
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
            case 6: // Payment
                return true
            case 7: // WhatsApp
                return true
            default:
                return false
        }
    }

    // Calcul du prochain/précédent step en tenant compte des skips Support Client
    const getNextStep = (from: number) => {
        // Agent API : step 0 → WhatsApp directement (champs déjà dans step 0)
        if (isExternalSync && from === 0) return 7
        // Agent API : skip Horaires (2), Personnalité (3), Règles (4)
        if (isExternalSync && from === 1) return 5
        // Agent API : Paramètres (5) → WhatsApp directement (skip Paiement, sans objet en sync externe)
        if (isExternalSync && from === 5) return 7
        // Support Client : skip step 2 (Horaires)
        if (isSupportClient && from === 1) return 3
        return Math.min(steps.length - 1, from + 1)
    }

    const getPrevStep = (from: number) => {
        // Agent API : WhatsApp → step 0 directement
        if (isExternalSync && from === 7) return 0
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
                setCurrentStep(7) // Just move to WhatsApp step
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
            setCurrentStep(7) // Move to WhatsApp step
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
                    <StepMission
                        missionTemplates={missionTemplates}
                        featureFlags={featureFlags}
                        formData={formData}
                        setFormData={setFormData}
                        updateFormData={updateFormData}
                        agentType={agentType}
                        setAgentType={setAgentType}
                        selectMissionTemplate={selectMissionTemplate}
                        apiAccessEnabled={apiAccessEnabled}
                        getMissionPrompt={getMissionPrompt}
                        isSupportClient={isSupportClient}
                        inputStyle={inputStyle}
                    />
                )

            case 1: // INFO
                return (
                    <StepInfo t={t} formData={formData} updateFormData={updateFormData} inputStyle={inputStyle} isExternalSync={isExternalSync} isSupportClient={isSupportClient} generating={generating} handleGenerate={handleGenerate} getLocation={getLocation} />
                )

            case 2: // HOURS
                return (
                    <StepHours t={t} formData={formData} setFormData={setFormData} isSupportClient={isSupportClient} inputStyle={inputStyle} />
                )

            case 3: // PERSONALITY
                return (
                    <StepPersonality t={t} formData={formData} updateFormData={updateFormData} isSupportClient={isSupportClient} personalities={personalities} />
                )

            case 4: // RULES
                return (
                    <StepRules formData={formData} updateFormData={updateFormData} isSupportClient={isSupportClient} isExternalSync={isExternalSync} inputStyle={inputStyle} conflictStatus={conflictStatus} conflictReason={conflictReason} checkConflict={checkConflict} buttonSecondaryStyle={buttonSecondaryStyle} />
                )

            case 5: // SETTINGS
                return (
                    <StepSettings t={t} formData={formData} updateFormData={updateFormData} inputStyle={inputStyle} isExternalSync={isExternalSync} isSupportClient={isSupportClient} personalities={personalities} />
                )

            case 6: // PAYMENT
                return (
                    <StepPayment formData={formData} updateFormData={updateFormData} inputStyle={inputStyle} isExternalSync={isExternalSync} isSupportClient={isSupportClient} />
                )

            case 7: // WHATSAPP
                return (
                    <StepWhatsapp
                        t={t}
                        createdAgent={createdAgent}
                        whatsappStatus={whatsappStatus}
                        connectionMode={connectionMode}
                        setConnectionMode={setConnectionMode}
                        pairingPhone={pairingPhone}
                        setPairingPhone={setPairingPhone}
                        connectWhatsApp={connectWhatsApp}
                        buttonPrimaryStyle={buttonPrimaryStyle}
                        buttonSecondaryStyle={buttonSecondaryStyle}
                        isSupportClient={isSupportClient}
                        handleFinish={handleFinish}
                        countdown={countdown}
                        cancelConnection={cancelConnection}
                        qrCode={qrCode}
                        pairingCode={pairingCode}
                        connectedPhone={connectedPhone}
                        isExternalSync={isExternalSync}
                        router={router}
                        goToKnowledgeBase={goToKnowledgeBase}
                        error={error}
                        slowConnectionHint={slowConnectionHint}
                    />
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
                    .filter(step => !isExternalSync || !['hours', 'personality', 'rules', 'payment'].includes(step.id))
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
            <div ref={stepTopRef} style={{ textAlign: 'center', marginBottom: 24, scrollMarginTop: 16 }}>
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

            {/* Navigation buttons — toujours visibles, même sur une étape longue */}
            <div className="agent-nav" style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 24,
                position: 'sticky', bottom: 0, zIndex: 10,
                padding: '14px 0', background: 'linear-gradient(180deg, transparent, #0f172a 28%)',
            }}>
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

                {currentStep < 7 ? (
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
                ) : currentStep === 7 ? (
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
