import type { Dispatch, SetStateAction } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SettingRow, ToggleSwitch } from './shared'
import type { AdminSettings } from '../types'

interface SecurityTabProps {
    settings: AdminSettings
    setSettings: Dispatch<SetStateAction<AdminSettings>>
    handleToggle: (key: keyof AdminSettings) => void
}

export function SecurityTab({ settings, setSettings, handleToggle }: SecurityTabProps) {
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
}
