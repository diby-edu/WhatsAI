'use client'

import { motion } from 'framer-motion'
import { MessageCircle, Sparkles, Zap, ArrowRight, Play, Star } from 'lucide-react'
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
            {/* Background Effects */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
                opacity: 0.5
            }} />
            <div style={{
                position: 'absolute',
                width: 600,
                height: 600,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                top: -200,
                right: -200,
                filter: 'blur(40px)'
            }} />
            <div style={{
                position: 'absolute',
                width: 500,
                height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                bottom: -200,
                left: -200,
                filter: 'blur(40px)'
            }} />

            <div style={{
                width: '100%',
                maxWidth: 1280,
                margin: '0 auto',
                padding: '0 24px',
                position: 'relative',
                zIndex: 10
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: 48,
                    alignItems: 'center'
                }}>
                    {/* Left Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 16px',
                                borderRadius: 100,
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                marginBottom: 24
                            }}
                        >
                            <Sparkles style={{ width: 16, height: 16, color: '#34d399' }} />
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#34d399' }}>
                                Propulsé par GPT-4o
                            </span>
                            <span style={{
                                padding: '2px 8px',
                                borderRadius: 100,
                                background: 'rgba(16, 185, 129, 0.2)',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#6ee7b7'
                            }}>
                                NOUVEAU
                            </span>
                        </motion.div>

                        {/* Main Title */}
                        <h1 style={{ fontSize: 56, fontWeight: 700, marginBottom: 24, lineHeight: 1.1 }}>
                            <span style={{ color: 'white' }}>Automatisez</span>
                            <br />
                            <span style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>WhatsApp</span>
                            <br />
                            <span style={{ color: 'white' }}>avec l'</span>
                            <span style={{
                                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>IA</span>
                        </h1>

                        {/* Subtitle */}
                        <p style={{ fontSize: 20, color: '#cbd5e1', marginBottom: 32, maxWidth: 500, lineHeight: 1.6 }}>
                            Transformez chaque conversation en opportunité.
                            Notre IA répond à vos clients <span style={{ color: 'white', fontWeight: 500 }}>24/7</span>,
                            qualifie vos leads et booste vos ventes.
                        </p>

                        {/* Stats Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 40 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 30, fontWeight: 700, color: 'white' }}>+300%</div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>Conversions</div>
                            </div>
                            <div style={{ width: 1, height: 48, background: '#334155' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 30, fontWeight: 700, color: 'white' }}>24/7</div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>Disponible</div>
                            </div>
                            <div style={{ width: 1, height: 48, background: '#334155' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 30, fontWeight: 700, color: 'white' }}>&lt;10s</div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>Réponse</div>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                            <Link href="/register" style={{ textDecoration: 'none' }}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '16px 32px',
                                        fontSize: 18,
                                        fontWeight: 600,
                                        borderRadius: 14,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                        color: 'white',
                                        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                                    }}
                                >
                                    <span>Commencer gratuitement</span>
                                    <ArrowRight style={{ width: 20, height: 20 }} />
                                </motion.button>
                            </Link>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '16px 32px',
                                    fontSize: 18,
                                    fontWeight: 600,
                                    borderRadius: 14,
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    cursor: 'pointer',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'white',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <Play style={{ width: 20, height: 20 }} />
                                <span>Voir la démo</span>
                            </motion.button>
                        </div>

                        {/* Trust Badges */}
                        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div style={{ display: 'flex' }}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #10b981, #a855f7)',
                                            border: '2px solid #0f172a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: 'white',
                                            marginLeft: i > 1 ? -12 : 0
                                        }}
                                    >
                                        {String.fromCharCode(64 + i)}
                                    </div>
                                ))}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Star key={i} style={{ width: 16, height: 16, fill: '#facc15', color: '#facc15' }} />
                                    ))}
                                </div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>
                                    <span style={{ color: 'white', fontWeight: 500 }}>5,000+</span> entreprises nous font confiance
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Content - Chat Demo */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        style={{ position: 'relative' }}
                    >
                        {/* Main Chat Window */}
                        <div style={{
                            position: 'relative',
                            background: 'rgba(30, 41, 59, 0.5)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 24,
                            padding: 24
                        }}>
                            {/* Chat Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                marginBottom: 24,
                                paddingBottom: 16,
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                            }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 16,
                                        background: 'linear-gradient(135deg, #10b981, #34d399)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <MessageCircle style={{ width: 28, height: 28, color: 'white' }} />
                                    </div>
                                    <div style={{
                                        position: 'absolute',
                                        bottom: -4,
                                        right: -4,
                                        width: 16,
                                        height: 16,
                                        background: '#22c55e',
                                        borderRadius: '50%',
                                        border: '2px solid #1e293b'
                                    }} />
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: 600, color: 'white', fontSize: 18 }}>WhatsAI Assistant</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#4ade80' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                                        En ligne
                                    </div>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308' }} />
                                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1 }}
                                    style={{
                                        maxWidth: '80%',
                                        padding: '14px 18px',
                                        borderRadius: 20,
                                        borderBottomRightRadius: 6,
                                        marginLeft: 'auto',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                        color: 'white',
                                        fontSize: 15,
                                        lineHeight: 1.5
                                    }}
                                >
                                    Bonjour ! J'aimerais avoir des infos sur vos services 👋
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 1.5 }}
                                    style={{
                                        maxWidth: '80%',
                                        padding: '14px 18px',
                                        borderRadius: 20,
                                        borderBottomLeftRadius: 6,
                                        background: 'rgba(30, 41, 59, 0.8)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: '#e2e8f0',
                                        fontSize: 15,
                                        lineHeight: 1.5
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <Zap style={{ width: 16, height: 16, color: '#34d399' }} />
                                        <span style={{ fontSize: 12, color: '#34d399', fontWeight: 500 }}>Réponse IA en 2s</span>
                                    </div>
                                    Bonjour ! 👋 Merci de votre intérêt !
                                    <br /><br />
                                    Je suis Marie, votre assistante virtuelle. Je peux vous aider avec :
                                    <br />
                                    ✨ Nos offres et tarifs
                                    <br />
                                    📅 Réserver un rendez-vous
                                    <br />
                                    ❓ Répondre à vos questions
                                    <br /><br />
                                    Que puis-je faire pour vous ?
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 2 }}
                                    style={{
                                        maxWidth: '80%',
                                        padding: '14px 18px',
                                        borderRadius: 20,
                                        borderBottomRightRadius: 6,
                                        marginLeft: 'auto',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                        color: 'white',
                                        fontSize: 15,
                                        lineHeight: 1.5
                                    }}
                                >
                                    Super ! Montrez-moi vos tarifs
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 2.5 }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#94a3b8' }}
                                >
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'bounce 1s infinite' }} />
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'bounce 1s infinite 0.15s' }} />
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'bounce 1s infinite 0.3s' }} />
                                    </div>
                                    L'IA rédige une réponse...
                                </motion.div>
                            </div>
                        </div>

                        {/* Floating Stats Cards */}
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            style={{
                                position: 'absolute',
                                top: -24,
                                right: -24,
                                background: 'rgba(30, 41, 59, 0.5)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                padding: 16
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Zap style={{ width: 24, height: 24, color: '#4ade80' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>98%</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Taux de satisfaction</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 5, repeat: Infinity }}
                            style={{
                                position: 'absolute',
                                bottom: -16,
                                left: -24,
                                background: 'rgba(30, 41, 59, 0.5)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                padding: 16
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MessageCircle style={{ width: 24, height: 24, color: '#c084fc' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>1.2M+</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Messages envoyés</div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                style={{
                    position: 'absolute',
                    bottom: 32,
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
                        border: '2px solid #475569',
                        display: 'flex',
                        justifyContent: 'center',
                        paddingTop: 8
                    }}
                >
                    <div style={{ width: 6, height: 12, borderRadius: 100, background: '#10b981' }} />
                </motion.div>
            </motion.div>
        </section>
    )
}
