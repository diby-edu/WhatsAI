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
        <section id="problem" style={{
            padding: '100px 24px',
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)',
            position: 'relative'
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 800,
                height: 800,
                background: 'radial-gradient(circle, rgba(239, 68, 68, 0.06) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 16px',
                            borderRadius: 50,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            marginBottom: 24
                        }}
                    >
                        <AlertTriangle style={{ width: 16, height: 16, color: '#ef4444' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>⚠️</span>
                    </motion.div>

                    <h2 style={{
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 20,
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
                    <p style={{
                        fontSize: 18,
                        color: '#94a3b8',
                        maxWidth: 600,
                        margin: '0 auto',
                        lineHeight: 1.7
                    }}>
                        {t('description')}
                    </p>
                    <p style={{
                        fontSize: 16,
                        color: '#64748b',
                        maxWidth: 600,
                        margin: '16px auto 0',
                        lineHeight: 1.7,
                        fontStyle: 'italic'
                    }}>
                        {t('situations')}
                    </p>
                </motion.div>

                {/* Problem Items */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: 16,
                    marginBottom: 48
                }}>
                    {items.map((item, index) => (
                        <motion.div
                            key={item.key}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: index * 0.1 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: '18px 22px',
                                borderRadius: 16,
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.15)'
                            }}
                        >
                            <XCircle style={{ width: 22, height: 22, color: '#ef4444', flexShrink: 0 }} />
                            <span style={{ fontSize: 15, color: '#e2e8f0', fontWeight: 500 }}>
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
                    style={{
                        textAlign: 'center',
                        padding: '24px 32px',
                        borderRadius: 20,
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.03))',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                >
                    <p style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: '#fca5a5',
                        margin: 0
                    }}>
                        {t('conclusion')}
                    </p>
                </motion.div>
            </div>
        </section>
    )
}
