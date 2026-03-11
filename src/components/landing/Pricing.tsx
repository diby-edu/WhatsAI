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

// Per-plan extras — expiration, renewal and bonus behaviors
const PLAN_SPECIFIC_FEATURES: Record<string, { text: string; highlight?: boolean }[]> = {
    free: [
        { text: '50 crédits offerts une seule fois' },
        { text: 'Pas de renouvellement automatique' },
    ],
    starter: [
        { text: 'À l\'expiration : crédits protégés (non perdus)' },
        { text: 'Au renouvellement : anciens + nouveaux crédits cumulés' },
        { text: '1 agent réactivé, les autres désactivés 7j' },
        { text: 'Sans renouvellement après 7j : crédits supprimés' },
    ],
    pro: [
        { text: 'À l\'expiration : crédits protégés (non perdus)' },
        { text: 'Au renouvellement : anciens + nouveaux crédits cumulés' },
        { text: 'Agents excédentaires désactivés 7j (récupérables)' },
        { text: 'Alerte à 85% de consommation mensuelle' },
        { text: 'Sans renouvellement après 7j : crédits supprimés' },
    ],
    business: [
        { text: 'À l\'expiration : crédits protégés (non perdus)' },
        { text: 'Au renouvellement : anciens + nouveaux crédits cumulés' },
        { text: 'Agents excédentaires désactivés 7j (récupérables)' },
        { text: 'Alerte à 85% de consommation mensuelle' },
        { text: 'Sans renouvellement après 7j : crédits supprimés' },
    ],
    scale: [
        { text: 'Rollover 20% des crédits non utilisés à chaque renouvellement', highlight: true },
        { text: '+2 000 crédits bonus offerts à chaque renouvellement', highlight: true },
        { text: 'Crédits sécurisés et reportés (Scale actif)', highlight: true },
        { text: 'Agents illimités — aucun archivage possible', highlight: true },
        { text: 'Notification détaillée de votre bonus après chaque renouvellement', highlight: false },
    ],
}

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
    'Free': { bg: 'linear-gradient(135deg, #64748b, #94a3b8)', glow: 'rgba(100, 116, 139, 0.3)' },
    'Starter': { bg: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59, 130, 246, 0.3)' },
    'Pro': { bg: 'linear-gradient(135deg, #25D366, #10b981)', glow: 'rgba(37, 211, 102, 0.4)' },
    'Business': { bg: 'linear-gradient(135deg, #f59e0b, #f97316)', glow: 'rgba(245, 158, 11, 0.3)' },
    'Scale': { bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', glow: 'rgba(139, 92, 246, 0.4)' },
}

