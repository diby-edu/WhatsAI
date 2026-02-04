'use client'

import { useState, useEffect } from 'react'
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
    Trash2
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Profile {
    id: string
    email: string
    full_name: string
    phone: string
    company: string
    currency?: string
}

interface NotificationSettings {
    email_new_conversation: boolean
    email_daily_summary: boolean
    email_low_credits: boolean
    email_new_order: boolean
    email_agent_status_change: boolean
    push_enabled: boolean
}

export default function SettingsPage() {
    const t = useTranslations('Settings')

    // Note: The tabs configuration depends on translations, so it's defined inside the component or using a memo
    const tabs = [
        { id: 'profile', label: t('tabs.profile'), icon: User },
        { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
        { id: 'security', label: t('tabs.security'), icon: Shield },
        { id: 'danger', label: t('tabs.danger'), icon: AlertTriangle }
    ]

    const [activeTab, setActiveTab] = useState('profile')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

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
        email_new_conversation: true,
        email_daily_summary: true,
        email_low_credits: true,
        email_new_order: true,
        email_agent_status_change: true,
        push_enabled: false
    })

    // Password state
    const [passwords, setPasswords] = useState({
        current: '',
        new: '',
        confirm: ''
    })

    useEffect(() => {
        fetchProfile()
    }, [])

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
            }
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNotifications = async () => {
        setSaving(true)
        // Simulate save - implement actual API later
        setTimeout(() => {
            setSaving(false)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        }, 500)
    }

    const handleChangePassword = async () => {
        if (passwords.new !== passwords.confirm) {
            alert(t('Security.errorMatch'))
            return
        }
        setSaving(true)
        // Implement password change API
        setTimeout(() => {
            setSaving(false)
            setSaved(true)
            setPasswords({ current: '', new: '', confirm: '' })
            setTimeout(() => setSaved(false), 3000)
        }, 500)
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <ToggleOption
                                        label={t('Notifications.newConversation.label')}
                                        description={t('Notifications.newConversation.description')}
                                        checked={notifications.email_new_conversation}
                                        onChange={(v) => setNotifications({ ...notifications, email_new_conversation: v })}
                                    />
                                    <ToggleOption
                                        label={t('Notifications.dailySummary.label')}
                                        description={t('Notifications.dailySummary.description')}
                                        checked={notifications.email_daily_summary}
                                        onChange={(v) => setNotifications({ ...notifications, email_daily_summary: v })}
                                    />
                                    <ToggleOption
                                        label={t('Notifications.lowCredits.label')}
                                        description={t('Notifications.lowCredits.description')}
                                        checked={notifications.email_low_credits}
                                        onChange={(v) => setNotifications({ ...notifications, email_low_credits: v })}
                                    />
                                    <ToggleOption
                                        label={t('Notifications.newOrder.label')}
                                        description={t('Notifications.newOrder.description')}
                                        checked={notifications.email_new_order}
                                        onChange={(v) => setNotifications({ ...notifications, email_new_order: v })}
                                    />
                                    <ToggleOption
                                        label={t('Notifications.agentStatus.label')}
                                        description={t('Notifications.agentStatus.description')}
                                        checked={notifications.email_agent_status_change}
                                        onChange={(v) => setNotifications({ ...notifications, email_agent_status_change: v })}
                                    />
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
                                    />
                                    <InputField
                                        label={t('Security.form.confirm')}
                                        icon={Lock}
                                        type={showPassword ? 'text' : 'password'}
                                        value={passwords.confirm}
                                        onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <SaveButton
                                    saving={saving}
                                    saved={saved}
                                    onClick={handleChangePassword}
                                    label={t('Security.update')}
                                    messages={{ save: t('Profile.save'), saving: t('Profile.saving'), saved: t('Profile.saved') }}
                                />
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

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
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
    suffix
}: {
    label: string
    icon: any
    value: string
    onChange?: (value: string) => void
    placeholder?: string
    disabled?: boolean
    type?: string
    suffix?: React.ReactNode
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
