'use client'

import { motion } from 'framer-motion'
import { MessageCircle, Sparkles, Zap, ArrowRight, Play, Star, Bot, CheckCircle, Clock, Users } from 'lucide-react'
import Link from 'next/link'

export default function Hero() {
    return (
        <section style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            paddingTop: 80,
            overflow: 'hidden',
            backgroundColor: '#020617'
        }}>
            {/* Animated Background */}
            <div style={{ position: 'absolute', inset: 0 }}>
                {/* Grid */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
                    backgroundSize: '50px 50px',
                    opacity: 0.5
                }} />

                {/* Gradient Orbs */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 8, repeat: Infinity }}
                    style={{
                        position: 'absolute',
                        width: 800,
                        height: 800,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 60%)',
                        top: -300,
                        right: -200,
                        filter: 'blur(60px)'
                    }}
                />
                <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 10, repeat: Infinity, delay: 2 }}
                    style={{
                        position: 'absolute',
                        width: 600,
                        height: 600,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 60%)',
                        bottom: -200,
                        left: -100,
                        filter: 'blur(60px)'
                    }}
                />
            </div>

            <div style={{
                width: '100%',
                maxWidth: 1280,
                margin: '0 auto',
                padding: '0 24px',
                position: 'relative',
                zIndex: 10
            }}>
                {/* Centered Content */}
                <div style={{ textAlign: 'center', maxWidth: 900, margin: '0 auto' }}>
                    {/* Trust Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 20px',
                            borderRadius: 100,
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(139, 92, 246, 0.1))',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            marginBottom: 32
                        }}
                    >
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} style={{ width: 14, height: 14, fill: '#facc15', color: '#facc15' }} />
                            ))}
                        </div>
                        <div style={{ width: 1, height: 20, background: 'rgba(148, 163, 184, 0.2)' }} />
                        <span style={{ fontSize: 14, color: '#94a3b8' }}>
                            <span style={{ color: 'white', fontWeight: 600 }}>+5,000</span> entreprises en Afrique
                        </span>
                    </motion.div>

                    {/* Main Title */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        style={{
                            fontSize: 'clamp(40px, 8vw, 72px)',
                            fontWeight: 800,
                            marginBottom: 24,
                            lineHeight: 1.1,
                            letterSpacing: '-0.02em'
                        }}
                    >
                        <span style={{ color: 'white' }}>Votre assistant</span>
                        <br />
                        <span style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>WhatsApp IA</span>
                        <span style={{ color: 'white' }}> 24/7</span>
                    </motion.h1>

                    {/* Subtitle */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        style={{
                            fontSize: 20,
                            color: '#94a3b8',
                            marginBottom: 40,
                            maxWidth: 600,
                            margin: '0 auto 40px',
                            lineHeight: 1.7
                        }}
                    >
                        Répondez instantanément à vos clients, qualifiez vos leads et
                        <span style={{ color: 'white', fontWeight: 500 }}> augmentez vos ventes de 300%</span> avec
                        l'intelligence artificielle.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 60 }}
                    >
                        <Link href="/register" style={{ textDecoration: 'none' }}>
                            <motion.button
                                whileHover={{ scale: 1.03, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '18px 36px',
                                    fontSize: 17,
                                    fontWeight: 700,
                                    borderRadius: 14,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                            >
                                <span>Essai gratuit • 100 crédits offerts</span>
                                <ArrowRight style={{ width: 18, height: 18 }} />
                            </motion.button>
                        </Link>
                        <motion.a
                            href="#pricing"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '18px 36px',
                                fontSize: 17,
                                fontWeight: 600,
                                borderRadius: 14,
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                cursor: 'pointer',
                                background: 'rgba(255, 255, 255, 0.03)',
                                color: 'white',
                                textDecoration: 'none'
                            }}
                        >
                            <span>Voir les tarifs</span>
                        </motion.a>
                    </motion.div>

                    {/* Features Pills */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 60 }}
                    >
                        {[
                            { icon: Zap, text: 'Réponse < 3 secondes' },
                            { icon: CheckCircle, text: 'Sans carte bancaire' },
                            { icon: Clock, text: 'Opérationnel en 5 min' }
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + i * 0.1 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 18px',
                                    borderRadius: 100,
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}
                            >
                                <item.icon style={{ width: 16, height: 16, color: '#34d399' }} />
                                <span style={{ fontSize: 14, color: '#e2e8f0' }}>{item.text}</span>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                {/* Chat Demo Card */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    style={{
                        maxWidth: 700,
                        margin: '0 auto',
                        position: 'relative'
                    }}
                >
                    {/* Glow Effect */}
                    <div style={{
                        position: 'absolute',
                        inset: -2,
                        borderRadius: 28,
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(139, 92, 246, 0.3))',
                        filter: 'blur(20px)',
                        opacity: 0.5
                    }} />

                    {/* Chat Window */}
                    <div style={{
                        position: 'relative',
                        background: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 24,
                        padding: 24,
                        overflow: 'hidden'
                    }}>
                        {/* Chat Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            marginBottom: 20,
                            paddingBottom: 16,
                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                <Bot style={{ width: 24, height: 24, color: 'white' }} />
                                <div style={{
                                    position: 'absolute',
                                    bottom: -2,
                                    right: -2,
                                    width: 14,
                                    height: 14,
                                    background: '#22c55e',
                                    borderRadius: '50%',
                                    border: '2px solid #0f172a'
                                }} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 600, color: 'white', fontSize: 16 }}>Assistant WhatsAI</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4ade80' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                                    En ligne • Répond instantanément
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1 }}
                                style={{
                                    alignSelf: 'flex-end',
                                    maxWidth: '75%',
                                    padding: '12px 18px',
                                    borderRadius: 18,
                                    borderBottomRightRadius: 4,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    fontSize: 15
                                }}
                            >
                                Bonjour ! Je cherche des infos sur vos services 👋
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1.5 }}
                                style={{
                                    alignSelf: 'flex-start',
                                    maxWidth: '75%',
                                    padding: '12px 18px',
                                    borderRadius: 18,
                                    borderBottomLeftRadius: 4,
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: '#e2e8f0',
                                    fontSize: 15
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Sparkles style={{ width: 14, height: 14, color: '#a78bfa' }} />
                                    <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 500 }}>IA • 2 secondes</span>
                                </div>
                                Bonjour ! 🎉 Je suis là pour vous aider.
                                <br /><br />
                                Je peux vous présenter nos offres, répondre à vos questions ou
                                prendre rendez-vous. Que souhaitez-vous ?
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 2.2 }}
                                style={{ display: 'flex', gap: 8 }}
                            >
                                {['📋 Nos offres', '📅 RDV', '❓ Questions'].map((btn, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 2.4 + i * 0.1 }}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: 12,
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            color: '#34d399',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {btn}
                                    </motion.div>
                                ))}
                            </motion.div>
                        </div>
                    </div>

                    {/* Floating Stats */}
                    <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        style={{
                            position: 'absolute',
                            top: -20,
                            right: -40,
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            borderRadius: 14,
                            padding: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10
                        }}
                    >
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: 'rgba(34, 197, 94, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Zap style={{ width: 20, height: 20, color: '#4ade80' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>98%</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Satisfaction</div>
                        </div>
                    </motion.div>

                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                        style={{
                            position: 'absolute',
                            bottom: 20,
                            left: -40,
                            background: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            borderRadius: 14,
                            padding: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10
                        }}
                    >
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: 'rgba(139, 92, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MessageCircle style={{ width: 20, height: 20, color: '#a78bfa' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>1M+</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Messages</div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                style={{
                    position: 'absolute',
                    bottom: 24,
                    left: '50%',
                    transform: 'translateX(-50%)'
                }}
            >
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{
                        width: 24,
                        height: 40,
                        borderRadius: 100,
                        border: '2px solid #334155',
                        display: 'flex',
                        justifyContent: 'center',
                        paddingTop: 8
                    }}
                >
                    <div style={{ width: 4, height: 10, borderRadius: 100, background: '#10b981' }} />
                </motion.div>
            </motion.div>
        </section>
    )
}
