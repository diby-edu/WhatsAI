'use client'

import { motion } from 'framer-motion'
import { Bot, QrCode, Zap, ArrowRight, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function HowItWorks() {
    const t = useTranslations('HowItWorks')

    const steps = [
        {
            number: '01',
            icon: Bot,
            titleKey: 'steps.step1.title',
            descKey: 'steps.step1.description',
            gradient: 'linear-gradient(135deg, #818cf8, #6366f1)',
            delay: 0
        },
        {
            number: '02',
            icon: QrCode,
            titleKey: 'steps.step2.title',
            descKey: 'steps.step2.description',
            gradient: 'linear-gradient(135deg, #f472b6, #ec4899)',
            delay: 0.2
        },
        {
            number: '03',
            icon: Zap,
            titleKey: 'steps.step3.title',
            descKey: 'steps.step3.description',
            gradient: 'linear-gradient(135deg, #34d399, #10b981)',
            delay: 0.4
        }
    ]

    return (
        <section id="how-it-works" className="py-16 sm:py-[100px] px-6 relative bg-[#020617]">
            {/* Background effects */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{
                background: 'linear-gradient(90deg, transparent, rgba(37, 211, 102, 0.3), transparent)'
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
                        <Zap style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span className="text-sm text-[#25D366] font-semibold">{t('badge')}</span>
                    </div>
                    <h2 className="font-bold text-white mb-4 leading-tight" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
                        {t.rich('title', {
                            green: (chunks) => (
                                <span style={{
                                    background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}>{chunks}</span>
                            )
                        })}
                    </h2>
                    <p className="text-lg text-slate-400 max-w-[500px] mx-auto">
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Steps */}
                <div className="flex justify-center items-stretch gap-6 flex-wrap">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: step.delay }}
                            className="flex-1 basis-[300px] max-w-[360px] relative flex items-stretch"
                        >
                            {/* Arrow connector */}
                            {index < steps.length - 1 && (
                                <div className="step-arrow absolute z-10 flex items-center" style={{
                                    right: -16, top: '50%', transform: 'translateY(-50%)'
                                }}>
                                    <motion.div
                                        animate={{ x: [0, 5, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="w-8 h-8 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(37, 211, 102, 0.2)' }}
                                    >
                                        <ArrowRight style={{ width: 16, height: 16, color: '#25D366' }} />
                                    </motion.div>
                                </div>
                            )}

                            {/* Card */}
                            <motion.div
                                className="hiw-step flex-1 rounded-[28px] text-center relative overflow-hidden"
                                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                                style={{
                                    padding: 36,
                                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}
                            >
                                {/* Step number background */}
                                <div className="hiw-number absolute top-4 right-4 font-black leading-none" style={{
                                    fontSize: 72,
                                    color: 'rgba(148, 163, 184, 0.06)'
                                }}>
                                    {step.number}
                                </div>

                                {/* Icon */}
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className="flex items-center justify-center mx-auto mb-6"
                                    style={{
                                        width: 72, height: 72, borderRadius: 20,
                                        background: step.gradient,
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <step.icon style={{ width: 32, height: 32, color: 'white' }} />
                                </motion.div>

                                <h3 className="text-xl font-bold text-white mb-3">{t(step.titleKey)}</h3>
                                <p className="text-sm text-slate-400 leading-[1.7]">{t(step.descKey)}</p>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="text-center mt-12"
                >
                    <Link href="/register" className="no-underline">
                        <motion.button
                            whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(37, 211, 102, 0.3)' }}
                            whileTap={{ scale: 0.98 }}
                            className="py-4 px-8 rounded-[14px] border-0 text-white font-bold text-base cursor-pointer inline-flex items-center gap-[10px]"
                            style={{
                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                boxShadow: '0 10px 30px rgba(37, 211, 102, 0.2)'
                            }}
                        >
                            <MessageCircle style={{ width: 20, height: 20 }} />
                            {t('cta')}
                            <ArrowRight style={{ width: 18, height: 18 }} />
                        </motion.button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
