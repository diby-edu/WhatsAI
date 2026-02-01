'use client'

import { motion } from 'framer-motion'
import { Zap, Target, MessageSquare, BarChart3, Globe, Shield, Database, Brain } from 'lucide-react'
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
        <section id="features" style={{
            padding: '120px 24px',
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
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
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.05) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 80 }}
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
                        <Zap style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span style={{ fontSize: 14, color: '#25D366', fontWeight: 600 }}>{t('badge')}</span>
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 16,
                        lineHeight: 1.2
                    }}>
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
                    <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 600, margin: '0 auto' }}>
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* Features Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 24,
                    marginBottom: 100
                }}>
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            style={{
                                padding: 32,
                                borderRadius: 24,
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Hover glow effect */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 2,
                                    background: feature.gradient,
                                    borderRadius: '24px 24px 0 0'
                                }}
                            />

                            {/* Icon */}
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: feature.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 20,
                                boxShadow: `0 10px 30px ${feature.glow}`
                            }}>
                                <feature.icon style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            {/* Content */}
                            <h3 style={{
                                fontSize: 20,
                                fontWeight: 600,
                                color: 'white',
                                marginBottom: 10
                            }}>
                                {feature.title}
                            </h3>
                            <p style={{
                                fontSize: 15,
                                color: '#94a3b8',
                                lineHeight: 1.6
                            }}>
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 32,
                        padding: '48px 64px',
                        borderRadius: 32,
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}
                >
                    {stats.map((stat, index) => (
                        <div key={stat.label} style={{ textAlign: 'center' }}>
                            <motion.div
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                style={{
                                    fontSize: 'clamp(32px, 4vw, 48px)',
                                    fontWeight: 800,
                                    background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                    marginBottom: 8
                                }}
                            >
                                {stat.value}
                            </motion.div>
                            <div style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>

            <style jsx global>{`
                @media (max-width: 768px) {
                    section#features > div > div:last-child {
                        grid-template-columns: repeat(2, 1fr) !important;
                        padding: 32px !important;
                        gap: 24px !important;
                    }
                }
                @media (max-width: 480px) {
                    section#features > div > div:last-child {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </section>
    )
}
