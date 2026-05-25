'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

interface Step {
    key: string
    done: boolean
    note?: string | null
}

const STEP_CONFIG: Record<string, {
    title: string
    description: string
    detail: string
    href: string
    cta: string
}> = {
    agent_created: {
        title: 'Créer votre agent IA',
        description: 'Votre agent est créé. C\'est votre assistant virtuel WhatsApp.',
        detail: 'L\'agent IA répond automatiquement aux messages de vos clients 24h/24. Vous pouvez créer plusieurs agents selon vos besoins (boutique, restaurant, support…).',
        href: '/dashboard/agents',
        cta: 'Gérer mes agents',
    },
    whatsapp_connected: {
        title: 'Connecter un numéro WhatsApp',
        description: 'Liez un numéro WhatsApp réel à votre agent.',
        detail: 'Sans numéro connecté, votre agent ne peut ni recevoir ni envoyer de messages. Allez dans les paramètres de l\'agent → onglet "WhatsApp" → scannez le QR code avec votre téléphone. Utilisez un numéro dédié (pas votre numéro personnel).',
        href: '/dashboard/agents',
        cta: 'Connecter WhatsApp',
    },
    knowledge_added: {
        title: 'Alimenter la base de connaissances',
        description: 'Donnez à votre agent les informations pour répondre correctement.',
        detail: 'La base de connaissances contient tout ce que votre agent doit savoir : vos produits, vos services, vos horaires, votre FAQ, vos tarifs. Sans ces informations, l\'agent répondra de façon générique. Ajoutez du texte, importez un PDF ou un lien web.',
        href: '/dashboard/agents',
        cta: 'Ajouter des connaissances',
    },
    products_added: {
        title: 'Ajouter votre catalogue produits',
        description: 'Listez vos produits pour que l\'agent puisse prendre des commandes.',
        detail: 'Si vous avez une boutique ou un menu, ajoutez vos produits avec photos, prix et descriptions. L\'agent pourra présenter votre catalogue, prendre des commandes et les enregistrer automatiquement. Étape optionnelle pour les missions Support.',
        href: '/dashboard/products',
        cta: 'Gérer mes produits',
    },
    first_conversation: {
        title: 'Tester votre agent',
        description: 'Envoyez un premier message à votre numéro WhatsApp connecté.',
        detail: 'Prenez votre téléphone et envoyez un message sur le numéro WhatsApp que vous avez connecté. Vérifiez que l\'agent répond correctement. Si la réponse n\'est pas satisfaisante, enrichissez la base de connaissances ou affinez les instructions de l\'agent.',
        href: '/dashboard/conversations',
        cta: 'Voir les conversations',
    },
}

export default function OnboardingChecklist() {
    const locale = useLocale()
    const [steps, setSteps] = useState<Step[]>([])
    const [allDone, setAllDone] = useState(false)
    const [loading, setLoading] = useState(true)
    const [expandedKey, setExpandedKey] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/dashboard/onboarding')
            .then(r => r.json())
            .then(d => {
                if (d.data) {
                    setSteps(d.data.steps)
                    setAllDone(d.data.allDone)
                }
            })
            .finally(() => setLoading(false))
    }, [])

    if (loading || allDone) return null

    const doneCount = steps.filter(s => s.done).length
    const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

    return (
        <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            style={{
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 16,
                padding: '20px 24px',
                marginBottom: 24,
                backdropFilter: 'blur(8px)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(59, 130, 246, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <span style={{ fontSize: 20 }}>🚀</span>
                    </div>
                    <div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
                            Démarrage rapide — {doneCount}/{steps.length} étapes complètes
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                            Suivez ces étapes pour que votre agent soit pleinement opérationnel
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ height: 4, background: 'rgba(148, 163, 184, 0.1)', borderRadius: 4, overflow: 'hidden' }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', borderRadius: 4 }}
                    />
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{progress}% complété</div>
            </div>

            {/* Steps */}
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                        {steps.map((step, i) => {
                            const config = STEP_CONFIG[step.key]
                            if (!config) return null
                            const isExpanded = expandedKey === step.key
                            const isNext = !step.done && steps.slice(0, i).every(s => s.done)

                            return (
                                <div key={step.key}
                                    style={{
                                        background: step.done
                                            ? 'rgba(16, 185, 129, 0.05)'
                                            : isNext
                                                ? 'rgba(59, 130, 246, 0.08)'
                                                : 'rgba(15, 23, 42, 0.3)',
                                        border: `1px solid ${step.done
                                            ? 'rgba(16, 185, 129, 0.2)'
                                            : isNext
                                                ? 'rgba(59, 130, 246, 0.25)'
                                                : 'rgba(148, 163, 184, 0.06)'}`,
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Step header */}
                                    <div
                                        onClick={() => !step.done && setExpandedKey(isExpanded ? null : step.key)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 16px',
                                            cursor: step.done ? 'default' : 'pointer',
                                        }}
                                    >
                                        {step.done
                                            ? <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                                            : <Circle size={20} style={{ color: isNext ? '#3b82f6' : '#334155', flexShrink: 0 }} />
                                        }
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                color: step.done ? '#94a3b8' : 'white',
                                                fontWeight: 600, fontSize: 13,
                                                textDecoration: step.done ? 'line-through' : 'none',
                                                opacity: step.done ? 0.6 : 1,
                                            }}>
                                                {i + 1}. {config.title}
                                                {isNext && !step.done && (
                                                    <span style={{ marginLeft: 8, fontSize: 10, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                                                        PROCHAINE ÉTAPE
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                                {config.description}
                                                {step.note && (
                                                    <span style={{ display: 'block', fontSize: 12, color: '#38bdf8', fontWeight: 500, marginTop: 4, background: 'rgba(56,189,248,0.08)', borderRadius: 6, padding: '3px 8px' }}>
                                                        ℹ️ {step.note}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!step.done && (
                                            <div style={{ color: '#475569', flexShrink: 0 }}>
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded detail */}
                                    <AnimatePresence>
                                        {isExpanded && !step.done && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <div style={{
                                                    padding: '0 16px 16px 48px',
                                                    borderTop: '1px solid rgba(148, 163, 184, 0.06)',
                                                    paddingTop: 12,
                                                }}>
                                                    <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
                                                        {config.detail}
                                                    </p>
                                                    <Link href={`/${locale}${config.href}`}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                                            padding: '8px 16px', borderRadius: 8,
                                                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                                            color: 'white', fontSize: 12, fontWeight: 600,
                                                            textDecoration: 'none',
                                                        }}
                                                    >
                                                        {config.cta} <ExternalLink size={12} />
                                                    </Link>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    )
}
