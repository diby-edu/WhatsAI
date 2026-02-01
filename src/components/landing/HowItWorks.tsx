'use client'

import { motion } from 'framer-motion'
import { Bot, QrCode, Zap, ArrowRight } from 'lucide-react'

const steps = [
    {
        number: '01',
        icon: Bot,
        title: 'Créez votre agent IA',
        description: 'Définissez la personnalité, le ton et configurez les réponses de votre assistant.',
        gradient: 'linear-gradient(135deg, #818cf8, #6366f1)',
        delay: 0
    },
    {
        number: '02',
        icon: QrCode,
        title: 'Connectez WhatsApp',
        description: 'Scannez le QR code pour lier votre numéro WhatsApp Business à votre agent.',
        gradient: 'linear-gradient(135deg, #f472b6, #ec4899)',
        delay: 0.2
    },
    {
        number: '03',
        icon: Zap,
        title: 'L\'IA répond 24h/24',
        description: 'Votre agent commence à répondre automatiquement. Suivez tout depuis le dashboard.',
        gradient: 'linear-gradient(135deg, #34d399, #10b981)',
        delay: 0.4
    }
]

export default function HowItWorks() {
    return (
        <section id="how-it-works" style={{
            padding: '100px 24px',
            background: '#020617',
            position: 'relative'
        }}>
            {/* Background effects */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(37, 211, 102, 0.3), transparent)'
            }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 64 }}
                >
                    <h2 style={{
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 16,
                        lineHeight: 1.2
                    }}>
                        3 étapes pour{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>automatiser</span>
                    </h2>
                    <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 500, margin: '0 auto' }}>
                        Configurez votre assistant IA en moins de 5 minutes.<br />
                        Aucune compétence technique requise.
                    </p>
                </motion.div>

                {/* Steps */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'stretch',
                    gap: 24,
                    flexWrap: 'wrap'
                }}>
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: step.delay }}
                            style={{
                                flex: '1 1 300px',
                                maxWidth: 360,
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'stretch'
                            }}
                        >
                            {/* Arrow connector */}
                            {index < steps.length - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    right: -16,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center'
                                }} className="step-arrow">
                                    <motion.div
                                        animate={{ x: [0, 5, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            background: 'rgba(37, 211, 102, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <ArrowRight style={{ width: 16, height: 16, color: '#25D366' }} />
                                    </motion.div>
                                </div>
                            )}

                            {/* Card */}
                            <motion.div
                                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                                style={{
                                    flex: 1,
                                    padding: 36,
                                    borderRadius: 28,
                                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    textAlign: 'center',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Step number background */}
                                <div style={{
                                    position: 'absolute',
                                    top: 16,
                                    right: 16,
                                    fontSize: 72,
                                    fontWeight: 900,
                                    color: 'rgba(148, 163, 184, 0.06)',
                                    lineHeight: 1
                                }}>
                                    {step.number}
                                </div>

                                {/* Icon */}
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: 20,
                                        background: step.gradient,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 24px',
                                        boxShadow: `0 20px 40px rgba(0,0,0,0.3)`
                                    }}
                                >
                                    <step.icon style={{ width: 32, height: 32, color: 'white' }} />
                                </motion.div>

                                {/* Content */}
                                <h3 style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: 'white',
                                    marginBottom: 12
                                }}>
                                    {step.title}
                                </h3>
                                <p style={{
                                    fontSize: 14,
                                    color: '#94a3b8',
                                    lineHeight: 1.7
                                }}>
                                    {step.description}
                                </p>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 900px) {
                    .step-arrow {
                        display: none !important;
                    }
                }
            `}</style>
        </section>
    )
}
