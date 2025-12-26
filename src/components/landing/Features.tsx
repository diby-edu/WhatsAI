'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
    Zap,
    Brain,
    MessageSquare,
    BarChart3,
    Shield,
    Globe,
    Sparkles,
    Target,
    Database
} from 'lucide-react'

const features = [
    {
        icon: Zap,
        title: 'Réponses instantanées',
        description: 'Votre IA répond en moins de 3 secondes, 24h/24, 7j/7. Ne perdez plus jamais un client.',
        gradient: 'from-amber-400 via-orange-500 to-rose-500',
        iconBg: 'bg-gradient-to-br from-amber-400 to-orange-600',
        glowColor: 'group-hover:shadow-amber-500/25',
    },
    {
        icon: Brain,
        title: 'IA ultra-intelligente',
        description: 'Propulsée par GPT-4o, votre assistant comprend le contexte et répond comme un humain.',
        gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
        iconBg: 'bg-gradient-to-br from-violet-400 to-purple-600',
        glowColor: 'group-hover:shadow-purple-500/25',
    },
    {
        icon: Target,
        title: 'Qualification de leads',
        description: 'Identifiez automatiquement les prospects chauds et priorisez vos efforts commerciaux.',
        gradient: 'from-emerald-400 via-green-500 to-teal-500',
        iconBg: 'bg-gradient-to-br from-emerald-400 to-green-600',
        glowColor: 'group-hover:shadow-emerald-500/25',
    },
    {
        icon: MessageSquare,
        title: 'Multi-conversations',
        description: 'Gérez des milliers de conversations simultanées sans effort ni équipe.',
        gradient: 'from-sky-400 via-blue-500 to-indigo-500',
        iconBg: 'bg-gradient-to-br from-sky-400 to-blue-600',
        glowColor: 'group-hover:shadow-blue-500/25',
    },
    {
        icon: BarChart3,
        title: 'Analytics avancés',
        description: 'Tableaux de bord en temps réel, taux de conversion, métriques clés pour optimiser.',
        gradient: 'from-rose-400 via-red-500 to-pink-500',
        iconBg: 'bg-gradient-to-br from-rose-400 to-red-600',
        glowColor: 'group-hover:shadow-rose-500/25',
    },
    {
        icon: Database,
        title: 'Base de connaissances',
        description: 'Entraînez votre IA sur vos produits, FAQ, et documents pour des réponses précises.',
        gradient: 'from-indigo-400 via-violet-500 to-purple-500',
        iconBg: 'bg-gradient-to-br from-indigo-400 to-violet-600',
        glowColor: 'group-hover:shadow-indigo-500/25',
    },
    {
        icon: Globe,
        title: '113+ langues',
        description: 'Communiquez avec vos clients dans leur langue maternelle automatiquement.',
        gradient: 'from-cyan-400 via-teal-500 to-emerald-500',
        iconBg: 'bg-gradient-to-br from-cyan-400 to-teal-600',
        glowColor: 'group-hover:shadow-cyan-500/25',
    },
    {
        icon: Shield,
        title: 'Sécurité maximale',
        description: 'Chiffrement de bout en bout, conformité RGPD, vos données sont protégées.',
        gradient: 'from-green-400 via-emerald-500 to-teal-500',
        iconBg: 'bg-gradient-to-br from-green-400 to-emerald-600',
        glowColor: 'group-hover:shadow-green-500/25',
    },
]

const FeatureCard = ({ feature, index }: { feature: typeof features[0], index: number }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
            className={`group relative ${feature.glowColor} transition-all duration-500`}
        >
            {/* Animated gradient border */}
            <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }} />

            <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-white/[0.08] h-full group-hover:shadow-2xl transition-all duration-500">
                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>

                {/* Content */}
                <div className="relative p-7">
                    {/* Icon with glow */}
                    <div className="relative mb-5">
                        <div className="absolute inset-0 rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity"
                            style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }} />
                        <div className={`relative w-14 h-14 rounded-2xl ${feature.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                            <feature.icon className="w-7 h-7 text-white drop-shadow-lg" />
                        </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-white mb-2.5 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r transition-all duration-300"
                        style={{ backgroundImage: feature.gradient }}>
                        {feature.title}
                    </h3>

                    {/* Description */}
                    <p className="text-slate-400 text-sm leading-relaxed group-hover:text-slate-300 transition-colors duration-300">
                        {feature.description}
                    </p>

                    {/* Hover indicator */}
                    <div className="mt-5 flex items-center gap-2 text-sm text-primary-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                        <span className="font-medium">Explorer</span>
                        <motion.span
                            animate={{ x: [0, 5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        >
                            →
                        </motion.span>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

export default function Features() {
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    return (
        <section id="features" className="py-28 lg:py-36 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-900/20 via-transparent to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

            <div className="container relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-3xl mx-auto mb-20"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/30 mb-8 backdrop-blur-sm"
                    >
                        <Sparkles className="w-4 h-4 text-primary-400" />
                        <span className="text-sm font-semibold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                            Fonctionnalités puissantes
                        </span>
                    </motion.div>

                    <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                        <span className="text-white">Tout pour </span>
                        <span className="bg-gradient-to-r from-primary-400 via-accent-400 to-cyan-400 bg-clip-text text-transparent">
                            automatiser
                        </span>
                        <br />
                        <span className="text-white">vos conversations</span>
                    </h2>

                    <p className="text-xl text-slate-400 leading-relaxed">
                        Une suite complète d'outils IA pour transformer vos conversations
                        en opportunités commerciales
                    </p>
                </motion.div>

                {/* Features Grid - Improved layout */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
                    {features.map((feature, index) => (
                        <FeatureCard key={feature.title} feature={feature} index={index} />
                    ))}
                </div>

                {/* Stats Section - More dynamic */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="mt-24"
                >
                    <div className="relative rounded-[32px] overflow-hidden">
                        {/* Gradient border effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/50 via-accent-500/50 to-cyan-500/50 rounded-[32px]" />

                        <div className="relative m-[1px] rounded-[31px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 lg:p-14">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
                                {[
                                    { value: '5,000+', label: 'Entreprises actives', gradient: 'from-amber-400 to-orange-500' },
                                    { value: '10M+', label: 'Messages traités', gradient: 'from-emerald-400 to-green-500' },
                                    { value: '98%', label: 'Satisfaction client', gradient: 'from-violet-400 to-purple-500' },
                                    { value: '+300%', label: 'ROI moyen', gradient: 'from-cyan-400 to-blue-500' },
                                ].map((stat, index) => (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: 0.1 * index }}
                                        className="text-center"
                                    >
                                        <div className={`text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-2`}>
                                            {stat.value}
                                        </div>
                                        <div className="text-slate-400 text-sm lg:text-base">{stat.label}</div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
