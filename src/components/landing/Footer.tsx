'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { MessageCircle, Twitter, Linkedin, Facebook, Instagram, Youtube, MapPin, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

const socialLinks = [
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
    { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
    { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
    { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
]

export default function Footer() {
    const t = useTranslations('Footer')

    const footerLinks = {
        product: [
            { label: t('links.features'), href: '#features' },
            { label: t('links.pricing'), href: '#pricing' },
            { label: t('links.faq'), href: '#faq' },
            { label: '💬 ' + t('links.community'), href: 'https://chat.whatsapp.com/E7vbXhqS0o5D4Wn2lrdDGi', external: true },
        ],
        company: [
            { label: t('links.about'), href: '/about' },
            { label: t('links.contact'), href: '/contact' },
        ],
        legal: [
            { label: t('links.privacy'), href: '/privacy' },
            { label: t('links.terms'), href: '/terms' },
            { label: t('links.gdpr'), href: '/gdpr' },
        ],
    }

    return (
        <footer className="relative pt-12 pb-6" style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.8) 100%)'
        }}>
            {/* Top border gradient */}
            <div className="absolute top-0 h-px" style={{
                left: '10%', right: '10%',
                background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent)'
            }} />

            <div className="max-w-[1200px] mx-auto px-6 relative z-10">

                {/* Footer Links grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
                    {/* Brand */}
                    <div className="col-span-2 sm:col-span-1">
                        <Link href="/" className="no-underline inline-flex items-center gap-[10px] mb-4">
                            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{
                                background: 'linear-gradient(135deg, #10b981, #059669)'
                            }}>
                                <MessageCircle style={{ width: 20, height: 20, color: 'white' }} />
                            </div>
                            <span className="font-bold text-xl" style={{
                                background: 'linear-gradient(135deg, #10b981, #34d399)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent'
                            }}>WazzapAI</span>
                        </Link>
                        <p className="text-slate-500 text-[13px] leading-relaxed mb-4">
                            {t('brandDescription')}
                        </p>
                        {/* Social icons */}
                        <div className="flex gap-2 flex-wrap">
                            {socialLinks.map((social) => (
                                <motion.a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-slate-400"
                                    style={{ background: 'rgba(51, 65, 85, 0.5)' }}
                                >
                                    <social.icon style={{ width: 16, height: 16 }} />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Produit */}
                    <div>
                        <h4 className="text-slate-200 font-semibold text-sm mb-4">{t('columns.product')}</h4>
                        <ul className="list-none p-0 m-0">
                            {footerLinks.product.map((link) => (
                                <li key={link.href} className="mb-[10px]">
                                    {'external' in link && link.external ? (
                                        <a href={link.href} target="_blank" rel="noopener noreferrer"
                                            className="text-[#25D366] no-underline text-sm">
                                            {link.label}
                                        </a>
                                    ) : (
                                        <Link href={link.href} className="text-slate-500 no-underline text-sm">
                                            {link.label}
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Entreprise */}
                    <div>
                        <h4 className="text-slate-200 font-semibold text-sm mb-4">{t('columns.company')}</h4>
                        <ul className="list-none p-0 m-0">
                            {footerLinks.company.map((link) => (
                                <li key={link.href} className="mb-[10px]">
                                    <Link href={link.href} className="text-slate-500 no-underline text-sm">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Légal */}
                    <div>
                        <h4 className="text-slate-200 font-semibold text-sm mb-4">{t('columns.legal')}</h4>
                        <ul className="list-none p-0 m-0">
                            {footerLinks.legal.map((link) => (
                                <li key={link.href} className="mb-[10px]">
                                    <Link href={link.href} className="text-slate-500 no-underline text-sm">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-6 flex flex-wrap justify-between items-center gap-4" style={{
                    borderTop: '1px solid rgba(148, 163, 184, 0.1)'
                }}>
                    <p className="text-slate-600 text-[13px]">
                        {t('rights')}
                    </p>
                    <div className="flex items-center gap-6 flex-wrap">
                        <div className="flex items-center gap-[6px] text-slate-600 text-[13px]">
                            <Mail style={{ width: 14, height: 14 }} />
                            support@wazzapai.com
                        </div>
                        <a href="tel:+2250554585927" className="flex items-center gap-[6px] text-slate-600 text-[13px] no-underline">
                            <MessageCircle style={{ width: 14, height: 14 }} />
                            +225 05 54 58 59 27
                        </a>
                        <div className="flex items-center gap-[6px] text-slate-600 text-[13px]">
                            <MapPin style={{ width: 14, height: 14 }} />
                            Abidjan, Côte d&apos;Ivoire
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}
