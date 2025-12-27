'use client'

import { motion } from 'framer-motion'
import { Check, Zap, Crown, Sparkles, ArrowRight, Gift } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

interface Plan {
    id: string
    name: string
    price_monthly: number
    price_yearly: number
    credits_per_month: number
    max_agents: number
    max_whatsapp_numbers: number
    is_popular: boolean
    description: string
    features: string[]
}

// Fallback plans if API fails
const fallbackPlans: Plan[] = [
    {
        id: 'starter',
        name: 'Starter',
        price_monthly: 5000,
        price_yearly: 50000,
        credits_per_month: 500,
        max_agents: 2,
        max_whatsapp_numbers: 1,
        is_popular: false,
        description: 'Parfait pour démarrer',
        features: ['500 crédits/mois', '2 agents IA', '1 numéro WhatsApp', 'Support email', 'Analytics de base']
    },
    {
        id: 'pro',
        name: 'Pro',
        price_monthly: 15000,
        price_yearly: 150000,
        credits_per_month: 2000,
        max_agents: 5,
        max_whatsapp_numbers: 3,
        is_popular: true,
        description: 'Pour les entreprises en croissance',
        features: ['2000 crédits/mois', '5 agents IA', '3 numéros WhatsApp', 'Support prioritaire', 'Analytics avancés', 'API Access']
    },
    {
        id: 'business',
        name: 'Business',
        price_monthly: 35000,
        price_yearly: 350000,
        credits_per_month: 10000,
        max_agents: -1,
        max_whatsapp_numbers: 10,
        is_popular: false,
        description: 'Solution complète',
        features: ['10000 crédits/mois', 'Agents illimités', '10 numéros WhatsApp', 'Support dédié 24/7', 'Formation incluse', 'API Premium']
    }
]

const planIcons = {
    'Starter': Zap,
    'Pro': Crown,
    'Business': Sparkles
}

const planGradients = {
    'Starter': { bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59, 130, 246, 0.3)' },
    'Pro': { bg: 'linear-gradient(135deg, #25D366, #10b981)', glow: 'rgba(37, 211, 102, 0.4)' },
    'Business': { bg: 'linear-gradient(135deg, #f59e0b, #f97316)', glow: 'rgba(245, 158, 11, 0.3)' }
}

