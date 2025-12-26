'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Check, Sparkles, Zap, Crown, Building2, ArrowRight, Star } from 'lucide-react'
import Link from 'next/link'

const plans = [
    {
        id: 'starter',
        name: 'Starter',
        icon: Zap,
        description: 'Parfait pour démarrer',
        price: 15000,
        period: '/mois',
        credits: '2 000',
        gradient: 'from-sky-400 via-blue-500 to-indigo-600',
        iconGradient: 'from-sky-400 to-blue-600',
        borderGradient: 'from-sky-400/50 via-blue-500/50 to-indigo-600/50',
        features: [
            '2 000 messages/mois',
            '1 agent IA',
            '1 numéro WhatsApp',
            'Qualification de leads',
            'Historique illimité',
            'Support email',
        ],
        cta: 'Commencer',
        popular: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        icon: Crown,
        description: 'Le choix des pros',
        price: 35000,
        period: '/mois',
        credits: '5 000',
        gradient: 'from-emerald-400 via-green-500 to-teal-600',
        iconGradient: 'from-emerald-400 to-green-600',
        borderGradient: 'from-emerald-400/60 via-green-500/60 to-teal-600/60',
        features: [
            '5 000 messages/mois',
            '2 agents IA',
            '2 numéros WhatsApp',
            'GPT-4o disponible',
            'Base de connaissances',
            'Analytics avancés',
            'Support prioritaire',
            'API access',
        ],
        cta: 'Essai gratuit',
        popular: true,
    },
    {
        id: 'business',
        name: 'Business',
        icon: Building2,
        description: 'Pour les équipes',
        price: 85000,
        period: '/mois',
        credits: '30 000',
        gradient: 'from-violet-400 via-purple-500 to-fuchsia-600',
        iconGradient: 'from-violet-400 to-purple-600',
        borderGradient: 'from-violet-400/50 via-purple-500/50 to-fuchsia-600/50',
        features: [
            '30 000 messages/mois',
            '4 agents IA',
            '4 numéros WhatsApp',
            'GPT-4 Turbo',
            'API personnalisée',
            'Webhooks',
            'Intégrations CRM',
            'Account manager dédié',
            'SLA garanti',
        ],
        cta: 'Contacter',
        popular: false,
    },
]

