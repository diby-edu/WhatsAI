'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
    Zap,
    Brain,
    MessageSquare,
    BarChart3,
    Clock,
    Shield,
    Globe,
    Sparkles,
    Users,
    Target,
    Workflow,
    Database
} from 'lucide-react'

const features = [
    {
        icon: Zap,
        title: 'Réponses instantanées',
        description: 'Votre IA répond en moins de 3 secondes, 24h/24, 7j/7. Ne perdez plus jamais un client.',
        gradient: 'from-yellow-500 to-orange-500',
        bgGlow: 'rgba(234, 179, 8, 0.1)',
    },
    {
        icon: Brain,
        title: 'IA ultra-intelligente',
        description: 'Propulsée par GPT-4o, votre assistant comprend le contexte et répond comme un humain.',
        gradient: 'from-purple-500 to-pink-500',
        bgGlow: 'rgba(168, 85, 247, 0.1)',
    },
    {
        icon: Target,
        title: 'Qualification de leads',
        description: 'Identifiez automatiquement les prospects chauds et priorisez vos efforts commerciaux.',
        gradient: 'from-emerald-500 to-teal-500',
        bgGlow: 'rgba(16, 185, 129, 0.1)',
    },
    {
        icon: MessageSquare,
        title: 'Multi-conversations',
        description: 'Gérez des milliers de conversations simultanées sans effort ni équipe.',
        gradient: 'from-blue-500 to-cyan-500',
        bgGlow: 'rgba(59, 130, 246, 0.1)',
    },
    {
        icon: BarChart3,
        title: 'Analytics avancés',
        description: 'Tableaux de bord en temps réel, taux de conversion, métriques clés pour optimiser.',
        gradient: 'from-rose-500 to-red-500',
        bgGlow: 'rgba(244, 63, 94, 0.1)',
    },
    {
        icon: Database,
        title: 'Base de connaissances',
        description: 'Entraînez votre IA sur vos produits, FAQ, et documents pour des réponses précises.',
        gradient: 'from-indigo-500 to-violet-500',
        bgGlow: 'rgba(99, 102, 241, 0.1)',
    },
    {
        icon: Globe,
        title: '113+ langues',
        description: 'Communiquez avec vos clients dans leur langue maternelle automatiquement.',
        gradient: 'from-cyan-500 to-blue-500',
        bgGlow: 'rgba(34, 211, 238, 0.1)',
    },
    {
        icon: Shield,
        title: 'Sécurité maximale',
        description: 'Chiffrement de bout en bout, conformité RGPD, vos données sont protégées.',
        gradient: 'from-green-500 to-emerald-500',
        bgGlow: 'rgba(34, 197, 94, 0.1)',
    },
]

const FeatureCard = ({ feature, index }: { feature: typeof features[0], index: number }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group relative"
        >
            <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                style={{ background: feature.bgGlow }}
            />
            <div className="relative glass-card p-8 rounded-3xl h-full card-glow">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gradient transition-all">
                    {feature.title}
                </h3>
                <p className="text-dark-400 leading-relaxed">
                    {feature.description}
                </p>

                {/* Hover Arrow */}
                <div className="mt-6 flex items-center gap-2 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-medium">En savoir plus</span>
                    <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        →
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}

export default function Features() {
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    return (
        <section id="features" className="py-32 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-primary-500/5 to-transparent pointer-events-none" />

            <div className="container relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto mb-20"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-500/10 border border-accent-500/20 mb-6"
                    >
                        <Sparkles className="w-4 h-4 text-accent-400" />
                        <span className="text-sm font-medium text-accent-400">
                            Fonctionnalités puissantes
                        </span>
                    </motion.div>

                    <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                        <span className="text-white">Tout ce dont vous avez besoin</span>
                        <br />
                        <span className="text-gradient">pour automatiser WhatsApp</span>
                    </h2>

                    <p className="text-xl text-dark-400">
                        Une suite complète d'outils IA pour transformer vos conversations
                        en opportunités commerciales
                    </p>
                </motion.div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, index) => (
                        <FeatureCard key={feature.title} feature={feature} index={index} />
                    ))}
                </div>

                {/* Bottom Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-20 glass-card rounded-3xl p-8 lg:p-12"
                >
                    <div className="grid md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-4xl lg:text-5xl font-bold text-gradient mb-2">5,000+</div>
                            <div className="text-dark-400">Entreprises actives</div>
                        </div>
                        <div>
                            <div className="text-4xl lg:text-5xl font-bold text-gradient mb-2">10M+</div>
                            <div className="text-dark-400">Messages traités</div>
                        </div>
                        <div>
                            <div className="text-4xl lg:text-5xl font-bold text-gradient mb-2">98%</div>
                            <div className="text-dark-400">Satisfaction client</div>
                        </div>
                        <div>
                            <div className="text-4xl lg:text-5xl font-bold text-gradient mb-2">+300%</div>
                            <div className="text-dark-400">ROI moyen</div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
