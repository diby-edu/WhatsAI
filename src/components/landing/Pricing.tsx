'use client'

import { motion } from 'framer-motion'
import { Check, Zap, Crown, Sparkles, ArrowRight, Loader2, Rocket, Users, Smartphone, CreditCard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import { formatPriceFromFcfa } from '@/lib/currency'

interface Plan {
    id: string
    name: string
    price_fcfa: number
    credits: number
    max_agents: number
    max_whatsapp_numbers: number
    is_popular: boolean
    description: string
}

type Currency = 'FCFA' | 'USD' | 'EUR'

const COMMON_FEATURES = [
    'Réponses automatiques 24/7',
    'Base de connaissances personnalisée',
    'Analytics et rapports',
    'Qualification de leads',
    'Historique illimité',
    'Templates de messages',
    'Support email inclus',
]

const planIcons: Record<string, any> = {
    'Gratuit': Zap,
    'Free': Zap,
    'Starter': Zap,
    'Pro': Crown,
    'Business': Sparkles,
    'Scale': Rocket,
}

const planGradients: Record<string, { bg: string; glow: string }> = {
    'Gratuit': { bg: 'linear-gradient(135deg, #64748b, #94a3b8)', glow: 'rgba(100, 116, 139, 0.3)' },
    'Free':    { bg: 'linear-gradient(135deg, #64748b, #94a3b8)', glow: 'rgba(100, 116, 139, 0.3)' },
    'Starter': { bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59, 130, 246, 0.3)' },
    'Pro':     { bg: 'linear-gradient(135deg, #25D366, #10b981)', glow: 'rgba(37, 211, 102, 0.4)' },
    'Business':{ bg: 'linear-gradient(135deg, #f59e0b, #f97316)', glow: 'rgba(245, 158, 11, 0.3)' },
    'Scale':   { bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', glow: 'rgba(139, 92, 246, 0.4)' },
}

const FALLBACK_PLANS: Plan[] = [
    { id: 'free',     name: 'Gratuit',  price_fcfa: 0,      credits: 50,    max_agents: 1,  max_whatsapp_numbers: 1,  is_popular: false, description: 'Pour tester la plateforme' },
    { id: 'starter',  name: 'Starter',  price_fcfa: 6900,   credits: 500,   max_agents: 1,  max_whatsapp_numbers: 1,  is_popular: false, description: '500 crédits · 1 agent · 1 numéro' },
    { id: 'pro',      name: 'Pro',      price_fcfa: 19900,  credits: 2500,  max_agents: 3,  max_whatsapp_numbers: 3,  is_popular: true,  description: '2 500 crédits · 3 agents · 3 numéros' },
    { id: 'business', name: 'Business', price_fcfa: 54900,  credits: 8000,  max_agents: 6,  max_whatsapp_numbers: 6,  is_popular: false, description: '8 000 crédits · 6 agents · 6 numéros' },
    { id: 'scale',    name: 'Scale',    price_fcfa: 129900, credits: 20000, max_agents: -1, max_whatsapp_numbers: -1, is_popular: false, description: '20 000 crédits · Illimité' },
]

export default function Pricing() {
    const t = useTranslations('Pricing')
    const router = useRouter()
    const [isYearly, setIsYearly] = useState(false)
    const [currency, setCurrency] = useState<Currency>('FCFA')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
    const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )
                const { data: { session } } = await supabase.auth.getSession()
                setIsAuthenticated(!!session)
            } catch {
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
                    const formatted: Plan[] = data.plans.map((p: any) => ({
                        id: p.id || 'unknown',
                        name: p.name || 'Plan',
                        price_fcfa: typeof p.price === 'number' ? p.price : (p.price_fcfa || 0),
                        credits: p.credits || 0,
                        max_agents: p.max_agents ?? 1,
                        max_whatsapp_numbers: p.max_whatsapp_numbers ?? 1,
                        is_popular: p.is_popular || false,
                        description: p.description || '',
                    }))
                    setPlans(formatted)
                }
            })
            .catch(() => {})
    }, [])

    const displayPrice = (priceFcfa: number): string => {
        if (priceFcfa === 0) return t('plans.free.name')
        const amount = isYearly ? Math.round(priceFcfa * 10) : priceFcfa
        return formatPriceFromFcfa(amount, currency)
    }

    return (
        <section id="pricing" style={{
            padding: '100px 24px 60px',
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
            position: 'relative'
        }}>
            <div style={{ maxWidth: 1500, margin: '0 auto', position: 'relative', zIndex: 1 }}>
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
                        {t.rich('title', {
                            green: (chunks) => (
                                <span style={{
                                    background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}>{chunks}</span>
                            )
                        })}
                    </h2>
                    <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 400, margin: '0 auto 28px' }}>
                        {t('subtitle')}
                    </p>

                    {/* Toggles row */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12
                    }}>
                        {/* Billing period toggle */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: 4,
                            borderRadius: 100,
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                            <button
                                onClick={() => setIsYearly(false)}
                                style={{
                                    padding: '8px 16px',
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
                                {t('toggle.monthly')}
                            </button>
                            <button
                                onClick={() => setIsYearly(true)}
                                style={{
                                    padding: '8px 16px',
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
                                {t('toggle.yearly')}
                                <span style={{
                                    padding: '2px 7px',
                                    borderRadius: 100,
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    color: '#f59e0b',
                                    fontSize: 11,
                                    fontWeight: 700
                                }}>
                                    {t('discount')}
                                </span>
                            </button>
                        </div>

                        {/* Currency toggle */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            padding: 4,
                            borderRadius: 100,
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                            {(['FCFA', 'USD', 'EUR'] as Currency[]).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCurrency(c)}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 100,
                                        border: 'none',
                                        background: currency === c ? 'rgba(148, 163, 184, 0.15)' : 'transparent',
                                        color: currency === c ? 'white' : '#64748b',
                                        fontWeight: currency === c ? 600 : 400,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {c === 'USD' ? '$ USD' : c === 'EUR' ? '€ EUR' : 'FCFA'}
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Plans grid */}
                <div className="pricing-grid" style={{
                    display: 'grid',
                    gap: 16,
                    alignItems: 'stretch'
                }}>
                    {plans.map((plan, index) => {
                        const nameKey = Object.keys(planIcons).find(k => plan.name.includes(k)) || plan.name
                        const Icon = planIcons[plan.name] || planIcons[nameKey] || Zap
                        const colors = planGradients[plan.name] || planGradients[nameKey] || planGradients['Starter']

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: index * 0.08 }}
                                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                                style={{
                                    padding: 22,
                                    borderRadius: 22,
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
                                        padding: '5px 14px',
                                        borderRadius: 100,
                                        background: 'linear-gradient(135deg, #25D366, #10b981)',
                                        color: 'white',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {t('popular')}
                                    </div>
                                )}

                                {/* Icon & Name */}
                                <div style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 13,
                                    background: colors.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 10,
                                    boxShadow: `0 8px 20px ${colors.glow}`
                                }}>
                                    <Icon style={{ width: 20, height: 20, color: 'white' }} />
                                </div>

                                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                                    {plan.name}
                                </h3>

                                {/* Price */}
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{
                                        fontSize: plan.price_fcfa === 0 ? 20 : 24,
                                        fontWeight: 800,
                                        background: plan.is_popular
                                            ? 'linear-gradient(135deg, #25D366, #6ee7b7)'
                                            : 'linear-gradient(135deg, #fff, #94a3b8)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                        lineHeight: 1.2
                                    }}>
                                        {displayPrice(plan.price_fcfa)}
                                    </div>
                                    {plan.price_fcfa > 0 && (
                                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                            /{isYearly ? t('perYear') : t('perMonth')}
                                        </div>
                                    )}
                                </div>

                                {/* Quotas — the only differentiators */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: 6,
                                    marginBottom: 14,
                                    padding: '10px 6px',
                                    borderRadius: 10,
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(148, 163, 184, 0.06)'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                                            {plan.credits.toLocaleString('fr-FR')}
                                        </div>
                                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                            <CreditCard size={8} />
                                            crédits
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(148,163,184,0.08)', borderRight: '1px solid rgba(148,163,184,0.08)' }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                                            {plan.max_agents === -1 ? '∞' : plan.max_agents}
                                        </div>
                                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                            <Users size={8} />
                                            agents
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                                            {plan.max_whatsapp_numbers === -1 ? '∞' : plan.max_whatsapp_numbers}
                                        </div>
                                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                            <Smartphone size={8} />
                                            numéros
                                        </div>
                                    </div>
                                </div>

                                {/* Common features (same for all plans) */}
                                <div style={{ flex: 1, marginBottom: 14 }}>
                                    {COMMON_FEATURES.map((feature, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            marginBottom: 7
                                        }}>
                                            <div style={{
                                                width: 15,
                                                height: 15,
                                                borderRadius: '50%',
                                                background: plan.is_popular
                                                    ? 'rgba(37, 211, 102, 0.2)'
                                                    : 'rgba(148, 163, 184, 0.08)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Check style={{
                                                    width: 9,
                                                    height: 9,
                                                    color: plan.is_popular ? '#25D366' : '#94a3b8'
                                                }} />
                                            </div>
                                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{feature}</span>
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
                                            router.push('/register')
                                            return
                                        }
                                        if (plan.price_fcfa === 0) {
                                            router.push('/dashboard')
                                            return
                                        }
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
                                        } catch {
                                            alert('Erreur réseau')
                                            setLoadingPlan(null)
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '11px 16px',
                                        borderRadius: 11,
                                        border: plan.is_popular ? 'none' : '1px solid rgba(148, 163, 184, 0.15)',
                                        background: plan.is_popular
                                            ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                            : 'transparent',
                                        color: plan.is_popular ? 'white' : '#e2e8f0',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: loadingPlan === plan.id ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        opacity: loadingPlan === plan.id ? 0.7 : 1
                                    }}
                                >
                                    {loadingPlan === plan.id ? (
                                        <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> {t('loading')}</>
                                    ) : (
                                        <>{plan.price_fcfa === 0 ? t('cta.try') : t('cta.choose')} <ArrowRight style={{ width: 14, height: 14 }} /></>
                                    )}
                                </motion.button>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Enterprise CTA */}
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
                            {t('enterprise.title')}
                        </h4>
                        <p style={{ fontSize: 14, color: '#94a3b8' }}>
                            {t('enterprise.subtitle')}
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
                        {t('enterprise.cta')}
                        <ArrowRight style={{ width: 14, height: 14 }} />
                    </motion.button>
                </motion.div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .pricing-grid {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
                @media (max-width: 800px) {
                    .pricing-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 520px) {
                    .pricing-grid {
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
