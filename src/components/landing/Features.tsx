'use client'

import { motion } from 'framer-motion'
import { Zap, Brain, Target, MessageSquare, BarChart3, Database, Globe, Shield } from 'lucide-react'

const features = [
    {
        icon: Zap,
        title: 'Réponses instantanées',
        description: 'Votre IA répond en moins de 3 secondes, 24h/24, 7j/7.',
        gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
        glow: 'rgba(245, 158, 11, 0.3)'
    },
    {
        icon: Brain,
        title: 'IA ultra-intelligente',
        description: 'Propulsée par GPT-4o, elle comprend le contexte comme un humain.',
        gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
        glow: 'rgba(139, 92, 246, 0.3)'
    },
    {
        icon: Target,
        title: 'Qualification de leads',
        description: 'Identifiez automatiquement les prospects chauds à prioriser.',
        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
        glow: 'rgba(16, 185, 129, 0.3)'
    },
    {
        icon: MessageSquare,
        title: 'Multi-conversations',
        description: 'Gérez des milliers de conversations simultanées sans effort.',
        gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
        glow: 'rgba(59, 130, 246, 0.3)'
    },
    {
        icon: BarChart3,
        title: 'Analytics avancés',
        description: 'Tableaux de bord en temps réel avec métriques clés.',
        gradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
        glow: 'rgba(236, 72, 153, 0.3)'
    },
    {
        icon: Database,
        title: 'Base de connaissances',
        description: 'Entraînez votre IA sur vos produits et FAQ.',
        gradient: 'linear-gradient(135deg, #14b8a6, #2dd4bf)',
        glow: 'rgba(20, 184, 166, 0.3)'
    },
    {
        icon: Globe,
        title: '113+ langues',
        description: 'Communiquez avec vos clients dans leur langue maternelle.',
        gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
        glow: 'rgba(99, 102, 241, 0.3)'
    },
    {
        icon: Shield,
        title: 'Sécurité maximale',
        description: 'Chiffrement bout en bout, conformité RGPD.',
        gradient: 'linear-gradient(135deg, #22c55e, #4ade80)',
        glow: 'rgba(34, 197, 94, 0.3)'
    }
]

const stats = [
    { value: '5,000+', label: 'Entreprises actives' },
    { value: '10M+', label: 'Messages traités' },
    { value: '98%', label: 'Satisfaction client' },
    { value: '+300%', label: 'ROI moyen' }
]

export default function Features() {
    return (
        <section id="features" style={{
            padding: '120px 24px',
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background decoration */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 1000,
                height: 1000,
                background: 'radial-gradient(circle, rgba(37, 211, 102, 0.05) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: 80 }}
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
                        <Zap style={{ width: 16, height: 16, color: '#25D366' }} />
                        <span style={{ fontSize: 14, color: '#25D366', fontWeight: 600 }}>Fonctionnalités</span>
                    </div>
                    <h2 style={{
                        fontSize: 'clamp(32px, 5vw, 48px)',
                        fontWeight: 700,
                        color: 'white',
                        marginBottom: 16,
                        lineHeight: 1.2
                    }}>
                        Une suite complète d'outils{' '}
                        <span style={{
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>IA</span>
                    </h2>
                    <p style={{ fontSize: 18, color: '#94a3b8', maxWidth: 600, margin: '0 auto' }}>
                        Transformez vos conversations en opportunités commerciales
                    </p>
                </motion.div>

                {/* Features Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 24,
                    marginBottom: 100
                }}>
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            whileHover={{ y: -8, transition: { duration: 0.2 } }}
                            style={{
                                padding: 32,
                                borderRadius: 24,
                                background: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Hover glow effect */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 2,
                                    background: feature.gradient,
                                    borderRadius: '24px 24px 0 0'
                                }}
                            />

                            {/* Icon */}
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                background: feature.gradient,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 20,
                                boxShadow: `0 10px 30px ${feature.glow}`
                            }}>
                                <feature.icon style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            {/* Content */}
                            <h3 style={{
                                fontSize: 20,
                                fontWeight: 600,
                                color: 'white',
                                marginBottom: 10
                            }}>
                                {feature.title}
                            </h3>
                            <p style={{
                                fontSize: 15,
                                color: '#94a3b8',
                                lineHeight: 1.6
                            }}>
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 32,
                        padding: '48px 64px',
                        borderRadius: 32,
                        background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(37, 211, 102, 0.2)'
                    }}
                >
                    {stats.map((stat, index) => (
                        <div key={stat.label} style={{ textAlign: 'center' }}>
                            <motion.div
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                style={{
                                    fontSize: 'clamp(32px, 4vw, 48px)',
                                    fontWeight: 800,
                                    background: 'linear-gradient(135deg, #25D366, #6ee7b7)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    marginBottom: 8
                                }}
                            >
                                {stat.value}
                            </motion.div>
                            <div style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>

            <style jsx global>{`
                @media (max-width: 768px) {
                    section#features > div > div:last-child {
                        grid-template-columns: repeat(2, 1fr) !important;
                        padding: 32px !important;
                        gap: 24px !important;
                    }
                }
                @media (max-width: 480px) {
                    section#features > div > div:last-child {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </section>
    )
}
