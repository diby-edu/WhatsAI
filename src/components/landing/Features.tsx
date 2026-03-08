'use client'

import { motion } from 'framer-motion'
import { Zap, Target, MessageSquare, BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function Features() {
    const t = useTranslations('Features')

    const features = [
        {
            icon: Zap,
            title: t('items.instant_response.title'),
            description: t('items.instant_response.description'),
            gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
            glow: 'rgba(245, 158, 11, 0.3)'
        },
        {
            icon: Target,
            title: t('items.lead_qualification.title'),
            description: t('items.lead_qualification.description'),
            gradient: 'linear-gradient(135deg, #10b981, #34d399)',
            glow: 'rgba(16, 185, 129, 0.3)'
        },
        {
            icon: MessageSquare,
            title: t('items.multi_conversations.title'),
            description: t('items.multi_conversations.description'),
            gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
            glow: 'rgba(59, 130, 246, 0.3)'
        },
        {
            icon: BarChart3,
            title: t('items.analytics.title'),
            description: t('items.analytics.description'),
            gradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
            glow: 'rgba(236, 72, 153, 0.3)'
        }
    ]

    const stats = [
        { value: t('stats.companies.value'), label: t('stats.companies.label') },
        { value: t('stats.messages.value'), label: t('stats.messages.label') },
        { value: t('stats.satisfaction.value'), label: t('stats.satisfaction.label') },
        { value: t('stats.roi.value'), label: t('stats.roi.label') }
    ]

    return (
        <section id="features" className="py-16 sm:py-[120px] px-6 relative" style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)'
        }}>
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
                width: 1000, height: 1000,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.05) 0%, transparent 70%)'
            }} />

            <div className="max-w-[1200px] mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-20"
                >
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-6" style={{
                        background: 'rgba(37, 211, 102, 0.1)',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}>
                        <Zap style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span className="text-sm text-[#25D366] font-semibold">{t('badge')}</span>
                    </div>
                    <h2 className="font-bold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
                        {t.rich('title', {
                            green: (chunks) => (
                                <span style={{
                                    background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}>{chunks}</span>
                            )
                        })}
                    </h2>
                    <p className="text-lg text-slate-400 max-w-[600px] mx-auto">
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-[100px]">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            className="p-8 rounded-3xl cursor-pointer relative overflow-hidden"
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}
                        >
                            {/* Hover glow top bar */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
                                style={{ background: feature.gradient }}
                            />

                            {/* Icon */}
                            <div className="flex items-center justify-center mb-5" style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: feature.gradient,
                                boxShadow: `0 10px 30px ${feature.glow}`
                            }}>
                                <feature.icon style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            <h3 className="text-xl font-semibold text-white mb-[10px]">{feature.title}</h3>
                            <p className="text-[15px] text-slate-400 leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-8 px-8 md:px-16 py-12 rounded-[32px]"
                    style={{
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}
                >
                    {stats.map((stat, index) => (
                        <div key={stat.label} className="text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className="font-extrabold mb-2"
                                style={{
                                    fontSize: 'clamp(32px, 4vw, 48px)',
                                    background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}
                            >
                                {stat.value}
                            </motion.div>
                            <div className="text-[15px] text-slate-400 font-medium">{stat.label}</div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    )
}
