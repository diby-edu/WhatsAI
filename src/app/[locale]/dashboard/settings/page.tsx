'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { motion, AnimatePresence } from 'framer-motion'
import {
    User,
    Bell,
    Shield,
    AlertTriangle,
    Save,
    Loader2,
    Check,
    Mail,
    Phone,
    Building,
    Lock,
    Eye,
    EyeOff,
    Trash2,
    Smartphone,
    Camera,
    Fingerprint,
    Gift,
    Copy,
    Star
} from 'lucide-react'
import { useBiometricAuth } from '@/hooks/useBiometricAuth'
import { useTranslations } from 'next-intl'
import { useCurrency } from '@/contexts/CurrencyContext'

interface Profile {
    id: string
    email: string
    full_name: string
    phone: string
    company: string
    currency?: string
    avatar_url?: string
}

interface NotificationSettings {
    // Email - Existing
    email_new_conversation: boolean
    email_daily_summary: boolean
    email_low_credits: boolean
    email_new_order: boolean
    email_agent_status_change: boolean
    // Email - Extended
    email_order_cancelled: boolean
    email_escalation: boolean
    email_credits_depleted: boolean
    email_subscription_expiring: boolean
    email_stock_out: boolean
    email_payment_received: boolean
    // Push - Existing
    push_enabled: boolean
    push_new_conversation: boolean
    push_new_order: boolean
    push_low_credits: boolean
    push_agent_status_change: boolean
    // Push - Extended
    push_order_cancelled: boolean
    push_escalation: boolean
    push_credits_depleted: boolean
    push_subscription_expiring: boolean
    push_stock_out: boolean
    push_payment_received: boolean
    push_new_booking: boolean
    // Leads
    push_new_lead: boolean
    email_new_lead: boolean
}

