'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Save, Globe, Shield, CreditCard, Mail, AlertTriangle,
    Database, Key, Server, Bell, Palette, Lock, RefreshCw,
    CheckCircle, Loader2, Users, Bot, Activity, Zap, MessageCircle, Wifi, WifiOff
} from 'lucide-react'

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

interface AdminNotificationSettings {
    // Legacy fields (for backwards compatibility)
    notif_new_user: boolean
    notif_plan_upgrade: boolean
    notif_plan_downgrade: boolean
    notif_payment_received: boolean
    notif_payment_failed: boolean
    notif_subscription_cancelled: boolean
    notif_agent_created: boolean
    notif_agent_connected: boolean
    notif_agent_disconnected: boolean
    notif_agent_quota_exceeded: boolean
    notif_openai_error: boolean
    notif_whatsapp_down: boolean
    notif_high_error_rate: boolean
    notif_new_conversation: boolean
    notif_new_order: boolean
    notif_escalation: boolean
    // Email notifications
    email_new_user: boolean
    email_plan_upgrade: boolean
    email_plan_downgrade: boolean
    email_payment_received: boolean
    email_payment_failed: boolean
    email_subscription_cancelled: boolean
    email_agent_created: boolean
    email_agent_connected: boolean
    email_agent_disconnected: boolean
    email_agent_quota_exceeded: boolean
    email_openai_error: boolean
    email_whatsapp_down: boolean
    email_high_error_rate: boolean
    email_new_conversation: boolean
    email_new_order: boolean
    email_escalation: boolean
    // Push notifications (in-app)
    push_new_user: boolean
    push_plan_upgrade: boolean
    push_plan_downgrade: boolean
    push_payment_received: boolean
    push_payment_failed: boolean
    push_subscription_cancelled: boolean
    push_agent_created: boolean
    push_agent_connected: boolean
    push_agent_disconnected: boolean
    push_agent_quota_exceeded: boolean
    push_openai_error: boolean
    push_whatsapp_down: boolean
    push_high_error_rate: boolean
    push_new_conversation: boolean
    push_new_order: boolean
    push_escalation: boolean
}

