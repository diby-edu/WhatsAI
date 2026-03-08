'use client'

import { motion } from 'framer-motion'
import { Star, Users, Quote } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function SocialProof() {
    const t = useTranslations('SocialProof')

    const testimonials = [
        { key: 't1', color: '#f97316' },
        { key: 't2', color: '#ec4899' },
        { key: 't3', color: '#3b82f6' }
    ]

    return (
        <section id="social-proof" className="py-16 sm:py-[100px] px-6 relative bg-[#0f172a]">
            {/* Background glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none" style={{
                width: 600, height: 600,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.05) 0%, transparent 70%)'
            }} />

            <div className="max-w-[1100px] mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-14"
                >
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-6" style={{
                        background: 'rgba(37, 211, 102, 0.1)',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}>
                        <Star style={{ width: 16, height: 16, color: '#25D366', fill: '#25D366' }} />
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
                    <p className="text-lg text-slate-400 max-w-[500px] mx-auto">
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Counter */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center mb-12"
                >
                    <div className="inline-flex items-center gap-3 px-7 py-[14px] rounded-full" style={{
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12), rgba(37, 211, 102, 0.04))',
                        border: '1px solid rgba(37, 211, 102, 0.25)'
                    }}>
                        <Users style={{ width: 22, height: 22, color: '#25D366' }} />
                        <span className="text-base font-bold text-[#25D366]">{t('counter')}</span>
                    </div>
                </motion.div>

                {/* Testimonials Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((item, index) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.15 }}
                            whileHover={{ y: -6, transition: { duration: 0.2 } }}
                            className="p-8 rounded-3xl relative overflow-hidden"
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}
                        >
                            <Quote style={{ width: 32, height: 32, color: 'rgba(37, 211, 102, 0.3)', marginBottom: 16 }} />

                            {/* Stars */}
                            <div className="flex gap-[3px] mb-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Star key={i} style={{ width: 16, height: 16, fill: '#facc15', color: '#facc15' }} />
                                ))}
                            </div>

                            <p className="text-[15px] text-slate-200 leading-[1.7] mb-6 italic">
                                &ldquo;{t(`testimonials.${item.key}.text`)}&rdquo;
                            </p>

                            {/* Author */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center rounded-full text-lg font-bold text-white shrink-0" style={{
                                    width: 44, height: 44,
                                    background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`
                                }}>
                                    {t(`testimonials.${item.key}.name`).charAt(0)}
                                </div>
                                <div>
                                    <div className="text-[15px] font-semibold text-white">
                                        {t(`testimonials.${item.key}.name`)}
                                    </div>
                                    <div className="text-[13px] text-slate-500">
                                        {t(`testimonials.${item.key}.role`)} — {t(`testimonials.${item.key}.company`)}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
