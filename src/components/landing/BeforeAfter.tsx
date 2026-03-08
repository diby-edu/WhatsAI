'use client'

import { motion } from 'framer-motion'
import { XCircle, CheckCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function BeforeAfter() {
    const t = useTranslations('BeforeAfter')

    const withoutItems: string[] = [0, 1, 2, 3, 4].map(i => t(`without.items.${i}`))
    const withItems: string[] = [0, 1, 2, 3, 4].map(i => t(`with.items.${i}`))

    return (
        <section id="before-after" className="py-16 sm:py-[100px] px-6 relative bg-[#0f172a]">
            <div className="max-w-[1000px] mx-auto relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-stretch">
                    {/* Without WazzapAI */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="p-9 rounded-[28px] relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.02) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}
                    >
                        {/* Red glow */}
                        <div className="absolute rounded-full" style={{
                            top: -50, right: -50, width: 200, height: 200,
                            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)'
                        }} />

                        <h3 className="text-2xl font-bold text-[#fca5a5] mb-7 flex items-center gap-[10px]">
                            <XCircle style={{ width: 28, height: 28, color: '#ef4444' }} />
                            {t('without.title')}
                        </h3>

                        <div className="flex flex-col gap-4">
                            {withoutItems.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: index * 0.08 }}
                                    className="flex items-center gap-3"
                                >
                                    <XCircle style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />
                                    <span className="text-[15px] text-slate-300 leading-relaxed">{item}</span>
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
                        className="p-9 rounded-[28px] relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.08) 0%, rgba(37, 211, 102, 0.02) 100%)',
                            border: '1px solid rgba(37, 211, 102, 0.2)'
                        }}
                    >
                        {/* Green glow */}
                        <div className="absolute rounded-full" style={{
                            top: -50, right: -50, width: 200, height: 200,
                            background: 'radial-gradient(circle, rgba(37, 211, 102, 0.1) 0%, transparent 70%)',
                            filter: 'blur(40px)'
                        }} />

                        <h3 className="text-2xl font-bold text-[#6ee7b7] mb-7 flex items-center gap-[10px]">
                            <CheckCircle style={{ width: 28, height: 28, color: '#25D366' }} />
                            {t('with.title')}
                        </h3>

                        <div className="flex flex-col gap-4">
                            {withItems.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: 10 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: index * 0.08 }}
                                    className="flex items-center gap-3"
                                >
                                    <CheckCircle style={{ width: 18, height: 18, color: '#25D366', flexShrink: 0 }} />
                                    <span className="text-[15px] text-slate-300 leading-relaxed">{item}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
