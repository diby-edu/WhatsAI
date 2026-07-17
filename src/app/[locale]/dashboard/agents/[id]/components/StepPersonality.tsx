import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import type { AgentFormData } from '../types'

interface StepPersonalityProps {
    formData: AgentFormData
    setFormData: Dispatch<SetStateAction<AgentFormData>>
    isSupportClient: boolean
}

export function StepPersonality({ formData, setFormData, isSupportClient }: StepPersonalityProps) {
    const personalities = [
        { id: 'friendly', name: 'Amical', emoji: '😊', description: 'Chaleureux et accessible' },
        { id: 'professional', name: 'Professionnel', emoji: '👔', description: 'Formel et efficace' },
        { id: 'casual', name: 'Décontracté', emoji: '🎉', description: 'Fun et relaxé' },
        { id: 'expert', name: 'Expert', emoji: '🎓', description: 'Technique et précis' }
    ]
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {isSupportClient && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10, fontSize: 13, color: '#a5b4fc' }}>
                    <span>ℹ️</span>
                    <span>En mode Support Client, la personnalité s'active automatiquement si vous ajoutez des produits à cet agent.</span>
                </div>
            )}
            {!isSupportClient && (
                <>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                            Personnalité de l'agent
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                            {personalities.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setFormData({ ...formData, agent_tone: p.id })}
                                    style={{
                                        padding: 20,
                                        border: `2px solid ${formData.agent_tone === p.id ? '#10b981' : 'rgba(148, 163, 184, 0.1)'}`,
                                        borderRadius: 12,
                                        textAlign: 'center',
                                        background: formData.agent_tone === p.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
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

                    {/* Emoji Toggle with animated switch */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 12
                    }}>
                        <div>
                            <h3 style={{ fontWeight: 500, color: 'white' }}>Utiliser des emojis</h3>
                            <p style={{ fontSize: 13, color: '#64748b' }}>L'agent utilisera des emojis dans ses réponses</p>
                        </div>
                        <button
                            onClick={() => setFormData({ ...formData, use_emojis: !formData.use_emojis })}
                            style={{
                                width: 48,
                                height: 28,
                                borderRadius: 14,
                                background: formData.use_emojis ? '#10b981' : '#334155',
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
                                left: formData.use_emojis ? 23 : 3,
                                transition: 'left 0.2s'
                            }} />
                        </button>
                    </div>
                </>
            )}
        </motion.div>
    )
}
