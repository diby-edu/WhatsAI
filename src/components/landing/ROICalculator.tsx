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
        <section id="roi-calculator" style={{
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
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.06) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
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
                        <Calculator style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span style={{ fontSize: 14, color: '#25D366', fontWeight: 600 }}>{t('badge')}</span>
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(28px, 5vw, 40px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 16,
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
                </motion.div>

                {/* Calculator Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    style={{
                        padding: 40,
                        borderRadius: 28,
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(37, 211, 102, 0.2)',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    {/* Input: Messages per day */}
                    <div style={{ marginBottom: 32 }}>
                        <label style={{
                            display: 'block',
                            fontSize: 15,
                            color: '#e2e8f0',
                            fontWeight: 500,
                            marginBottom: 12
                        }}>
                            {t('inputs.messages')}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <input
                                type="range"
                                min="5"
                                max="500"
                                value={messages}
                                onChange={(e) => setMessages(Number(e.target.value))}
                                style={{
                                    flex: 1,
                                    height: 6,
                                    borderRadius: 3,
                                    appearance: 'none',
                                    background: `linear-gradient(to right, #25D366 0%, #25D366 ${(messages - 5) / 495 * 100}%, rgba(148, 163, 184, 0.2) ${(messages - 5) / 495 * 100}%, rgba(148, 163, 184, 0.2) 100%)`,
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            />
                            <span style={{
                                minWidth: 50,
                                textAlign: 'right',
                                fontWeight: 700,
                                fontSize: 18,
                                color: '#25D366'
                            }}>{messages}</span>
                        </div>
                    </div>

                    {/* Input: Conversion rate */}
                    <div style={{ marginBottom: 32 }}>
                        <label style={{
                            display: 'block',
                            fontSize: 15,
                            color: '#e2e8f0',
                            fontWeight: 500,
                            marginBottom: 12
                        }}>
                            {t('inputs.conversion')}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={conversion}
                                onChange={(e) => setConversion(Number(e.target.value))}
                                style={{
                                    flex: 1,
                                    height: 6,
                                    borderRadius: 3,
                                    appearance: 'none',
                                    background: `linear-gradient(to right, #25D366 0%, #25D366 ${(conversion - 1) / 49 * 100}%, rgba(148, 163, 184, 0.2) ${(conversion - 1) / 49 * 100}%, rgba(148, 163, 184, 0.2) 100%)`,
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            />
                            <span style={{
                                minWidth: 50,
                                textAlign: 'right',
                                fontWeight: 700,
                                fontSize: 18,
                                color: '#25D366'
                            }}>{conversion}%</span>
                        </div>
                    </div>

                    {/* Input: Avg sale value */}
                    <div style={{ marginBottom: 40 }}>
                        <label style={{
                            display: 'block',
                            fontSize: 15,
                            color: '#e2e8f0',
                            fontWeight: 500,
                            marginBottom: 12
                        }}>
                            {t('inputs.avgSale')}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <input
                                type="range"
                                min="1000"
                                max="100000"
                                step="1000"
                                value={avgSale}
                                onChange={(e) => setAvgSale(Number(e.target.value))}
                                style={{
                                    flex: 1,
                                    height: 6,
                                    borderRadius: 3,
                                    appearance: 'none',
                                    background: `linear-gradient(to right, #25D366 0%, #25D366 ${(avgSale - 1000) / 99000 * 100}%, rgba(148, 163, 184, 0.2) ${(avgSale - 1000) / 99000 * 100}%, rgba(148, 163, 184, 0.2) 100%)`,
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            />
                            <span style={{
                                minWidth: 90,
                                textAlign: 'right',
                                fontWeight: 700,
                                fontSize: 18,
                                color: '#25D366'
                            }}>{formatNumber(avgSale)}</span>
                        </div>
                    </div>

                    {/* Result */}
                    <div style={{
                        padding: '28px 32px',
                        borderRadius: 20,
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.15), rgba(37, 211, 102, 0.05))',
                        border: '1px solid rgba(37, 211, 102, 0.3)',
                        textAlign: 'center',
                        marginBottom: 24
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            marginBottom: 8
                        }}>
                            <TrendingUp style={{ width: 22, height: 22, color: '#25D366' }} />
                            <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>
                                {t('result')}
                            </span>
                        </div>
                        <div style={{
                            fontSize: 'clamp(32px, 5vw, 48px)',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            {formatNumber(monthlyRevenue)} {t('currency')}
                        </div>
                    </div>

                    {/* Help text */}
                    <p style={{
                        textAlign: 'center',
                        fontSize: 14,
                        color: '#64748b',
                        marginBottom: 28
                    }}>
                        {t('helpText')}
                    </p>

                    {/* CTA */}
                    <div style={{ textAlign: 'center' }}>
                        <Link href="/register" style={{ textDecoration: 'none' }}>
                            <motion.button
                                whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(37, 211, 102, 0.3)' }}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                    padding: '16px 32px',
                                    borderRadius: 14,
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: 16,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
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

            <style jsx global>{`
                input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: #25D366;
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                input[type="range"]::-moz-range-thumb {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: #25D366;
                    cursor: pointer;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
            `}</style>
        </section>
    )
}
