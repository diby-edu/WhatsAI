import type { useTranslations } from 'next-intl'
import type { NewAgentFormData, Personality } from '../types'

interface StepPersonalityProps {
    t: ReturnType<typeof useTranslations>
    formData: NewAgentFormData
    updateFormData: (field: string, value: any) => void
    isSupportClient: boolean
    personalities: Personality[]
}

export function StepPersonality({ t, formData, updateFormData, isSupportClient, personalities }: StepPersonalityProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!isSupportClient && (
                <>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                            {t('Form.personality.label')}
                        </label>
                        <div className="agent-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                            {personalities.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => updateFormData('personality', p.id)}
                                    style={{
                                        padding: 20,
                                        border: `2px solid ${formData.personality === p.id ? '#10b981' : 'rgba(148, 163, 184, 0.1)'}`,
                                        borderRadius: 12,
                                        textAlign: 'center',
                                        background: formData.personality === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>{p.emoji}</div>
                                    <h3 style={{ fontWeight: 600, color: 'white' }}>{p.name}</h3>
                                    <p style={{ fontSize: 12, color: '#64748b' }}>{p.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 12
                    }}>
                        <div>
                            <h3 style={{ fontWeight: 500, color: 'white' }}>{t('Form.personality.emojis')}</h3>
                            <p style={{ fontSize: 13, color: '#64748b' }}>{t('Form.personality.emojisHint')}</p>
                        </div>
                        <button
                            onClick={() => updateFormData('useEmojis', !formData.useEmojis)}
                            style={{
                                width: 48,
                                height: 28,
                                borderRadius: 14,
                                background: formData.useEmojis ? '#10b981' : '#334155',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                        >
                            <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: 'white',
                                position: 'absolute',
                                top: 3,
                                left: formData.useEmojis ? 23 : 3,
                                transition: 'left 0.2s'
                            }} />
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
