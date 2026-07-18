import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { User, Mail, Phone, Building, Camera, Check, Loader2 } from 'lucide-react'
import { InputField, SaveButton } from './fields'
import type { Profile } from '../types'

interface ProfileTabProps {
    t: ReturnType<typeof useTranslations>
    profile: Profile
    setProfile: Dispatch<SetStateAction<Profile>>
    avatarInputRef: RefObject<HTMLInputElement | null>
    uploadingAvatar: boolean
    handleAvatarFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
    otpStep: 'idle' | 'sending' | 'verify'
    setOtpStep: Dispatch<SetStateAction<'idle' | 'sending' | 'verify'>>
    handleSendPhoneOtp: () => void
    otpCountdown: number
    otpCode: string
    setOtpCode: Dispatch<SetStateAction<string>>
    handleConfirmPhoneOtp: () => void
    otpVerifying: boolean
    otpError: string | null
    saving: boolean
    saved: boolean
    handleSaveProfile: () => void
}

export function ProfileTab({
    t,
    profile,
    setProfile,
    avatarInputRef,
    uploadingAvatar,
    handleAvatarFileSelect,
    otpStep,
    setOtpStep,
    handleSendPhoneOtp,
    otpCountdown,
    otpCode,
    setOtpCode,
    handleConfirmPhoneOtp,
    otpVerifying,
    otpError,
    saving,
    saved,
    handleSaveProfile,
}: ProfileTabProps) {
    return (
        <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                {t('Profile.title')}
            </h2>

            {/* Avatar Upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                <div
                    onClick={() => avatarInputRef.current?.click()}
                    style={{
                        position: 'relative',
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        cursor: 'pointer',
                        flexShrink: 0
                    }}
                >
                    <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: profile.avatar_url ? 'transparent' : 'linear-gradient(135deg, #10b981, #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 28,
                        fontWeight: 600,
                        border: '3px solid rgba(16, 185, 129, 0.3)',
                        flexShrink: 0
                    }}>
                        {profile.avatar_url
                            ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : profile.full_name?.charAt(0)?.toUpperCase()
                        }
                    </div>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s'
                    }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                        <Camera style={{ width: 22, height: 22, color: 'white' }} />
                    </div>
                </div>
                <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    hidden
                    onChange={handleAvatarFileSelect}
                />
                <div>
                    <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: 10,
                            color: 'white',
                            cursor: uploadingAvatar ? 'wait' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {uploadingAvatar ? (
                            <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <Camera style={{ width: 18, height: 18 }} />
                        )}
                        {uploadingAvatar ? 'Upload...' : 'Changer photo'}
                    </button>
                    <p style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>JPG, PNG. Max 2MB</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                <InputField
                    label={t('Profile.form.fullName')}
                    icon={User}
                    value={profile.full_name}
                    onChange={(v) => setProfile({ ...profile, full_name: v })}
                    placeholder="Votre nom"
                />
                <InputField
                    label={t('Profile.form.email')}
                    icon={Mail}
                    value={profile.email}
                    disabled
                    placeholder="email@exemple.com"
                />
                <InputField
                    label={t('Profile.form.phone')}
                    icon={Phone}
                    value={profile.phone}
                    onChange={(v) => { setProfile({ ...profile, phone: v }); setOtpStep('idle') }}
                    placeholder="+225 XX XX XX XX"
                />
                {/* Vérification WhatsApp */}
                {profile.phone_verified ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#34d399' }}>
                        <Check size={14} /> Numéro WhatsApp vérifié
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, color: '#f59e0b' }}>Numéro non vérifié</span>
                            {otpStep === 'idle' && (
                                <button
                                    onClick={handleSendPhoneOtp}
                                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: 'none', background: 'rgba(16,185,129,0.15)', color: '#34d399', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Vérifier via WhatsApp
                                </button>
                            )}
                            {otpStep === 'sending' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />}
                        </div>
                        {otpStep === 'verify' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                    Code envoyé au <strong style={{ color: 'white' }}>{profile.phone}</strong>
                                    {otpCountdown > 0 && <span> — expire dans {Math.floor(otpCountdown/60)}:{String(otpCountdown%60).padStart(2,'0')}</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Code à 6 chiffres"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.3)', color: 'white', fontSize: 14, letterSpacing: 4 }}
                                    />
                                    <button
                                        onClick={handleConfirmPhoneOtp}
                                        disabled={otpCode.length < 6 || otpVerifying}
                                        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: otpCode.length === 6 ? '#10b981' : 'rgba(100,116,139,0.2)', color: 'white', fontWeight: 600, fontSize: 13, cursor: otpCode.length === 6 ? 'pointer' : 'not-allowed' }}
                                    >
                                        {otpVerifying ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Valider'}
                                    </button>
                                </div>
                                {otpCountdown === 0 && (
                                    <button onClick={handleSendPhoneOtp} style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                                        Renvoyer le code
                                    </button>
                                )}
                            </div>
                        )}
                        {otpError && <div style={{ fontSize: 12, color: '#f87171' }}>{otpError}</div>}
                    </div>
                )}
                <InputField
                    label={t('Profile.form.company')}
                    icon={Building}
                    value={profile.company}
                    onChange={(v) => setProfile({ ...profile, company: v })}
                    placeholder="Nom de l'entreprise"
                />
                <div style={{}}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>Devise</label>
                    <div style={{ position: 'relative' }}>
                        <Building style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                        <select
                            value={profile.currency || 'USD'}
                            onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 44px',
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 10,
                                color: 'white',
                                fontSize: 14,
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="XOF">FCFA (XOF)</option>
                        </select>
                    </div>
                </div>
            </div>
            <SaveButton
                saving={saving}
                saved={saved}
                onClick={handleSaveProfile}
                messages={{ save: t('Profile.save'), saving: t('Profile.saving'), saved: t('Profile.saved') }}
            />
        </motion.div>
    )
}
