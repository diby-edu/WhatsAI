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
        <section id="social-proof" style={{
            padding: '100px 24px',
            background: '#0f172a',
            position: 'relative'
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 600,
                height: 600,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.05) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 56 }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 20px',
                        borderRadius: 100,
                        background: 'rgba(37, 211, 102, 0.1)',
                        border: '1px solid rgba(37, 211, 102, 0.2)',
                        marginBottom: 24
                    }}>
                        <Star style={{ width: 16, height: 16, color: '#25D366', fill: '#25D366' }} />
                        <span style={{ fontSize: 14, color: '#25D366', fontWeight: 600 }}>{t('badge')}</span>
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 16,
                        lineHeight: 1.2
                    }}>
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
                    <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 500, margin: '0 auto' }}>
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Counter */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 48
                    }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 28px',
                        borderRadius: 100,
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12), rgba(37, 211, 102, 0.04))',
                        border: '1px solid rgba(37, 211, 102, 0.25)'
                    }}>
                        <Users style={{ width: 22, height: 22, color: '#25D366' }} />
                        <span style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#25D366'
                        }}>
                            {t('counter')}
                        </span>
                    </div>
                </motion.div>

                {/* Testimonials Grid */}
                <div className="sp-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 24
                }}>
                    {testimonials.map((item, index) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.15 }}
                            whileHover={{ y: -6, transition: { duration: 0.2 } }}
                            style={{
                                padding: 32,
                                borderRadius: 24,
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Quote icon */}
                            <Quote style={{
                                width: 32,
                                height: 32,
                                color: 'rgba(37, 211, 102, 0.3)',
                                marginBottom: 16
                            }} />

                            {/* Stars */}
                            <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Star key={i} style={{ width: 16, height: 16, fill: '#facc15', color: '#facc15' }} />
                                ))}
                            </div>

                            {/* Text */}
                            <p style={{
                                fontSize: 15,
                                color: '#e2e8f0',
                                lineHeight: 1.7,
                                marginBottom: 24,
                                fontStyle: 'italic'
                            }}>
                                &ldquo;{t(`testimonials.${item.key}.text`)}&rdquo;
                            </p>

                            {/* Author */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {/* Avatar */}
                                <div style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${item.color}, ${item.color}88)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: 'white'
                                }}>
                                    {t(`testimonials.${item.key}.name`).charAt(0)}
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: 'white'
                                    }}>
                                        {t(`testimonials.${item.key}.name`)}
                                    </div>
                                    <div style={{
                                        fontSize: 13,
                                        color: '#64748b'
                                    }}>
                                        {t(`testimonials.${item.key}.role`)} — {t(`testimonials.${item.key}.company`)}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 900px) {
                    .sp-grid {
                        grid-template-columns: 1fr !important;
                        max-width: 500px !important;
                        margin: 0 auto !important;
                    }
                }
            `}</style>
        </section>
    )
}
