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
        <section id="community" className="py-16 sm:py-[100px] px-6 relative overflow-hidden" style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)'
        }}>
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
                width: 700, height: 700,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.08) 0%, transparent 70%)'
            }} />

            <div className="max-w-[1100px] mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-14"
                >
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-6" style={{
                        background: 'rgba(37, 211, 102, 0.1)',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}>
                        <Users style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span className="text-[#25D366] text-[13px] font-semibold tracking-wider">COMMUNAUTÉ</span>
                    </div>

                    <h2 className="font-extrabold text-slate-100 leading-tight mb-4" style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>
                        Rejoignez notre{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            communauté
                        </span>{' '}
                        d&apos;entrepreneurs
                    </h2>

                    <p className="text-slate-400 text-lg max-w-[520px] mx-auto mb-4">
                        Ils automatisent, ils partagent, ils réussissent
                    </p>

                    {/* Member count */}
                    <div className="inline-flex items-center gap-2 px-4 py-[6px] rounded-full" style={{
                        background: 'rgba(37, 211, 102, 0.05)',
                        border: '1px solid rgba(37, 211, 102, 0.15)'
                    }}>
                        <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
                        <span className="text-slate-500 text-sm">+200 membres actifs</span>
                    </div>
                </motion.div>

                {/* Benefits grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
                    {benefits.map((benefit, i) => (
                        <motion.div
                            key={benefit.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="p-6 rounded-2xl flex flex-col gap-3"
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(148, 163, 184, 0.08)'
                            }}
                        >
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: `${benefit.color}18`,
                                border: `1px solid ${benefit.color}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <benefit.icon style={{ width: 22, height: 22, color: benefit.color }} />
                            </div>
                            <div>
                                <h3 className="text-slate-200 font-bold text-base mb-[6px]">{benefit.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{benefit.desc}</p>
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
                    className="text-center"
                >
                    <motion.a
                        href={COMMUNITY_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className="inline-flex items-center gap-[10px] px-9 py-4 rounded-[14px] text-white font-bold text-[17px] no-underline cursor-pointer"
                        style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            boxShadow: '0 8px 32px rgba(37, 211, 102, 0.35)'
                        }}
                    >
                        <MessageCircle style={{ width: 22, height: 22 }} />
                        Rejoindre la communauté →
                    </motion.a>

                    <p className="text-slate-600 text-[13px] mt-4">
                        Gratuit • Zéro spam • Quittez à tout moment
                    </p>
                </motion.div>
            </div>
        </section>
    )
}
