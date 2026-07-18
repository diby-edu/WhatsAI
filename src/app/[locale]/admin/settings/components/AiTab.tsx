import type { Dispatch, SetStateAction } from 'react'
import type { AdminSettings } from '../types'

interface AiTabProps {
    settings: AdminSettings
    setSettings: Dispatch<SetStateAction<AdminSettings>>
}

export function AiTab({ settings, setSettings }: AiTabProps) {
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
}
