import type { Dispatch, SetStateAction } from 'react'
import { SettingRow, ToggleSwitch } from './shared'
import type { AdminSettings } from '../types'

interface GeneralTabProps {
    settings: AdminSettings
    setSettings: Dispatch<SetStateAction<AdminSettings>>
    handleToggle: (key: keyof AdminSettings) => void
}

export function GeneralTab({ settings, setSettings, handleToggle }: GeneralTabProps) {
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
}