export default function Pricing() {
    const [isYearly, setIsYearly] = useState(false)
    const [plans, setPlans] = useState<Plan[]>(fallbackPlans)

    useEffect(() => {
        fetch('/api/plans')
            .then(res => res.json())
            .then(data => {
                if (data.plans && data.plans.length > 0) {
                    const formattedPlans = data.plans.map((p: any) => ({
                        ...p,
                        features: p.features || [
                            `${p.credits_per_month} crédits/mois`,
                            `${p.max_agents === -1 ? 'Illimité' : p.max_agents} agents`,
                            `${p.max_whatsapp_numbers} numéro(s) WhatsApp`,
                            p.is_popular ? 'Support prioritaire' : 'Support email'
                        ]
                    }))
                    setPlans(formattedPlans)
                }
            })
            .catch(() => setPlans(fallbackPlans))
    }, [])

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR').format(price)
    }

    return (
        <section id="pricing" style={{
            padding: '120px 24px',
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                top: '30%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 800,
                height: 800,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 60 }}
                >
                    <h2 style={{
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 16,
                        lineHeight: 1.2
                    }}>
                        Des tarifs{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>transparents</span>
                    </h2>
                    <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 500, margin: '0 auto 32px' }}>
                        Choisissez le plan adapté à votre activité. Changez à tout moment.
                    </p>

                    {/* Toggle */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: 6,
                        borderRadius: 100,
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <button
                            onClick={() => setIsYearly(false)}
                            style={{
                                padding: '12px 24px',
                                borderRadius: 100,
                                border: 'none',
                                background: !isYearly ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'transparent',
                                color: !isYearly ? 'white' : '#94a3b8',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            Mensuel
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            style={{
                                padding: '12px 24px',
                                borderRadius: 100,
                                border: 'none',
                                background: isYearly ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'transparent',
                                color: isYearly ? 'white' : '#94a3b8',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            Annuel
                            <span style={{
                                padding: '4px 10px',
                                borderRadius: 100,
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#f59e0b',
                                fontSize: 12,
                                fontWeight: 700
                            }}>
                                -17%
                            </span>
                        </button>
                    </div>
                </motion.div>

                {/* Free trial banner */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 16,
                        padding: '16px 32px',
                        borderRadius: 100,
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(37, 211, 102, 0.2)',
                        marginBottom: 48,
                        maxWidth: 500,
                        margin: '0 auto 48px'
                    }}
                >
                    <Gift style={{ width: 24, height: 24, color: '#25D366' }} />
                    <div style={{ color: 'white', fontWeight: 500 }}>
                        <span style={{ color: '#25D366', fontWeight: 700 }}>100 crédits gratuits</span> pour tester
                    </div>
                    <Link href="/register" style={{ textDecoration: 'none' }}>
                        <motion.span
                            whileHover={{ x: 5 }}
                            style={{ color: '#25D366', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                            Essayer <ArrowRight style={{ width: 16, height: 16 }} />
                        </motion.span>
                    </Link>
                </motion.div>

                {/* Plans */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 32,
                    alignItems: 'stretch'
                }}>
                    {plans.map((plan, index) => {
                        const Icon = planIcons[plan.name as keyof typeof planIcons] || Zap
                        const colors = planGradients[plan.name as keyof typeof planGradients] || planGradients.Starter
                        const price = isYearly ? Math.round(plan.price_monthly * 10) : plan.price_monthly

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.15 }}
                                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                                style={{
                                    padding: 40,
                                    borderRadius: 32,
                                    background: plan.is_popular
                                        ? 'linear-gradient(180deg, rgba(37, 211, 102, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)'
                                        : 'rgba(15, 23, 42, 0.6)',
                                    backdropFilter: 'blur(20px)',
                                    border: plan.is_popular
                                        ? '2px solid rgba(37, 211, 102, 0.4)'
                                        : '1px solid rgba(148, 163, 184, 0.1)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                {/* Popular badge */}
                                {plan.is_popular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 24,
                                        right: 24,
                                        padding: '8px 16px',
                                        borderRadius: 100,
                                        background: 'linear-gradient(135deg, #25D366, #10b981)',
                                        color: 'white',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1
                                    }}>
                                        Populaire
                                    </div>
                                )}

                                {/* Icon & Name */}
                                <div style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 20,
                                    background: colors.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 24,
                                    boxShadow: `0 15px 35px ${colors.glow}`
                                }}>
                                    <Icon style={{ width: 32, height: 32, color: 'white' }} />
                                </div>

                                <h3 style={{
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: 'white',
                                    marginBottom: 8
                                }}>
                                    {plan.name}
                                </h3>
                                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                                    {plan.description}
                                </p>

                                {/* Price */}
                                <div style={{ marginBottom: 32 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        <span style={{
                                            fontSize: 48,
                                            fontWeight: 800,
                                            background: plan.is_popular
                                                ? 'linear-gradient(135deg, #25D366, #6ee7b7)'
                                                : 'linear-gradient(135deg, #fff, #94a3b8)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent'
                                        }}>
                                            {formatPrice(price)}
                                        </span>
                                        <span style={{ fontSize: 18, color: '#64748b', fontWeight: 500 }}>
                                            FCFA/{isYearly ? 'an' : 'mois'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                        {formatPrice(plan.credits_per_month)} crédits inclus
                                    </div>
                                </div>

                                {/* Features */}
                                <div style={{ flex: 1, marginBottom: 32 }}>
                                    {plan.features.map((feature, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            marginBottom: 14
                                        }}>
                                            <div style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                background: plan.is_popular
                                                    ? 'rgba(37, 211, 102, 0.2)'
                                                    : 'rgba(148, 163, 184, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Check style={{
                                                    width: 14,
                                                    height: 14,
                                                    color: plan.is_popular ? '#25D366' : '#94a3b8'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: 15, color: '#e2e8f0' }}>
                                                {feature}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Button */}
                                <Link href="/register" style={{ textDecoration: 'none' }}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            width: '100%',
                                            padding: '16px 24px',
                                            borderRadius: 16,
                                            border: plan.is_popular ? 'none' : '2px solid rgba(148, 163, 184, 0.2)',
                                            background: plan.is_popular
                                                ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                                : 'transparent',
                                            color: plan.is_popular ? 'white' : '#e2e8f0',
                                            fontWeight: 600,
                                            fontSize: 16,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8
                                        }}
                                    >
                                        Choisir {plan.name}
                                        <ArrowRight style={{ width: 18, height: 18 }} />
                                    </motion.button>
                                </Link>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Enterprise CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        marginTop: 64,
                        padding: '32px 48px',
                        borderRadius: 24,
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 24
                    }}
                >
                    <div>
                        <h4 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 8 }}>
                            Besoin d'une solution sur-mesure ?
                        </h4>
                        <p style={{ fontSize: 15, color: '#94a3b8' }}>
                            Contactez-nous pour un plan personnalisé adapté à votre entreprise.
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '14px 28px',
                            borderRadius: 12,
                            border: '2px solid rgba(37, 211, 102, 0.4)',
                            background: 'rgba(37, 211, 102, 0.1)',
                            color: '#25D366',
                            fontWeight: 600,
                            fontSize: 15,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        Contacter l'équipe
                        <ArrowRight style={{ width: 16, height: 16 }} />
                    </motion.button>
                </motion.div>
            </div>
        </section>
    )
}