interface PaymentProviderReadiness {
    provider: 'cinetpay' | 'paystack' | 'feexpay' | 'paydunya'
    ready: boolean
    requiredKeys: string[]
    missingKeys: string[]
    warnings: string[]
}

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

    const [settings, setSettings] = useState({
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

    const ToggleSwitch = ({ value, onChange, color = '#10b981' }: { value: boolean, onChange: () => void, color?: string }) => (
        <button
            type="button"
            onClick={onChange}
            style={{
                width: 52,
                height: 28,
                borderRadius: 14,
                background: value ? color : '#475569',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s'
            }}
        >
            <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: 3,
                left: value ? 27 : 3,
                transition: 'left 0.2s'
            }} />
        </button>
    )

    const SettingRow = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.3)'
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'white', marginBottom: description ? 4 : 0 }}>{label}</div>
                {description && <div style={{ fontSize: 13, color: '#64748b' }}>{description}</div>}
            </div>
            <div style={{ marginLeft: 20 }}>{children}</div>
        </div>
    )

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Nom de l'application
                            </label>
                            <input
                                type="text"
                                value={settings.appName}
                                onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 16
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Description
                            </label>
                            <textarea
                                value={settings.appDescription}
                                onChange={(e) => setSettings({ ...settings, appDescription: e.target.value })}
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <SettingRow
                            label="Autoriser les inscriptions"
                            description="Permet aux nouveaux utilisateurs de s'inscrire"
                        >
                            <ToggleSwitch
                                value={settings.allowRegistrations}
                                onChange={() => handleToggle('allowRegistrations')}
                            />
                        </SettingRow>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Crédits par défaut (nouveaux utilisateurs)
                            </label>
                            <input
                                className="admin-settings-small-input"
                                type="number"
                                value={settings.defaultCredits}
                                onChange={(e) => setSettings({ ...settings, defaultCredits: e.target.valueAsNumber })}
                                style={{
                                    width: 150,
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>
                    </div>
                )

            case 'ai':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Modèle OpenAI par défaut
                            </label>
                            <select
                                value={settings.openaiModel}
                                onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            >
                                <option value="gpt-4o-mini">GPT-4o Mini (économique)</option>
                                <option value="gpt-4o">GPT-4o (équilibré)</option>
                                <option value="gpt-4-turbo">GPT-4 Turbo (puissant)</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (rapide)</option>
                            </select>
                        </div>

                        <div className="admin-settings-grid-2">
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Tokens max par message
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxTokensPerMessage}
                                    onChange={(e) => setSettings({ ...settings, maxTokensPerMessage: e.target.valueAsNumber })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Température par défaut
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="2"
                                    value={settings.temperatureDefault}
                                    onChange={(e) => setSettings({ ...settings, temperatureDefault: parseFloat(e.target.value) })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                        </div>

                        <h3 style={{ color: '#a78bfa', fontWeight: 600, marginTop: 16 }}>Limites d'agents par plan</h3>
                        <div className="admin-settings-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                            {[
                                { label: 'Free', key: 'maxAgentsFree' },
                                { label: 'Starter', key: 'maxAgentsStarter' },
                                { label: 'Pro', key: 'maxAgentsPro' },
                                { label: 'Business', key: 'maxAgentsBusiness' },
                            ].map(item => (
                                <div key={item.key}>
                                    <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6, fontSize: 13 }}>
                                        {item.label}
                                    </label>
                                    <input
                                        type="number"
                                        value={settings[item.key as keyof typeof settings] as number}
                                        onChange={(e) => setSettings({ ...settings, [item.key]: e.target.valueAsNumber })}
                                        style={{
                                            width: '100%',
                                            padding: 12,
                                            borderRadius: 8,
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            border: '1px solid rgba(148, 163, 184, 0.1)',
                                            color: 'white',
                                            textAlign: 'center'
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )

            case 'payment':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{
                            padding: 16,
                            borderRadius: 12,
                            background: activeProviderReadiness?.ready ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${activeProviderReadiness?.ready ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <AlertTriangle style={{
                                width: 20,
                                height: 20,
                                color: activeProviderReadiness?.ready ? '#4ade80' : '#f87171'
                            }} />
                            <div>
                                <div style={{
                                    fontWeight: 600,
                                    color: activeProviderReadiness?.ready ? '#4ade80' : '#f87171'
                                }}>
                                    {activeProviderReadiness?.ready
                                        ? `${paymentProviderLabel(settings.defaultPaymentProvider)} pilote actuellement les nouveaux paiements en ligne`
                                        : `${paymentProviderLabel(settings.defaultPaymentProvider)} n est pas pret pour les nouveaux paiements en ligne`}
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                    {activeProviderReadiness?.ready
                                        ? 'Les nouveaux liens de paiement en ligne peuvent etre generes normalement.'
                                        : 'Les nouveaux paiements en ligne sont bloques tant que la configuration requise est incomplete.'}
                                </div>
                                {activeProviderReadiness && !activeProviderReadiness.ready && activeProviderReadiness.missingKeys.length > 0 && (
                                    <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 6 }}>
                                        Configuration manquante : {activeProviderReadiness.missingKeys.join(', ')}
                                    </div>
                                )}
                                {activeProviderReadiness && activeProviderReadiness.warnings.length > 0 && (
                                    <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>
                                        {activeProviderReadiness.warnings.join(' • ')}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Fournisseur de paiement par defaut
                            </label>
                            <select
                                value={settings.defaultPaymentProvider}
                                onChange={(e) => setSettings({ ...settings, defaultPaymentProvider: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            >
                                <option
                                    value="cinetpay"
                                    disabled={Boolean(providerReadiness?.cinetpay && !providerReadiness.cinetpay.ready && settings.defaultPaymentProvider !== 'cinetpay')}
                                >
                                    {providerReadiness?.cinetpay && !providerReadiness.cinetpay.ready ? 'CinetPay (non pret)' : 'CinetPay'}
                                </option>
                                <option
                                    value="paystack"
                                    disabled={Boolean(providerReadiness?.paystack && !providerReadiness.paystack.ready && settings.defaultPaymentProvider !== 'paystack')}
                                >
                                    {providerReadiness?.paystack && !providerReadiness.paystack.ready ? 'Paystack (non pret)' : 'Paystack'}
                                </option>
                                <option
                                    value="feexpay"
                                    disabled={Boolean(providerReadiness?.feexpay && !providerReadiness.feexpay.ready && settings.defaultPaymentProvider !== 'feexpay')}
                                >
                                    {providerReadiness?.feexpay && !providerReadiness.feexpay.ready ? 'FeexPay (non pret)' : 'FeexPay'}
                                </option>
                                <option
                                    value="paydunya"
                                    disabled={Boolean(providerReadiness?.paydunya && !providerReadiness.paydunya.ready && settings.defaultPaymentProvider !== 'paydunya')}
                                >
                                    {providerReadiness?.paydunya && !providerReadiness.paydunya.ready ? 'PayDunya (non pret)' : 'PayDunya'}
                                </option>
                            </select>
                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                                Ce choix pilote les nouveaux paiements en ligne crees par la plateforme. Les transactions deja lancees conservent leur fournisseur d origine.
                            </p>
                        </div>

                        <div className="admin-settings-grid-2">
                            <div style={{
                                padding: 16,
                                borderRadius: 12,
                                background: 'rgba(15, 23, 42, 0.35)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}>
                                <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>
                                    Lien de paiement automatique
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                                    Le client recoit un lien de paiement securise. L argent est d abord collecte par la plateforme, puis reverse a l utilisateur par la plateforme.
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                    Fournisseur actif: {paymentProviderLabel(settings.defaultPaymentProvider)}
                                    {activeProviderReadiness?.ready ? ' - pret' : ' - non pret'}
                                </div>
                            </div>
                            <div style={{
                                padding: 16,
                                borderRadius: 12,
                                background: 'rgba(15, 23, 42, 0.35)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}>
                                <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>
                                    Paiement manuel
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                                    Le client paie directement sur les moyens renseignes par le marchand. Le marchand verifie ensuite le paiement avant confirmation.
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                    Aucun lien heberge n est genere dans ce mode.
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Diagnostic CinetPay (lecture seule)
                            </label>
                            <select
                                value={settings.cinetpayMode}
                                onChange={(e) => setSettings({ ...settings, cinetpayMode: e.target.value })}
                                disabled
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: '#94a3b8'
                                }}
                            >
                                <option value="sandbox">Sandbox (Test)</option>
                                <option value="live">Production (Live)</option>
                            </select>
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                Information technique uniquement. Les nouveaux paiements en ligne sont surtout pilotes par le fournisseur par defaut et les variables d environnement.
                            </p>
                        </div>

                        <div className="admin-settings-grid-2">
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Site ID CinetPay
                                </label>
                                <input
                                    type="password"
                                    value={settings.cinetpaySiteId}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.3)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: '#64748b'
                                    }}
                                />
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Configuré via variables d'environnement
                                </p>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Devise historique (lecture seule)
                                </label>
                                <select
                                    value={settings.currency}
                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.3)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: '#94a3b8'
                                    }}
                                >
                                    <option value="XOF">FCFA (XOF)</option>
                                    <option value="XAF">FCFA (XAF)</option>
                                    <option value="USD">Dollar (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                    Cette valeur reste informative ici. Le runtime utilise la configuration serveur des fournisseurs.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Taux de commission par défaut (%)
                            </label>
                            <input
                                className="admin-settings-small-input"
                                type="number"
                                value={settings.defaultCommissionRate}
                                onChange={(e) => setSettings({ ...settings, defaultCommissionRate: e.target.valueAsNumber })}
                                style={{
                                    width: 150,
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                                Utilisé pour calculer le montant net lors de la création d'un reversement.
                            </p>
                        </div>
                    </div>
                )

            case 'email':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SettingRow
                            label="Notifications email"
                            description="Envoyer des emails automatiques aux utilisateurs"
                        >
                            <ToggleSwitch
                                value={settings.emailNotifications}
                                onChange={() => handleToggle('emailNotifications')}
                            />
                        </SettingRow>

                        <div className="admin-settings-grid-2-1" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Serveur SMTP
                                </label>
                                <input
                                    type="text"
                                    value={settings.smtpHost}
                                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Port SMTP
                                </label>
                                <input
                                    type="number"
                                    value={settings.smtpPort}
                                    onChange={(e) => setSettings({ ...settings, smtpPort: e.target.valueAsNumber })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Email d'envoi
                            </label>
                            <input
                                type="email"
                                value={settings.smtpUser}
                                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Mot de passe SMTP
                            </label>
                            <input
                                type="password"
                                value={settings.smtpPassword}
                                onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                                placeholder="Mot de passe Hostinger (email)"
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                            <p style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>
                                Mot de passe de votre adresse email Hostinger. Sauvegardé de façon sécurisée.
                            </p>
                        </div>

                        <SettingRow
                            label="Connexion sécurisée (TLS)"
                            description="Utiliser TLS pour les connexions SMTP"
                        >
                            <ToggleSwitch
                                value={settings.smtpSecure}
                                onChange={() => handleToggle('smtpSecure')}
                            />
                        </SettingRow>
                    </div>
                )

            case 'security':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="admin-settings-grid-2">
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Timeout de session (heures)
                                </label>
                                <input
                                    type="number"
                                    value={settings.sessionTimeout}
                                    onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.valueAsNumber })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Tentatives de connexion max
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxLoginAttempts}
                                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: e.target.valueAsNumber })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                />
                            </div>
                        </div>

                        <SettingRow
                            label="Vérification email obligatoire"
                            description="Les utilisateurs doivent vérifier leur email avant connexion"
                        >
                            <ToggleSwitch
                                value={settings.requireEmailVerification}
                                onChange={() => handleToggle('requireEmailVerification')}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Authentification à deux facteurs"
                            description="Activer le 2FA pour les comptes admin"
                        >
                            <ToggleSwitch
                                value={settings.enable2FA}
                                onChange={() => handleToggle('enable2FA')}
                            />
                        </SettingRow>

                        {/* Danger Zone */}
                        <div style={{
                            marginTop: 24,
                            padding: 20,
                            borderRadius: 16,
                            border: '2px solid rgba(239, 68, 68, 0.2)',
                            background: 'rgba(239, 68, 68, 0.05)'
                        }}>
                            <h3 style={{ color: '#f87171', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle style={{ width: 18, height: 18 }} />
                                Zone dangereuse
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <SettingRow
                                    label="Réinitialiser toutes les sessions"
                                    description="Déconnecte tous les utilisateurs"
                                >
                                    <button style={{
                                        padding: '10px 16px',
                                        borderRadius: 8,
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#f87171',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}>
                                        Réinitialiser
                                    </button>
                                </SettingRow>
                            </div>
                        </div>
                    </div>
                )

            case 'advanced':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Niveau de logs
                            </label>
                            <select
                                value={settings.logLevel}
                                onChange={(e) => setSettings({ ...settings, logLevel: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            >
                                <option value="error">Error (erreurs uniquement)</option>
                                <option value="warn">Warn (avertissements)</option>
                                <option value="info">Info (informations générales)</option>
                                <option value="debug">Debug (débogage détaillé)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Limite de requêtes API (par minute)
                            </label>
                            <input
                                className="admin-settings-small-input"
                                type="number"
                                value={settings.apiRateLimit}
                                onChange={(e) => setSettings({ ...settings, apiRateLimit: e.target.valueAsNumber })}
                                style={{
                                    width: 150,
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>

                        <SettingRow
                            label="Métriques de performance"
                            description="Collecter les métriques pour le monitoring"
                        >
                            <ToggleSwitch
                                value={settings.enableMetrics}
                                onChange={() => handleToggle('enableMetrics')}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Purger les logs"
                            description="Supprime tous les logs de plus de 14 jours"
                        >
                            <button style={{
                                padding: '10px 16px',
                                borderRadius: 8,
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                color: '#fbbf24',
                                cursor: 'pointer',
                                fontWeight: 500
                            }}>
                                Purger
                            </button>
                        </SettingRow>
                    </div>
                )

            case 'otp':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{
                            padding: '20px 24px',
                            borderRadius: 16,
                            background: 'rgba(15,23,42,0.6)',
                            border: '1px solid rgba(148,163,184,0.12)',
                        }}>
                            <h3 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <MessageCircle size={18} style={{ color: '#10b981' }} />
                                Connexion WhatsApp — Envoi OTP
                            </h3>
                            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
                                Ce numéro dédié envoie les codes de vérification aux nouveaux utilisateurs. Il ne répond jamais aux messages reçus.
                            </p>

                            {/* Statut */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                                {otpStatus === 'connected' ? (
                                    <>
                                        <Wifi size={16} style={{ color: '#10b981' }} />
                                        <span style={{ color: '#10b981', fontWeight: 600, fontSize: 14 }}>Connecté</span>
                                        {otpPhone && <span style={{ color: '#64748b', fontSize: 13 }}>— {otpPhone}</span>}
                                    </>
                                ) : otpStatus === 'qr_ready' ? (
                                    <>
                                        <Loader2 size={16} style={{ color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
                                        <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 14 }}>Scannez le QR code ci-dessous</span>
                                    </>
                                ) : otpStatus === 'connecting' ? (
                                    <>
                                        <Loader2 size={16} style={{ color: '#64748b', animation: 'spin 1s linear infinite' }} />
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: 14 }}>Génération du QR code…</span>
                                    </>
                                ) : (
                                    <>
                                        <WifiOff size={16} style={{ color: '#64748b' }} />
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: 14 }}>
                                            {otpStatus === 'not_configured' ? 'Non configuré' : 'Déconnecté'}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* QR Code */}
                            {otpQrCode && (otpStatus === 'qr_ready' || otpStatus === 'connecting') && (
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div style={{
                                        display: 'inline-block',
                                        padding: 16,
                                        background: 'white',
                                        borderRadius: 16,
                                        marginBottom: 12,
                                    }}>
                                        <img src={otpQrCode} alt="QR Code WhatsApp OTP" width={200} height={200} style={{ display: 'block' }} />
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: 13 }}>
                                        Ouvrez WhatsApp sur la SIM dédiée → <strong>Appareils liés</strong> → <strong>Lier un appareil</strong>
                                    </p>
                                </div>
                            )}

                            {/* Boutons */}
                            <div style={{ display: 'flex', gap: 10 }}>
                                {otpStatus !== 'connected' && (
                                    <button
                                        onClick={handleOtpConnect}
                                        disabled={otpLoading}
                                        style={{
                                            padding: '10px 20px', borderRadius: 10, border: 'none',
                                            background: 'linear-gradient(135deg, #10b981, #0891b2)',
                                            color: 'white', fontWeight: 600, fontSize: 13,
                                            cursor: otpLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                        }}
                                    >
                                        {otpLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                                        {otpStatus === 'not_configured' ? 'Initialiser' : 'Afficher le QR code'}
                                    </button>
                                )}
                                {otpStatus === 'connected' && (
                                    <button
                                        onClick={handleOtpDisconnect}
                                        disabled={otpLoading}
                                        style={{
                                            padding: '10px 20px', borderRadius: 10,
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'rgba(239,68,68,0.08)',
                                            color: '#f87171', fontWeight: 600, fontSize: 13,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                        }}
                                    >
                                        <WifiOff size={14} /> Déconnecter
                                    </button>
                                )}
                            </div>

                            {/* Reset tentatives OTP */}
                            <div style={{
                                marginTop: 8,
                                padding: 16,
                                borderRadius: 12,
                                background: 'rgba(15,23,42,0.4)',
                                border: '1px solid rgba(100,116,139,0.2)',
                            }}>
                                <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13, marginBottom: 8 }}>
                                    Réinitialiser les tentatives d'un utilisateur
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                                    Si un utilisateur est bloqué ("Trop de tentatives"), saisissez son numéro international et cliquez Réinitialiser.
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        value={otpResetPhone}
                                        onChange={e => setOtpResetPhone(e.target.value)}
                                        placeholder="ex: 225747094746"
                                        style={{
                                            flex: 1, padding: '8px 12px', borderRadius: 8,
                                            background: 'rgba(15,23,42,0.6)',
                                            border: '1px solid rgba(100,116,139,0.3)',
                                            color: 'white', fontSize: 13,
                                        }}
                                    />
                                    <button
                                        onClick={handleOtpResetLimit}
                                        disabled={otpResetLoading || !otpResetPhone.trim()}
                                        style={{
                                            padding: '8px 16px', borderRadius: 8,
                                            background: otpResetLoading ? 'rgba(100,116,139,0.3)' : 'rgba(59,130,246,0.2)',
                                            color: '#60a5fa', fontWeight: 600, fontSize: 13,
                                            cursor: otpResetLoading || !otpResetPhone.trim() ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            border: '1px solid rgba(59,130,246,0.3)',
                                        }}
                                    >
                                        {otpResetLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                                        Réinitialiser
                                    </button>
                                </div>
                                {otpResetMsg && (
                                    <div style={{
                                        marginTop: 8, fontSize: 12, padding: '6px 10px', borderRadius: 6,
                                        background: otpResetMsg.startsWith('Erreur') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                        color: otpResetMsg.startsWith('Erreur') ? '#f87171' : '#34d399',
                                        border: `1px solid ${otpResetMsg.startsWith('Erreur') ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                                    }}>
                                        {otpResetMsg}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )

            case 'notifications':
                const NotificationItem = ({ label, description, emailKey, pushKey, critical }: {
                    label: string,
                    description: string,
                    emailKey: keyof AdminNotificationSettings,
                    pushKey: keyof AdminNotificationSettings,
                    critical?: boolean
                }) => (
                    <div className="admin-settings-notif-item" style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.3)',
                        gap: 16
                    }}>
                        <div>
                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{label}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{description}</div>
                        </div>
                        <div className="admin-settings-notif-channel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Email</span>
                            <ToggleSwitch
                                value={notificationSettings[emailKey] as boolean}
                                onChange={() => setNotificationSettings(s => ({ ...s, [emailKey]: !s[emailKey] }))}
                                color={critical ? '#ef4444' : '#10b981'}
                            />
                        </div>
                        <div className="admin-settings-notif-channel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Push</span>
                            <ToggleSwitch
                                value={notificationSettings[pushKey] as boolean}
                                onChange={() => setNotificationSettings(s => ({ ...s, [pushKey]: !s[pushKey] }))}
                                color={critical ? '#ef4444' : '#3b82f6'}
                            />
                        </div>
                    </div>
                )

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Info Banner */}
                        <div style={{
                            padding: 16,
                            borderRadius: 12,
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <Bell style={{ width: 20, height: 20, color: '#60a5fa' }} />
                            <div>
                                <div style={{ fontWeight: 600, color: '#60a5fa' }}>Canaux de notification</div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                    Configurez séparément les notifications par <strong>Email</strong> et par <strong>Push</strong> (in-app).
                                </div>
                            </div>
                        </div>

                        {/* Users & Revenue */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Users style={{ width: 18, height: 18, color: '#3b82f6' }} />
                                <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Utilisateurs & Revenus</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <NotificationItem label="Nouvel utilisateur inscrit" description="Alerte quand un nouveau compte est créé" emailKey="email_new_user" pushKey="push_new_user" />
                                <NotificationItem label="Upgrade de plan" description="Un utilisateur passe à un plan supérieur" emailKey="email_plan_upgrade" pushKey="push_plan_upgrade" />
                                <NotificationItem label="Downgrade de plan" description="Un utilisateur passe à un plan inférieur" emailKey="email_plan_downgrade" pushKey="push_plan_downgrade" />
                                <NotificationItem label="Paiement reçu" description="Confirmation de paiement en ligne" emailKey="email_payment_received" pushKey="push_payment_received" />
                                <NotificationItem label="Paiement échoué" description="Échec d'un paiement" emailKey="email_payment_failed" pushKey="push_payment_failed" critical />
                                <NotificationItem label="Abonnement annulé" description="Un utilisateur annule son abonnement" emailKey="email_subscription_cancelled" pushKey="push_subscription_cancelled" />
                            </div>
                        </div>

                        {/* Agents */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Bot style={{ width: 18, height: 18, color: '#10b981' }} />
                                <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Agents IA</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <NotificationItem label="Nouvel agent créé" description="Un utilisateur crée un nouvel agent" emailKey="email_agent_created" pushKey="push_agent_created" />
                                <NotificationItem label="Agent connecté WhatsApp" description="Un agent se connecte avec succès" emailKey="email_agent_connected" pushKey="push_agent_connected" />
                                <NotificationItem label="Agent déconnecté WhatsApp" description="Perte de connexion WhatsApp" emailKey="email_agent_disconnected" pushKey="push_agent_disconnected" critical />
                                <NotificationItem label="Quota agents dépassé" description="Tentative de créer plus d'agents que permis" emailKey="email_agent_quota_exceeded" pushKey="push_agent_quota_exceeded" />
                            </div>
                        </div>

                        {/* System & Health */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Zap style={{ width: 18, height: 18, color: '#f59e0b' }} />
                                <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Système & Santé</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <NotificationItem label="Erreur API OpenAI" description="Problème avec l'API IA" emailKey="email_openai_error" pushKey="push_openai_error" critical />
                                <NotificationItem label="Service WhatsApp down" description="Le bot ne répond plus" emailKey="email_whatsapp_down" pushKey="push_whatsapp_down" critical />
                                <NotificationItem label="Taux d'erreur élevé" description="> 5% de messages échoués" emailKey="email_high_error_rate" pushKey="push_high_error_rate" critical />
                            </div>
                        </div>

                        {/* Activity */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Activity style={{ width: 18, height: 18, color: '#8b5cf6' }} />
                                <h3 style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Activité</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <NotificationItem label="Nouvelle conversation" description="Un client contacte un agent (volume élevé)" emailKey="email_new_conversation" pushKey="push_new_conversation" />
                                <NotificationItem label="Nouvelle commande" description="Une commande est passée" emailKey="email_new_order" pushKey="push_new_order" />
                                <NotificationItem label="Escalade conversation" description="Conversation transférée à humain" emailKey="email_escalation" pushKey="push_escalation" />
                            </div>
                        </div>

                        {/* Save Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSaveNotifications}
                            disabled={saving}
                            style={{
                                padding: '14px 24px',
                                borderRadius: 12,
                                background: saved ? '#22c55e' : 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                color: 'white',
                                fontWeight: 600,
                                cursor: saving ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                marginTop: 8
                            }}
                        >
                            {saving ? (
                                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                            ) : saved ? (
                                <CheckCircle style={{ width: 18, height: 18 }} />
                            ) : (
                                <Save style={{ width: 18, height: 18 }} />
                            )}
                            {saved ? 'Sauvegardé !' : 'Sauvegarder les notifications'}
                        </motion.button>
                    </div>
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
