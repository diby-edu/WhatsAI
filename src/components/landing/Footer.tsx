'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MessageCircle, Mail, Phone, MapPin, ArrowRight, Send, Twitter, Linkedin, Facebook, Instagram, Youtube } from 'lucide-react'

const footerLinks = {
    product: [
        { label: 'Fonctionnalités', href: '#features' },
        { label: 'Tarifs', href: '#pricing' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Changelog', href: '/changelog' },
        { label: 'API Docs', href: '/docs' },
    ],
    company: [
        { label: 'À propos', href: '/about' },
        { label: 'Blog', href: '/blog' },
        { label: 'Carrières', href: '/careers' },
        { label: 'Partenaires', href: '/partners' },
        { label: 'Contact', href: '/contact' },
    ],
    legal: [
        { label: 'Confidentialité', href: '/privacy' },
        { label: 'Conditions', href: '/terms' },
        { label: 'Mentions légales', href: '/legal' },
        { label: 'RGPD', href: '/gdpr' },
    ],
    resources: [
        { label: 'Centre d\'aide', href: '/help' },
        { label: 'Tutoriels', href: '/tutorials' },
        { label: 'Webinaires', href: '/webinars' },
        { label: 'Templates', href: '/templates' },
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
        <footer className="relative pt-32 pb-8 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/20 to-transparent" />

            <div className="container relative z-10">
                {/* CTA Section */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative glass-card rounded-3xl p-12 mb-20 overflow-hidden"
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />

                    <div className="relative grid lg:grid-cols-2 gap-10 items-center">
                        <div>
                            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                                Prêt à automatiser votre WhatsApp ?
                            </h2>
                            <p className="text-lg text-dark-300 mb-6">
                                Rejoignez des milliers d'entreprises qui utilisent WhatsAI pour
                                booster leurs ventes et satisfaire leurs clients 24h/24.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <Link href="/register">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="btn btn-primary text-lg"
                                    >
                                        Commencer gratuitement
                                        <ArrowRight className="w-5 h-5" />
                                    </motion.button>
                                </Link>
                                <Link href="/demo">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="btn btn-secondary text-lg"
                                    >
                                        Voir la démo
                                    </motion.button>
                                </Link>
                            </div>
                        </div>

                        {/* Newsletter */}
                        <div className="lg:pl-10">
                            <h3 className="text-xl font-semibold text-white mb-4">
                                Newsletter
                            </h3>
                            <p className="text-dark-400 mb-4">
                                Recevez nos derniers conseils et actualités.
                            </p>
                            <form className="flex gap-3">
                                <div className="flex-1 relative">
                                    <input
                                        type="email"
                                        placeholder="votre@email.com"
                                        className="input pr-12"
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    <Send className="w-5 h-5" />
                                </motion.button>
                            </form>
                        </div>
                    </div>
                </motion.div>

                {/* Footer Links */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="flex items-center gap-3 mb-6">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-primary-500/25">
                                <MessageCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <span className="text-xl font-bold text-white">WhatsAI</span>
                            </div>
                        </Link>
                        <p className="text-dark-400 text-sm mb-6 leading-relaxed">
                            La solution d'automatisation WhatsApp propulsée par l'IA pour les entreprises modernes.
                        </p>
                        <div className="flex gap-3">
                            {socialLinks.map((social) => (
                                <motion.a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    className="w-10 h-10 rounded-xl bg-dark-800 flex items-center justify-center text-dark-400 hover:text-white hover:bg-primary-500/20 transition-colors"
                                    aria-label={social.label}
                                >
                                    <social.icon className="w-5 h-5" />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Produit</h4>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-dark-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Entreprise</h4>
                        <ul className="space-y-3">
                            {footerLinks.company.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-dark-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Ressources</h4>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-dark-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Légal</h4>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-dark-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-dark-800 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-dark-500 text-sm">
                        © {new Date().getFullYear()} WhatsAI. Tous droits réservés.
                    </p>
                    <div className="flex items-center gap-6 text-sm text-dark-500">
                        <a href="mailto:contact@whatsai.com" className="flex items-center gap-2 hover:text-white transition-colors">
                            <Mail className="w-4 h-4" />
                            contact@whatsai.com
                        </a>
                        <span className="hidden md:inline">•</span>
                        <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Abidjan, Côte d'Ivoire
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
