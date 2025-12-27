'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import { useState } from 'react'

export default function WhatsAppButton() {
    const [isOpen, setIsOpen] = useState(false)

    // Numéro WhatsApp de contact (format international sans +)
    const whatsappNumber = '2250718287025'
    const defaultMessage = 'Bonjour ! Je souhaite en savoir plus sur WhatsAI.'

    const handleWhatsAppClick = () => {
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultMessage)}`
        window.open(url, '_blank')
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 12
        }}>
            {/* Popup message */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            background: 'white',
                            borderRadius: 16,
                            padding: 20,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            maxWidth: 280,
                            position: 'relative'
                        }}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                border: 'none',
                                background: '#f1f5f9',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X style={{ width: 14, height: 14, color: '#64748b' }} />
                        </button>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <MessageCircle style={{ width: 20, height: 20, color: 'white' }} />
                            </div>
                            <div>
                                <h4 style={{ color: '#1e293b', fontWeight: 600, fontSize: 14, margin: 0 }}>
                                    WhatsAI Support
                                </h4>
                                <p style={{ color: '#10b981', fontSize: 12, margin: 0 }}>
                                    ● En ligne
                                </p>
                            </div>
                        </div>

                        {/* Message */}
                        <div style={{
                            background: '#f1f5f9',
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 16
                        }}>
                            <p style={{ color: '#475569', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                                👋 Bonjour ! Comment pouvons-nous vous aider aujourd'hui ?
                            </p>
                        </div>

                        {/* CTA Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleWhatsAppClick}
                            style={{
                                width: '100%',
                                padding: '12px 20px',
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 14,
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                        >
                            <MessageCircle style={{ width: 18, height: 18 }} />
                            Démarrer une conversation
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main WhatsApp Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #25D366, #128C7E)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4)',
                    position: 'relative'
                }}
            >
                {/* Pulse animation */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        border: '2px solid #25D366'
                    }}
                />

                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                        >
                            <X style={{ width: 28, height: 28, color: 'white' }} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="whatsapp"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                        >
                            {/* WhatsApp icon SVG */}
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    )
}
