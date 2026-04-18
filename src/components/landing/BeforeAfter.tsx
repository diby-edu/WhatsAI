'use client'

import { motion } from 'framer-motion'
import { XCircle, CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function BeforeAfter() {
    const t = useTranslations('BeforeAfter')

    const withoutItems: string[] = [0, 1, 2, 3, 4].map(i => t(`without.items.${i}`))
    const withItems: string[] = [0, 1, 2, 3, 4].map(i => t(`with.items.${i}`))

    return (
        <section id="before-after" style={{
            padding: '100px 24px',
            background: '#0f172a',
            position: 'relative'
        }}>
            <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                <div className="ba-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 32,
                    alignItems: 'stretch'
                }}>
                    {/* Without WazzapAI */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            padding: 36,
                            borderRadius: 28,
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Red glow */}
                        <div style={{
                            position: 'absolute',
                            top: -50,
                            right: -50,
                            width: 200,
                            height: 200,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)'
                        }} />

                        <h3 style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: '#fca5a5',
                            marginBottom: 28,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10
                        }}>
                            <XCircle style={{ width: 28, height: 28, color: '#ef4444' }} />
                            {t('without.title')}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {withoutItems.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: index * 0.08 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        flexWrap: 'nowrap',
                                        textAlign: 'left'
                                    }}
                                >
                                    <XCircle style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />
                                    <span style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                                        {item}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* With WazzapAI */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        style={{
                            padding: 36,
                            borderRadius: 28,
                            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(37, 211, 102, 0.02) 100%)',
                            border: '1px solid rgba(37, 211, 102, 0.2)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Green glow */}
                        <div style={{
                            position: 'absolute',
                            top: -50,
                            right: -50,
                            width: 200,
                            height: 200,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(37, 211, 102, 0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)'
                        }} />

                        <h3 style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: '#6ee7b7',
                            marginBottom: 28,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10
                        }}>
                            <CheckCircle style={{ width: 28, height: 28, color: '#25D366' }} />
                            {t('with.title')}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {withItems.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: 10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: index * 0.08 }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        flexWrap: 'nowrap',
                                        textAlign: 'left'
                                    }}
                                >
                                    <CheckCircle style={{ width: 18, height: 18, color: '#25D366', flexShrink: 0 }} />
                                    <span style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                                        {item}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 768px) {
                    #before-after {
                        padding-top: 60px !important;
                        padding-bottom: 60px !important;
                    }
                    .ba-grid {
                        grid-template-columns: 1fr !important;
                        gap: 20px !important;
                    }
                    .ba-grid > div {
                        padding: 24px !important;
                    }
                }
            `}</style>
        </section>
    )
}
