'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { QrCode, Settings, Zap, MessageCircle, ArrowRight } from 'lucide-react'

const steps = [
    {
        number: '01',
        icon: QrCode,
        title: 'Connectez WhatsApp',
        description: 'Scannez le QR code ou utilisez le code de liaison pour connecter votre numéro en quelques secondes.',
        gradient: 'from-blue-500 to-cyan-400',
    },
    {
        number: '02',
        icon: Settings,
        title: 'Configurez votre agent',
        description: 'Définissez la personnalité, les instructions et la base de connaissances de votre assistant IA.',
        gradient: 'from-purple-500 to-pink-500',
    },
    {
        number: '03',
        icon: Zap,
        title: 'Activez l\'automatisation',
        description: 'Votre IA commence à répondre automatiquement. Surveillez les conversations depuis le dashboard.',
        gradient: 'from-primary-500 to-emerald-400',
    },
]

export default function HowItWorks() {
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    return (
        <section id="how-it-works" className="py-32 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-dark-900/50 to-dark-950" />
            <div className="absolute inset-0 bg-grid opacity-20" />

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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6"
                    >
                        <Zap className="w-4 h-4 text-primary-400" />
                        <span className="text-sm font-medium text-primary-400">
                            Simple et rapide
                        </span>
                    </motion.div>

                    <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                        <span className="text-white">3 étapes pour </span>
                        <span className="text-gradient">automatiser</span>
                    </h2>

                    <p className="text-xl text-dark-400">
                        Configurez votre assistant IA en moins de 5 minutes.
                        Aucune compétence technique requise.
                    </p>
                </motion.div>

                {/* Steps */}
                <div className="relative">
                    {/* Connection Line */}
                    <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-primary-500/20 -translate-y-1/2" />

                    <div className="grid lg:grid-cols-3 gap-8">
                        {steps.map((step, index) => {
                            const ref = useRef(null)
                            const isInView = useInView(ref, { once: true, margin: "-50px" })

                            return (
                                <motion.div
                                    ref={ref}
                                    key={step.number}
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ duration: 0.5, delay: index * 0.2 }}
                                    className="relative"
                                >
                                    {/* Arrow between steps */}
                                    {index < steps.length - 1 && (
                                        <div className="hidden lg:flex absolute top-1/2 -right-4 z-10 -translate-y-1/2">
                                            <motion.div
                                                animate={{ x: [0, 4, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                className="w-8 h-8 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center"
                                            >
                                                <ArrowRight className="w-4 h-4 text-dark-400" />
                                            </motion.div>
                                        </div>
                                    )}

                                    <div className="glass-card p-8 rounded-3xl h-full text-center relative overflow-hidden group">
                                        {/* Background Glow */}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            style={{
                                                background: `radial-gradient(circle at center, ${step.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.1)' : step.gradient.includes('purple') ? 'rgba(168, 85, 247, 0.1)' : 'rgba(16, 185, 129, 0.1)'} 0%, transparent 70%)`
                                            }}
                                        />

                                        {/* Step Number */}
                                        <div className="relative">
                                            <div className="text-6xl font-bold text-dark-800 mb-4">
                                                {step.number}
                                            </div>

                                            {/* Icon */}
                                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                                <step.icon className="w-8 h-8 text-white" />
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-3">
                                            {step.title}
                                        </h3>
                                        <p className="text-dark-400 leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>

                {/* Demo Video Placeholder */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-20"
                >
                    <div className="glass-card rounded-3xl p-1 max-w-4xl mx-auto">
                        <div className="aspect-video rounded-2xl bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center relative overflow-hidden">
                            {/* Placeholder for video */}
                            <div className="absolute inset-0 bg-grid opacity-30" />

                            {/* Phone Mockup */}
                            <div className="relative z-10 animate-float">
                                <div className="w-64 h-[500px] bg-dark-800 rounded-[40px] border-4 border-dark-700 p-3 shadow-2xl">
                                    <div className="w-full h-full bg-dark-900 rounded-[32px] overflow-hidden">
                                        {/* WhatsApp Header */}
                                        <div className="bg-primary-600 p-4 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                                <MessageCircle className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-white font-semibold">WhatsAI Bot</div>
                                                <div className="text-white/70 text-xs">En ligne</div>
                                            </div>
                                        </div>

                                        {/* Chat Messages */}
                                        <div className="p-4 space-y-3">
                                            <div className="bg-dark-700 rounded-lg rounded-tl-none p-3 max-w-[80%]">
                                                <p className="text-white text-sm">Bonjour ! Comment puis-je vous aider ? 👋</p>
                                            </div>
                                            <div className="bg-primary-500 rounded-lg rounded-tr-none p-3 max-w-[80%] ml-auto">
                                                <p className="text-white text-sm">Je veux des infos sur vos prix</p>
                                            </div>
                                            <div className="bg-dark-700 rounded-lg rounded-tl-none p-3 max-w-[80%]">
                                                <p className="text-white text-sm">Bien sûr ! Nous avons 3 forfaits...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Play button */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="w-20 h-20 rounded-full bg-primary-500/90 backdrop-blur flex items-center justify-center shadow-lg shadow-primary-500/25"
                                >
                                    <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1" />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
