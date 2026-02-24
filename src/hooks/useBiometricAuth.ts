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

                // Determine biometric type
                let biometricType: BiometricType = 'none'
                if (result.isAvailable) {
                    // BiometryType: 1 = Touch ID/Fingerprint, 2 = Face ID, 3 = Iris
                    switch (result.biometryType) {
                        case 1:
                            biometricType = 'fingerprint'
                            break
                        case 2:
                            biometricType = 'face'
                            break
                        case 3:
                            biometricType = 'iris'
                            break
                        default:
                            biometricType = 'fingerprint' // Default to fingerprint
                    }
                }

                setState({
                    isAvailable: result.isAvailable,
                    isEnabled: enabled && result.isAvailable,
                    biometricType,
                    isAuthenticated: false
                })
            } catch (error) {
                console.log('Biometric not available:', error)
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
                subtitle: 'Utilisez votre empreinte digitale',
                description: 'Placez votre doigt sur le capteur',
                negativeButtonText: 'Annuler'
            })

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
        setState(prev => ({ ...prev, isEnabled: false }))
    }, [])

    // Get biometric type label in French
    const getBiometricLabel = useCallback((): string => {
        switch (state.biometricType) {
            case 'fingerprint':
                return 'Empreinte digitale'
            case 'face':
                return 'Reconnaissance faciale'
            case 'iris':
                return 'Scanner d\'iris'
            default:
                return 'Biométrie'
        }
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
