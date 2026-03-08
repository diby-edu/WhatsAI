'use client'

import { motion } from 'framer-motion'
import { UtensilsCrossed, ShoppingCart, Home, Wrench, Heart, GraduationCap, Sparkles, Building2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function BusinessTypes() {
    const t = useTranslations('BusinessTypes')

    const businesses = [
        { key: 'restaurant', icon: UtensilsCrossed, gradient: 'linear-gradient(135deg, #f97316, #fb923c)', glow: 'rgba(249, 115, 22, 0.3)' },
        { key: 'ecommerce', icon: ShoppingCart, gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59, 130, 246, 0.3)' },
        { key: 'realestate', icon: Home, gradient: 'linear-gradient(135deg, #10b981, #34d399)', glow: 'rgba(16, 185, 129, 0.3)' },
        { key: 'services', icon: Wrench, gradient: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', glow: 'rgba(139, 92, 246, 0.3)' },
        { key: 'health', icon: Heart, gradient: 'linear-gradient(135deg, #ef4444, #f87171)', glow: 'rgba(239, 68, 68, 0.3)' },
        { key: 'education', icon: GraduationCap, gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)', glow: 'rgba(6, 182, 212, 0.3)' },
        { key: 'beauty', icon: Sparkles, gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', glow: 'rgba(236, 72, 153, 0.3)' },
        { key: 'enterprise', icon: Building2, gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', glow: 'rgba(245, 158, 11, 0.3)' }
    ]

    return (
        <section id="business-types" className="py-16 sm:py-[100px] px-6 relative" style={{
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)'
        }}>
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
                width: 1000, height: 1000,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.04) 0%, transparent 70%)'
            }} />

            <div className="max-w-[1200px] mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-6" style={{
                        background: 'rgba(37, 211, 102, 0.1)',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}>
                        <Building2 style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span className="text-sm text-[#25D366] font-semibold">{t('badge')}</span>
                    </div>
                    <h2 className="font-bold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>
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
                    <p className="text-lg text-slate-400 max-w-[600px] mx-auto">
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {businesses.map((biz, index) => (
                        <motion.div
                            key={biz.key}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.07 }}
                            whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            className="p-7 rounded-3xl cursor-pointer relative overflow-hidden text-center"
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}
                        >
                            {/* Hover top bar */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
                                style={{ background: biz.gradient }}
                            />

                            {/* Icon */}
                            <div className="flex items-center justify-center mx-auto mb-4" style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: biz.gradient,
                                boxShadow: `0 10px 30px ${biz.glow}`
                            }}>
                                <biz.icon style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            <h3 className="text-base font-semibold text-white mb-2">
                                {t(`items.${biz.key}.title`)}
                            </h3>
                            <p className="text-[13px] text-slate-400 leading-relaxed m-0">
                                {t(`items.${biz.key}.description`)}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
