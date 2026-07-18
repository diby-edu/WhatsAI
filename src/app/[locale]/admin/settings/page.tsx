'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Save, Globe, Shield, CreditCard, Mail,
    Database, Key, Server, Bell, Palette, Lock,
    CheckCircle, Loader2, MessageCircle
} from 'lucide-react'
import { ToggleSwitch, SettingRow } from './components/shared'
import { GeneralTab } from './components/GeneralTab'
import { AiTab } from './components/AiTab'
import { PaymentTab } from './components/PaymentTab'
import { EmailTab } from './components/EmailTab'
import { SecurityTab } from './components/SecurityTab'
import { AdvancedTab } from './components/AdvancedTab'
import { OtpTab } from './components/OtpTab'
import { NotificationsTab } from './components/NotificationsTab'
import type { AdminNotificationSettings, PaymentProviderReadiness, AdminSettings } from './types'

type TabId = 'general' | 'ai' | 'payment' | 'email' | 'security' | 'advanced' | 'notifications' | 'otp'

interface Tab {
    id: TabId
    label: string
    icon: any
}

const tabs: Tab[] = [
    { id: 'general', label: 'Général', icon: Globe },
    { id: 'ai', label: 'Intelligence Artificielle', icon: Shield },
    { id: 'payment', label: 'Paiements', icon: CreditCard },
    { id: 'email', label: 'Emails', icon: Mail },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Sécurité', icon: Lock },
    { id: 'advanced', label: 'Avancé', icon: Server },
    { id: 'otp', label: 'WhatsApp OTP', icon: MessageCircle },
]

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('general')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    // LOAD-2 : tant que le fetch initial des params prod n'a pas reussi, `settings`
    // ne contient que des valeurs par defaut codees en dur — Sauvegarder doit
    // rester desactive pour ne pas les ecraser silencieusement.
    const [settingsLoaded, setSettingsLoaded] = useState(false)
    const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null)

    // OTP WhatsApp
    const [otpStatus, setOtpStatus] = useState<'not_configured' | 'connecting' | 'qr_ready' | 'connected' | 'disconnected'>('not_configured')
    const [otpQrCode, setOtpQrCode] = useState<string | null>(null)
    const [otpPhone, setOtpPhone] = useState<string | null>(null)
    const [otpLoading, setOtpLoading] = useState(false)
    const [otpResetPhone, setOtpResetPhone] = useState('')
    const [otpResetLoading, setOtpResetLoading] = useState(false)
    const [otpResetMsg, setOtpResetMsg] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [isCompact, setIsCompact] = useState(false)
    const [providerReadiness, setProviderReadiness] = useState<{
        current: PaymentProviderReadiness
        cinetpay: PaymentProviderReadiness
        paystack: PaymentProviderReadiness
        feexpay: PaymentProviderReadiness
        paydunya: PaymentProviderReadiness
    } | null>(null)

    const [notificationSettings, setNotificationSettings] = useState<AdminNotificationSettings>({
        // Legacy fields
        notif_new_user: true,
        notif_plan_upgrade: true,
        notif_plan_downgrade: true,
        notif_payment_received: true,
        notif_payment_failed: true,
        notif_subscription_cancelled: true,
        notif_agent_created: true,
        notif_agent_connected: true,
        notif_agent_disconnected: true,
        notif_agent_quota_exceeded: true,
        notif_openai_error: true,
        notif_whatsapp_down: true,
        notif_high_error_rate: true,
        notif_new_conversation: false,
        notif_new_order: true,
        notif_escalation: true,
        // Email notifications
        email_new_user: true,
        email_plan_upgrade: true,
        email_plan_downgrade: true,
        email_payment_received: true,
        email_payment_failed: true,
        email_subscription_cancelled: true,
        email_agent_created: false,
        email_agent_connected: false,
        email_agent_disconnected: true,
        email_agent_quota_exceeded: true,
        email_openai_error: true,
        email_whatsapp_down: true,
        email_high_error_rate: true,
        email_new_conversation: false,
        email_new_order: true,
        email_escalation: true,
        // Push notifications (in-app)
        push_new_user: true,
        push_plan_upgrade: true,
        push_plan_downgrade: true,
        push_payment_received: true,
        push_payment_failed: true,
        push_subscription_cancelled: true,
        push_agent_created: true,
        push_agent_connected: true,
        push_agent_disconnected: true,
        push_agent_quota_exceeded: true,
        push_openai_error: true,
        push_whatsapp_down: true,
        push_high_error_rate: true,
        push_new_conversation: false,
        push_new_order: true,
        push_escalation: true
    })

    useEffect(() => {
        fetchNotificationPreferences()
    }, [])

    useEffect(() => {
        const onResize = () => setIsCompact(window.innerWidth < 900)
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const fetchNotificationPreferences = async () => {
        try {
            const res = await fetch('/api/admin/notification-preferences')
            const data = await res.json()
            if (data.data?.preferences) {
                setNotificationSettings(data.data.preferences)
            }
        } catch (err) {
            console.error('Error fetching admin notification preferences:', err)
        }
    }

    const handleSaveNotifications = async () => {
        setSaving(true)
        setSaveError(null)
        try {
            const res = await fetch('/api/admin/notification-preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationSettings)
            })
            if (res.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            } else {
                const data = await res.json().catch(() => ({}))
                setSaveError(data.error || 'Erreur lors de la sauvegarde')
            }
        } catch (err) {
            console.error('Error saving admin notification preferences:', err)
            setSaveError('Erreur réseau — vérifiez votre connexion')
        } finally {
            setSaving(false)
        }
    }

    const [settings, setSettings] = useState<AdminSettings>({
        // General
        appName: 'WazzapAI',
        appDescription: 'Plateforme d\'automatisation WhatsApp avec IA',
        maintenanceMode: false,
        allowRegistrations: true,
        defaultCredits: 10,

        // AI
        openaiModel: 'gpt-4o-mini',
        maxTokensPerMessage: 500,
        temperatureDefault: 0.7,
        maxAgentsFree: 1,
        maxAgentsStarter: 2,
        maxAgentsPro: 5,
        maxAgentsBusiness: 10,

        // Payment
        cinetpayMode: 'sandbox',
        cinetpaySiteId: '********',
        defaultPaymentProvider: 'cinetpay',
        currency: 'XOF',
        defaultCommissionRate: 10,

        // Email
        emailNotifications: true,
        smtpHost: 'smtp.hostinger.com',
        smtpPort: 465,
        smtpUser: 'support@wazzapai.com',
        smtpPassword: '',
        smtpSecure: true,

        // Security
        sessionTimeout: 0,
        maxLoginAttempts: 5,
        requireEmailVerification: false,
        enable2FA: false,

        // Advanced
        logLevel: 'info',
        enableMetrics: true,
        apiRateLimit: 100,
    })

    useEffect(() => {
        fetchSettings()
    }, [])

    // Fetch OTP status quand on ouvre l'onglet + polling si en cours de connexion
    useEffect(() => {
        if (activeTab !== 'otp') return
        let cancelled = false
        const poll = async () => {
            try {
                const res = await fetch('/api/admin/otp-whatsapp')
                const data = await res.json()
                if (cancelled) return
                const d = data.data || {}
                setOtpStatus(d.configured ? (d.status || 'disconnected') : 'not_configured')
                setOtpQrCode(d.qrCode || null)
                setOtpPhone(d.phone || null)
            } catch { /* silencieux */ }
        }
        poll()
        const interval = setInterval(poll, 3000)
        return () => { cancelled = true; clearInterval(interval) }
    }, [activeTab])

    const handleOtpConnect = async () => {
        setOtpLoading(true)
        try {
            await fetch('/api/admin/otp-whatsapp', { method: 'POST' })
            setOtpStatus('connecting')
            setOtpQrCode(null)
        } catch { /* silencieux */ }
        setOtpLoading(false)
    }

    const handleOtpDisconnect = async () => {
        setOtpLoading(true)
        try {
            await fetch('/api/admin/otp-whatsapp', { method: 'DELETE' })
            setOtpStatus('disconnected')
            setOtpQrCode(null)
            setOtpPhone(null)
        } catch { /* silencieux */ }
        setOtpLoading(false)
    }

    const handleOtpResetLimit = async () => {
        if (!otpResetPhone.trim()) return
        setOtpResetLoading(true)
        setOtpResetMsg(null)
        try {
            const res = await fetch('/api/admin/otp-whatsapp/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: otpResetPhone.trim() }),
            })
            const data = await res.json()
            if (data.data?.reset) {
                setOtpResetMsg('Tentatives réinitialisées. L\'utilisateur peut retenter.')
                setOtpResetPhone('')
            } else {
                setOtpResetMsg('Erreur : ' + (data.error || 'inconnue'))
            }
        } catch {
            setOtpResetMsg('Erreur réseau')
        }
        setOtpResetLoading(false)
    }

    const fetchSettings = async () => {
        setSettingsLoadError(null)
        try {
            const res = await fetch('/api/admin/settings')
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            if (data.data?.settings) {
                const fetchedSettings = { ...data.data.settings }
                if (fetchedSettings.defaultPaymentProvider === 'feepay') {
                    fetchedSettings.defaultPaymentProvider = 'feexpay'
                }
                if (
                    fetchedSettings.defaultPaymentProvider !== 'paystack'
                    && fetchedSettings.defaultPaymentProvider !== 'cinetpay'
                    && fetchedSettings.defaultPaymentProvider !== 'feexpay'
                    && fetchedSettings.defaultPaymentProvider !== 'paydunya'
                ) {
                    fetchedSettings.defaultPaymentProvider = 'cinetpay'
                }
                setSettings(prev => ({ ...prev, ...fetchedSettings }))
            }
            if (data.data?.providerReadiness) {
                setProviderReadiness(data.data.providerReadiness)
            }
            setSettingsLoaded(true)
        } catch (err) {
            console.error('Error fetching admin settings:', err)
            setSettingsLoadError('Impossible de charger les paramètres actuels. Sauvegarder est désactivé pour éviter d\'écraser la configuration en production.')
        }
    }

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveError(null)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })
            if (res.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            } else {
                const data = await res.json().catch(() => ({}))
                setSaveError(data.error || 'Erreur lors de la sauvegarde')
            }
        } catch (err) {
            console.error('Error saving settings:', err)
            setSaveError('Erreur réseau — vérifiez votre connexion')
        } finally {
            setSaving(false)
        }
    }

    const paymentProviderLabel = (provider: string) => {
        if (provider === 'paystack') return 'Paystack'
        if (provider === 'feexpay') return 'FeexPay'
        if (provider === 'paydunya') return 'PayDunya'
        return 'CinetPay'
    }

    const activeProviderReadiness =
        settings.defaultPaymentProvider === 'paystack'
            ? providerReadiness?.paystack || null
            : settings.defaultPaymentProvider === 'feexpay'
                ? providerReadiness?.feexpay || null
                : settings.defaultPaymentProvider === 'paydunya'
                    ? providerReadiness?.paydunya || null
                    : providerReadiness?.cinetpay || null

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <GeneralTab settings={settings} setSettings={setSettings} handleToggle={handleToggle} />
                )

            case 'ai':
                return (
                    <AiTab settings={settings} setSettings={setSettings} />
                )

            case 'payment':
                return (
                    <PaymentTab
                        settings={settings}
                        setSettings={setSettings}
                        providerReadiness={providerReadiness}
                        activeProviderReadiness={activeProviderReadiness}
                        paymentProviderLabel={paymentProviderLabel}
                    />
                )

            case 'email':
                return (
                    <EmailTab settings={settings} setSettings={setSettings} handleToggle={handleToggle} />
                )

            case 'security':
                return (
                    <SecurityTab settings={settings} setSettings={setSettings} handleToggle={handleToggle} />
                )

            case 'advanced':
                return (
                    <AdvancedTab settings={settings} setSettings={setSettings} handleToggle={handleToggle} />
                )

            case 'otp':
                return (
                    <OtpTab
                        otpStatus={otpStatus}
                        otpQrCode={otpQrCode}
                        otpPhone={otpPhone}
                        otpLoading={otpLoading}
                        handleOtpConnect={handleOtpConnect}
                        handleOtpDisconnect={handleOtpDisconnect}
                        otpResetPhone={otpResetPhone}
                        setOtpResetPhone={setOtpResetPhone}
                        handleOtpResetLimit={handleOtpResetLimit}
                        otpResetLoading={otpResetLoading}
                        otpResetMsg={otpResetMsg}
                    />
                )

            case 'notifications':
                return (
                    <NotificationsTab
                        notificationSettings={notificationSettings}
                        setNotificationSettings={setNotificationSettings}
                        handleSaveNotifications={handleSaveNotifications}
                        saving={saving}
                        saved={saved}
                    />
                )
        }
    }

    return (
        <div className="admin-settings-page" style={{ maxWidth: 900 }}>
            {/* Header */}
            <div className="admin-settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Paramètres système
                    </h1>
                    <p style={{ color: '#94a3b8' }}>Configuration globale de l'application</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <motion.button
                        className="admin-settings-save"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={activeTab === 'notifications' ? handleSaveNotifications : handleSave}
                        disabled={saving || !settingsLoaded}
                        title={!settingsLoaded ? 'Chargement des paramètres en cours...' : undefined}
                        style={{
                            padding: '14px 24px',
                            borderRadius: 12,
                            background: !settingsLoaded ? 'rgba(100,116,139,0.4)' : saved ? '#22c55e' : saveError ? '#ef4444' : 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: 'white',
                            fontWeight: 600,
                            cursor: saving || !settingsLoaded ? 'not-allowed' : 'pointer',
                            opacity: !settingsLoaded ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        {saving || !settingsLoaded ? (
                            <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                        ) : saved ? (
                            <CheckCircle style={{ width: 18, height: 18 }} />
                        ) : (
                            <Save style={{ width: 18, height: 18 }} />
                        )}
                        {!settingsLoaded ? 'Chargement...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
                    </motion.button>
                    {saveError && (
                        <span style={{ fontSize: 12, color: '#f87171' }}>{saveError}</span>
                    )}
                </div>
            </div>

            {settingsLoadError && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '14px 18px', marginBottom: 24, borderRadius: 12,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                }}>
                    <span style={{ color: '#fecaca', fontSize: 14 }}>{settingsLoadError}</span>
                    <button
                        onClick={fetchSettings}
                        style={{
                            padding: '8px 16px', borderRadius: 8, border: 'none',
                            background: '#ef4444', color: 'white', fontWeight: 600,
                            fontSize: 13, cursor: 'pointer', flexShrink: 0,
                        }}
                    >
                        Réessayer
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="admin-settings-tabs" style={{
                display: 'flex',
                flexWrap: isCompact ? 'wrap' : 'nowrap',
                gap: 8,
                marginBottom: 24,
                padding: 6,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 14,
                overflowX: isCompact ? 'visible' : 'auto'
            }}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            className="admin-settings-tab-btn"
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: isCompact ? '10px 12px' : '12px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: isActive ? '#10b981' : 'transparent',
                                color: isActive ? 'white' : '#94a3b8',
                                cursor: 'pointer',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                whiteSpace: isCompact ? 'normal' : 'nowrap',
                                maxWidth: isCompact ? 'none' : 'none',
                                flex: isCompact ? '1 1 140px' : '0 0 auto',
                                transition: 'all 0.2s'
                            }}
                        >
                            <tab.icon style={{ width: 18, height: 18 }} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 20,
                    padding: 24
                }}
            >
                {renderTabContent()}
            </motion.div>
        </div>
    )
}
