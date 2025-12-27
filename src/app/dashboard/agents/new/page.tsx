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
    RefreshCw
} from 'lucide-react'
import Link from 'next/link'

const steps = [
    { id: 'info', title: 'Informations', icon: Bot },
    { id: 'mission', title: 'Mission', icon: Target },
    { id: 'personality', title: 'Personnalité', icon: Sparkles },
    { id: 'settings', title: 'Paramètres', icon: Settings },
    { id: 'whatsapp', title: 'WhatsApp', icon: Smartphone },
]

const missionTemplates = [
    {
        id: 'ecommerce',
        title: '🛒 E-commerce / Boutique',
        description: 'Vente de produits en ligne, catalogue, commandes',
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
        title: '🍽️ Restaurant / Fast-food',
        description: 'Commandes de plats, menu du jour, livraison',
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
        title: '🏨 Hôtel / Hébergement',
        description: 'Réservation de chambres, services hôteliers',
        prompt: `Tu es le concierge virtuel de notre hôtel.

Ton rôle:
- Renseigner sur les types de chambres et tarifs
- Effectuer des réservations
- Informer sur les services (restaurant, spa, piscine)
- Répondre aux questions des clients

Pour une réservation, collecte:
1. Dates d'arrivée et de départ
2. Type de chambre souhaité
3. Nombre d'adultes et d'enfants
4. Préférences (vue, étage, lit king, etc.)
5. Nom complet et téléphone
6. Heure d'arrivée approximative

Règles:
- Propose des surclassements si disponibles
- Mentionne les services inclus (petit-déjeuner, wifi, parking)
- Confirme le tarif total et les conditions d'annulation
- Sois accueillant et professionnel`,
    },
    {
        id: 'salon',
        title: '💇 Salon / Institut de beauté',
        description: 'Prise de rendez-vous, services beauté',
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
        title: '🔧 Services / Artisan',
        description: 'Devis, interventions, prestations diverses',
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
        title: '✏️ Personnalisé',
        description: 'Créez votre propre mission sur mesure',
        prompt: '',
    },
]


const personalities = [
    { id: 'professional', name: 'Professionnel', emoji: '👔', description: 'Formel et courtois' },
    { id: 'friendly', name: 'Amical', emoji: '😊', description: 'Chaleureux et accessible' },
    { id: 'casual', name: 'Décontracté', emoji: '🤙', description: 'Cool et moderne' },
    { id: 'formal', name: 'Formel', emoji: '🎩', description: 'Très formel et respectueux' },
]

