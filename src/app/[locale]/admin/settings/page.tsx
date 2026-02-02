'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Save, Globe, Shield, CreditCard, Mail, AlertTriangle,
    Database, Key, Server, Bell, Palette, Lock, RefreshCw,
    CheckCircle, Loader2
} from 'lucide-react'

type TabId = 'general' | 'ai' | 'payment' | 'email' | 'security' | 'advanced'

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
    { id: 'security', label: 'Sécurité', icon: Lock },
    { id: 'advanced', label: 'Avancé', icon: Server },
]

export default function AdminSettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('general')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const [settings, setSettings] = useState({
        // General
        appName: 'WazzapAI',
        appDescription: 'Plateforme d\'automatisation WhatsApp avec IA',
        maintenanceMode: false,
        allowRegistrations: true,
        defaultCredits: 100,

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
        currency: 'XOF',

        // Email
        emailNotifications: true,
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'noreply@wazzapai.com',
        smtpSecure: true,

        // Security
        sessionTimeout: 24,
        maxLoginAttempts: 5,
        requireEmailVerification: false,
        enable2FA: false,

        // Advanced
        logLevel: 'info',
        enableMetrics: true,
        apiRateLimit: 100,
    })

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSave = async () => {
        setSaving(true)
        // Simulate save
        await new Promise(resolve => setTimeout(resolve, 1000))
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
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
                            label="Mode maintenance"
                            description="Désactive l'accès au site pour les utilisateurs"
                        >
                            <ToggleSwitch
                                value={settings.maintenanceMode}
                                onChange={() => handleToggle('maintenanceMode')}
                                color="#ef4444"
                            />
                        </SettingRow>

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
                                type="number"
                                value={settings.defaultCredits}
                                onChange={(e) => setSettings({ ...settings, defaultCredits: parseInt(e.target.value) })}
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Tokens max par message
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxTokensPerMessage}
                                    onChange={(e) => setSettings({ ...settings, maxTokensPerMessage: parseInt(e.target.value) })}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
                                        onChange={(e) => setSettings({ ...settings, [item.key]: parseInt(e.target.value) })}
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
                            background: settings.cinetpayMode === 'sandbox' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            border: `1px solid ${settings.cinetpayMode === 'sandbox' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <AlertTriangle style={{
                                width: 20,
                                height: 20,
                                color: settings.cinetpayMode === 'sandbox' ? '#fbbf24' : '#4ade80'
                            }} />
                            <div>
                                <div style={{
                                    fontWeight: 600,
                                    color: settings.cinetpayMode === 'sandbox' ? '#fbbf24' : '#4ade80'
                                }}>
                                    {settings.cinetpayMode === 'sandbox' ? 'Mode Sandbox actif' : 'Mode Production actif'}
                                </div>
                                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                    {settings.cinetpayMode === 'sandbox'
                                        ? 'Les paiements sont en mode test. Aucun vrai paiement ne sera effectué.'
                                        : 'Les paiements réels sont activés.'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Mode CinetPay
                            </label>
                            <select
                                value={settings.cinetpayMode}
                                onChange={(e) => setSettings({ ...settings, cinetpayMode: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            >
                                <option value="sandbox">Sandbox (Test)</option>
                                <option value="live">Production (Live)</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Site ID
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
                                    Devise
                                </label>
                                <select
                                    value={settings.currency}
                                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                >
                                    <option value="XOF">FCFA (XOF)</option>
                                    <option value="XAF">FCFA (XAF)</option>
                                    <option value="USD">Dollar (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                </select>
                            </div>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
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
                                    onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    Timeout de session (heures)
                                </label>
                                <input
                                    type="number"
                                    value={settings.sessionTimeout}
                                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
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
                                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })}
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
                                type="number"
                                value={settings.apiRateLimit}
                                onChange={(e) => setSettings({ ...settings, apiRateLimit: parseInt(e.target.value) })}
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
                            description="Supprime tous les logs de plus de 30 jours"
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
        }
    }

    return (
        <div style={{ maxWidth: 900 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Paramètres système
                    </h1>
                    <p style={{ color: '#94a3b8' }}>Configuration globale de l'application</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
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
                        gap: 8
                    }}
                >
                    {saving ? (
                        <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    ) : saved ? (
                        <CheckCircle style={{ width: 18, height: 18 }} />
                    ) : (
                        <Save style={{ width: 18, height: 18 }} />
                    )}
                    {saved ? 'Sauvegardé !' : 'Sauvegarder'}
                </motion.button>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 24,
                padding: 6,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 14,
                overflowX: 'auto'
            }}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '12px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: isActive ? '#10b981' : 'transparent',
                                color: isActive ? 'white' : '#94a3b8',
                                cursor: 'pointer',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                whiteSpace: 'nowrap',
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

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
