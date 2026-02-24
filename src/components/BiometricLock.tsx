'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, Smartphone, RefreshCw } from 'lucide-react'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'

export function BiometricLock({ children }: { children: React.ReactNode }) {
    const { isEnabled, isAuthenticated, authenticate, getBiometricLabel, loading, biometricType } = useBiometricAuth()
    const [showLock, setShowLock] = useState(false)
    const [authenticating, setAuthenticating] = useState(false)

    useEffect(() => {
        // Only check on mobile
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
        if (!isCapacitor) return

        // If biometric is enabled but not authenticated, show lock
        if (!loading && isEnabled && !isAuthenticated) {
            setShowLock(true)
            // Auto-prompt for authentication
            handleAuthenticate()
        }
    }, [loading, isEnabled, isAuthenticated])

    // Handle app resume - re-authenticate
    useEffect(() => {
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
        if (!isCapacitor || !isEnabled) return

        let listenerHandle: any = null

        const setupAppResumeListener = async () => {
            try {
                const { App } = await import('@capacitor/app')

                listenerHandle = await App.addListener('appStateChange', async ({ isActive }) => {
                    if (isActive && isEnabled) {
                        // App came back to foreground, re-authenticate
                        setShowLock(true)
                        handleAuthenticate()
                    }
                })
            } catch {
                // App state listener not available in web
            }
        }

        setupAppResumeListener()

        return () => {
            if (listenerHandle) {
                listenerHandle.remove()
            }
        }
    }, [isEnabled])

    const handleAuthenticate = async () => {
        setAuthenticating(true)
        const success = await authenticate()
        setAuthenticating(false)

        if (success) {
            setShowLock(false)
        }
    }

    // Not on mobile or biometric not enabled - show children directly
    if (!showLock) {
        return <>{children}</>
    }

    return (
        <>
            {/* Lock Screen Overlay */}
            <AnimatePresence>
                {showLock && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9999,
                            backgroundColor: '#0f172a',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 24
                        }}
                    >
                        {/* Logo */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 20,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 24
                            }}
                        >
                            <Smartphone style={{ width: 40, height: 40, color: 'white' }} />
                        </motion.div>

                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            style={{
                                fontSize: 24,
                                fontWeight: 700,
                                color: 'white',
                                marginBottom: 8
                            }}
                        >
                            WazzapAI
                        </motion.h1>

                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                fontSize: 14,
                                color: '#94a3b8',
                                marginBottom: 48,
                                textAlign: 'center'
                            }}
                        >
                            Utilisez {getBiometricLabel().toLowerCase()} pour déverrouiller
                        </motion.p>

                        {/* Fingerprint Button */}
                        <motion.button
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            onClick={handleAuthenticate}
                            disabled={authenticating}
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: '50%',
                                background: authenticating
                                    ? 'rgba(16, 185, 129, 0.3)'
                                    : 'rgba(16, 185, 129, 0.15)',
                                border: '2px solid rgba(16, 185, 129, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {authenticating ? (
                                <RefreshCw
                                    style={{
                                        width: 48,
                                        height: 48,
                                        color: '#10b981',
                                        animation: 'spin 1s linear infinite'
                                    }}
                                />
                            ) : (
                                <Fingerprint
                                    style={{
                                        width: 48,
                                        height: 48,
                                        color: '#10b981'
                                    }}
                                />
                            )}
                        </motion.button>

                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            style={{
                                fontSize: 12,
                                color: '#64748b',
                                marginTop: 24
                            }}
                        >
                            {authenticating ? 'Vérification en cours...' : 'Appuyez pour déverrouiller'}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Children always rendered but hidden when locked */}
            <div style={{ visibility: showLock ? 'hidden' : 'visible' }}>
                {children}
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    )
}