export default function NewAgentPage() {
    const router = useRouter()
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createdAgent, setCreatedAgent] = useState<any>(null)

    // WhatsApp connection state
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [whatsappStatus, setWhatsappStatus] = useState<'idle' | 'connecting' | 'qr_ready' | 'connected' | 'error'>('idle')
    const [connectedPhone, setConnectedPhone] = useState<string | null>(null)

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
    })

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
            case 0:
                return formData.name.trim() !== ''
            case 1:
                return formData.mission !== '' && formData.systemPrompt.trim() !== ''
            case 2:
                return formData.personality !== ''
            case 3:
                return true
            case 4:
                return true // WhatsApp step is optional
            default:
                return false
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
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la création')
            }

            setCreatedAgent(data.agent)
            setCurrentStep(4) // Move to WhatsApp step
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    // Connect WhatsApp
    const connectWhatsApp = async () => {
        if (!createdAgent) return

        console.log('INITIATING WHATSAPP CONNECTION for agent:', createdAgent.id)
        setWhatsappStatus('connecting')
        setError(null)

        try {
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: createdAgent.id }),
            })

            console.log('Connect response status:', response.status)
            const data = await response.json()
            console.log('Connect response data:', data)

            if (!response.ok) {
                throw new Error(data.error || 'Erreur de connexion')
            }

            if (data.qrCode) {
                setQrCode(data.qrCode)
                setWhatsappStatus('qr_ready')
            } else if (data.status === 'connected') {
                setWhatsappStatus('connected')
                setConnectedPhone(data.phoneNumber)
            }
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
                                Nom de l'agent *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateFormData('name', e.target.value)}
                                placeholder="Ex: Assistant Commercial"
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => updateFormData('description', e.target.value)}
                                placeholder="Décrivez brièvement le rôle de cet agent..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'none' }}
                            />
                        </div>
                    </div>
                )

            case 1:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                Choisissez une mission
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
                                Instructions système (prompt) *
                            </label>
                            <textarea
                                value={formData.systemPrompt}
                                onChange={(e) => updateFormData('systemPrompt', e.target.value)}
                                placeholder="Décrivez en détail comment l'agent doit se comporter..."
                                rows={8}
                                style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace', fontSize: 13 }}
                            />
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                Plus les instructions sont détaillées, meilleur sera le comportement de l'agent.
                            </p>
                        </div>
                    </div>
                )

            case 2:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                                Personnalité de l'agent
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
                                <h3 style={{ fontWeight: 500, color: 'white' }}>Utiliser des emojis</h3>
                                <p style={{ fontSize: 13, color: '#64748b' }}>L'agent utilisera des emojis dans ses réponses</p>
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

            case 3:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Délai de réponse: {formData.responseDelay}s
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
                                <span>1s (rapide)</span>
                                <span>10s (naturel)</span>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Langue principale
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

                        {/* Summary */}
                        <div style={{
                            padding: 20,
                            background: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: 12
                        }}>
                            <h3 style={{ fontWeight: 600, color: 'white', marginBottom: 16 }}>Récapitulatif</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>Nom</span>
                                    <span style={{ color: 'white', fontWeight: 500 }}>{formData.name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>Personnalité</span>
                                    <span style={{ color: 'white', fontWeight: 500 }}>
                                        {personalities.find(p => p.id === formData.personality)?.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>Emojis</span>
                                    <span style={{ color: 'white', fontWeight: 500 }}>{formData.useEmojis ? 'Oui' : 'Non'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748b' }}>Délai</span>
                                    <span style={{ color: 'white', fontWeight: 500 }}>{formData.responseDelay}s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )

            case 4:
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
                                    Connecter WhatsApp
                                </h3>
                                <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 400 }}>
                                    Scannez le QR code avec votre téléphone pour connecter WhatsApp à cet agent.
                                </p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonPrimaryStyle}
                                >
                                    <QrCode style={{ width: 20, height: 20 }} />
                                    Afficher le QR Code
                                </button>
                                <button
                                    onClick={handleFinish}
                                    style={{ ...buttonSecondaryStyle, marginTop: 8 }}
                                >
                                    Passer cette étape
                                </button>
                            </>
                        )}

                        {whatsappStatus === 'connecting' && (
                            <>
                                <Loader2 style={{ width: 48, height: 48, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: '#94a3b8' }}>Génération du QR code...</p>
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
                                    Scannez ce code avec WhatsApp sur votre téléphone
                                </p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonSecondaryStyle}
                                >
                                    <RefreshCw style={{ width: 18, height: 18 }} />
                                    Régénérer le QR code
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
                                    WhatsApp connecté ! 🎉
                                </h3>
                                <p style={{ color: '#94a3b8' }}>
                                    Numéro: {connectedPhone}
                                </p>
                                <button
                                    onClick={handleFinish}
                                    style={buttonPrimaryStyle}
                                >
                                    Terminer
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
                                    Erreur de connexion
                                </h3>
                                <p style={{ color: '#f87171' }}>{error}</p>
                                <button
                                    onClick={connectWhatsApp}
                                    style={buttonPrimaryStyle}
                                >
                                    <RefreshCw style={{ width: 18, height: 18 }} />
                                    Réessayer
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
                    Retour aux agents
                </Link>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    Créer un nouvel agent
                </h1>
                <p style={{ color: '#94a3b8' }}>
                    Configurez votre assistant IA en quelques étapes
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
                    {error}
                </div>
            )}

            {/* Step content */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ ...cardStyle, marginBottom: 32 }}
            >
                {renderStepContent()}
            </motion.div>

            {/* Navigation buttons */}
            {currentStep < 4 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button
                        onClick={() => setCurrentStep(prev => prev - 1)}
                        disabled={currentStep === 0}
                        style={{
                            ...buttonSecondaryStyle,
                            opacity: currentStep === 0 ? 0.5 : 1,
                            cursor: currentStep === 0 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <ArrowLeft style={{ width: 18, height: 18 }} />
                        Précédent
                    </button>

                    {currentStep < 3 ? (
                        <button
                            onClick={() => setCurrentStep(prev => prev + 1)}
                            disabled={!canProceed()}
                            style={{
                                ...buttonPrimaryStyle,
                                opacity: canProceed() ? 1 : 0.5,
                                cursor: canProceed() ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Suivant
                            <ArrowRight style={{ width: 18, height: 18 }} />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateAgent}
                            disabled={loading || !canProceed()}
                            style={{
                                ...buttonPrimaryStyle,
                                opacity: !loading && canProceed() ? 1 : 0.5,
                                cursor: !loading && canProceed() ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                                    Création...
                                </>
                            ) : (
                                <>
                                    Créer l'agent
                                    <Check style={{ width: 18, height: 18 }} />
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
