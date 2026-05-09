'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Smartphone, X } from 'lucide-react'
import { PLAY_STORE_URL } from '@/lib/utils'

interface AppDownloadBannerProps {
    dismissed: boolean
    onDismissed: () => void
}

export default function AppDownloadBanner({ dismissed, onDismissed }: AppDownloadBannerProps) {
    const [sessionClosed, setSessionClosed] = useState(false)

    if (dismissed || sessionClosed) return null

    const handleDownloaded = async () => {
        try {
            await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_banner_dismissed: true })
            })
        } catch { /* silencieux */ }
        onDismissed()
    }

    const handleClose = () => {
        setSessionClosed(true)
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 14,
                    padding: '14px 20px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    position: 'relative'
                }}
            >
                {/* Icône */}
                <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #10b981, #0891b2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Smartphone style={{ width: 22, height: 22, color: 'white' }} />
                </div>

                {/* Texte */}
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: 14, marginBottom: 2 }}>
                        WazzapAI est disponible sur Android
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>
                        Gérez vos agents, recevez les alertes en temps réel et répondez à vos clients depuis votre téléphone.
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                                padding: '8px 16px', borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, #10b981, #0891b2)',
                                color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6
                            }}
                        >
                            Télécharger
                        </motion.button>
                    </a>
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleDownloaded}
                        style={{
                            padding: '8px 14px', borderRadius: 10,
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'transparent', color: '#10b981',
                            fontWeight: 600, fontSize: 13, cursor: 'pointer'
                        }}
                    >
                        J&apos;ai téléchargé ✓
                    </motion.button>
                </div>

                {/* Fermer session */}
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute', top: 10, right: 12,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#64748b', padding: 4
                    }}
                >
                    <X size={14} />
                </button>
            </motion.div>
        </AnimatePresence>
    )
}
