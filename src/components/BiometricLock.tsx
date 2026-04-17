'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, Smartphone, RefreshCw, KeyRound } from 'lucide-react'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'
import { unregisterCurrentDeviceToken } from '@/lib/notifications/device-token-client'

export function BiometricLock({ children }: { children: React.ReactNode }) {
    const { isEnabled, isAuthenticated, authenticate, getBiometricLabel, loading } = useBiometricAuth()
    const [showLock, setShowLock] = useState(false)
    const [authenticating, setAuthenticating] = useState(false)
    const [authFailed, setAuthFailed] = useState(false) // true après un annuler/échec
    // Ref pour éviter l'auto-prompt en boucle
    const hasAutoPrompted = useRef(false)

    // Vérification initiale au chargement
    // IMPORTANT: isAuthenticated est intentionnellement ABSENT des deps
    // pour éviter la boucle infinie (cancel → isAuthenticated=false → re-trigger → cancel → ...)
    useEffect(() => {
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
        if (!isCapacitor) return
        if (loading) return

        if (isEnabled && !isAuthenticated) {
            setShowLock(true)
            // Auto-prompt une seule fois au démarrage
            if (!hasAutoPrompted.current) {
                hasAutoPrompted.current = true
                handleAuthenticate()
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, isEnabled])

    // Quand l'auth réussit depuis ailleurs (ex: premier `isAuthenticated` depuis localStorage)
    useEffect(() => {
        if (isAuthenticated && showLock) {
            setShowLock(false)
            setAuthFailed(false)
        }
    }, [isAuthenticated, showLock])

    // Handle app resume - re-verrouiller seulement si session expirée
    useEffect(() => {
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
        if (!isCapacitor || !isEnabled) return

        let listenerHandle: any = null

        const setupAppResumeListener = async () => {
            try {
                const { App } = await import('@capacitor/app')

                listenerHandle = await App.addListener('appStateChange', async ({ isActive }) => {
                    if (!isActive) {
                        // App fermée/tuée → effacer la session pour forcer le prompt au prochain lancement
                        localStorage.removeItem('wazzapai_biometric_session')
                        return
                    }
                    if (isActive && isEnabled) {
                        const SESSION_TIMEOUT = 30 * 60 * 1000
                        const AUTH_SESSION_KEY = 'wazzapai_biometric_session'
                        const sessionData = localStorage.getItem(AUTH_SESSION_KEY)

                        if (sessionData) {
                            try {
                                const { timestamp } = JSON.parse(sessionData)
                                if (Date.now() - timestamp < SESSION_TIMEOUT) {
                                    // Session encore valide → ne pas re-verrouiller
                                    return
                                }
                            } catch {
                                // JSON invalide → continuer vers re-auth
                            }
                        }

                        // Session expirée → verrouiller et auto-prompt
                        hasAutoPrompted.current = false
                        setAuthFailed(false)
                        setShowLock(true)
                        handleAuthenticate()
                    }
                })
            } catch {
                // Pas disponible en web
            }
        }

        setupAppResumeListener()

        return () => {
            if (listenerHandle) listenerHandle.remove()
        }
    }, [isEnabled])

    const handleAuthenticate = async () => {
        setAuthenticating(true)
        setAuthFailed(false)
        const success = await authenticate()
        setAuthenticating(false)

        if (success) {
            setShowLock(false)
            setAuthFailed(false)
        } else {
            // Echec ou annulation → montrer le bouton "mot de passe"
            setAuthFailed(true)
        }
    }

    const handleUsePassword = async () => {
        try {
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            try {
                await unregisterCurrentDeviceToken()
            } catch {
                // Best-effort only
            }
            await supabase.auth.signOut()
            // Supprimer la session biométrique
            localStorage.removeItem('wazzapai_biometric_session')
            window.location.href = '/login'
        } catch {
            window.location.href = '/login'
        }
    }

    // Pas sur mobile ou biométrie non activée → afficher directement
    if (!showLock) {
        return <>{children}</>
    }

    return (
        <>
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
                            style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 8 }}
                        >
                            WazzapAI
                        </motion.h1>

                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            style={{ fontSize: 14, color: '#94a3b8', marginBottom: 48, textAlign: 'center' }}
                        >
                            {authFailed
                                ? 'Authentification annulée ou échouée'
                                : `Utilisez ${getBiometricLabel().toLowerCase()} pour déverrouiller`
                            }
                        </motion.p>

                        {/* Bouton empreinte */}
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
                                    : authFailed
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : 'rgba(16, 185, 129, 0.15)',
                                border: `2px solid ${authFailed ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: authenticating ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {authenticating ? (
                                <RefreshCw style={{ width: 48, height: 48, color: '#10b981', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <Fingerprint style={{ width: 48, height: 48, color: authFailed ? '#ef4444' : '#10b981' }} />
                            )}
                        </motion.button>

                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            style={{ fontSize: 12, color: '#64748b', marginTop: 24 }}
                        >
                            {authenticating ? 'Vérification en cours...' : 'Appuyez pour réessayer'}
                        </motion.p>

                        {/* Bouton mot de passe — visible seulement après un échec/annulation */}
                        {authFailed && (
                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                onClick={handleUsePassword}
                                style={{
                                    marginTop: 32,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(148, 163, 184, 0.3)',
                                    borderRadius: 12,
                                    padding: '12px 24px',
                                    color: '#94a3b8',
                                    fontSize: 14,
                                    cursor: 'pointer'
                                }}
                            >
                                <KeyRound style={{ width: 16, height: 16 }} />
                                Utiliser mon mot de passe
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

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
