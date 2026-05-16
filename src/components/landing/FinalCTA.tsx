'use client'

import { motion } from 'framer-motion'
import { MessageCircle, ArrowRight, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { PLAY_STORE_URL } from '@/lib/utils'

export default function FinalCTA() {
    const t = useTranslations('FinalCTA')

    return (
        <section id="final-cta" style={{
            padding: '100px 24px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Full-width gradient background */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(16, 185, 129, 0.06) 50%, rgba(6, 182, 212, 0.04) 100%)'
            }} />

            {/* Animated glow orbs */}
            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.15, 0.25, 0.15]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: 'absolute',
                    width: 500,
                    height: 500,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(37, 211, 102, 0.2) 0%, transparent 60%)',
                    left: '-10%',
                    top: '-30%',
                    filter: 'blur(60px)'
                }}
            />
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 8, repeat: Infinity, delay: 2 }}
                style={{
                    position: 'absolute',
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 60%)',
                    right: '-5%',
                    bottom: '-20%',
                    filter: 'blur(60px)'
                }}
            />

            <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
                {/* Sparkle badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    style={{ marginBottom: 28 }}
                >
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        style={{ display: 'inline-block' }}
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
                    style={{
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        fontWeight: 800,
                        color: 'white',
                        marginBottom: 20,
                        lineHeight: 1.2
                    }}
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
                    style={{
                        fontSize: 18,
                        color: '#94a3b8',
                        marginBottom: 40,
                        lineHeight: 1.7
                    }}
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
                    <Link href="/register" style={{ textDecoration: 'none' }}>
                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 25px 50px rgba(37, 211, 102, 0.35)' }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                padding: '20px 44px',
                                borderRadius: 16,
                                border: 'none',
                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: 18,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 12,
                                boxShadow: '0 15px 40px rgba(37, 211, 102, 0.25)'
                            }}
                        >
                            <MessageCircle style={{ width: 22, height: 22 }} />
                            {t('cta')}
                            <ArrowRight style={{ width: 20, height: 20 }} />
                        </motion.button>
                    </Link>
                </motion.div>

                {/* Play Store Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    style={{ marginTop: 24 }}
                >
                    <motion.a
                        href={PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        style={{ textDecoration: 'none', display: 'inline-block' }}
                    >
                        <Image
                            src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
                            alt="Disponible sur Google Play"
                            width={155}
                            height={60}
                            style={{ height: 60, width: 'auto', display: 'block' }}
                        />
                    </motion.a>
                </motion.div>
            </div>
        </section>
    )
}
