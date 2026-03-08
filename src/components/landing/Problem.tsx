'use client'

import { motion } from 'framer-motion'
import { XCircle, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function Problem() {
    const t = useTranslations('Problem')

    const items = [
        { key: 'unanswered' },
        { key: 'lateReplies' },
        { key: 'tooMany' },
        { key: 'lostClients' },
        { key: 'managementStress' },
        { key: 'missedOpportunities' },
    ]

    return (
        <section id="problem" className="py-16 sm:py-[100px] px-6 relative" style={{
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)'
        }}>
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
                width: 800, height: 800,
                background: 'radial-gradient(circle, rgba(239, 68, 68, 0.06) 0%, transparent 70%)'
            }} />

            <div className="max-w-[800px] mx-auto relative z-10">
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}
                    >
                        <AlertTriangle style={{ width: 16, height: 16, color: '#ef4444' }} />
                        <span className="text-[13px] font-semibold text-[#ef4444]">⚠️</span>
                    </motion.div>

                    <h2 className="font-bold text-white mb-5 leading-tight" style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>
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
                    <p className="text-lg text-slate-400 max-w-[600px] mx-auto leading-relaxed">
                        {t('description')}
                    </p>
                    <p className="text-base text-slate-500 max-w-[600px] mx-auto mt-4 leading-relaxed italic">
                        {t('situations')}
                    </p>
                </motion.div>

                {/* Problem Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            className="flex items-center gap-[14px] px-[22px] py-[18px] rounded-2xl"
                            style={{
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.15)'
                            }}
                        >
                            <XCircle style={{ width: 22, height: 22, color: '#ef4444', flexShrink: 0 }} />
                            <span className="text-[15px] text-slate-200 font-medium">
                                {t(`items.${item.key}`)}
                            </span>
                        </motion.div>
                    ))}
                </div>

                {/* Conclusion */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="text-center px-8 py-6 rounded-[20px]"
                    style={{
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.03))',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                >
                    <p className="text-lg font-semibold text-[#fca5a5] m-0">
                        {t('conclusion')}
                    </p>
                </motion.div>
            </div>
        </section>
    )
}
