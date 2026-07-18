import type { Dispatch, SetStateAction } from 'react'
import { SettingRow, ToggleSwitch } from './shared'
import type { AdminSettings } from '../types'

interface AdvancedTabProps {
    settings: AdminSettings
    setSettings: Dispatch<SetStateAction<AdminSettings>>
    handleToggle: (key: keyof AdminSettings) => void
}

export function AdvancedTab({ settings, setSettings, handleToggle }: AdvancedTabProps) {
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
}