const PricingCard = ({ plan, index, isYearly }: { plan: typeof plans[0], index: number, isYearly: boolean }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-50px" })
    const yearlyPrice = Math.round(plan.price * 10)
    const savings = Math.round((plan.price * 12 - yearlyPrice) / 1000)

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: index * 0.15, ease: "easeOut" }}
            className={`relative group ${plan.popular ? 'lg:-mt-6 lg:mb-6 z-10' : ''}`}
        >
            {/* Popular Badge - Above card */}
            {plan.popular && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute -top-5 left-1/2 -translate-x-1/2 z-20"
                >
                    <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/30">
                        <Star className="w-4 h-4 fill-current" />
                        Plus populaire
                        <Star className="w-4 h-4 fill-current" />
                    </div>
                </motion.div>
            )}

            {/* Animated gradient border */}
            <div className={`absolute -inset-[2px] rounded-[32px] bg-gradient-to-b ${plan.borderGradient} opacity-0 group-hover:opacity-100 transition-all duration-500 ${plan.popular ? 'opacity-100' : ''}`} />

            {/* Card */}
            <div className={`relative h-full rounded-[30px] overflow-hidden ${plan.popular
                    ? 'bg-gradient-to-b from-slate-800 via-slate-800/95 to-slate-900'
                    : 'bg-gradient-to-b from-slate-900 via-slate-800/80 to-slate-900'
                } backdrop-blur-xl border border-white/[0.05]`}>

                {/* Subtle top glow for popular */}
                {plan.popular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
                )}

                <div className="relative p-8 lg:p-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="mb-8">
                        {/* Icon */}
                        <div className="relative mb-6">
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${plan.iconGradient} blur-xl opacity-40`} />
                            <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.iconGradient} flex items-center justify-center shadow-xl`}>
                                <plan.icon className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        {/* Plan name */}
                        <h3 className={`text-2xl font-bold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent mb-2`}>
                            {plan.name}
                        </h3>
                        <p className="text-slate-400 text-sm">{plan.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-8">
                        <div className="flex items-baseline gap-1">
                            <span className="text-5xl lg:text-6xl font-bold text-white tracking-tight">
                                {(isYearly ? yearlyPrice : plan.price).toLocaleString('fr-FR')}
                            </span>
                            <span className="text-lg text-slate-400 font-medium">
                                FCFA{isYearly ? '/an' : '/mois'}
                            </span>
                        </div>
                        {isYearly && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-sm font-medium text-emerald-400">
                                    Économisez {savings}K FCFA
                                </span>
                            </div>
                        )}
                        <p className="mt-3 text-sm text-slate-500">
                            {plan.credits} crédits/mois inclus
                        </p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-4 mb-10 flex-1">
                        {plan.features.map((feature, i) => (
                            <motion.li
                                key={feature}
                                initial={{ opacity: 0, x: -10 }}
                                animate={isInView ? { opacity: 1, x: 0 } : {}}
                                transition={{ delay: 0.3 + i * 0.05 }}
                                className="flex items-start gap-3"
                            >
                                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${plan.iconGradient} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg`}>
                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                                <span className="text-slate-300 text-sm leading-relaxed">{feature}</span>
                            </motion.li>
                        ))}
                    </ul>

                    {/* CTA Button */}
                    <Link href={`/register?plan=${plan.id}`} className="block">
                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${plan.popular
                                    ? `bg-gradient-to-r ${plan.gradient} text-white shadow-xl shadow-green-500/20 hover:shadow-green-500/30`
                                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                                }`}
                        >
                            {plan.cta}
                            <ArrowRight className="w-5 h-5" />
                        </motion.button>
                    </Link>
                </div>
            </div>
        </motion.div>
    )
}

export default function Pricing() {
    const [isYearly, setIsYearly] = useState(false)
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    return (
        <section id="pricing" className="py-28 lg:py-36 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/10 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl" />
            <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />

            <div className="container relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-8 backdrop-blur-sm"
                    >
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                            Tarification simple
                        </span>
                    </motion.div>

                    <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                        <span className="text-white">Des prix </span>
                        <span className="bg-gradient-to-r from-primary-400 via-accent-400 to-cyan-400 bg-clip-text text-transparent">
                            transparents
                        </span>
                    </h2>

                    <p className="text-xl text-slate-400 mb-10 leading-relaxed">
                        Commencez gratuitement avec 100 crédits.
                        <br className="hidden sm:block" />
                        Évoluez selon vos besoins.
                    </p>

                    {/* Toggle - More modern */}
                    <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-slate-800/80 border border-white/10 backdrop-blur-sm">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${!isYearly
                                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Mensuel
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${isYearly
                                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Annuel
                            <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 text-xs font-bold">
                                -17%
                            </span>
                        </button>
                    </div>
                </motion.div>

                {/* Pricing Cards - Better spacing */}
                <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-start">
                    {plans.map((plan, index) => (
                        <PricingCard key={plan.id} plan={plan} index={index} isYearly={isYearly} />
                    ))}
                </div>

                {/* Enterprise CTA - More elegant */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-20"
                >
                    <div className="relative rounded-[28px] overflow-hidden">
                        {/* Gradient border */}
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 via-fuchsia-500/30 to-pink-500/30" />

                        <div className="relative m-[1px] rounded-[27px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 lg:p-10">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="text-center md:text-left">
                                    <h3 className="text-2xl font-bold text-white mb-2">
                                        Besoin d'une solution sur-mesure ?
                                    </h3>
                                    <p className="text-slate-400">
                                        Contactez-nous pour un plan personnalisé adapté à votre entreprise.
                                    </p>
                                </div>
                                <Link href="/contact">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-xl shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 transition-all whitespace-nowrap flex items-center gap-2"
                                    >
                                        Contacter l'équipe
                                        <ArrowRight className="w-5 h-5" />
                                    </motion.button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
