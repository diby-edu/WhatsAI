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
        <section id="business-types" style={{
            padding: '100px 24px',
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)',
            position: 'relative'
        }}>
            {/* Background decoration */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 1000,
                height: 1000,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.04) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 64 }}
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
                        <Building2 style={{ width: 16, height: 16, color: '#25D366' }} />
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
                    <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 600, margin: '0 auto' }}>
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Grid */}
                <div className="bt-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 20
                }}>
                    {businesses.map((biz, index) => (
                        <motion.div
                            key={biz.key}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.07 }}
                            whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            style={{
                                padding: 28,
                                borderRadius: 24,
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                textAlign: 'center'
                            }}
                        >
                            {/* Hover top bar */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 2,
                                    background: biz.gradient,
                                    borderRadius: '24px 24px 0 0'
                                }}
                            />

                            {/* Icon */}
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: biz.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 16px',
                                boxShadow: `0 10px 30px ${biz.glow}`
                            }}>
                                <biz.icon style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            <h3 style={{
                                fontSize: 16,
                                fontWeight: 600,
                                color: 'white',
                                marginBottom: 8
                            }}>
                                {t(`items.${biz.key}.title`)}
                            </h3>
                            <p style={{
                                fontSize: 13,
                                color: '#94a3b8',
                                lineHeight: 1.6,
                                margin: 0
                            }}>
                                {t(`items.${biz.key}.description`)}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 1024px) {
                    .bt-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 600px) {
                    .bt-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
                @media (max-width: 768px) {
                    #business-types {
                        padding-top: 60px !important;
                        padding-bottom: 60px !important;
                    }
                    #business-types h3,
                    #business-types p {
                        word-break: break-word !important;
                        overflow-wrap: break-word !important;
                        hyphens: auto !important;
                    }
                    .bt-grid > div {
                        padding: 18px !important;
                    }
                }
            `}</style>
        </section>
    )
}
