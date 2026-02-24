'use client'

import { useState, useEffect, useCallback } from 'react'

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none'

interface BiometricState {
    isAvailable: boolean
    isEnabled: boolean
    biometricType: BiometricType
    isAuthenticated: boolean
}

const BIOMETRIC_ENABLED_KEY = 'wazzapai_biometric_enabled'
const AUTH_SESSION_KEY = 'wazzapai_biometric_session'
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export function useBiometricAuth() {
    const [state, setState] = useState<BiometricState>({
        isAvailable: false,
        isEnabled: false,
        biometricType: 'none',
        isAuthenticated: false
    })
    const [loading, setLoading] = useState(true)

    // Check if biometric is available and enabled
    useEffect(() => {
        const checkBiometric = async () => {
            const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()

            if (!isCapacitor) {
                setLoading(false)
                return
            }

            try {
                const { NativeBiometric } = await import('capacitor-native-biometric')

                // Check availability
                const result = await NativeBiometric.isAvailable()

                // Get saved preference
                const enabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true'

                // Check for existing valid session
                let isAlreadyAuthenticated = false
                const sessionData = localStorage.getItem(AUTH_SESSION_KEY)
                if (sessionData) {
                    try {
                        const { timestamp } = JSON.parse(sessionData)
                        if (Date.now() - timestamp < SESSION_TIMEOUT) {
                            isAlreadyAuthenticated = true
                        } else {
                            // Session expired, remove it
                            localStorage.removeItem(AUTH_SESSION_KEY)
                        }
                    } catch {
                        localStorage.removeItem(AUTH_SESSION_KEY)
                    }
                }

                // Determine biometric type - use generic for better UX
                let biometricType: BiometricType = 'none'
                if (result.isAvailable) {
                    // BiometryType: 1 = Touch ID/Fingerprint, 2 = Face ID, 3 = Iris
                    // Default to fingerprint for better label display
                    biometricType = 'fingerprint'
                }

                setState({
                    isAvailable: result.isAvailable,
                    isEnabled: enabled && result.isAvailable,
                    biometricType,
                    isAuthenticated: isAlreadyAuthenticated
                })
            } catch (error) {
                // Silent fail for biometric
            } finally {
                setLoading(false)
            }
        }

        checkBiometric()
    }, [])

    // Authenticate using biometrics
    const authenticate = useCallback(async (): Promise<boolean> => {
        const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()

        if (!isCapacitor || !state.isAvailable) {
            return true // Allow if not on mobile or not available
        }

        try {
            const { NativeBiometric } = await import('capacitor-native-biometric')

            await NativeBiometric.verifyIdentity({
                reason: 'Déverrouillez WazzapAI',
                title: 'Authentification',
                subtitle: 'Authentification biométrique',
                description: 'Utilisez votre empreinte ou reconnaissance faciale',
                negativeButtonText: 'Annuler'
            })

            // Save session to localStorage
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ timestamp: Date.now() }))
            setState(prev => ({ ...prev, isAuthenticated: true }))
            return true
        } catch (error: any) {
            console.log('Biometric auth failed:', error)
            setState(prev => ({ ...prev, isAuthenticated: false }))
            return false
        }
    }, [state.isAvailable])

    // Enable biometric authentication
    const enableBiometric = useCallback(async (): Promise<boolean> => {
        // First authenticate to enable
        const success = await authenticate()

        if (success) {
            localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
            setState(prev => ({ ...prev, isEnabled: true }))
            return true
        }
        return false
    }, [authenticate])

    // Disable biometric authentication
    const disableBiometric = useCallback(() => {
        localStorage.removeItem(BIOMETRIC_ENABLED_KEY)
        localStorage.removeItem(AUTH_SESSION_KEY)
        setState(prev => ({ ...prev, isEnabled: false, isAuthenticated: false }))
    }, [])

    // Get biometric type label in French - use generic label for better UX
    const getBiometricLabel = useCallback((): string => {
        if (state.biometricType === 'none') return 'Biométrie'
        return 'Authentification biométrique'
    }, [state.biometricType])

    return {
        ...state,
        loading,
        authenticate,
        enableBiometric,
        disableBiometric,
        getBiometricLabel
    }
}