const FALLBACK_PLANS: Plan[] = [
    { id: 'free', name: 'Gratuit', price_fcfa: 0, credits: 50, max_agents: 1, max_whatsapp_numbers: 1, is_popular: false, description: 'Pour tester la plateforme' },
    { id: 'starter', name: 'Starter', price_fcfa: 6900, credits: 500, max_agents: 1, max_whatsapp_numbers: 1, is_popular: false, description: '500 crédits · 1 agent · 1 numéro' },
    { id: 'pro', name: 'Pro', price_fcfa: 19900, credits: 2500, max_agents: 3, max_whatsapp_numbers: 3, is_popular: true, description: '2 500 crédits · 3 agents · 3 numéros' },
    { id: 'business', name: 'Business', price_fcfa: 54900, credits: 8000, max_agents: 6, max_whatsapp_numbers: 6, is_popular: false, description: '8 000 crédits · 6 agents · 6 numéros' },
    { id: 'scale', name: 'Scale', price_fcfa: 129900, credits: 20000, max_agents: -1, max_whatsapp_numbers: -1, is_popular: false, description: '20 000 crédits · Illimité' },
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
                        credits: p.credits_included || p.credits || 0,
                        max_agents: p.max_agents ?? 1,
                        max_whatsapp_numbers: p.max_whatsapp_numbers ?? 1,
                        is_popular: p.is_popular || false,
                        description: p.description || '',
                    }))
                    const hasFree = formatted.some(p => p.price_fcfa === 0 || p.id === 'free' || p.name.toLowerCase().includes('gratuit') || p.name.toLowerCase().includes('free'))
                    if (!hasFree) {
                        const fallbackFree = FALLBACK_PLANS.find(p => p.id === 'free')
                        if (fallbackFree) formatted.unshift(fallbackFree)
                    }
                    // Ensure Scale plan always shows even if not yet in DB
                    const hasScale = formatted.some(p => p.name.toLowerCase().includes('scale'))
                    if (!hasScale) {
                        const fallbackScale = FALLBACK_PLANS.find(p => p.id === 'scale')
                        if (fallbackScale) formatted.push(fallbackScale)
                    }
                    setPlans(formatted)
                }
            })
            .catch(() => { })
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
                                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                                style={{
                                    padding: 28,
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
                                        {plan.id === 'pro' ? t('recommended') : t('popular')}
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

                                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                                    {plan.name}
                                </h3>

                                {/* Scale gold badge */}
                                {plan.id === 'scale' && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '4px 10px',
                                        borderRadius: 100,
                                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.12))',
                                        border: '1px solid rgba(245, 158, 11, 0.35)',
                                        marginBottom: 12,
                                        alignSelf: 'flex-start'
                                    }}>
                                        <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>
                                            ⭐ Rollover 20% • +2 000 crédits/mois
                                        </span>
                                    </div>
                                )}

                                {/* Price */}
                                <div style={{ marginBottom: 14 }}>
                                    <div style={{
                                        fontSize: plan.price_fcfa === 0 ? 22 : 30,
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
                                    {/* ROI Hint */}
                                    {(plan.id === 'starter' || plan.id === 'pro') && (
                                        <div style={{
                                            marginTop: 10,
                                            padding: '6px 12px',
                                            borderRadius: 8,
                                            background: 'rgba(37, 211, 102, 0.08)',
                                            border: '1px solid rgba(37, 211, 102, 0.15)',
                                            fontSize: 11,
                                            color: '#25D366',
                                            fontWeight: 500
                                        }}>
                                            {t(`roiHint.${plan.id}`)}
                                        </div>
                                    )}
                                </div>

                                {/* Quotas — the only differentiators */}
                                <div className="quota-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: 6,
                                    marginBottom: 14,
                                    padding: '12px 6px',
                                    borderRadius: 12,
                                    background: plan.is_popular
                                        ? 'rgba(37, 211, 102, 0.06)'
                                        : 'rgba(255, 255, 255, 0.04)',
                                    border: plan.is_popular
                                        ? '1px solid rgba(37, 211, 102, 0.15)'
                                        : '1px solid rgba(148, 163, 184, 0.08)'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
                                            {plan.credits.toLocaleString('fr-FR')}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                            <CreditCard size={9} />
                                            crédits
                                        </div>
                                        {plan.id !== 'free' && (
                                            <div style={{ fontSize: 9, color: plan.id === 'scale' ? '#a78bfa' : '#64748b', marginTop: 2 }}>
                                                {plan.id === 'scale' ? 'Rollover 20%' : 'Protégés 7j/expir.'}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(148,163,184,0.1)', borderRight: '1px solid rgba(148,163,184,0.1)' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
                                            {plan.max_agents === -1 ? '∞' : plan.max_agents}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                            <Users size={9} />
                                            agents
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.1 }}>
                                            {plan.max_whatsapp_numbers === -1 ? '∞' : plan.max_whatsapp_numbers}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                            <Smartphone size={9} />
                                            numéros
                                        </div>
                                    </div>
                                </div>

                                {/* Common features (same for all plans) */}
                                <div style={{ flex: 1, marginBottom: 10 }}>
                                    {COMMON_FEATURES.map((feature, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
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
                                            <span style={{ fontSize: 13, color: '#94a3b8' }}>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Plan-specific features (credits policy, Scale bonuses) */}
                                {(PLAN_SPECIFIC_FEATURES[plan.id] || []).length > 0 && (
                                    <div style={{ marginBottom: 14, borderTop: '1px solid rgba(148,163,184,0.08)', paddingTop: 10 }}>
                                        {(PLAN_SPECIFIC_FEATURES[plan.id] || []).map((feat, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 8,
                                                marginBottom: 6
                                            }}>
                                                <div style={{
                                                    width: 15,
                                                    height: 15,
                                                    borderRadius: '50%',
                                                    background: plan.id === 'scale'
                                                        ? 'rgba(139, 92, 246, 0.2)'
                                                        : 'rgba(59, 130, 246, 0.1)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    <span style={{
                                                        fontSize: 8,
                                                        color: plan.id === 'scale' ? '#a78bfa' : '#60a5fa'
                                                    }}>✦</span>
                                                </div>
                                                <span style={{
                                                    fontSize: 12,
                                                    color: plan.id === 'scale' ? '#c4b5fd' : '#93c5fd',
                                                    fontWeight: feat.highlight ? 600 : 400
                                                }}>{feat.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

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

                {/* Expiration & Renewal explainer */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        marginTop: 32,
                        marginBottom: 0,
                        padding: '24px 28px',
                        borderRadius: 18,
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                    }}
                >
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 20, textAlign: 'center' }}>
                        ⚡ Ce qui se passe à l'expiration &amp; au renouvellement
                    </h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 20
                    }}>
                        {/* Expiration column */}
                        <div style={{
                            padding: '16px',
                            borderRadius: 12,
                            background: 'rgba(239, 68, 68, 0.06)',
                            border: '1px solid rgba(239, 68, 68, 0.15)'
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 10 }}>
                                📉 À l'expiration
                            </div>
                            {[
                                'Plan réduit au Free automatiquement',
                                'Crédits gelés (protégés) — non perdus immédiatement',
                                'Agents excédentaires archivés (non supprimés)',
                                'Seul 1 agent reste actif (limite Free)',
                                'IA en pause si crédits épuisés',
                            ].map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'flex', gap: 6 }}>
                                    <span style={{ color: '#f87171', flexShrink: 0 }}>•</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        {/* Renewal column */}
                        <div style={{
                            padding: '16px',
                            borderRadius: 12,
                            background: 'rgba(34, 197, 94, 0.06)',
                            border: '1px solid rgba(34, 197, 94, 0.15)'
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 10 }}>
                                🔄 À la souscription (dans les 7j)
                            </div>
                            {[
                                'Crédits sécurisés réactivés pleinement',
                                'Anciens crédits + nouveaux crédits cumulés',
                                'Plan restauré avec les quotas du plan choisi',
                                'Agents archivés récupérables',
                                'Si >7j sans renouvellement : crédits définitivement supprimés',
                            ].map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'flex', gap: 6 }}>
                                    <span style={{ color: '#4ade80', flexShrink: 0 }}>•</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        {/* Scale advantages column */}
                        <div style={{
                            padding: '16px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(167, 139, 250, 0.04))',
                            border: '1px solid rgba(139, 92, 246, 0.25)'
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>
                                ⭐ Avantages exclusifs Scale
                            </div>
                            {[
                                'Rollover 20% des crédits non utilisés à chaque renouvellement',
                                '+2 000 crédits bonus offerts chaque mois',
                                'Crédits toujours sécurisés tant que Scale est actif',
                                'Agents illimités — aucun archivage possible',
                                'Notification de votre bonus de rollover après chaque renouvellement',
                            ].map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'flex', gap: 6 }}>
                                    <span style={{ color: '#a78bfa', flexShrink: 0 }}>•</span>
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

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
            `}</style>
        </section>
    )
}
