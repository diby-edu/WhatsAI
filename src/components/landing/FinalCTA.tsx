'use client'

import { motion } from 'framer-motion'
import { MessageCircle, ArrowRight, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function FinalCTA() {
    const t = useTranslations('FinalCTA')

    return (
        <section id="final-cta" className="py-16 sm:py-[100px] px-6 relative overflow-hidden">
            {/* Full-width gradient background */}
            <div className="absolute inset-0" style={{
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(16, 185, 129, 0.06) 50%, rgba(6, 182, 212, 0.04) 100%)'
            }} />

            {/* Animated glow orbs */}
            <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.25, 0.15] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 500, height: 500,
                    background: 'radial-gradient(circle, rgba(37, 211, 102, 0.2) 0%, transparent 60%)',
                    left: '-10%', top: '-30%', filter: 'blur(60px)'
                }}
            />
            <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 8, repeat: Infinity, delay: 2 }}
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 400, height: 400,
                    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 60%)',
                    right: '-5%', bottom: '-20%', filter: 'blur(60px)'
                }}
            />

            <div className="max-w-[700px] mx-auto relative z-10 text-center">
                {/* Sparkle badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="mb-7"
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="inline-block"
                    >
                        <Sparkles style={{ width: 40, height: 40, color: '#25D366' }} />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-white font-extrabold mb-5 leading-tight"
                    style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}
                >
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
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-lg text-slate-400 mb-10 leading-relaxed"
                >
                    {t('subtitle')}
                </motion.p>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                >
                    <Link href="/register" className="no-underline">
                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 25px 50px rgba(37, 211, 102, 0.35)' }}
                            whileTap={{ scale: 0.98 }}
                            className="py-5 px-11 rounded-2xl border-0 text-white font-bold text-lg cursor-pointer inline-flex items-center gap-3"
                            style={{
                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                boxShadow: '0 15px 40px rgba(37, 211, 102, 0.25)'
                            }}
                        >
                            <MessageCircle style={{ width: 22, height: 22 }} />
                            {t('cta')}
                            <ArrowRight style={{ width: 20, height: 20 }} />
                        </motion.button>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
