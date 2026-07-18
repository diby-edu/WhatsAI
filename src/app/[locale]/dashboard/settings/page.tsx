'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User,
    Bell,
    Shield,
    AlertTriangle,
    Loader2,
    Gift
} from 'lucide-react'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'
import { useTranslations } from 'next-intl'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useToast } from '@/components/ui/Toast'
import { ProfileTab } from './components/ProfileTab'
import { NotificationsTab } from './components/NotificationsTab'
import { SecurityTab } from './components/SecurityTab'
import { ReferralTab } from './components/ReferralTab'
import { DangerTab } from './components/DangerTab'
import type { Profile, NotificationSettings } from './types'

export default function SettingsPage() {
    const t = useTranslations('Settings')
    const { setCurrency } = useCurrency()
    const toast = useToast()
    const searchParams = useSearchParams()

    // Note: The tabs configuration depends on translations, so it's defined inside the component or using a memo
    const tabs = [
        { id: 'profile', label: t('tabs.profile'), icon: User },
        { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
        { id: 'security', label: t('tabs.security'), icon: Shield },
        { id: 'referral', label: 'Parrainage', icon: Gift },
        { id: 'danger', label: t('tabs.danger'), icon: AlertTriangle }
    ]

    const validTabs = tabs.map(t => t.id)
    const tabFromUrl = searchParams.get('tab') ?? ''
    const [activeTab, setActiveTab] = useState(validTabs.includes(tabFromUrl) ? tabFromUrl : 'profile')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const avatarInputRef = useRef<HTMLInputElement>(null)

    // Biometric authentication
    const {
        isAvailable: biometricAvailable,
        isEnabled: biometricEnabled,
        biometricType,
        enableBiometric,
        disableBiometric,
        getBiometricLabel,
        loading: biometricLoading
    } = useBiometricAuth()
    const [enablingBiometric, setEnablingBiometric] = useState(false)

    // Profile state
    const [profile, setProfile] = useState<Profile>({
        id: '',
        email: '',
        full_name: '',
        phone: '',
        company: ''
    })

    // Notification state
    const [notifications, setNotifications] = useState<NotificationSettings>({
        // Email - Existing
        email_new_conversation: true,
        email_daily_summary: true,
        email_low_credits: true,
        email_new_order: true,
        email_agent_status_change: true,
        // Email - Extended
        email_order_cancelled: true,
        email_escalation: true,
        email_credits_depleted: true,
        email_subscription_expiring: true,
        email_stock_out: true,
        email_payment_received: true,
        // Push - Existing
        push_enabled: true,
        push_new_conversation: true,
        push_new_order: true,
        push_low_credits: true,
        push_agent_status_change: true,
        // Push - Extended
        push_order_cancelled: true,
        push_escalation: true,
        push_credits_depleted: true,
        push_subscription_expiring: true,
        push_stock_out: true,
        push_payment_received: true,
        push_new_booking: true,
        // Leads
        push_new_lead: true,
        email_new_lead: true,
    })

    // Password state
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    })

    // Crop state
    const [cropModalOpen, setCropModalOpen] = useState(false)
    const [rawImageSrc, setRawImageSrc] = useState<string>('')
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

    // OTP phone verification (settings)
    const [otpStep, setOtpStep] = useState<'idle' | 'sending' | 'verify'>('idle')
    const [otpCode, setOtpCode] = useState('')
    const [otpCountdown, setOtpCountdown] = useState(0)
    const [otpError, setOtpError] = useState<string | null>(null)
    const [otpVerifying, setOtpVerifying] = useState(false)

    const handleSendPhoneOtp = async () => {
        setOtpError(null)
        setOtpStep('sending')
        try {
            const res = await fetch('/api/phone-verify/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: profile.phone }),
            })
            const data = await res.json()
            if (!res.ok) { setOtpError(data.error || 'Erreur envoi'); setOtpStep('idle'); return }
            // Mode bypass : vérification automatique
            if (data.data?.bypass) {
                const confirmRes = await fetch('/api/phone-verify/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: profile.phone, code: 'BYPASS' }),
                })
                if (confirmRes.ok) {
                    setProfile(p => ({ ...p, phone_verified: true }))
                    setOtpStep('idle')
                    return
                }
            }
            setOtpStep('verify')
            setOtpCountdown(180)
        } catch { setOtpError('Erreur réseau'); setOtpStep('idle') }
    }

    const handleConfirmPhoneOtp = async () => {
        if (!otpCode.trim() || otpVerifying) return
        setOtpVerifying(true)
        setOtpError(null)
        try {
            const res = await fetch('/api/phone-verify/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: profile.phone, code: otpCode }),
            })
            const data = await res.json()
            if (!res.ok) { setOtpError(data.error || 'Code incorrect'); setOtpVerifying(false); return }
            setProfile(p => ({ ...p, phone_verified: true }))
            setOtpStep('idle')
            setOtpCode('')
        } catch { setOtpError('Erreur réseau') }
        setOtpVerifying(false)
    }

    useEffect(() => {
        if (otpCountdown <= 0) return
        const t = setTimeout(() => setOtpCountdown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [otpCountdown])

    // Referral state
    const [referralData, setReferralData] = useState<{
        referral_code: string | null
        total_referrals: number
        confirmed: number
        pending: number
        credits_earned: number
    } | null>(null)
    const [referralLoading, setReferralLoading] = useState(false)
    const [copiedRef, setCopiedRef] = useState(false)

    useEffect(() => {
        fetchProfile()
        fetchNotificationPreferences()
    }, [])

    useEffect(() => {
        if (activeTab === 'referral' && !referralData && !referralLoading) {
            fetchReferralData()
        }
    }, [activeTab])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            if (data.data?.profile) {
                setProfile(data.data.profile)
            }
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchNotificationPreferences = async () => {
        try {
            const res = await fetch('/api/notification-preferences')
            const data = await res.json()
            if (data.data?.preferences) {
                setNotifications(data.data.preferences)
            }
        } catch (err) {
            console.error('Error fetching notification preferences:', err)
        }
    }

    const fetchReferralData = async () => {
        setReferralLoading(true)
        try {
            const res = await fetch('/api/referral/apply')
            const data = await res.json()
            if (data.data) {
                setReferralData(data.data)
            }
        } catch (err) {
            console.error('Error fetching referral data:', err)
        } finally {
            setReferralLoading(false)
        }
    }

    const handleCopyReferralLink = () => {
        if (!referralData?.referral_code) return
        const link = `${window.location.origin}/fr/register?ref=${referralData.referral_code}`
        navigator.clipboard.writeText(link)
        setCopiedRef(true)
        setTimeout(() => setCopiedRef(false), 2000)
    }

    const handleSaveProfile = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: profile.full_name,
                    phone: profile.phone,
                    company: profile.company,
                    currency: profile.currency || 'USD'
                })
            })
            if (res.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
                // Sync la devise dans le contexte global pour mise à jour immédiate
                if (profile.currency) setCurrency(profile.currency)
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'Erreur lors de la sauvegarde du profil')
            }
        } catch (err) {
            console.error('Error:', err)
            toast.error('Erreur réseau — le profil n\'a pas été sauvegardé')
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNotifications = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/notification-preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notifications)
            })
            if (res.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'Erreur lors de la sauvegarde des notifications')
            }
        } catch (err) {
            console.error('Error saving notification preferences:', err)
            toast.error('Erreur réseau — les préférences n\'ont pas été sauvegardées')
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) {
            toast.error(t('Security.errorMatch'))
            return
        }
        if (passwords.new.length < 6) {
            toast.error('Le mot de passe doit contenir au moins 6 caractères')
            return
        }
        setSaving(true)
        try {
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            const { error } = await supabase.auth.updateUser({
                password: passwords.new
            })
            if (error) {
                toast.error(error.message || 'Erreur lors du changement de mot de passe')
            } else {
                setSaved(true)
                setPasswords({ current: '', new: '', confirm: '' })
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (err) {
            console.error('Password change error:', err)
            toast.error('Erreur inattendue')
        } finally {
            setSaving(false)
        }
    }

    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 10 * 1024 * 1024) {
            toast.error('Image trop volumineuse. Maximum 10MB')
            return
        }
        const reader = new FileReader()
        reader.onload = (event) => {
            setRawImageSrc(event.target?.result as string)
            setCrop({ x: 0, y: 0 })
            setZoom(1)
            setCropModalOpen(true)
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
        const image = new Image()
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = reject
            image.src = imageSrc
        })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        canvas.width = pixelCrop.width
        canvas.height = pixelCrop.height
        ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
        return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9) })
    }

    const handleCropConfirm = async () => {
        if (!croppedAreaPixels) return
        setCropModalOpen(false)
        setUploadingAvatar(true)
        try {
            const croppedBlob = await getCroppedImg(rawImageSrc, croppedAreaPixels)
            const { createClient } = await import('@/lib/supabase/client')
            const supabase = createClient()
            const filePath = `${profile.id}/avatar.jpg`
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' })
            if (uploadError) {
                console.error('Upload error:', uploadError)
                toast.error("Erreur lors de l'upload")
                return
            }
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
            const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar_url: avatarUrl })
            })
            if (res.ok) {
                setProfile(prev => ({ ...prev, avatar_url: avatarUrl }))
            }
        } catch (err) {
            console.error('Avatar upload error:', err)
            toast.error('Erreur inattendue')
        } finally {
            setUploadingAvatar(false)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                <p style={{ color: '#94a3b8' }}>{t('subtitle')}</p>
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {/* Sidebar Tabs */}
                <div className="settings-sidebar" style={{
                    width: 220,
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 12,
                    flexShrink: 0
                }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '14px 16px',
                                background: activeTab === tab.id
                                    ? tab.id === 'danger'
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : 'rgba(16, 185, 129, 0.15)'
                                    : 'transparent',
                                border: 'none',
                                borderRadius: 12,
                                color: activeTab === tab.id
                                    ? tab.id === 'danger' ? '#f87171' : '#34d399'
                                    : '#94a3b8',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                            }}
                        >
                            <tab.icon style={{ width: 20, height: 20 }} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 'clamp(16px, 4vw, 28px)'
                }}>
                    <AnimatePresence mode="wait">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <ProfileTab
                                t={t}
                                profile={profile}
                                setProfile={setProfile}
                                avatarInputRef={avatarInputRef}
                                uploadingAvatar={uploadingAvatar}
                                handleAvatarFileSelect={handleAvatarFileSelect}
                                otpStep={otpStep}
                                setOtpStep={setOtpStep}
                                handleSendPhoneOtp={handleSendPhoneOtp}
                                otpCountdown={otpCountdown}
                                otpCode={otpCode}
                                setOtpCode={setOtpCode}
                                handleConfirmPhoneOtp={handleConfirmPhoneOtp}
                                otpVerifying={otpVerifying}
                                otpError={otpError}
                                saving={saving}
                                saved={saved}
                                handleSaveProfile={handleSaveProfile}
                            />
                        )}

                        {/* Notifications Tab */}
                        {activeTab === 'notifications' && (
                            <NotificationsTab
                                t={t}
                                notifications={notifications}
                                setNotifications={setNotifications}
                                saving={saving}
                                saved={saved}
                                handleSaveNotifications={handleSaveNotifications}
                            />
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <SecurityTab
                                t={t}
                                showPassword={showPassword}
                                setShowPassword={setShowPassword}
                                passwords={passwords}
                                setPasswords={setPasswords}
                                saving={saving}
                                saved={saved}
                                handleChangePassword={handleChangePassword}
                                biometricAvailable={biometricAvailable}
                                biometricEnabled={biometricEnabled}
                                disableBiometric={disableBiometric}
                                enableBiometric={enableBiometric}
                                setEnablingBiometric={setEnablingBiometric}
                                enablingBiometric={enablingBiometric}
                                biometricLoading={biometricLoading}
                                getBiometricLabel={getBiometricLabel}
                            />
                        )}

                        {/* Referral Tab */}
                        {activeTab === 'referral' && (
                            <ReferralTab
                                referralLoading={referralLoading}
                                referralData={referralData}
                                handleCopyReferralLink={handleCopyReferralLink}
                                copiedRef={copiedRef}
                            />
                        )}

                        {/* Danger Zone Tab */}
                        {activeTab === 'danger' && (
                            <DangerTab t={t} toast={toast} />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Crop Modal */}
            {cropModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: 24
                }}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        borderRadius: 20,
                        padding: 24,
                        width: '100%',
                        maxWidth: 480,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20
                    }}>
                        <h3 style={{ color: 'white', fontWeight: 600, fontSize: 18, margin: 0 }}>
                            Recadrer la photo
                        </h3>
                        <div style={{ position: 'relative', width: '100%', height: 320, background: '#0f172a', borderRadius: 12 }}>
                            <Cropper
                                image={rawImageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ color: '#94a3b8', fontSize: 13, flexShrink: 0 }}>Zoom</span>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                style={{ flex: 1, accentColor: '#10b981' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setCropModalOpen(false)}
                                style={{
                                    flex: 1, padding: '12px',
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.2)',
                                    borderRadius: 10, color: '#94a3b8',
                                    cursor: 'pointer', fontSize: 14
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCropConfirm}
                                style={{
                                    flex: 1, padding: '12px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    border: 'none', borderRadius: 10,
                                    color: 'white', cursor: 'pointer',
                                    fontSize: 14, fontWeight: 600
                                }}
                            >
                                Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
