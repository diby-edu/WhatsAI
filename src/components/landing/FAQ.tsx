'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import { ChevronDown, HelpCircle, MessageCircle, CreditCard, Shield, Smartphone, Calendar, Lock, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function FAQ() {
    const t = useTranslations('FAQ')
    const headerRef = useRef(null)
    const isHeaderInView = useInView(headerRef, { once: true })

    const faqKeys = [
        { key: 'howItWorks', icon: MessageCircle },
        { key: 'banRisk', icon: Shield },
        { key: 'freeTest', icon: HelpCircle },
        { key: 'credits', icon: CreditCard },
        { key: 'multiNumber', icon: Smartphone },
        { key: 'appointments', icon: Calendar },
        { key: 'security', icon: Lock },
        { key: 'cancel', icon: XCircle }
    ]

    const faqs = faqKeys.map(item => ({
        question: t(`items.${item.key}.question`),
        answer: t(`items.${item.key}.answer`),
        category: t(`items.${item.key}.category`),
        icon: item.icon
    }))

    const FAQItem = ({ faq, index }: { faq: typeof faqs[0], index: number }) => {
        const [isOpen, setIsOpen] = useState(false)
        const ref = useRef(null)
        const isInView = useInView(ref, { once: true, margin: "-50px" })
        const Icon = faq.icon

        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: index * 0.05 }}
            >
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 16,
                        padding: '20px 24px',
                        borderRadius: 16,
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: isOpen ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.1)',
                        background: isOpen
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)'
                            : 'rgba(30, 41, 59, 0.5)',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        boxShadow: isOpen ? '0 8px 32px rgba(16, 185, 129, 0.15)' : 'none'
                    }}
                >
                    {/* Icon */}
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: isOpen
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'rgba(51, 65, 85, 0.5)',
                        transition: 'all 0.3s ease'
                    }}>
                        <Icon style={{
                            width: 22,
                            height: 22,
                            color: isOpen ? 'white' : '#94a3b8',
                            transition: 'all 0.3s ease'
                        }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                        {/* Category badge */}
                        <span style={{
                            display: 'inline-block',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: isOpen ? '#34d399' : '#64748b',
                            marginBottom: 6
                        }}>
                            {faq.category}
                        </span>

                        <h3 style={{
                            fontSize: 17,
                            fontWeight: 600,
                            color: isOpen ? 'white' : '#e2e8f0',
                            marginBottom: 0,
                            lineHeight: 1.4
                        }}>
                            {faq.question}
                        </h3>

                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <p style={{
                                        marginTop: 12,
                                        color: '#94a3b8',
                                        lineHeight: 1.7,
                                        fontSize: 15
                                    }}>
                                        {faq.answer}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Chevron */}
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.3)',
                            flexShrink: 0
                        }}
                    >
                        <ChevronDown style={{
                            width: 18,
                            height: 18,
                            color: isOpen ? '#34d399' : '#64748b'
                        }} />
                    </motion.div>
                </motion.button>
            </motion.div>
        )
    }

    return (
        <section id="faq" style={{
            padding: '80px 0',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.02) 50%, transparent 100%)'
        }}>
            {/* Background elements */}
            <div style={{
                position: 'absolute',
                top: '20%',
                left: '-10%',
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
                filter: 'blur(60px)'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '10%',
                right: '-5%',
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%)',
                filter: 'blur(60px)'
            }} />

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 10 }}>
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.2 }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 16px',
                            borderRadius: 50,
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            marginBottom: 20
                        }}
                    >
                        <HelpCircle style={{ width: 16, height: 16, color: '#34d399' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>{t('badge')}</span>
                    </motion.div>

                    <h2 style={{
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 800,
                        marginBottom: 16,
                        lineHeight: 1.2,
                        color: 'white'
                    }}>
                        {t.rich('title', {
                            green: (chunks) => (
                                <span style={{
                                    background: 'linear-gradient(135deg, #34d399, #06b6d4)',
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
                        maxWidth: 500,
                        margin: '0 auto'
                    }}>
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* FAQ Grid - 2 columns on desktop */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                    gap: 12
                }}>
                    {faqs.map((faq, index) => (
                        <FAQItem key={index} faq={faq} index={index} />
                    ))}
                </div>
            </div>
        </section>
    )
}
