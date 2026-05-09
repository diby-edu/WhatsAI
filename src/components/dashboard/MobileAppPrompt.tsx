'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, X } from 'lucide-react'
import { PLAY_STORE_URL } from '@/lib/utils'

const SESSION_KEY = 'mobile_app_prompt_dismissed'

export default function MobileAppPrompt() {
    const [visible, setVisible] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // Détecter Android dans un navigateur (pas l'app Capacitor)
        const isAndroid = /Android/i.test(navigator.userAgent)
        const isCapacitor = !!(window as any).Capacitor
        const alreadyDismissed = sessionStorage.getItem(SESSION_KEY) === '1'
        if (isAndroid && !isCapacitor && !alreadyDismissed) {
            // Délai léger pour ne pas bloquer le chargement
            const t = setTimeout(() => setVisible(true), 1500)
            return () => clearTimeout(t)
        }
    }, [])

    const dismiss = () => {
        sessionStorage.setItem(SESSION_KEY, '1')
        setVisible(false)
    }

    if (!mounted) return null

    return createPortal(
        <AnimatePresence>
            {visible && (
                <>
                    {/* Overlay semi-transparent */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={dismiss}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9998,
                            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)'
                        }}
                    />

                    {/* Bottom sheet */}
                    <motion.div
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
                            background: '#1e293b',
                            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                            borderRadius: '20px 20px 0 0',
                            padding: '24px 24px 36px',
                            boxShadow: '0 -20px 60px rgba(0,0,0,0.5)'
                        }}
                    >
                        {/* Handle */}
                        <div style={{
                            width: 40, height: 4, borderRadius: 2,
                            background: 'rgba(148,163,184,0.3)',
                            margin: '0 auto 20px'
                        }} />

                        {/* Bouton fermer */}
                        <button
                            onClick={dismiss}
                            style={{
                                position: 'absolute', top: 16, right: 16,
                                background: 'rgba(148,163,184,0.1)', border: 'none',
                                borderRadius: 8, padding: 6, cursor: 'pointer', color: '#94a3b8'
                            }}
                        >
                            <X size={16} />
                        </button>

                        {/* Contenu */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                                background: 'linear-gradient(135deg, #10b981, #0891b2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Smartphone style={{ width: 28, height: 28, color: 'white' }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, color: 'white', fontSize: 17, marginBottom: 6 }}>
                                    Meilleure expérience disponible
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>
                                    Téléchargez l&apos;app WazzapAI pour recevoir les alertes en temps réel, gérer vos agents et répondre à vos clients — même hors connexion.
                                </div>
                            </div>
                        </div>

                        {/* Boutons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <a
                                href={PLAY_STORE_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: 'none' }}
                                onClick={dismiss}
                            >
                                <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    style={{
                                        width: '100%', padding: '16px',
                                        borderRadius: 14, border: 'none',
                                        background: 'linear-gradient(135deg, #10b981, #0891b2)',
                                        color: 'white', fontWeight: 700, fontSize: 16,
                                        cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: 10
                                    }}
                                >
                                    <Smartphone size={20} />
                                    Télécharger sur Google Play
                                </motion.button>
                            </a>
                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={dismiss}
                                style={{
                                    width: '100%', padding: '14px',
                                    borderRadius: 14,
                                    border: '1px solid rgba(148,163,184,0.2)',
                                    background: 'transparent', color: '#94a3b8',
                                    fontWeight: 500, fontSize: 15, cursor: 'pointer'
                                }}
                            >
                                Continuer dans le navigateur
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    )
}
