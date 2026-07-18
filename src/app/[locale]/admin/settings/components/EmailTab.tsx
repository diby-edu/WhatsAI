import type { Dispatch, SetStateAction } from 'react'
import { SettingRow, ToggleSwitch } from './shared'
import type { AdminSettings } from '../types'

interface EmailTabProps {
    settings: AdminSettings
    setSettings: Dispatch<SetStateAction<AdminSettings>>
    handleToggle: (key: keyof AdminSettings) => void
}

export function EmailTab({ settings, setSettings, handleToggle }: EmailTabProps) {
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
}
