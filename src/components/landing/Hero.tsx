'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Sparkles, Zap, ArrowRight, Star, Bot, CheckCircle, Clock, Users, Send, Shield, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

export default function Hero() {
    const t = useTranslations('Hero')
    const [visibleMessages, setVisibleMessages] = useState(0)
    const [isTyping, setIsTyping] = useState(false)

    const chatMessages = [
        { id: 1, type: 'received', text: t('chat.message1'), time: "10:30" },
        { id: 2, type: 'sent', text: t('chat.response1'), time: "10:30", isBot: true },
        { id: 3, type: 'sent', text: t('chat.response2'), time: "10:30", isBot: true },
        { id: 4, type: 'received', text: t('chat.message2'), time: "10:31" },
        { id: 5, type: 'sent', text: t('chat.response3'), time: "10:31", isBot: true },
    ]

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
            setTimeout(() => setVisibleMessages(0), 4000)
        }
    }, [visibleMessages])

    return (
        <section
            id="hero"
            className="relative min-h-screen flex items-center pt-[100px] pb-[60px] overflow-visible"
            style={{ background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)' }}
        >
            {/* Animated Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                {/* WhatsApp Green Glow */}
                <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.25, 0.15] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                        position: 'absolute',
                        width: 900, height: 900,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(37, 211, 102, 0.25) 0%, transparent 60%)',
                        top: -300, left: '50%',
                        transform: 'translateX(-50%)',
                        filter: 'blur(80px)'
                    }}
                />
                {/* Purple accent */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 10, repeat: Infinity, delay: 3 }}
                    style={{
                        position: 'absolute',
                        width: 600, height: 600,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 60%)',
                        bottom: -100, right: -100,
                        filter: 'blur(60px)'
                    }}
                />
                {/* Grid pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(37, 211, 102, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(37, 211, 102, 0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px'
                }} />
            </div>

            <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 relative z-10">
                {/* 2-col grid on lg+, 1-col stacked on mobile/tablet */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[50px] lg:gap-20 items-center text-center lg:text-left">

                    {/* Left Content */}
                    <div>
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-[10px] px-4 py-2 rounded-full mb-7"
                            style={{
                                background: 'rgba(37, 211, 102, 0.1)',
                                border: '1px solid rgba(37, 211, 102, 0.3)'
                            }}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Sparkles style={{ width: 16, height: 16, color: '#25D366' }} />
                            </motion.div>
                            <span className="text-sm text-[#25D366] font-semibold">
                                {t('poweredBy')}
                            </span>
                        </motion.div>

                        {/* Main Title */}
                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="font-extrabold mb-6 leading-[1.15] -tracking-[0.03em] text-white"
                            style={{ fontSize: 'clamp(26px, 5vw, 58px)' }}
                        >
                            {t.rich('title', {
                                green: (chunks) => (
                                    <span style={{
                                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 50%, #075E54 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text'
                                    }}>{chunks}</span>
                                ),
                                gold: (chunks) => (
                                    <span style={{
                                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text'
                                    }}>{chunks}</span>
                                ),
                                br: () => <br />
                            })}
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-slate-400 mb-8 leading-[1.7] w-full"
                            style={{ fontSize: 'clamp(14px, 3vw, 18px)' }}
                        >
                            {t.rich('subtitle', {
                                white: (chunks) => <span className="text-white font-medium">{chunks}</span>,
                                green: (chunks) => <span className="text-[#25D366] font-medium">{chunks}</span>
                            })}
                        </motion.p>

                        {/* Feature Pills */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.25 }}
                            className="flex flex-wrap gap-3 mb-9 justify-center lg:justify-start"
                        >
                            {[
                                { icon: Zap, text: t('pills.response') },
                                { icon: Clock, text: t('pills.available') },
                                { icon: Shield, text: t('pills.noCard') }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2 px-4 py-[10px] rounded-[10px]" style={{
                                    background: 'rgba(30, 41, 59, 0.6)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>
                                    <item.icon style={{ width: 16, height: 16, color: '#25D366' }} />
                                    <span className="text-sm text-slate-200 font-medium">{item.text}</span>
                                </div>
                            ))}
                        </motion.div>

                        {/* CTA Buttons — stacked vertically on mobile, row on sm+ */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="flex flex-col sm:flex-row flex-wrap gap-3 mb-10"
                        >
                            <Link href="/register" className="w-full sm:w-auto no-underline">
                                <motion.button
                                    whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(37, 211, 102, 0.3)' }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full sm:w-auto py-[18px] px-9 rounded-[14px] border-none text-white font-bold text-base cursor-pointer flex items-center justify-center gap-[10px]"
                                    style={{
                                        background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                        boxShadow: '0 10px 30px rgba(37, 211, 102, 0.2)'
                                    }}
                                >
                                    <MessageCircle style={{ width: 20, height: 20 }} />
                                    {t('cta.trial')}
                                    <ArrowRight style={{ width: 18, height: 18 }} />
                                </motion.button>
                            </Link>
                            <Link href="#how-it-works" className="w-full sm:w-auto no-underline">
                                <motion.button
                                    whileHover={{ scale: 1.03, background: 'rgba(37, 211, 102, 0.15)' }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full sm:w-auto py-[18px] px-8 rounded-[14px] font-semibold text-base cursor-pointer text-[#25D366]"
                                    style={{
                                        border: '2px solid rgba(37, 211, 102, 0.4)',
                                        background: 'rgba(37, 211, 102, 0.05)'
                                    }}
                                >
                                    {t('cta.pricing')}
                                </motion.button>
                            </Link>
                        </motion.div>

                        {/* Trust Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="flex flex-wrap gap-6 justify-center lg:justify-start"
                        >
                            {[
                                { value: t('stats.companies.value'), label: t('stats.companies.label'), icon: Users },
                                { value: t('stats.messages.value'), label: t('stats.messages.label'), icon: MessageCircle },
                                { value: t('stats.satisfaction.value'), label: t('stats.satisfaction.label'), icon: Star }
                            ].map((stat, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-[12px] flex items-center justify-center" style={{
                                        background: 'rgba(37, 211, 102, 0.1)'
                                    }}>
                                        <stat.icon style={{ width: 20, height: 20, color: '#25D366' }} />
                                    </div>
                                    <div>
                                        <div className="text-[22px] font-bold text-white">{stat.value}</div>
                                        <div className="text-[13px] text-slate-500">{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Right - Phone Mockup — caché sur mobile (< md:768px), visible md+ */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="hidden md:flex justify-center items-center relative"
                    >
                        {/* Glow behind phone */}
                        <div style={{
                            position: 'absolute',
                            width: 400, height: 400,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(37, 211, 102, 0.2) 0%, transparent 70%)',
                            filter: 'blur(40px)'
                        }} />

                        {/* Phone Frame */}
                        <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            style={{
                                width: 340, height: 700,
                                borderRadius: 45,
                                background: 'linear-gradient(180deg, #1e1e1e 0%, #0d0d0d 100%)',
                                padding: 12,
                                boxShadow: '0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
                                position: 'relative'
                            }}
                        >
                            {/* Notch */}
                            <div style={{
                                position: 'absolute', top: 12, left: '50%',
                                transform: 'translateX(-50%)',
                                width: 120, height: 28,
                                background: '#000', borderRadius: 20, zIndex: 20
                            }} />

                            {/* Screen */}
                            <div style={{
                                width: '100%', height: '100%',
                                borderRadius: 35, overflow: 'hidden',
                                background: '#111b21'
                            }}>
                                {/* WhatsApp Header */}
                                <div style={{
                                    background: '#1f2c34',
                                    padding: '50px 16px 12px',
                                    display: 'flex', alignItems: 'center', gap: 12
                                }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Bot style={{ width: 22, height: 22, color: 'white' }} />
                                    </div>
                                    <div>
                                        <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>{t('chat.botName')}</div>
                                        <div style={{ color: '#25D366', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25D366' }} />
                                            {t('chat.status')}
                                        </div>
                                    </div>
                                </div>

                                {/* Chat Area */}
                                <div style={{
                                    padding: 12, height: 480, overflowY: 'auto',
                                    background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                                    display: 'flex', flexDirection: 'column', gap: 8
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
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                        marginBottom: 6, color: '#25D366', fontSize: 11, fontWeight: 600
                                                    }}>
                                                        <Sparkles style={{ width: 12, height: 12 }} />
                                                        {t('chat.aiResponse')}
                                                    </div>
                                                )}
                                                <div style={{ color: 'white', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                                                    {msg.text}
                                                </div>
                                                <div style={{
                                                    textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.6)',
                                                    marginTop: 4, display: 'flex', alignItems: 'center',
                                                    justifyContent: 'flex-end', gap: 4
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
                                                alignSelf: 'flex-end', padding: '12px 18px',
                                                borderRadius: 16, background: '#005c4b',
                                                display: 'flex', gap: 4
                                            }}
                                        >
                                            {[0, 1, 2].map(i => (
                                                <motion.div
                                                    key={i}
                                                    animate={{ y: [0, -5, 0] }}
                                                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                                                    style={{
                                                        width: 8, height: 8, borderRadius: '50%',
                                                        background: 'rgba(255,255,255,0.7)'
                                                    }}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </div>

                                {/* Input Bar */}
                                <div style={{
                                    position: 'absolute', bottom: 12, left: 12, right: 12,
                                    background: '#1f2c34', borderRadius: 25,
                                    padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12
                                }}>
                                    <div style={{ flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                                        {t('chat.inputPlaceholder')}
                                    </div>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%', background: '#25D366',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
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
                                position: 'absolute', top: 50, right: 20,
                                background: 'rgba(37, 211, 102, 0.15)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(37, 211, 102, 0.3)',
                                borderRadius: 16, padding: '14px 18px',
                                display: 'flex', alignItems: 'center', gap: 10
                            }}
                        >
                            <TrendingUp style={{ width: 20, height: 20, color: '#25D366' }} />
                            <div>
                                <div style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>{t('chat.floatConversion.value')}</div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>{t('chat.floatConversion.label')}</div>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 10, 0], rotate: [0, -3, 0] }}
                            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                            style={{
                                position: 'absolute', bottom: 100, left: 0,
                                background: 'rgba(30, 41, 59, 0.9)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: 16, padding: '14px 18px',
                                display: 'flex', alignItems: 'center', gap: 10
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
        </section>
    )
}
