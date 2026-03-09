'use client'

import { motion } from 'framer-motion'
import { Calculator, ArrowRight, MessageCircle, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Link from 'next/link'

export default function ROICalculator() {
    const t = useTranslations('ROICalculator')
    const [messages, setMessages] = useState(50)
    const [conversion, setConversion] = useState(10)
    const [avgSale, setAvgSale] = useState(15000)

    const monthlyRevenue = Math.round(messages * (conversion / 100) * avgSale * 30)

    const formatNumber = (num: number) => {
        return num.toLocaleString('fr-FR')
    }

    return (
        <section id="roi-calculator" className="py-16 sm:py-[100px] px-6 relative" style={{
            background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)'
        }}>
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{
                width: 800, height: 800,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.06) 0%, transparent 70%)'
            }} />

            <div className="max-w-[700px] mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-6" style={{
                        background: 'rgba(37, 211, 102, 0.1)',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}>
                        <Calculator style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span className="text-sm text-[#25D366] font-semibold">{t('badge')}</span>
                    </div>
                    <h2 className="font-bold text-white mb-4 leading-tight text-center" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>
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
                </motion.div>

                {/* Calculator Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="p-10 rounded-[28px]"
                    style={{
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(37, 211, 102, 0.2)',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    {/* Input: Messages per day */}
                    <div className="mb-8">
                        <label className="block text-[15px] text-slate-200 font-medium mb-3">
                            {t('inputs.messages')}
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="500"
                                value={messages}
                                onChange={(e) => setMessages(Number(e.target.value))}
                                className="flex-1 h-[6px] rounded-[3px] cursor-pointer outline-none"
                                style={{
                                    appearance: 'none',
                                    background: `linear-gradient(to right, #25D366 0%, #25D366 ${(messages - 5) / 495 * 100}%, rgba(148, 163, 184, 0.2) ${(messages - 5) / 495 * 100}%, rgba(148, 163, 184, 0.2) 100%)`
                                }}
                            />
                            <span className="min-w-[50px] text-right font-bold text-lg text-[#25D366]">
                                {messages}
                            </span>
                        </div>
                    </div>

                    {/* Input: Conversion rate */}
                    <div className="mb-8">
                        <label className="block text-[15px] text-slate-200 font-medium mb-3">
                            {t('inputs.conversion')}
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={conversion}
                                onChange={(e) => setConversion(Number(e.target.value))}
                                className="flex-1 h-[6px] rounded-[3px] cursor-pointer outline-none"
                                style={{
                                    appearance: 'none',
                                    background: `linear-gradient(to right, #25D366 0%, #25D366 ${(conversion - 1) / 49 * 100}%, rgba(148, 163, 184, 0.2) ${(conversion - 1) / 49 * 100}%, rgba(148, 163, 184, 0.2) 100%)`
                                }}
                            />
                            <span className="min-w-[50px] text-right font-bold text-lg text-[#25D366]">
                                {conversion}%
                            </span>
                        </div>
                    </div>

                    {/* Input: Avg sale value */}
                    <div className="mb-10">
                        <label className="block text-[15px] text-slate-200 font-medium mb-3">
                            {t('inputs.avgSale')}
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1000"
                                max="100000"
                                step="1000"
                                value={avgSale}
                                onChange={(e) => setAvgSale(Number(e.target.value))}
                                className="flex-1 h-[6px] rounded-[3px] cursor-pointer outline-none"
                                style={{
                                    appearance: 'none',
                                    background: `linear-gradient(to right, #25D366 0%, #25D366 ${(avgSale - 1000) / 99000 * 100}%, rgba(148, 163, 184, 0.2) ${(avgSale - 1000) / 99000 * 100}%, rgba(148, 163, 184, 0.2) 100%)`
                                }}
                            />
                            <span className="min-w-[90px] text-right font-bold text-lg text-[#25D366]">
                                {formatNumber(avgSale)}
                            </span>
                        </div>
                    </div>

                    {/* Result */}
                    <div className="py-7 px-8 rounded-[20px] text-center mb-6" style={{
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.15), rgba(37, 211, 102, 0.05))',
                        border: '1px solid rgba(37, 211, 102, 0.3)'
                    }}>
                        <div className="flex items-center justify-center gap-[10px] mb-2">
                            <TrendingUp style={{ width: 22, height: 22, color: '#25D366' }} />
                            <span className="text-[15px] text-slate-400 font-medium">
                                {t('result')}
                            </span>
                        </div>
                        <div className="font-extrabold" style={{
                            fontSize: 'clamp(32px, 5vw, 48px)',
                            background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            {formatNumber(monthlyRevenue)} {t('currency')}
                        </div>
                    </div>

                    {/* Help text */}
                    <p className="text-center text-sm text-slate-500 mb-7">
                        {t('helpText')}
                    </p>

                    {/* CTA */}
                    <div className="text-center">
                        <Link href="/register" style={{ textDecoration: 'none' }}>
                            <motion.button
                                whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(37, 211, 102, 0.3)' }}
                                whileTap={{ scale: 0.98 }}
                                className="py-4 px-8 rounded-[14px] border-none text-white font-bold text-base cursor-pointer inline-flex items-center gap-[10px]"
                                style={{
                                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                    boxShadow: '0 10px 30px rgba(37, 211, 102, 0.2)'
                                }}
                            >
                                <MessageCircle style={{ width: 20, height: 20 }} />
                                {t('cta')}
                                <ArrowRight style={{ width: 18, height: 18 }} />
                            </motion.button>
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
