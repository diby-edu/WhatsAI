'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MessageCircle, ArrowRight, Send, Twitter, Linkedin, Facebook, Instagram, Youtube, MapPin, Mail, Phone } from 'lucide-react'

const footerLinks = {
    product: [
        { label: 'Fonctionnalités', href: '#features' },
        { label: 'Tarifs', href: '#pricing' },
        { label: 'FAQ', href: '#faq' },
        { label: 'API Docs', href: '/docs' },
    ],
    company: [
        { label: 'À propos', href: '/about' },
        { label: 'Blog', href: '/blog' },
        { label: 'Partenaires', href: '/partners' },
        { label: 'Contact', href: '/contact' },
    ],
    resources: [
        { label: 'Centre d\'aide', href: '/help' },
        { label: 'Tutoriels', href: '/tutorials' },
        { label: 'Templates', href: '/templates' },
    ],
    legal: [
        { label: 'Confidentialité', href: '/privacy' },
        { label: 'Conditions', href: '/terms' },
        { label: 'RGPD', href: '/gdpr' },
    ],
}

const socialLinks = [
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
    { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
    { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
    { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
]

export default function Footer() {
    return (
        <footer style={{
            position: 'relative',
            paddingTop: 48,
            paddingBottom: 24,
            background: 'linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.8) 100%)'
        }}>
            {/* Top border gradient */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: '10%',
                right: '10%',
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent)'
            }} />

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 10 }}>

                {/* CTA Section - Compact */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{
                        borderRadius: 24,
                        padding: '40px 32px',
                        marginBottom: 48,
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(30, 41, 59, 0.3) 100%)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        backdropFilter: 'blur(10px)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Background glow */}
                    <div style={{
                        position: 'absolute',
                        top: -50,
                        right: -50,
                        width: 200,
                        height: 200,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
                        filter: 'blur(40px)'
                    }} />

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 32,
                        alignItems: 'center',
                        position: 'relative'
                    }}>
                        <div>
                            <h2 style={{
                                fontSize: 28,
                                fontWeight: 700,
                                color: 'white',
                                marginBottom: 12,
                                lineHeight: 1.3
                            }}>
                                Prêt à automatiser votre WhatsApp ?
                            </h2>
                            <p style={{ color: '#94a3b8', marginBottom: 20, fontSize: 15 }}>
                                Rejoignez des milliers d'entreprises qui utilisent WhatsAI 24h/24.
                            </p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <Link href="/register" style={{ textDecoration: 'none' }}>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '12px 24px',
                                            borderRadius: 12,
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            color: 'white',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 15
                                        }}
                                    >
                                        Commencer gratuitement
                                        <ArrowRight style={{ width: 18, height: 18 }} />
                                    </motion.button>
                                </Link>
                                <Link href="/demo" style={{ textDecoration: 'none' }}>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: 12,
                                            background: 'rgba(51, 65, 85, 0.5)',
                                            color: 'white',
                                            fontWeight: 600,
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            cursor: 'pointer',
                                            fontSize: 15
                                        }}
                                    >
                                        Voir la démo
                                    </motion.button>
                                </Link>
                            </div>
                        </div>

                        {/* Newsletter */}
                        <div>
                            <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8, fontSize: 16 }}>
                                Newsletter
                            </h3>
                            <p style={{ color: '#64748b', marginBottom: 12, fontSize: 14 }}>
                                Recevez nos derniers conseils et actualités.
                            </p>
                            <form style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="email"
                                    placeholder="votre@email.com"
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        borderRadius: 10,
                                        background: 'rgba(30, 41, 59, 0.8)',
                                        border: '1px solid rgba(148, 163, 184, 0.2)',
                                        color: 'white',
                                        fontSize: 14,
                                        outline: 'none'
                                    }}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="submit"
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 10,
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Send style={{ width: 18, height: 18, color: 'white' }} />
                                </motion.button>
                            </form>
                        </div>
                    </div>
                </motion.div>

                {/* Footer Links - Compact grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 32,
                    marginBottom: 40
                }}>
                    {/* Brand */}
                    <div>
                        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <MessageCircle style={{ width: 20, height: 20, color: 'white' }} />
                            </div>
                            <span style={{
                                fontWeight: 700,
                                fontSize: 20,
                                background: 'linear-gradient(135deg, #10b981, #34d399)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>WhatsAI</span>
                        </Link>
                        <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                            L'IA qui répond à vos clients sur WhatsApp 24h/24.
                        </p>
                        {/* Social icons */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            {socialLinks.map((social) => (
                                <motion.a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: 'rgba(51, 65, 85, 0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#94a3b8',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <social.icon style={{ width: 16, height: 16 }} />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Produit */}
                    <div>
                        <h4 style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Produit</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {footerLinks.product.map((link) => (
                                <li key={link.label} style={{ marginBottom: 10 }}>
                                    <Link href={link.href} style={{
                                        color: '#64748b',
                                        textDecoration: 'none',
                                        fontSize: 14,
                                        transition: 'color 0.2s'
                                    }}>
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Entreprise */}
                    <div>
                        <h4 style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Entreprise</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {footerLinks.company.map((link) => (
                                <li key={link.label} style={{ marginBottom: 10 }}>
                                    <Link href={link.href} style={{
                                        color: '#64748b',
                                        textDecoration: 'none',
                                        fontSize: 14
                                    }}>
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Ressources */}
                    <div>
                        <h4 style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Ressources</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {footerLinks.resources.map((link) => (
                                <li key={link.label} style={{ marginBottom: 10 }}>
                                    <Link href={link.href} style={{
                                        color: '#64748b',
                                        textDecoration: 'none',
                                        fontSize: 14
                                    }}>
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Légal */}
                    <div>
                        <h4 style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Légal</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {footerLinks.legal.map((link) => (
                                <li key={link.label} style={{ marginBottom: 10 }}>
                                    <Link href={link.href} style={{
                                        color: '#64748b',
                                        textDecoration: 'none',
                                        fontSize: 14
                                    }}>
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div style={{
                    paddingTop: 24,
                    borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16
                }}>
                    <p style={{ color: '#475569', fontSize: 13 }}>
                        © 2025 WhatsAI. Tous droits réservés.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                            <Mail style={{ width: 14, height: 14 }} />
                            contact@whatsai.com
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 13 }}>
                            <MapPin style={{ width: 14, height: 14 }} />
                            Abidjan, Côte d'Ivoire
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
