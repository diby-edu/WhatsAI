'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Check, Sparkles, Zap, Crown, Building2, ArrowRight } from 'lucide-react'
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
        gradient: 'from-blue-500 to-cyan-500',
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
        gradient: 'from-primary-500 to-emerald-400',
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
        gradient: 'from-purple-500 to-pink-500',
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
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className={`relative ${plan.popular ? 'lg:-mt-4 lg:mb-4' : ''}`}
        >
            {/* Popular Badge */}
            {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className={`px-4 py-1.5 rounded-full bg-gradient-to-r ${plan.gradient} text-white text-sm font-semibold shadow-lg`}>
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            Plus populaire
                        </div>
                    </div>
                </div>
            )}

            <div className={`relative h-full rounded-3xl ${plan.popular
                    ? 'bg-gradient-to-b from-primary-500/10 to-dark-900 border-2 border-primary-500/30'
                    : 'glass-card'
                } p-8 flex flex-col`}>

                {/* Glow Effect for Popular */}
                {plan.popular && (
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />
                )}

                {/* Header */}
                <div className="relative">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                        <plan.icon className="w-7 h-7 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                    <p className="text-dark-400 mb-6">{plan.description}</p>

                    {/* Price */}
                    <div className="mb-6">
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold text-white">
                                {(isYearly ? yearlyPrice : plan.price).toLocaleString('fr-FR')}
                            </span>
                            <span className="text-dark-400">FCFA{isYearly ? '/an' : '/mois'}</span>
                        </div>
                        {isYearly && (
                            <div className="mt-2 text-sm text-primary-400">
                                Économisez {savings}K FCFA/an
                            </div>
                        )}
                        <div className="mt-2 text-sm text-dark-500">
                            {plan.credits} crédits/mois inclus
                        </div>
                    </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <Check className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-dark-300">{feature}</span>
                        </li>
                    ))}
                </ul>

                {/* CTA */}
                <Link href={`/register?plan=${plan.id}`}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${plan.popular
                                ? 'btn btn-primary'
                                : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                            }`}
                    >
                        {plan.cta}
                        <ArrowRight className="w-4 h-4" />
                    </motion.button>
                </Link>
            </div>
        </motion.div>
    )
}

export default function Pricing() {
    const [isYearly, setIsYearly] = useState(false)
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    return (
        <section id="pricing" className="py-32 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full bg-gradient-radial from-accent-500/5 to-transparent pointer-events-none" />

            <div className="container relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-16"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6"
                    >
                        <Crown className="w-4 h-4 text-primary-400" />
                        <span className="text-sm font-medium text-primary-400">
                            Tarification simple
                        </span>
                    </motion.div>

                    <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                        <span className="text-white">Des prix </span>
                        <span className="text-gradient">transparents</span>
                    </h2>

                    <p className="text-xl text-dark-400 mb-10">
                        Commencez gratuitement avec 100 crédits.
                        Évoluez selon vos besoins.
                    </p>

                    {/* Toggle */}
                    <div className="inline-flex items-center gap-4 p-1.5 rounded-full bg-dark-800/50 border border-dark-700">
                        <button
                            onClick={() => setIsYearly(false)}
                            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${!isYearly
                                    ? 'bg-primary-500 text-white shadow-lg'
                                    : 'text-dark-400 hover:text-white'
                                }`}
                        >
                            Mensuel
                        </button>
                        <button
                            onClick={() => setIsYearly(true)}
                            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isYearly
                                    ? 'bg-primary-500 text-white shadow-lg'
                                    : 'text-dark-400 hover:text-white'
                                }`}
                        >
                            Annuel
                            <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
                                -17%
                            </span>
                        </button>
                    </div>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan, index) => (
                        <PricingCard key={plan.id} plan={plan} index={index} isYearly={isYearly} />
                    ))}
                </div>

                {/* Enterprise CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-16 text-center"
                >
                    <div className="glass-card rounded-2xl p-8 max-w-3xl mx-auto">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="text-left">
                                <h3 className="text-xl font-bold text-white mb-2">
                                    Besoin d'une solution sur-mesure ?
                                </h3>
                                <p className="text-dark-400">
                                    Contactez-nous pour un plan personnalisé adapté à votre entreprise.
                                </p>
                            </div>
                            <Link href="/contact">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="btn btn-secondary whitespace-nowrap"
                                >
                                    Contacter l'équipe
                                </motion.button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
