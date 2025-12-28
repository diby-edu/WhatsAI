'use client'

import { motion } from 'framer-motion'
import { Check, Zap, Crown, Sparkles, ArrowRight, Gift, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Plan {
    id: string
    name: string
    price: number
    credits: number
    max_agents: number
    is_popular: boolean
    description: string
    features: string[]
}

// Fallback plans with correct pricing
const fallbackPlans: Plan[] = [
    {
        id: 'gratuit',
        name: 'Gratuit',
        price: 0,
        credits: 100,
        max_agents: 1,
        is_popular: false,
        description: 'Pour découvrir',
        features: ['100 crédits offerts', '1 agent IA', '1 numéro WhatsApp', 'Support communauté']
    },
    {
        id: 'starter',
        name: 'Starter',
        price: 5000,
        credits: 500,
        max_agents: 2,
        is_popular: false,
        description: 'Pour démarrer',
        features: ['500 crédits/mois', '2 agents IA', '1 numéro WhatsApp', 'Support email', 'Statistiques de base']
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 15000,
        credits: 2000,
        max_agents: 5,
        is_popular: true,
        description: 'Le plus populaire',
        features: ['2000 crédits/mois', '5 agents IA', '3 numéros WhatsApp', 'Support prioritaire', 'Analytics avancés', 'Produits illimités']
    },
    {
        id: 'business',
        name: 'Business',
        price: 35000,
        credits: 10000,
        max_agents: -1,
        is_popular: false,
        description: 'Solution complète',
        features: ['10000 crédits/mois', 'Agents illimités', '10 numéros WhatsApp', 'Support dédié 24/7', 'Formation incluse', 'API Premium']
    }
]

const planIcons: Record<string, any> = {
    'Gratuit': Zap,
    'Starter': Zap,
    'Pro': Crown,
    'Business': Sparkles
}

const planGradients: Record<string, { bg: string; glow: string }> = {
    'Gratuit': { bg: 'linear-gradient(135deg, #64748b, #94a3b8)', glow: 'rgba(100, 116, 139, 0.3)' },
    'Starter': { bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59, 130, 246, 0.3)' },
    'Pro': { bg: 'linear-gradient(135deg, #25D366, #10b981)', glow: 'rgba(37, 211, 102, 0.4)' },
    'Business': { bg: 'linear-gradient(135deg, #f59e0b, #f97316)', glow: 'rgba(245, 158, 11, 0.3)' }
}

export default function Pricing() {
    const router = useRouter()
    const [isYearly, setIsYearly] = useState(false)
    const [plans, setPlans] = useState<Plan[]>(fallbackPlans)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

    // Check authentication status
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )
                const { data: { session } } = await supabase.auth.getSession()
                setIsAuthenticated(!!session)
            } catch (e) {
                setIsAuthenticated(false)
            }
        }
        checkAuth()
    }, [])

    useEffect(() => {
        fetch('/api/plans')
            .then(res => res.json())
            .then(data => {
                if (data.plans && data.plans.length > 0) {
                    // Map API data and ensure valid numbers
                    const formattedPlans = data.plans.map((p: any) => ({
                        id: p.id || 'unknown',
                        name: p.name || 'Plan',
                        price: typeof p.price === 'number' && !isNaN(p.price) ? p.price : 0,
                        credits: typeof p.credits === 'number' && !isNaN(p.credits) ? p.credits : 0,
                        max_agents: p.max_agents || 1,
                        is_popular: p.is_popular || false,
                        description: p.description || '',
                        features: Array.isArray(p.features) ? p.features : [
                            `${p.credits || 0} crédits/mois`,
                            `${p.max_agents === -1 ? 'Illimité' : p.max_agents || 1} agents`,
                            p.is_popular ? 'Support prioritaire' : 'Support email'
                        ]
                    }))
                    setPlans(formattedPlans)
                }
            })
            .catch(() => setPlans(fallbackPlans))
    }, [])

    const formatPrice = (price: number) => {
        if (typeof price !== 'number' || isNaN(price)) return '0'
        return new Intl.NumberFormat('fr-FR').format(price)
    }

    return (
        <section id="pricing" style={{
            padding: '100px 24px 60px',
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
                    <h2 style={{
                        fontSize: 'clamp(28px, 4vw, 42px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 12,
                        lineHeight: 1.2
                    }}>
                        Des tarifs{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>transparents</span>
                    </h2>
                    <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 400, margin: '0 auto 24px' }}>
                        Choisissez le plan adapté à votre activité
                    </p>

                    {/* Toggle */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 4,
                        borderRadius: 100,
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <button
                            onClick={() => setIsYearly(false)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 100,
                                border: 'none',
                                background: !isYearly ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'transparent',
                                color: !isYearly ? 'white' : '#94a3b8',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            Mensuel
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 100,
                                border: 'none',
                                background: isYearly ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'transparent',
                                color: isYearly ? 'white' : '#94a3b8',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            Annuel
                            <span style={{
                                padding: '3px 8px',
                                borderRadius: 100,
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#f59e0b',
                                fontSize: 11,
                                fontWeight: 700
                            }}>
                                -17%
                            </span>
                        </button>
                    </div>
                </motion.div>

                {/* Plans - 4 columns */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 20,
                    alignItems: 'stretch'
                }}>
                    {plans.map((plan, index) => {
                        const Icon = planIcons[plan.name] || Zap
                        const colors = planGradients[plan.name] || planGradients.Starter
                        const price = isYearly ? Math.round((plan.price || 0) * 10) : (plan.price || 0)

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: index * 0.1 }}
                                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                style={{
                                    padding: 28,
                                    borderRadius: 24,
                                    background: plan.is_popular
                                        ? 'linear-gradient(180deg, rgba(37, 211, 102, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                                        : 'rgba(15, 23, 42, 0.6)',
                                    backdropFilter: 'blur(20px)',
                                    border: plan.is_popular
                                        ? '2px solid rgba(37, 211, 102, 0.4)'
                                        : '1px solid rgba(148, 163, 184, 0.1)',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                {/* Popular badge */}
                                {plan.is_popular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: -12,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        padding: '6px 16px',
                                        borderRadius: 100,
                                        background: 'linear-gradient(135deg, #25D366, #10b981)',
                                        color: 'white',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}>
                                        Populaire
                                    </div>
                                )}

                                {/* Icon & Name */}
                                <div style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    background: colors.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 16,
                                    boxShadow: `0 10px 25px ${colors.glow}`
                                }}>
                                    <Icon style={{ width: 26, height: 26, color: 'white' }} />
                                </div>

                                <h3 style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: 'white',
                                    marginBottom: 4
                                }}>
                                    {plan.name}
                                </h3>
                                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                                    {plan.description}
                                </p>

                                {/* Price */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        <span style={{
                                            fontSize: 36,
                                            fontWeight: 800,
                                            background: plan.is_popular
                                                ? 'linear-gradient(135deg, #25D366, #6ee7b7)'
                                                : 'linear-gradient(135deg, #fff, #94a3b8)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent'
                                        }}>
                                            {price === 0 ? 'Gratuit' : formatPrice(price)}
                                        </span>
                                        {price > 0 && (
                                            <span style={{ fontSize: 14, color: '#64748b' }}>
                                                /{isYearly ? 'an' : 'mois'}
                                            </span>
                                        )}
                                    </div>
                                    {plan.credits > 0 && (
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                            {formatPrice(plan.credits)} crédits inclus
                                        </div>
                                    )}
                                </div>

                                {/* Features */}
                                <div style={{ flex: 1, marginBottom: 20 }}>
                                    {plan.features.map((feature, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            marginBottom: 10
                                        }}>
                                            <div style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: '50%',
                                                background: plan.is_popular
                                                    ? 'rgba(37, 211, 102, 0.2)'
                                                    : 'rgba(148, 163, 184, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Check style={{
                                                    width: 12,
                                                    height: 12,
                                                    color: plan.is_popular ? '#25D366' : '#94a3b8'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                                                {feature}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Button */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={loadingPlan === plan.id}
                                    onClick={async () => {
                                        if (!isAuthenticated) {
                                            // Not logged in - redirect to register
                                            router.push('/register')
                                            return
                                        }

                                        if (plan.price === 0) {
                                            // Free plan - just go to dashboard
                                            router.push('/dashboard')
                                            return
                                        }

                                        // Authenticated with paid plan - initiate payment
                                        setLoadingPlan(plan.id)
                                        try {
                                            const res = await fetch('/api/payments/initialize', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ type: 'subscription', planId: plan.id }),
                                            })
                                            const data = await res.json()

                                            if (data.data?.paymentUrl) {
                                                window.location.href = data.data.paymentUrl
                                            } else {
                                                alert(data.error || 'Erreur lors du paiement')
                                                setLoadingPlan(null)
                                            }
                                        } catch (err) {
                                            alert('Erreur réseau')
                                            setLoadingPlan(null)
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px 20px',
                                        borderRadius: 12,
                                        border: plan.is_popular ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
                                        background: plan.is_popular
                                            ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                            : 'transparent',
                                        color: plan.is_popular ? 'white' : '#e2e8f0',
                                        fontWeight: 600,
                                        fontSize: 14,
                                        cursor: loadingPlan === plan.id ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        opacity: loadingPlan === plan.id ? 0.7 : 1
                                    }}
                                >
                                    {loadingPlan === plan.id ? (
                                        <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Chargement...</>
                                    ) : (
                                        <>{plan.price === 0 ? 'Essayer' : 'Choisir'} <ArrowRight style={{ width: 16, height: 16 }} /></>
                                    )}
                                </motion.button>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Enterprise CTA - more compact */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        marginTop: 48,
                        padding: '24px 40px',
                        borderRadius: 20,
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 16
                    }}
                >
                    <div>
                        <h4 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 4 }}>
                            Besoin d'une solution sur-mesure ?
                        </h4>
                        <p style={{ fontSize: 14, color: '#94a3b8' }}>
                            Contactez-nous pour un plan personnalisé.
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '12px 24px',
                            borderRadius: 10,
                            border: '1px solid rgba(37, 211, 102, 0.4)',
                            background: 'rgba(37, 211, 102, 0.1)',
                            color: '#25D366',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        Contacter l'équipe
                        <ArrowRight style={{ width: 14, height: 14 }} />
                    </motion.button>
                </motion.div>
            </div>

            <style jsx global>{`
                @media (max-width: 1100px) {
                    section#pricing > div > div:nth-child(2) {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 768px) {
                    section#pricing > div > div:nth-child(2) {
                        grid-template-columns: 1fr !important;
                        gap: 20px !important;
                    }
                    section#pricing h2 {
                        font-size: 28px !important;
                    }
                    section#pricing > div > div:nth-child(2) > div {
                        padding: 24px !important;
                    }
                    section#pricing > div > div:nth-child(2) > div h3 {
                        font-size: 20px !important;
                    }
                    section#pricing > div > div:nth-child(2) > div > div:first-child {
                        font-size: 32px !important;
                    }
                }
                @media (max-width: 600px) {
                    section#pricing > div > div:nth-child(2) {
                        grid-template-columns: 1fr !important;
                    }
                    section#pricing > div {
                        padding: 0 16px !important;
                    }
                }
            `}</style>
        </section>
    )
}