export default function SettingsPage() {
    const t = useTranslations('Settings')
    const { setCurrency } = useCurrency()

    // Note: The tabs configuration depends on translations, so it's defined inside the component or using a memo
    const tabs = [
        { id: 'profile', label: t('tabs.profile'), icon: User },
        { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
        { id: 'security', label: t('tabs.security'), icon: Shield },
        { id: 'referral', label: 'Parrainage', icon: Gift },
        { id: 'danger', label: t('tabs.danger'), icon: AlertTriangle }
    ]

    const [activeTab, setActiveTab] = useState('profile')
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
            }
        } catch (err) {
            console.error('Error:', err)
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
            }
        } catch (err) {
            console.error('Error saving notification preferences:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) {
            alert(t('Security.errorMatch'))
            return
        }
        if (passwords.new.length < 6) {
            alert('Le mot de passe doit contenir au moins 6 caractères')
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
                alert(error.message || 'Erreur lors du changement de mot de passe')
            } else {
                setSaved(true)
                setPasswords({ current: '', new: '', confirm: '' })
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (err) {
            console.error('Password change error:', err)
            alert('Erreur inattendue')
        } finally {
            setSaving(false)
        }
    }

    const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 10 * 1024 * 1024) {
            alert('Image trop volumineuse. Maximum 10MB')
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
        image.src = imageSrc
        await new Promise<void>((resolve) => { image.onload = () => resolve() })
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
                alert('Erreur lors de l\'upload')
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
            alert('Erreur inattendue')
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
                                            background: profile.avatar_url
                                                ? `url(${profile.avatar_url})`
                                                : 'linear-gradient(135deg, #10b981, #059669)',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: 28,
                                            fontWeight: 600,
                                            border: '3px solid rgba(16, 185, 129, 0.3)'
                                        }}>
                                            {!profile.avatar_url && profile.full_name?.charAt(0)?.toUpperCase()}
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
                                        onChange={(v) => setProfile({ ...profile, phone: v })}
                                        placeholder="+225 XX XX XX XX"
                                    />
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
                        )}

                        {/* Notifications Tab */}
                        {activeTab === 'notifications' && (
                            <motion.div
                                key="notifications"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                                    {t('Notifications.title')}
                                </h2>

                                {/* Email Notifications Section */}
                                <div style={{ marginBottom: 32 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <Mail style={{ width: 20, height: 20, color: '#3b82f6' }} />
                                        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                                            {t('Notifications.emailSection') || 'Notifications Email'}
                                        </h3>
                                    </div>

                                    {/* Commandes */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Commandes</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.newOrder.label')}
                                            description={t('Notifications.newOrder.description')}
                                            checked={notifications.email_new_order}
                                            onChange={(v) => setNotifications({ ...notifications, email_new_order: v })}
                                        />
                                        <ToggleOption
                                            label={t('Notifications.orderCancelled.label') || 'Commande annulée'}
                                            description={t('Notifications.orderCancelled.description') || 'Notification quand une commande est annulée'}
                                            checked={notifications.email_order_cancelled}
                                            onChange={(v) => setNotifications({ ...notifications, email_order_cancelled: v })}
                                        />
                                        <ToggleOption
                                            label={'Paiement reçu'}
                                            description={'Email quand un client paie une commande'}
                                            checked={notifications.email_payment_received}
                                            onChange={(v) => setNotifications({ ...notifications, email_payment_received: v })}
                                        />
                                    </div>

                                    {/* Conversations */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Conversations</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.newConversation.label')}
                                            description={t('Notifications.newConversation.description')}
                                            checked={notifications.email_new_conversation}
                                            onChange={(v) => setNotifications({ ...notifications, email_new_conversation: v })}
                                        />
                                        <ToggleOption
                                            label={t('Notifications.escalation.label') || 'Escalade demandée'}
                                            description={t('Notifications.escalation.description') || 'Le client veut parler à un humain'}
                                            checked={notifications.email_escalation}
                                            onChange={(v) => setNotifications({ ...notifications, email_escalation: v })}
                                        />
                                    </div>

                                    {/* Agent */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Agent IA</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.agentStatus.label')}
                                            description={t('Notifications.agentStatus.description')}
                                            checked={notifications.email_agent_status_change}
                                            onChange={(v) => setNotifications({ ...notifications, email_agent_status_change: v })}
                                        />
                                    </div>

                                    {/* Crédits & Facturation */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Crédits & Facturation</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.lowCredits.label')}
                                            description={t('Notifications.lowCredits.description')}
                                            checked={notifications.email_low_credits}
                                            onChange={(v) => setNotifications({ ...notifications, email_low_credits: v })}
                                        />
                                        <ToggleOption
                                            label={t('Notifications.creditsDepleted.label') || 'Crédits épuisés'}
                                            description={t('Notifications.creditsDepleted.description') || 'Alerte quand vos crédits atteignent zéro'}
                                            checked={notifications.email_credits_depleted}
                                            onChange={(v) => setNotifications({ ...notifications, email_credits_depleted: v })}
                                        />
                                        <ToggleOption
                                            label={t('Notifications.subscriptionExpiring.label') || 'Abonnement expire bientôt'}
                                            description={t('Notifications.subscriptionExpiring.description') || 'Rappel 7 jours avant expiration'}
                                            checked={notifications.email_subscription_expiring}
                                            onChange={(v) => setNotifications({ ...notifications, email_subscription_expiring: v })}
                                        />
                                    </div>

                                    {/* Produits */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Produits</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.stockOut.label') || 'Stock épuisé'}
                                            description={t('Notifications.stockOut.description') || 'Alerte quand un produit est en rupture'}
                                            checked={notifications.email_stock_out}
                                            onChange={(v) => setNotifications({ ...notifications, email_stock_out: v })}
                                        />
                                    </div>

                                    {/* Leads */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Leads</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={'Nouveau lead qualifié'}
                                            description={'Email quand un prospect est capturé par votre agent WhatsApp'}
                                            checked={notifications.email_new_lead}
                                            onChange={(v) => setNotifications({ ...notifications, email_new_lead: v })}
                                        />
                                    </div>

                                    {/* Rapports */}
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, marginTop: 16 }}>Rapports</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.dailySummary.label')}
                                            description={t('Notifications.dailySummary.description')}
                                            checked={notifications.email_daily_summary}
                                            onChange={(v) => setNotifications({ ...notifications, email_daily_summary: v })}
                                        />
                                    </div>
                                </div>

                                {/* Push Notifications Section */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                        <Smartphone style={{ width: 20, height: 20, color: '#10b981' }} />
                                        <h3 style={{ color: '#94a3b8', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                                            {t('Notifications.pushSection') || 'Notifications Push (Mobile)'}
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <ToggleOption
                                            label={t('Notifications.pushEnabled.label') || 'Activer les notifications push'}
                                            description={t('Notifications.pushEnabled.description') || 'Recevoir des notifications sur votre téléphone'}
                                            checked={notifications.push_enabled}
                                            onChange={(v) => setNotifications({ ...notifications, push_enabled: v })}
                                        />
                                        {notifications.push_enabled && (
                                            <>
                                                {/* Commandes */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Commandes</p>
                                                <ToggleOption
                                                    label={t('Notifications.pushNewOrder.label') || 'Nouvelle commande'}
                                                    description={t('Notifications.pushNewOrder.description') || 'Notification quand une commande est passée'}
                                                    checked={notifications.push_new_order}
                                                    onChange={(v) => setNotifications({ ...notifications, push_new_order: v })}
                                                />
                                                <ToggleOption
                                                    label={t('Notifications.pushOrderCancelled.label') || 'Commande annulée'}
                                                    description={t('Notifications.pushOrderCancelled.description') || 'Notification quand une commande est annulée'}
                                                    checked={notifications.push_order_cancelled}
                                                    onChange={(v) => setNotifications({ ...notifications, push_order_cancelled: v })}
                                                />
                                                <ToggleOption
                                                    label={'Paiement reçu'}
                                                    description={'Notification quand un client paie une commande'}
                                                    checked={notifications.push_payment_received}
                                                    onChange={(v) => setNotifications({ ...notifications, push_payment_received: v })}
                                                />

                                                {/* Conversations */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Conversations</p>
                                                <ToggleOption
                                                    label={t('Notifications.pushNewConversation.label') || 'Nouvelle conversation'}
                                                    description={t('Notifications.pushNewConversation.description') || 'Notification quand un nouveau client vous contacte'}
                                                    checked={notifications.push_new_conversation}
                                                    onChange={(v) => setNotifications({ ...notifications, push_new_conversation: v })}
                                                />
                                                <ToggleOption
                                                    label={t('Notifications.pushEscalation.label') || 'Escalade demandée'}
                                                    description={t('Notifications.pushEscalation.description') || 'Le client veut parler à un humain'}
                                                    checked={notifications.push_escalation}
                                                    onChange={(v) => setNotifications({ ...notifications, push_escalation: v })}
                                                />

                                                {/* Agent */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Agent IA</p>
                                                <ToggleOption
                                                    label={t('Notifications.pushAgentStatus.label') || "Statut de l'agent"}
                                                    description={t('Notifications.pushAgentStatus.description') || "Notification quand votre agent change de statut"}
                                                    checked={notifications.push_agent_status_change}
                                                    onChange={(v) => setNotifications({ ...notifications, push_agent_status_change: v })}
                                                />

                                                {/* Crédits */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Crédits</p>
                                                <ToggleOption
                                                    label={t('Notifications.pushLowCredits.label') || 'Crédits faibles'}
                                                    description={t('Notifications.pushLowCredits.description') || 'Alerte quand vos crédits sont bas'}
                                                    checked={notifications.push_low_credits}
                                                    onChange={(v) => setNotifications({ ...notifications, push_low_credits: v })}
                                                />
                                                <ToggleOption
                                                    label={t('Notifications.pushCreditsDepleted.label') || 'Crédits épuisés'}
                                                    description={t('Notifications.pushCreditsDepleted.description') || 'Alerte critique quand crédits = 0'}
                                                    checked={notifications.push_credits_depleted}
                                                    onChange={(v) => setNotifications({ ...notifications, push_credits_depleted: v })}
                                                />
                                                <ToggleOption
                                                    label={t('Notifications.pushSubscriptionExpiring.label') || 'Abonnement expire'}
                                                    description={t('Notifications.pushSubscriptionExpiring.description') || 'Rappel avant expiration'}
                                                    checked={notifications.push_subscription_expiring}
                                                    onChange={(v) => setNotifications({ ...notifications, push_subscription_expiring: v })}
                                                />

                                                {/* Produits */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Produits</p>
                                                <ToggleOption
                                                    label={t('Notifications.pushStockOut.label') || 'Stock épuisé'}
                                                    description={t('Notifications.pushStockOut.description') || 'Alerte rupture de stock'}
                                                    checked={notifications.push_stock_out}
                                                    onChange={(v) => setNotifications({ ...notifications, push_stock_out: v })}
                                                />

                                                {/* Réservations */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Réservations</p>
                                                <ToggleOption
                                                    label={'Nouvelle réservation'}
                                                    description={'Notification quand un client réserve un service'}
                                                    checked={notifications.push_new_booking}
                                                    onChange={(v) => setNotifications({ ...notifications, push_new_booking: v })}
                                                />

                                                {/* Leads */}
                                                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4, marginTop: 12 }}>Leads</p>
                                                <ToggleOption
                                                    label={'Nouveau lead qualifié'}
                                                    description={'Notification push quand un prospect est capturé par votre agent'}
                                                    checked={notifications.push_new_lead}
                                                    onChange={(v) => setNotifications({ ...notifications, push_new_lead: v })}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <SaveButton
                                    saving={saving}
                                    saved={saved}
                                    onClick={handleSaveNotifications}
                                    messages={{ save: t('Profile.save'), saving: t('Profile.saving'), saved: t('Profile.saved') }}
                                />
                            </motion.div>
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
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
                        )}

                        {/* Referral Tab */}
                        {activeTab === 'referral' && (
                            <motion.div
                                key="referral"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div>
                                    <h2 className="text-xl font-semibold text-white mb-1">Parrainage</h2>
                                    <p className="text-gray-400 text-sm">Invitez vos amis et gagnez des crédits ensemble.</p>
                                </div>

                                {referralLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
                                    </div>
                                ) : referralData ? (
                                    <div className="space-y-4">
                                        {/* Bonus info */}
                                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <Gift className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-green-300 font-medium text-sm">+10 crédits pour vous et votre filleul</p>
                                                    <p className="text-gray-400 text-xs mt-0.5">Les crédits sont offerts après le premier paiement validé de votre filleul.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Referral link */}
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                            <p className="text-gray-400 text-sm font-medium">Votre lien de parrainage</p>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono truncate">
                                                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/fr/register?ref=${referralData.referral_code}`}
                                                </div>
                                                <button
                                                    onClick={handleCopyReferralLink}
                                                    className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-sm transition-colors flex-shrink-0"
                                                >
                                                    {copiedRef ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    {copiedRef ? 'Copié' : 'Copier'}
                                                </button>
                                            </div>
                                            <p className="text-gray-500 text-xs">Code : <span className="text-gray-300 font-mono font-semibold">{referralData.referral_code}</span></p>
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-white">{referralData.total_referrals}</p>
                                                <p className="text-gray-400 text-xs mt-1">Filleuls invités</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                                <p className="text-2xl font-bold text-green-400">{referralData.confirmed}</p>
                                                <p className="text-gray-400 text-xs mt-1">Confirmés</p>
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Star className="w-4 h-4 text-yellow-400" />
                                                    <p className="text-2xl font-bold text-yellow-400">{referralData.credits_earned}</p>
                                                </div>
                                                <p className="text-gray-400 text-xs mt-1">Crédits gagnés</p>
                                            </div>
                                        </div>

                                        {referralData.pending > 0 && (
                                            <p className="text-gray-500 text-xs text-center">
                                                {referralData.pending} parrainage{referralData.pending > 1 ? 's' : ''} en attente de premier paiement
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500 text-sm">
                                        Impossible de charger les données de parrainage.
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Danger Zone Tab */}
                        {activeTab === 'danger' && (
                            <motion.div
                                key="danger"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#f87171', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <AlertTriangle style={{ width: 24, height: 24 }} />
                                    {t('Danger.title')}
                                </h2>
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: 12,
                                    padding: 24
                                }}>
                                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{t('Danger.deleteAccount.title')}</h3>
                                    <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
                                        {t('Danger.deleteAccount.description')}
                                    </p>
                                    <button
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '12px 20px',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            borderRadius: 10,
                                            color: '#f87171',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onClick={() => {
                                            if (confirm(t('Danger.deleteAccount.confirm'))) {
                                                // Implement delete account
                                                alert(t('Danger.deleteAccount.support'))
                                            }
                                        }}
                                    >
                                        <Trash2 style={{ width: 18, height: 18 }} />
                                        {t('Danger.deleteAccount.button')}
                                    </button>
                                </div>
                            </motion.div>
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
                        <div style={{ position: 'relative', width: '100%', height: 320, background: '#0f172a', borderRadius: 12, overflow: 'hidden' }}>
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

// Input Field Component
function InputField({
    label,
    icon: Icon,
    value,
    onChange,
    placeholder,
    disabled,
    type = 'text',
    suffix,
    autoComplete
}: {
    label: string
    icon: any
    value: string
    onChange?: (value: string) => void
    placeholder?: string
    disabled?: boolean
    type?: string
    suffix?: React.ReactNode
    autoComplete?: string
}) {
    return (
        <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <Icon style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                <input
                    type={type}
                    value={value || ''}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    style={{
                        width: '100%',
                        padding: '12px 12px 12px 44px',
                        paddingRight: suffix ? 44 : 12,
                        background: disabled ? 'rgba(51, 65, 85, 0.3)' : 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        borderRadius: 10,
                        color: disabled ? '#64748b' : 'white',
                        fontSize: 14,
                        cursor: disabled ? 'not-allowed' : 'text'
                    }}
                />
                {suffix && (
                    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                        {suffix}
                    </div>
                )}
            </div>
        </div>
    )
}

// Toggle Option Component
function ToggleOption({
    label,
    description,
    checked,
    onChange
}: {
    label: string
    description: string
    checked: boolean
    onChange: (value: boolean) => void
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            borderRadius: 12
        }}>
            <div>
                <h4 style={{ color: 'white', fontWeight: 500, marginBottom: 4 }}>{label}</h4>
                <p style={{ color: '#64748b', fontSize: 13 }}>{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    width: 52,
                    height: 28,
                    borderRadius: 14,
                    border: 'none',
                    background: checked ? '#10b981' : 'rgba(100, 116, 139, 0.3)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s'
                }}
            >
                <motion.div
                    animate={{ x: checked ? 24 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: 2
                    }}
                />
            </button>
        </div>
    )
}

// Save Button Component
function SaveButton({
    saving,
    saved,
    onClick,
    label,
    messages
}: {
    saving: boolean
    saved: boolean
    onClick: () => void
    label?: string
    messages: {
        save: string,
        saving: string,
        saved: string
    }
}) {
    return (
        <button
            onClick={onClick}
            disabled={saving}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 28,
                padding: '14px 28px',
                background: saved
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: 12,
                color: 'white',
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                transition: 'all 0.2s'
            }}
        >
            {saving ? (
                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
            ) : saved ? (
                <Check style={{ width: 18, height: 18 }} />
            ) : (
                <Save style={{ width: 18, height: 18 }} />
            )}
            {saving ? messages.saving : saved ? messages.saved : label || messages.save}
        </button>
    )
}
