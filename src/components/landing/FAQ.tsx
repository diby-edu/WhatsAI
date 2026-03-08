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
        { key: 'cancel', icon: XCircle },
        { key: 'retention', icon: Calendar },
        { key: 'whatsappBusiness', icon: Smartphone },
        { key: 'trainAI', icon: HelpCircle }
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
                    className="w-full flex items-start gap-4 text-left cursor-pointer"
                    style={{
                        padding: '20px 24px',
                        borderRadius: 16,
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
                    <div className="flex items-center justify-center shrink-0" style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
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
                    <div className="flex-1">
                        {/* Category badge */}
                        <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.5px] mb-[6px]" style={{
                            color: isOpen ? '#34d399' : '#64748b'
                        }}>
                            {faq.category}
                        </span>

                        <h3 className="text-[17px] font-semibold mb-0 leading-[1.4]" style={{
                            color: isOpen ? 'white' : '#e2e8f0'
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
                                    <p className="mt-3 text-slate-400 leading-[1.7] text-[15px]">
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
                        className="flex items-center justify-center shrink-0"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isOpen ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.3)'
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
        <section id="faq" className="py-16 sm:py-20 relative" style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.02) 50%, transparent 100%)'
        }}>
            {/* Background glows */}
            <div className="absolute pointer-events-none" style={{
                top: '20%', left: '-10%',
                width: 400, height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
                filter: 'blur(60px)'
            }} />
            <div className="absolute pointer-events-none" style={{
                bottom: '10%', right: '-5%',
                width: 300, height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%)',
                filter: 'blur(60px)'
            }} />

            <div className="max-w-[900px] mx-auto px-6 relative z-10">
                {/* Header */}
                <motion.div
                    ref={headerRef}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isHeaderInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={isHeaderInView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5"
                        style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        <HelpCircle style={{ width: 16, height: 16, color: '#34d399' }} />
                        <span className="text-[13px] font-semibold text-[#34d399]">{t('badge')}</span>
                    </motion.div>

                    <h2 className="font-extrabold mb-4 leading-tight text-white" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
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
                    <p className="text-lg text-slate-400 max-w-[500px] mx-auto">
                        {t('subtitle')}
                    </p>
                </motion.div>

                {/* FAQ Grid — 2 colonnes sur desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {faqs.map((faq, index) => (
                        <FAQItem key={index} faq={faq} index={index} />
                    ))}
                </div>
            </div>
        </section>
    )
}
