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
        <section id="pricing" className="pt-[100px] pb-[60px] px-6 relative" style={{
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)'
        }}>
            <div className="max-w-[1500px] mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <h2 className="font-bold text-white mb-3 leading-tight" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
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
                    <p className="text-base text-slate-400 max-w-[400px] mx-auto mb-7">
                        {t('subtitle')}
                    </p>

                    {/* Toggles row */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* Billing period toggle */}
                        <div className="inline-flex items-center gap-1 p-1 rounded-full" style={{
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
                                className="flex items-center gap-[6px]"
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 100,
                                    border: 'none',
                                    background: isYearly ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'transparent',
                                    color: isYearly ? 'white' : '#94a3b8',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s'
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
                        <div className="inline-flex items-center gap-[2px] p-1 rounded-full" style={{
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
                <div className="pricing-grid grid gap-4 items-stretch">
                    {plans.map((plan, index) => {
                        const nameKey = Object.keys(planIcons).find(k => plan.name.includes(k)) || plan.name
                        const Icon = planIcons[plan.name] || planIcons[nameKey] || Zap
                        const colors = planGradients[plan.name] || planGradients[nameKey] || planGradients['Starter']

                        return (
                            <motion.div
                                key={plan.id}
                                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                                className="p-7 rounded-[22px] relative flex flex-col"
                                style={{
                                    background: plan.is_popular
                                        ? 'linear-gradient(180deg, rgba(37, 211, 102, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)'
                                        : 'rgba(15, 23, 42, 0.6)',
                                    backdropFilter: 'blur(20px)',
                                    border: plan.is_popular
                                        ? '2px solid rgba(37, 211, 102, 0.4)'
                                        : '1px solid rgba(148, 163, 184, 0.1)'
                                }}
                            >
                                {/* Popular badge */}
                                {plan.is_popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-[14px] py-[5px] rounded-full text-white text-[10px] font-bold uppercase tracking-[0.5px] whitespace-nowrap" style={{
                                        background: 'linear-gradient(135deg, #25D366, #10b981)'
                                    }}>
                                        {plan.id === 'pro' ? t('recommended') : t('popular')}
                                    </div>
                                )}

                                {/* Icon */}
                                <div className="flex items-center justify-center mb-[10px]" style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 13,
                                    background: colors.bg,
                                    boxShadow: `0 8px 20px ${colors.glow}`
                                }}>
                                    <Icon style={{ width: 20, height: 20, color: 'white' }} />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>

                                {/* Scale gold badge */}
                                {plan.id === 'scale' && (
                                    <div className="inline-flex items-center gap-[5px] px-[10px] py-1 rounded-full mb-3 self-start" style={{
                                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.12))',
                                        border: '1px solid rgba(245, 158, 11, 0.35)'
                                    }}>
                                        <span className="text-[11px] text-[#fbbf24] font-bold">
                                            ⭐ Rollover 20% • +2 000 crédits/mois
                                        </span>
                                    </div>
                                )}

                                {/* Price */}
                                <div className="mb-[14px]">
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
                                        <div className="text-[11px] text-slate-500 mt-[2px]">
                                            /{isYearly ? t('perYear') : t('perMonth')}
                                        </div>
                                    )}
                                    {(plan.id === 'starter' || plan.id === 'pro') && (
                                        <div className="mt-[10px] px-3 py-[6px] rounded-lg text-[11px] text-[#25D366] font-medium" style={{
                                            background: 'rgba(37, 211, 102, 0.08)',
                                            border: '1px solid rgba(37, 211, 102, 0.15)'
                                        }}>
                                            {t(`roiHint.${plan.id}`)}
                                        </div>
                                    )}
                                </div>

                                {/* Quotas */}
                                <div className="grid grid-cols-3 gap-[6px] mb-[14px] px-[6px] py-3 rounded-xl" style={{
                                    background: plan.is_popular
                                        ? 'rgba(37, 211, 102, 0.06)'
                                        : 'rgba(255, 255, 255, 0.04)',
                                    border: plan.is_popular
                                        ? '1px solid rgba(37, 211, 102, 0.15)'
                                        : '1px solid rgba(148, 163, 184, 0.08)'
                                }}>
                                    <div className="text-center">
                                        <div className="text-[22px] font-extrabold text-white leading-[1.1]">
                                            {plan.credits.toLocaleString('fr-FR')}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-[3px] flex items-center justify-center gap-[2px]">
                                            <CreditCard size={9} />
                                            crédits
                                        </div>
                                        {plan.id !== 'free' && (
                                            <div className="text-[9px] mt-[2px]" style={{
                                                color: plan.id === 'scale' ? '#a78bfa' : '#64748b'
                                            }}>
                                                {plan.id === 'scale' ? 'Rollover 20%' : 'Protégés 7j/expir.'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center" style={{
                                        borderLeft: '1px solid rgba(148,163,184,0.1)',
                                        borderRight: '1px solid rgba(148,163,184,0.1)'
                                    }}>
                                        <div className="text-[22px] font-extrabold text-white leading-[1.1]">
                                            {plan.max_agents === -1 ? '∞' : plan.max_agents}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-[3px] flex items-center justify-center gap-[2px]">
                                            <Users size={9} />
                                            agents
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[22px] font-extrabold text-white leading-[1.1]">
                                            {plan.max_whatsapp_numbers === -1 ? '∞' : plan.max_whatsapp_numbers}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-[3px] flex items-center justify-center gap-[2px]">
                                            <Smartphone size={9} />
                                            numéros
                                        </div>
                                    </div>
                                </div>

                                {/* Common features */}
                                <div className="flex-1 mb-[10px]">
                                    {COMMON_FEATURES.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-2 mb-[7px]">
                                            <div className="w-[15px] h-[15px] rounded-full flex items-center justify-center shrink-0" style={{
                                                background: plan.is_popular
                                                    ? 'rgba(37, 211, 102, 0.2)'
                                                    : 'rgba(148, 163, 184, 0.08)'
                                            }}>
                                                <Check style={{
                                                    width: 9,
                                                    height: 9,
                                                    color: plan.is_popular ? '#25D366' : '#94a3b8'
                                                }} />
                                            </div>
                                            <span className="text-[13px] text-slate-400">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Plan-specific features */}
                                {(PLAN_SPECIFIC_FEATURES[plan.id] || []).length > 0 && (
                                    <div className="mb-[14px] pt-[10px]" style={{
                                        borderTop: '1px solid rgba(148,163,184,0.08)'
                                    }}>
                                        {(PLAN_SPECIFIC_FEATURES[plan.id] || []).map((feat, i) => (
                                            <div key={i} className="flex items-start gap-2 mb-[6px]">
                                                <div className="w-[15px] h-[15px] rounded-full flex items-center justify-center shrink-0" style={{
                                                    background: plan.id === 'scale'
                                                        ? 'rgba(139, 92, 246, 0.2)'
                                                        : 'rgba(59, 130, 246, 0.1)'
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
                                    className="w-full py-[11px] px-4 rounded-[11px] font-semibold text-[13px] flex items-center justify-center gap-[6px]"
                                    style={{
                                        border: plan.is_popular ? 'none' : '1px solid rgba(148, 163, 184, 0.15)',
                                        background: plan.is_popular
                                            ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                            : 'transparent',
                                        color: plan.is_popular ? 'white' : '#e2e8f0',
                                        cursor: loadingPlan === plan.id ? 'wait' : 'pointer',
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
                    className="mt-8 px-7 py-6 rounded-[18px]"
                    style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}
                >
                    <h4 className="text-[15px] font-bold text-white mb-5 text-center">
                        ⚡ Ce qui se passe à l&apos;expiration &amp; au renouvellement
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Expiration */}
                        <div className="p-4 rounded-xl" style={{
                            background: 'rgba(239, 68, 68, 0.06)',
                            border: '1px solid rgba(239, 68, 68, 0.15)'
                        }}>
                            <div className="text-[13px] font-bold text-[#f87171] mb-[10px]">
                                📉 À l&apos;expiration
                            </div>
                            {[
                                'Plan réduit au Free automatiquement',
                                'Crédits gelés (protégés) — non perdus immédiatement',
                                'Agents excédentaires archivés (non supprimés)',
                                'Seul 1 agent reste actif (limite Free)',
                                'IA en pause si crédits épuisés',
                            ].map((item, i) => (
                                <div key={i} className="text-[12px] text-slate-400 mb-[6px] flex gap-[6px]">
                                    <span className="text-[#f87171] shrink-0">•</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        {/* Renewal */}
                        <div className="p-4 rounded-xl" style={{
                            background: 'rgba(34, 197, 94, 0.06)',
                            border: '1px solid rgba(34, 197, 94, 0.15)'
                        }}>
                            <div className="text-[13px] font-bold text-[#4ade80] mb-[10px]">
                                🔄 À la souscription (dans les 7j)
                            </div>
                            {[
                                'Crédits sécurisés réactivés pleinement',
                                'Anciens crédits + nouveaux crédits cumulés',
                                'Plan restauré avec les quotas du plan choisi',
                                'Agents archivés récupérables',
                                'Si >7j sans renouvellement : crédits définitivement supprimés',
                            ].map((item, i) => (
                                <div key={i} className="text-[12px] text-slate-400 mb-[6px] flex gap-[6px]">
                                    <span className="text-[#4ade80] shrink-0">•</span>
                                    {item}
                                </div>
                            ))}
                        </div>

                        {/* Scale */}
                        <div className="p-4 rounded-xl" style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(167, 139, 250, 0.04))',
                            border: '1px solid rgba(139, 92, 246, 0.25)'
                        }}>
                            <div className="text-[13px] font-bold text-[#a78bfa] mb-[10px]">
                                ⭐ Avantages exclusifs Scale
                            </div>
                            {[
                                'Rollover 20% des crédits non utilisés à chaque renouvellement',
                                '+2 000 crédits bonus offerts chaque mois',
                                'Crédits toujours sécurisés tant que Scale est actif',
                                'Agents illimités — aucun archivage possible',
                                'Notification de votre bonus de rollover après chaque renouvellement',
                            ].map((item, i) => (
                                <div key={i} className="text-[12px] text-slate-400 mb-[6px] flex gap-[6px]">
                                    <span className="text-[#a78bfa] shrink-0">•</span>
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
                    className="mt-12 px-10 py-6 rounded-[20px] flex items-center justify-between flex-wrap gap-4"
                    style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}
                >
                    <div>
                        <h4 className="text-lg font-semibold text-white mb-1">{t('enterprise.title')}</h4>
                        <p className="text-sm text-slate-400">{t('enterprise.subtitle')}</p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-6 py-3 rounded-[10px] flex items-center gap-[6px] font-semibold text-sm text-[#25D366] cursor-pointer"
                        style={{
                            border: '1px solid rgba(37, 211, 102, 0.4)',
                            background: 'rgba(37, 211, 102, 0.1)'
                        }}
                    >
                        {t('enterprise.cta')}
                        <ArrowRight style={{ width: 14, height: 14 }} />
                    </motion.button>
                </motion.div>
            </div>
        </section>
    )
}
