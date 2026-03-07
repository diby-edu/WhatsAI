'use client'

import { motion } from 'framer-motion'
import { MessageCircle, Users, Zap, Bell, Gift } from 'lucide-react'

const COMMUNITY_LINK = 'https://chat.whatsapp.com/E7vbXhqS0o5D4Wn2lrdDGi'

const benefits = [
    {
        icon: MessageCircle,
        color: '#25D366',
        title: 'Support rapide',
        desc: 'Vos questions répondues en quelques minutes par la communauté'
    },
    {
        icon: Zap,
        color: '#f59e0b',
        title: 'Tips exclusifs',
        desc: 'Stratégies et scripts de vente testés par vos pairs entrepreneurs'
    },
    {
        icon: Bell,
        color: '#3b82f6',
        title: 'Avant tout le monde',
        desc: 'Nouvelles fonctionnalités et offres membres en avant-première'
    },
    {
        icon: Gift,
        color: '#ec4899',
        title: 'Ressources gratuites',
        desc: 'Templates de messages, guides et scripts de vente offerts'
    }
]

export default function WhatsAppCommunity() {
    return (
        <section id="community" style={{
            padding: '100px 24px',
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 700,
                height: 700,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.08) 0%, transparent 70%)',
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
                    {/* Badge */}
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
                        <Users style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span style={{ color: '#25D366', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>COMMUNAUTÉ</span>
                    </div>

                    <h2 style={{
                        fontSize: 'clamp(28px, 5vw, 44px)',
                        fontWeight: 800,
                        color: '#f1f5f9',
                        lineHeight: 1.2,
                        marginBottom: 16
                    }}>
                        Rejoignez notre{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            communauté
                        </span>{' '}
                        d'entrepreneurs
                    </h2>

                    <p style={{ color: '#94a3b8', fontSize: 18, maxWidth: 520, margin: '0 auto 16px' }}>
                        Ils automatisent, ils partagent, ils réussissent
                    </p>

                    {/* Member count */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 16px',
                        borderRadius: 100,
                        background: 'rgba(37, 211, 102, 0.05)',
                        border: '1px solid rgba(37, 211, 102, 0.15)'
                    }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366', animation: 'pulse 2s infinite' }} />
                        <span style={{ color: '#64748b', fontSize: 14 }}>+200 membres actifs</span>
                    </div>
                </motion.div>

                {/* Benefits grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 20,
                    marginBottom: 48
                }}>
                    {benefits.map((benefit, i) => (
                        <motion.div
                            key={benefit.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            style={{
                                padding: 24,
                                borderRadius: 16,
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(148, 163, 184, 0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12
                            }}
                        >
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: `${benefit.color}18`,
                                border: `1px solid ${benefit.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <benefit.icon style={{ width: 22, height: 22, color: benefit.color }} />
                            </div>
                            <div>
                                <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                                    {benefit.title}
                                </h3>
                                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
                                    {benefit.desc}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    style={{ textAlign: 'center' }}
                >
                    <motion.a
                        href={COMMUNITY_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '16px 36px',
                            borderRadius: 14,
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 17,
                            textDecoration: 'none',
                            boxShadow: '0 8px 32px rgba(37, 211, 102, 0.35)',
                            cursor: 'pointer'
                        }}
                    >
                        <MessageCircle style={{ width: 22, height: 22 }} />
                        Rejoindre la communauté →
                    </motion.a>

                    <p style={{ color: '#475569', fontSize: 13, marginTop: 16 }}>
                        Gratuit • Zéro spam • Quittez à tout moment
                    </p>
                </motion.div>
            </div>

            <style jsx global>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </section>
    )
}
