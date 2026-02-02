'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    HelpCircle,
    ChevronDown,
    MessageCircle,
    Mail,
    Book,
    Video,
    ExternalLink,
    Bot,
    CreditCard,
    Zap,
    Users
} from 'lucide-react'
import Link from 'next/link'

interface FAQItem {
    question: string
    answer: string
    icon: any
}

const faqs: FAQItem[] = [
    {
        question: "Comment créer mon premier agent IA ?",
        answer: "Allez dans 'Agents' puis cliquez sur 'Créer un nouvel agent'. Configurez son nom, sa mission et son prompt système. Ensuite, connectez votre numéro WhatsApp en scannant le QR code.",
        icon: Bot
    },
    {
        question: "Comment fonctionne le système de crédits ?",
        answer: "Chaque message envoyé par l'agent consomme des crédits. Le nombre de crédits dépend de votre plan. Vous pouvez acheter des crédits supplémentaires dans 'Facturation'.",
        icon: Zap
    },
    {
        question: "Comment connecter mon numéro WhatsApp ?",
        answer: "Ouvrez WhatsApp sur votre téléphone, allez dans Paramètres > Appareils liés > Lier un appareil, puis scannez le QR code affiché dans les paramètres de votre agent.",
        icon: MessageCircle
    },
    {
        question: "Comment changer de plan d'abonnement ?",
        answer: "Rendez-vous dans 'Facturation' et sélectionnez le plan qui vous convient. Le changement prend effet immédiatement et vos crédits sont ajustés.",
        icon: CreditCard
    },
    {
        question: "Comment gérer plusieurs agents ?",
        answer: "Selon votre plan, vous pouvez créer plusieurs agents. Chaque agent peut avoir sa propre configuration et gérer un numéro WhatsApp différent.",
        icon: Users
    },
    {
        question: "Mes conversations sont-elles sécurisées ?",
        answer: "Oui, toutes les conversations sont chiffrées et stockées de manière sécurisée. Nous ne lisons jamais le contenu de vos conversations.",
        icon: HelpCircle
    }
]

const guides = [
    { title: "Guide de démarrage rapide", description: "Apprenez les bases en 5 minutes", icon: Book },
    { title: "Configuration avancée", description: "Optimisez votre agent IA", icon: Bot },
    { title: "Tutoriels vidéo", description: "Formations pas à pas", icon: Video }
]

export default function HelpPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Centre d'aide</h1>
                <p style={{ color: '#94a3b8' }}>Trouvez des réponses à vos questions</p>
            </div>

            {/* Quick Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 20
            }}>
                <motion.a
                    href="https://wa.me/2250554585927"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02, borderColor: '#10b981' }}
                    style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 16,
                        padding: 24,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16
                    }}
                >
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: 'rgba(16, 185, 129, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <MessageCircle style={{ width: 24, height: 24, color: '#10b981' }} />
                    </div>
                    <div>
                        <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Support WhatsApp</h3>
                        <p style={{ color: '#94a3b8', fontSize: 13 }}>Réponse rapide en direct</p>
                    </div>
                    <ExternalLink style={{ width: 18, height: 18, color: '#10b981', marginLeft: 'auto' }} />
                </motion.a>

                <motion.a
                    href="mailto:support@wazzapai.com"
                    whileHover={{ scale: 1.02, borderColor: '#3b82f6' }}
                    style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 16,
                        padding: 24,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16
                    }}
                >
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: 'rgba(59, 130, 246, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Mail style={{ width: 24, height: 24, color: '#3b82f6' }} />
                    </div>
                    <div>
                        <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Email Support</h3>
                        <p style={{ color: '#94a3b8', fontSize: 13 }}>support@wazzapai.com</p>
                    </div>
                </motion.a>
            </div>

            {/* FAQ Section */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                padding: 28
            }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                    Questions fréquentes
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {faqs.map((faq, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <button
                                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                style={{
                                    width: '100%',
                                    background: openFaq === index
                                        ? 'rgba(16, 185, 129, 0.1)'
                                        : 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid',
                                    borderColor: openFaq === index
                                        ? 'rgba(16, 185, 129, 0.3)'
                                        : 'rgba(148, 163, 184, 0.1)',
                                    borderRadius: 12,
                                    padding: 18,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <faq.icon style={{ width: 20, height: 20, color: '#34d399', flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontWeight: 500, color: 'white' }}>{faq.question}</span>
                                    <motion.div
                                        animate={{ rotate: openFaq === index ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown style={{ width: 20, height: 20, color: '#64748b' }} />
                                    </motion.div>
                                </div>
                                {openFaq === index && (
                                    <motion.p
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        style={{
                                            marginTop: 14,
                                            paddingTop: 14,
                                            borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                                            color: '#94a3b8',
                                            fontSize: 14,
                                            lineHeight: 1.6
                                        }}
                                    >
                                        {faq.answer}
                                    </motion.p>
                                )}
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Resources */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 20,
                padding: 28
            }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                    Ressources & Guides
                </h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16
                }}>
                    {guides.map((guide, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ scale: 1.02, borderColor: 'rgba(168, 85, 247, 0.3)' }}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 14,
                                padding: 20,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <guide.icon style={{ width: 28, height: 28, color: '#a855f7', marginBottom: 12 }} />
                            <h3 style={{ color: 'white', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                                {guide.title}
                            </h3>
                            <p style={{ color: '#64748b', fontSize: 13 }}>{guide.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Contact Info */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.1))',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: 20,
                padding: 28,
                textAlign: 'center'
            }}>
                <h3 style={{ color: 'white', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
                    Besoin d'aide personnalisée ?
                </h3>
                <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
                    Notre équipe est disponible du lundi au vendredi, de 8h à 18h GMT
                </p>
                <Link
                    href="https://wa.me/2250554585927"
                    target="_blank"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        borderRadius: 12,
                        color: 'white',
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'transform 0.2s'
                    }}
                >
                    <MessageCircle style={{ width: 18, height: 18 }} />
                    Contacter le support
                </Link>
            </div>
        </div>
    )
}
