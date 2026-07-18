import type { Dispatch, SetStateAction } from 'react'
import type { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, Fingerprint, Check } from 'lucide-react'
import { InputField, SaveButton } from './fields'

interface Passwords {
    current: string
    new: string
    confirm: string
}

interface SecurityTabProps {
    t: ReturnType<typeof useTranslations>
    showPassword: boolean
    setShowPassword: Dispatch<SetStateAction<boolean>>
    passwords: Passwords
    setPasswords: Dispatch<SetStateAction<Passwords>>
    saving: boolean
    saved: boolean
    handleChangePassword: () => void
    biometricAvailable: boolean
    biometricEnabled: boolean
    disableBiometric: () => void
    enableBiometric: () => Promise<boolean>
    setEnablingBiometric: Dispatch<SetStateAction<boolean>>
    enablingBiometric: boolean
    biometricLoading: boolean
    getBiometricLabel: () => string
}

export function SecurityTab({
    t,
    showPassword,
    setShowPassword,
    passwords,
    setPasswords,
    saving,
    saved,
    handleChangePassword,
    biometricAvailable,
    biometricEnabled,
    disableBiometric,
    enableBiometric,
    setEnablingBiometric,
    enablingBiometric,
    biometricLoading,
    getBiometricLabel,
}: SecurityTabProps) {
    return (
        <motion.div
            key="security"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                {t('Security.title')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}>{t('Security.changePassword')}</h3>
                <InputField
                    label={t('Security.form.current')}
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    value={passwords.current}
                    onChange={(v) => setPasswords({ ...passwords, current: v })}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    suffix={
                        <button
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            {showPassword ?
                                <EyeOff style={{ width: 18, height: 18, color: '#64748b' }} /> :
                                <Eye style={{ width: 18, height: 18, color: '#64748b' }} />
                            }
                        </button>
                    }
                />
                <InputField
                    label={t('Security.form.new')}
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    value={passwords.new}
                    onChange={(v) => setPasswords({ ...passwords, new: v })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                />
                <InputField
                    label={t('Security.form.confirm')}
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    value={passwords.confirm}
                    onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                />
            </div>
            <SaveButton
                saving={saving}
                saved={saved}
                onClick={handleChangePassword}
                label={t('Security.update')}
                messages={{ save: t('Profile.save'), saving: t('Profile.saving'), saved: t('Profile.saved') }}
            />

            {/* Biometric Authentication - Only show on mobile */}
            {biometricAvailable && (
                <div style={{ marginTop: 32 }}>
                    <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
                        Authentification biométrique
                    </h3>
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 12,
                        padding: 20
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: biometricEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Fingerprint style={{
                                        width: 24,
                                        height: 24,
                                        color: biometricEnabled ? '#10b981' : '#64748b'
                                    }} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'white', marginBottom: 2 }}>
                                        {getBiometricLabel()}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#64748b' }}>
                                        {biometricEnabled
                                            ? 'Activé - Déverrouillage rapide'
                                            : 'Désactivé - Activer pour plus de sécurité'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (biometricEnabled) {
                                        disableBiometric()
                                    } else {
                                        setEnablingBiometric(true)
                                        await enableBiometric()
                                        setEnablingBiometric(false)
                                    }
                                }}
                                disabled={enablingBiometric || biometricLoading}
                                style={{
                                    width: 52,
                                    height: 28,
                                    borderRadius: 14,
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    background: biometricEnabled
                                        ? 'linear-gradient(135deg, #10b981, #059669)'
                                        : 'rgba(100, 116, 139, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    top: 2,
                                    left: biometricEnabled ? 26 : 2,
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    background: 'white',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    transition: 'left 0.3s ease'
                                }} />
                            </button>
                        </div>
                        {biometricEnabled && (
                            <div style={{
                                marginTop: 16,
                                padding: '12px 16px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <Check style={{ width: 16, height: 16, color: '#10b981' }} />
                                <span style={{ fontSize: 13, color: '#10b981' }}>
                                    L'app sera verrouillée à chaque ouverture
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    )
}
