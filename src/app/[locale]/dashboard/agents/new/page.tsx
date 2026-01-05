'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { Clock, Shield, MapPin, Globe } from 'lucide-react'

export default function NewAgentPage() {
    const t = useTranslations('Agents')
    const tCommon = useTranslations('Agents.connect') // specialized namespace if needed or just access via t('connect...')
    const router = useRouter()
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createdAgent, setCreatedAgent] = useState<any>(null)

    // WhatsApp connection state
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'>('idle')
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null)

    // Conflict Detection State
    const [conflictStatus, setConflictStatus] = useState<'idle' | 'checking' | 'safe' | 'conflict' | 'error'>('idle')
    const [conflictReason, setConflictReason] = useState('')

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        mission: '',
        systemPrompt: '',
        personality: 'friendly',
        useEmojis: true,
        responseDelay: 2,
        language: 'fr',
        enableVoice: false,
        voiceId: 'alloy',
        // NEW FIELDS
        business_address: '',
        contact_phone: '',
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
        }
    })

    const steps = [
        { id: 'info', title: t('Wizard.steps.info'), icon: Bot },
        { id: 'hours', title: 'Horaires', icon: Clock }, // New Step
        { id: 'mission', title: t('Wizard.steps.mission'), icon: Target },
        { id: 'personality', title: t('Wizard.steps.personality'), icon: Sparkles },
        { id: 'rules', title: 'Règles', icon: Shield }, // New Step
        { id: 'settings', title: t('Wizard.steps.settings'), icon: Settings },
        { id: 'whatsapp', title: t('Wizard.steps.whatsapp'), icon: Smartphone },
    ]

    const missionTemplates = [
        {
            id: 'ecommerce',
            title: t('Templates.ecommerce.title'),
            description: t('Templates.ecommerce.description'),
            prompt: `Tu es l'assistant commercial de notre boutique en ligne.

Ton rôle:
- Accueillir les clients et répondre à leurs questions
- Présenter les produits disponibles (voir liste des produits)
- Aider à choisir les bons produits selon leurs besoins
- Prendre les commandes et informations de livraison

Pour commander, tu dois collecter:
1. Le(s) produit(s) souhaité(s) et quantités
2. Nom complet du client
3. Numéro de téléphone
4. Adresse de livraison complète
5. Mode de paiement (Mobile Money, carte, ou cash à la livraison)

Règles:
- Sois courtois et serviable
- Propose toujours des produits complémentaires
- Confirme le total avant de valider la commande
- Donne le délai de livraison estimé`,
        },
        {
            id: 'restaurant',
            title: t('Templates.restaurant.title'),
            description: t('Templates.restaurant.description'),
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
            description: t('Templates.hotel.description'),
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
            description: t('Templates.salon.description'),
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
        {
            id: 'services',
            title: t('Templates.services.title'),
            description: t('Templates.services.description'),
            prompt: `Tu es l'assistant de notre entreprise de services.

Ton rôle:
- Comprendre les besoins du client
- Expliquer nos services et tarifs
- Prendre les demandes d'intervention ou de devis
- Fixer les rendez-vous

Pour une intervention, collecte:
1. Nature du problème ou service demandé
2. Adresse complète
3. Disponibilités du client
4. Nom et téléphone
5. Urgence (urgent ou peut attendre)

Règles:
- Pose des questions pour bien comprendre le besoin
- Donne une fourchette de prix si possible
- Propose un créneau de passage
- Confirme tous les détails avant de valider`,
        },
        {
            id: 'custom',
            title: t('Templates.custom.title'),
            description: t('Templates.custom.description'),
            prompt: '',
        },
    ]

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
        updateFormData('mission', template.id)
        if (template.id !== 'custom') {
            updateFormData('systemPrompt', template.prompt)
        }
    }

    const canProceed = () => {
        switch (currentStep) {
            case 0: // Info
                return formData.name.trim() !== ''
            case 1: // Hours
                return true
            case 2: // Mission
                return formData.mission !== '' && formData.systemPrompt.trim() !== ''
            case 3: // Personality
                return formData.personality !== ''
            case 4: // Rules
                return conflictStatus !== 'conflict'
            case 5: // Settings
                return true
            case 6: // WhatsApp
                return true
            default:
                return false
        }
    }

    // AI Generation
    const handleGenerate = async () => {
        if (!formData.name) {
            alert("Nom requis")
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
                    context: formData.mission !== 'custom' ?
                        missionTemplates.find(t => t.id === formData.mission)?.title : 'Assistant Polyvalent'
                })
            })
            const data = await res.json()
            if (res.ok && data.data?.text) {
                updateFormData('description', data.data.text)
            } else {
                alert(data.error)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setGenerating(false)
        }
    }

    // GPS Helper
    const getLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toString(),
                    longitude: pos.coords.longitude.toString()
                }))
            }, () => alert("Impossible de récupérer la position."))
        }
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
                        phone: formData.contact_phone,
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

    // Create agent via API
    const handleCreateAgent = async () => {
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
                    business_address: formData.business_address,
                    contact_phone: formData.contact_phone,
                    site_url: formData.site_url,
                    latitude: parseFloat(formData.latitude) || null,
                    longitude: parseFloat(formData.longitude) || null,
                    business_hours: formData.business_hours,
                    custom_rules: formData.custom_rules,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création')
            }

            setCreatedAgent(data.agent)
            setCurrentStep(6) // Move to WhatsApp step
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    // Connect WhatsApp
    const connectWhatsApp = async () => {
        if (!createdAgent) {
            setError(t('connect.errors.noAgent'))
            return
        }

        setWhatsappStatus('connecting')
        setError(null)

        try {
            // Step 1: Initiate connection
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: createdAgent.id }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || t('connect.error'))
            }

            // If already connected
            if (data.data?.status === 'connected') {
                setWhatsappStatus('connected')
                setConnectedPhone(data.data.phoneNumber || '')
                return
            }

            // Step 2: Poll for QR code (it takes a moment for the service to generate)
            const pollForQR = async (attempts = 0): Promise<void> => {
                if (attempts >= 15) { // Max 15 attempts (30 seconds)
                    throw new Error('Délai d\'attente dépassé pour le QR code')
                }

                await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 sec

                const statusRes = await fetch(`/api/whatsapp/connect?agentId=${createdAgent.id}`)
                const statusData = await statusRes.json()

                if (statusData.data?.qrCode) {
                    setQrCode(statusData.data.qrCode)
                    setWhatsappStatus('qr_ready')
                    return
                } else if (statusData.data?.status === 'connected') {
                    setWhatsappStatus('connected')
                    setConnectedPhone(statusData.data.phoneNumber || '')
                    return
                } else {
                    // Keep polling
                    return pollForQR(attempts + 1)
                }
            }

            await pollForQR()

        } catch (err) {
            console.error('CONNECT ERROR:', err)
            setError((err as Error).message)
            setWhatsappStatus('error')
        }
    }

    // Poll for connection status
    useEffect(() => {
        if (whatsappStatus !== 'qr_ready' || !createdAgent) return

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/whatsapp/connect?agentId=${createdAgent.id}`)
                const data = await response.json()

                if (data.status === 'connected') {
                    setWhatsappStatus('connected')
                    setConnectedPhone(data.phoneNumber)
                    clearInterval(interval)
                } else if (data.qrCode && data.qrCode !== qrCode) {
                    setQrCode(data.qrCode)
                }
            } catch (err) {
                console.error('Polling error:', err)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [whatsappStatus, createdAgent, qrCode])

    const handleFinish = () => {
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
            case 0:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                                    {generating ? (
                                        <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <Sparkles style={{ width: 12, height: 12 }} />
                                    )}
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
                        </div>

                        {/* NEW FIELDS: Address & Contact */}
                        <div>
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
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Téléphone Support
                                </label>
                                <input
                                    type="text"
                                    value={formData.contact_phone}
                                    onChange={(e) => updateFormData('contact_phone', e.target.value)}
                                    placeholder="+225..."
                                    style={inputStyle}
                                />
                            </div>
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
                        </div>
                    </div>
                )

            case 1: // HOURS
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(formData.business_hours).map(([day, hours]) => (
                            <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'rgba(30, 41, 59, 0.3)', borderRadius: 8 }}>
                                <span style={{ textTransform: 'capitalize', color: 'white', width: 100 }}>{t(`WeekDays.${day}`)}</span>
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
                                                style={{ ...inputStyle, padding: '4px 8px', width: 100 }}
                                            />
                                        </>
                                    ) : (
                                        <span style={{ color: '#64748b', fontStyle: 'italic', width: 216, textAlign: 'center' }}>Fermé</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )

            case 2: // MISSION
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                {t('Form.mission.label')}
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {missionTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => selectMissionTemplate(template)}
                                        style={{
                                            padding: 16,
                                            border: `2px solid ${formData.mission === template.id ? '#10b981' : 'rgba(148, 163, 184, 0.1)'}`,
                                            borderRadius: 12,
                                            textAlign: 'left',
                                            background: formData.mission === template.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <h3 style={{ fontWeight: 600, color: 'white', marginBottom: 4 }}>{template.title}</h3>
                                        <p style={{ fontSize: 13, color: '#94a3b8' }}>{template.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('Form.mission.systemPromptLabel')} *
                            </label>
                            <textarea
                                value={formData.systemPrompt}
                                onChange={(e) => updateFormData('systemPrompt', e.target.value)}
                                placeholder={t('Form.mission.promptPlaceholder')}
                                rows={8}
                                style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace', fontSize: 13 }}
                            />
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                {t('Form.mission.hint')}
                            </p>
                        </div>
                    </div>
                )

            case 3: // PERSONALITY
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                {t('Form.personality.label')}
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
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
                                placeholder="- Livraison gratuite > 50.000 FCFA..."
                                rows={8}
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
                                    {conflictStatus === 'conflict' ? 'Conflit Détecté' : 'Vérification de cohérence'}
                                </h4>
                                <p style={{ fontSize: 13, color: '#94a3b8' }}>
                                    {conflictStatus === 'conflict' ? conflictReason : "L'IA vérifie si vos règles contredisent les horaires."}
                                </p>
                            </div>
                            <button
                                onClick={checkConflict}
                                disabled={formData.custom_rules.length < 5 || conflictStatus === 'checking'}
                                style={{
                                    ...buttonSecondaryStyle,
                                    background: 'rgba(30, 41, 59, 0.8)',
                                    opacity: formData.custom_rules.length < 5 ? 0.5 : 1
                                }}
                            >
                                {conflictStatus === 'checking' ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                Vérifier
                            </button>
                        </div>
                    </div>
                )

            case 5: // SETTINGS
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                {t('Form.settings.responseDelay')}: {formData.responseDelay}s
                            </label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={formData.responseDelay}
                                onChange={(e) => updateFormData('responseDelay', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: '#10b981' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                <span>1s ({t('Form.settings.fast')})</span>
                                <span>10s ({t('Form.settings.natural')})</span>
                            </div>
                        </div>

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

                        {/* Voice Settings (Premium) */}
                        <div style={{
                            padding: 20,
                            background: 'rgba(16, 185, 129, 0.05)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 12,
                            marginTop: 12
                        }}>
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
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>{t('Form.summary.delay')}</span>
                                    <span style={{ color: 'white', fontWeight: 500 }}>{formData.responseDelay}s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )

            case 6: // WHATSAPP
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 20 }}>
                        {whatsappStatus === 'idle' && (
                            <>
                                <div style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 20,
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <QrCode style={{ width: 40, height: 40, color: '#34d399' }} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 600, color: 'white', textAlign: 'center' }}>
                                    {t('connect.title')}
                                </h3>
                                <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
                                    {t('connect.scanPrompt')}
                                </p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonPrimaryStyle}
                                >
                                    <QrCode style={{ width: 20, height: 20 }} />
                                    {t('Wizard.buttons.generateQr')}
                                </button>
                                <button
                                    onClick={handleFinish}
                                    style={{ ...buttonSecondaryStyle, marginTop: 8 }}
                                >
                                    {t('Wizard.buttons.skip')}
                                </button>
                            </>
                        )}

                        {whatsappStatus === 'connecting' && (
                            <>
                                <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#94a3b8' }}>{t('connect.initialization')}</p>
                            </>
                        )}

                        {whatsappStatus === 'qr_ready' && qrCode && (
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
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonSecondaryStyle}
                                >
                                    <RefreshCw style={{ width: 18, height: 18 }} />
                                    {t('connect.actions.regenerate')}
                                </button>
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
                                <button
                                    onClick={handleFinish}
                                    style={buttonPrimaryStyle}
                                >
                                    {t('Wizard.buttons.finish')}
                                    <ArrowRight style={{ width: 20, height: 20 }} />
                                </button>
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
                                    {t('Wizard.buttons.retry')}
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
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 8 }}>
                {steps.map((step, index) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: index < currentStep
                                ? '#10b981'
                                : index === currentStep
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : 'rgba(51, 65, 85, 0.5)',
                            color: index <= currentStep ? '#34d399' : '#64748b'
                        }}>
                            {index < currentStep ? (
                                <Check style={{ width: 20, height: 20, color: 'white' }} />
                            ) : (
                                <step.icon style={{ width: 20, height: 20 }} />
                            )}
                        </div>
                        {index < steps.length - 1 && (
                            <div style={{
                                width: 40,
                                height: 4,
                                background: index < currentStep ? '#10b981' : 'rgba(51, 65, 85, 0.5)',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button
                    onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                    disabled={currentStep === 0 || currentStep === 4}
                    style={{
                        ...buttonSecondaryStyle,
                        opacity: currentStep === 0 || currentStep === 4 ? 0 : 1,
                        pointerEvents: currentStep === 0 || currentStep === 4 ? 'none' : 'auto'
                    }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    {t('Wizard.buttons.prev')}
                </button>

                {currentStep < 6 ? (
                    <button
                        onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
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
        </div>
    )
}
