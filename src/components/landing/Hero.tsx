'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Sparkles, Zap, ArrowRight, Star, Bot, CheckCircle, Clock, Users, Send, Shield, TrendingUp, Phone } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

// WhatsApp-style chat messages for the demo
const chatMessages = [
    { id: 1, type: 'received', text: "Bonjour ! Je cherche un appartement 3 pièces à Abidjan 🏠", time: "10:30" },
    { id: 2, type: 'sent', text: "Bonjour ! 👋 Je suis votre assistant WhatsAI. J'ai trouvé 5 appartements correspondant à vos critères.", time: "10:30", isBot: true },
    { id: 3, type: 'sent', text: "📍 Cocody - 3 pièces - 350,000 FCFA/mois\n📍 Marcory - 3 pièces - 280,000 FCFA/mois\n📍 Plateau - 3 pièces - 450,000 FCFA/mois", time: "10:30", isBot: true },
    { id: 4, type: 'received', text: "Super ! Je peux visiter celui de Cocody demain ?", time: "10:31" },
    { id: 5, type: 'sent', text: "Parfait ! ✅ J'ai planifié une visite pour demain à 14h. Vous recevrez un SMS de confirmation.", time: "10:31", isBot: true },
]

export default function Hero() {
    const [visibleMessages, setVisibleMessages] = useState(0)
    const [isTyping, setIsTyping] = useState(false)

    useEffect(() => {
        if (visibleMessages < chatMessages.length) {
            const timer = setTimeout(() => {
                if (chatMessages[visibleMessages]?.type === 'sent') {
                    setIsTyping(true)
                    setTimeout(() => {
                        setIsTyping(false)
                        setVisibleMessages(v => v + 1)
                    }, 1200)
                } else {
                    setVisibleMessages(v => v + 1)
                }
            }, visibleMessages === 0 ? 1000 : 2000)
            return () => clearTimeout(timer)
        } else {
            // Loop the animation
            setTimeout(() => setVisibleMessages(0), 4000)
        }
    }, [visibleMessages])

    return (
        <section style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            paddingTop: 100,
            paddingBottom: 60,
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)'
        }}>
            {/* Animated Background Effects */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {/* WhatsApp Green Glow */}
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.15, 0.25, 0.15]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                        position: 'absolute',
                        width: 900,
                        height: 900,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(37, 211, 102, 0.25) 0%, transparent 60%)',
                        top: -300,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        filter: 'blur(80px)'
                    }}
                />
                {/* Purple accent */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1]
                    }}
                    transition={{ duration: 10, repeat: Infinity, delay: 3 }}
                    style={{
                        position: 'absolute',
                        width: 600,
                        height: 600,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 60%)',
                        bottom: -100,
                        right: -100,
                        filter: 'blur(60px)'
                    }}
                />
                {/* Grid pattern */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `
                        linear-gradient(rgba(37, 211, 102, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(37, 211, 102, 0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px'
                }} />
            </div>

            <div style={{
                width: '100%',
                maxWidth: 1400,
                margin: '0 auto',
                padding: '0 24px',
                position: 'relative',
                zIndex: 10
            }}>
                <div className="hero-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 80,
                    alignItems: 'center'
                }}>
                    {/* Left Content */}
                    <div className="hero-content">
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 16px',
                                borderRadius: 100,
                                background: 'rgba(37, 211, 102, 0.1)',
                                border: '1px solid rgba(37, 211, 102, 0.3)',
                                marginBottom: 28
                            }}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Sparkles style={{ width: 16, height: 16, color: '#25D366' }} />
                            </motion.div>
                            <span style={{ fontSize: 14, color: '#25D366', fontWeight: 600 }}>
                                Propulsé par l'IA
                            </span>
                        </motion.div>

                        {/* Main Title */}
                        <motion.h1
                            className="hero-title"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            style={{
                                fontSize: 'clamp(26px, 5vw, 58px)',
                                fontWeight: 800,
                                marginBottom: 24,
                                lineHeight: 1.15,
                                letterSpacing: '-0.03em'
                            }}
                        >
                            <span style={{ color: 'white' }}>Transformez votre</span>
                            <br />
                            <span style={{
                                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 50%, #075E54 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>WhatsApp</span>
                            <span style={{ color: 'white' }}> en</span>
                            <br />
                            <span style={{ color: 'white' }}>machine à </span>
                            <span style={{
                                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>ventes</span>
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            className="hero-subtitle"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            style={{
                                fontSize: 'clamp(14px, 3vw, 18px)',
                                color: '#94a3b8',
                                marginBottom: 32,
                                lineHeight: 1.7,
                                maxWidth: '100%'
                            }}
                        >
                            Notre IA répond à vos clients <span style={{ color: 'white', fontWeight: 500 }}>24h/24</span>,
                            qualifie vos prospects et <span style={{ color: '#25D366', fontWeight: 500 }}>augmente vos conversions de 300%</span>.
                        </motion.p>

                        {/* Feature Pills */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}
                        >
                            {[
                                { icon: Zap, text: 'Réponse en < 3 sec' },
                                { icon: Clock, text: 'Disponible 24h/24' },
                                { icon: Shield, text: 'Sans carte bancaire' }
                            ].map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>
                                    <item.icon style={{ width: 16, height: 16, color: '#25D366' }} />
                                    <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{item.text}</span>
                                </div>
                            ))}
                        </motion.div>

                        {/* CTA Buttons */}
                        <motion.div
                            className="hero-buttons"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 40 }}
                        >
                            <Link href="/register" style={{ textDecoration: 'none' }}>
                                <motion.button
                                    whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(37, 211, 102, 0.3)' }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        padding: '18px 36px',
                                        borderRadius: 14,
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: 16,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        boxShadow: '0 10px 30px rgba(37, 211, 102, 0.2)'
                                    }}
                                >
                                    <MessageCircle style={{ width: 20, height: 20 }} />
                                    Essai gratuit
                                    <ArrowRight style={{ width: 18, height: 18 }} />
                                </motion.button>
                            </Link>
                            <Link href="#pricing" style={{ textDecoration: 'none' }}>
                                <motion.button
                                    whileHover={{ scale: 1.03, background: 'rgba(37, 211, 102, 0.15)' }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{
                                        padding: '18px 32px',
                                        borderRadius: 14,
                                        border: '2px solid rgba(37, 211, 102, 0.4)',
                                        background: 'rgba(37, 211, 102, 0.05)',
                                        color: '#25D366',
                                        fontWeight: 600,
                                        fontSize: 16,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Voir les tarifs
                                </motion.button>
                            </Link>
                        </motion.div>

                        {/* Trust Stats */}
                        <motion.div
                            className="hero-stats"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}
                        >
                            {[
                                { value: '+5,000', label: 'Entreprises', icon: Users },
                                { value: '2M+', label: 'Messages/mois', icon: MessageCircle },
                                { value: '98%', label: 'Satisfaction', icon: Star }
                            ].map((stat, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        background: 'rgba(37, 211, 102, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <stat.icon style={{ width: 20, height: 20, color: '#25D366' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                                        <div style={{ fontSize: 13, color: '#64748b' }}>{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Right - Phone Mockup with WhatsApp Chat */}
                    <motion.div
                        className="hero-phone"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            position: 'relative'
                        }}
                    >
                        {/* Glow behind phone */}
                        <div style={{
                            position: 'absolute',
                            width: 400,
                            height: 400,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(37, 211, 102, 0.2) 0%, transparent 70%)',
                            filter: 'blur(40px)'
                        }} />

                        {/* Phone Frame */}
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            style={{
                                width: 340,
                                height: 700,
                                borderRadius: 45,
                                background: 'linear-gradient(180deg, #1e1e1e 0%, #0d0d0d 100%)',
                                padding: 12,
                                boxShadow: '0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
                                position: 'relative'
                            }}
                        >
                            {/* Notch */}
                            <div style={{
                                position: 'absolute',
                                top: 12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 120,
                                height: 28,
                                background: '#000',
                                borderRadius: 20,
                                zIndex: 20
                            }} />

                            {/* Screen */}
                            <div style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 35,
                                overflow: 'hidden',
                                background: '#111b21'
                            }}>
                                {/* WhatsApp Header */}
                                <div style={{
                                    background: '#1f2c34',
                                    padding: '50px 16px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12
                                }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Bot style={{ width: 22, height: 22, color: 'white' }} />
                                    </div>
                                    <div>
                                        <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>WhatsAI Assistant</div>
                                        <div style={{ color: '#25D366', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366' }} />
                                            En ligne
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Area */}
                                <div style={{
                                    padding: 12,
                                    height: 480,
                                    overflowY: 'auto',
                                    background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8
                                }}>
                                    <AnimatePresence>
                                        {chatMessages.slice(0, visibleMessages).map((msg) => (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                transition={{ duration: 0.3 }}
                                                style={{
                                                    maxWidth: '85%',
                                                    alignSelf: msg.type === 'sent' ? 'flex-end' : 'flex-start',
                                                    padding: '10px 14px',
                                                    borderRadius: msg.type === 'sent' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                                    background: msg.type === 'sent' ? '#005c4b' : '#202c33',
                                                    position: 'relative'
                                                }}
                                            >
                                                {msg.isBot && (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        marginBottom: 6,
                                                        color: '#25D366',
                                                        fontSize: 11,
                                                        fontWeight: 600
                                                    }}>
                                                        <Sparkles style={{ width: 12, height: 12 }} />
                                                        Réponse IA
                                                    </div>
                                                )}
                                                <div style={{
                                                    color: 'white',
                                                    fontSize: 14,
                                                    lineHeight: 1.5,
                                                    whiteSpace: 'pre-line'
                                                }}>
                                                    {msg.text}
                                                </div>
                                                <div style={{
                                                    textAlign: 'right',
                                                    fontSize: 11,
                                                    color: 'rgba(255,255,255,0.6)',
                                                    marginTop: 4,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-end',
                                                    gap: 4
                                                }}>
                                                    {msg.time}
                                                    {msg.type === 'sent' && (
                                                        <CheckCircle style={{ width: 14, height: 14, color: '#53bdeb' }} />
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {/* Typing Indicator */}
                                    {isTyping && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            style={{
                                                alignSelf: 'flex-end',
                                                padding: '12px 18px',
                                                borderRadius: 16,
                                                background: '#005c4b',
                                                display: 'flex',
                                                gap: 4
                                            }}
                                        >
                                            {[0, 1, 2].map(i => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ y: [0, -5, 0] }}
                                                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: 'rgba(255,255,255,0.7)'
                                                    }}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </div>

                                {/* Input Bar */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    left: 12,
                                    right: 12,
                                    background: '#1f2c34',
                                    borderRadius: 25,
                                    padding: '10px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12
                                }}>
                                    <div style={{ flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                                        Écrire un message...
                                    </div>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: '#25D366',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Send style={{ width: 18, height: 18, color: 'white' }} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Floating Elements */}
                        <motion.div
                            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                            transition={{ duration: 5, repeat: Infinity }}
                            style={{
                                position: 'absolute',
                                top: 50,
                                right: 20,
                                background: 'rgba(37, 211, 102, 0.15)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(37, 211, 102, 0.3)',
                                borderRadius: 16,
                                padding: '14px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}
                        >
                            <TrendingUp style={{ width: 20, height: 20, color: '#25D366' }} />
                            <div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>+300%</div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>Conversions</div>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 10, 0], rotate: [0, -3, 0] }}
                            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                            style={{
                                position: 'absolute',
                                bottom: 100,
                                left: 0,
                                background: 'rgba(30, 41, 59, 0.9)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: 16,
                                padding: '14px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}
                        >
                            <div style={{ display: 'flex' }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Star key={i} style={{ width: 14, height: 14, fill: '#facc15', color: '#facc15' }} />
                                ))}
                            </div>
                            <span style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>4.9/5</span>
                        </motion.div>
                    </motion.div>
                </div>
            </div>

            {/* CSS for responsive */}
            <style jsx global>{`
                @media (max-width: 1024px) {
                    section > div > div {
                        grid-template-columns: 1fr !important;
                        gap: 50px !important;
                        text-align: center !important;
                    }
                    section > div > div > div:first-child > div:last-of-type {
                        justify-content: center !important;
                    }
                    section > div > div > div:first-child > div[style*="gap: 40"] {
                        justify-content: center !important;
                    }
                }
                
                /* Mobile responsive - Fix text overflow and buttons */
                @media (max-width: 768px) {
                    section {
                        padding-top: 80px !important;
                        padding-bottom: 40px !important;
                    }
                    section > div {
                        padding: 0 16px !important;
                    }
                    section > div > div {
                        gap: 30px !important;
                    }
                    /* Fix title overflow */
                    section h1 {
                        font-size: 28px !important;
                        word-wrap: break-word !important;
                        overflow-wrap: break-word !important;
                        hyphens: auto !important;
                    }
                    /* Fix subtitle overflow */
                    section p {
                        font-size: 15px !important;
                        max-width: 100% !important;
                        padding: 0 8px !important;
                    }
                    /* Stack buttons vertically on mobile */
                    section > div > div > div:first-child > div[style*="gap: 16px"][style*="marginBottom: 40"] {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                        width: 100% !important;
                    }
                    section > div > div > div:first-child > div[style*="gap: 16px"][style*="marginBottom: 40"] a {
                        width: 100% !important;
                    }
                    section > div > div > div:first-child > div[style*="gap: 16px"][style*="marginBottom: 40"] button {
                        width: 100% !important;
                        justify-content: center !important;
                    }
                    /* Stack feature pills */
                    section > div > div > div:first-child > div[style*="flexWrap: wrap"] {
                        justify-content: center !important;
                    }
                    /* Stack trust stats */
                    section > div > div > div:first-child > div[style*="gap: 40"] {
                        flex-direction: column !important;
                        gap: 20px !important;
                        align-items: center !important;
                    }
                    /* Hide phone mockup on very small screens */
                    section > div > div > div:last-child {
                        display: none !important;
                    }
                }
                
                /* Small mobile (iPhone SE, etc) */
                @media (max-width: 375px) {
                    section h1 {
                        font-size: 24px !important;
                    }
                    section p {
                        font-size: 14px !important;
                    }
                    section > div > div > div:first-child > div[style*="flexWrap: wrap"] > div {
                        padding: 8px 12px !important;
                        font-size: 12px !important;
                    }
                }
            `}</style>
        </section>
    )
}
