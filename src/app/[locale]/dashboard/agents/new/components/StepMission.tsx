import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { Shield } from 'lucide-react'
import { isValidEscalationPhone } from '../helpers'
import type { MissionTemplate, NewAgentFormData } from '../types'

function sanitizeEscalationPhone(value: string): string {
    const raw = value || ''
    const digits = raw.replace(/[^\d]/g, '')
    return raw.startsWith('+') ? '+' + digits : digits
}

interface StepMissionProps {
    missionTemplates: MissionTemplate[]
    featureFlags: Record<string, boolean>
    formData: NewAgentFormData
    setFormData: Dispatch<SetStateAction<NewAgentFormData>>
    updateFormData: (field: string, value: any) => void
    agentType: '' | 'conversationnel' | 'api'
    setAgentType: Dispatch<SetStateAction<'' | 'conversationnel' | 'api'>>
    selectMissionTemplate: (template: MissionTemplate) => void
    apiAccessEnabled: boolean
    getMissionPrompt: (templateId: string, ecommerceMode?: 'native' | 'external_sync') => string
    isSupportClient: boolean
    inputStyle: CSSProperties
}

export function StepMission({
    missionTemplates,
    featureFlags,
    formData,
    setFormData,
    updateFormData,
    agentType,
    setAgentType,
    selectMissionTemplate,
    apiAccessEnabled,
    getMissionPrompt,
    isSupportClient,
    inputStyle,
}: StepMissionProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Grille unifiée — tous les types d'agents */}
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 16 }}>
                    Quel type d&apos;agent souhaitez-vous créer ?
                </label>
                <div className="agent-grid-3">
                    {missionTemplates.map((template) => {
                        const flagKey = `agent_${template.id}`
                        const isEnabled = template.id === 'support_client' || Object.keys(featureFlags).length === 0 || featureFlags[flagKey] !== false
                        const isSelected = formData.mission === template.id && agentType === 'conversationnel'
                        return (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => {
                                    if (!isEnabled) return
                                    setAgentType('conversationnel')
                                    selectMissionTemplate(template)
                                }}
                                disabled={!isEnabled}
                                style={{
                                    padding: 16,
                                    border: `2px solid ${isSelected ? '#10b981' : isEnabled ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.05)'}`,
                                    borderRadius: 12,
                                    textAlign: 'left',
                                    background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                                    opacity: isEnabled ? 1 : 0.45,
                                    position: 'relative' as const,
                                    display: 'flex',
                                    flexDirection: 'column' as const,
                                    alignItems: 'flex-start'
                                }}
                            >
                                {!isEnabled && (
                                    <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, color: '#64748b', background: 'rgba(100,116,139,0.15)', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>
                                        BIENTÔT
                                    </span>
                                )}
                                <h3 style={{ fontWeight: 600, color: isEnabled ? 'white' : '#64748b', marginBottom: 4, marginTop: 0 }}>{template.title}</h3>
                                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{template.description}</p>
                            </button>
                        )
                    })}

                    {/* Canal Notification API */}
                    <button
                        type="button"
                        onClick={() => {
                            if (!apiAccessEnabled) return
                            setAgentType('api')
                            setFormData(prev => ({
                                ...prev,
                                mission: 'ecommerce',
                                ecommerce_mode: 'external_sync',
                                systemPrompt: getMissionPrompt('ecommerce', 'external_sync')
                            }))
                        }}
                        disabled={!apiAccessEnabled}
                        style={{
                            padding: 16,
                            border: `2px solid ${!apiAccessEnabled ? 'rgba(148, 163, 184, 0.05)' : agentType === 'api' ? '#0ea5e9' : 'rgba(148, 163, 184, 0.1)'}`,
                            borderRadius: 12,
                            textAlign: 'left',
                            background: !apiAccessEnabled ? 'rgba(255,255,255,0.02)' : agentType === 'api' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                            cursor: apiAccessEnabled ? 'pointer' : 'not-allowed',
                            opacity: apiAccessEnabled ? 1 : 0.45,
                            position: 'relative' as const,
                            display: 'flex',
                            flexDirection: 'column' as const,
                            alignItems: 'flex-start'
                        }}
                    >
                        <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.05em' }}>
                            API
                        </span>
                        <h3 style={{ fontWeight: 600, color: apiAccessEnabled ? 'white' : '#64748b', marginBottom: 4, marginTop: 0 }}>Canal Notification API</h3>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                            Connectez Shopify, WooCommerce ou autre plateforme pour envoyer confirmations et mises à jour via WhatsApp.
                        </p>
                    </button>
                </div>
            </div>

            {/* Champs inline — agent API */}
            {agentType === 'api' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ padding: 14, background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: 12, color: '#bae6fd', fontSize: 13, lineHeight: 1.6 }}>
                        Votre agent servira uniquement de canal de notification WhatsApp. Les commandes et paiements restent gérés sur votre plateforme (Chariow, Shopify, WooCommerce...).
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Nom de l&apos;agent *
                        </label>
                        <input type="text" value={formData.name} onChange={(e) => updateFormData('name', e.target.value)} placeholder="Ex: Boutique Chez Marie" style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Numéro d&apos;escalade / SAV * <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(format : +225XXXXXXXXX)</span>
                        </label>
                        <input
                            type="text"
                            value={formData.escalation_phone}
                            onChange={(e) => updateFormData('escalation_phone', sanitizeEscalationPhone(e.target.value))}
                            placeholder="+2250701010101"
                            style={{ ...inputStyle, border: formData.escalation_phone && !isValidEscalationPhone(formData.escalation_phone) ? '1px solid #f87171' : inputStyle.border }}
                        />
                        {formData.escalation_phone && !isValidEscalationPhone(formData.escalation_phone) && (
                            <p style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>Format invalide. Exemple : +2250701010101 (+ indicatif + numéro, chiffres uniquement)</p>
                        )}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Message de redirection * <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(envoyé quand un client vous répond)</span>
                        </label>
                        <textarea
                            value={formData.external_sync_reply_message}
                            onChange={(e) => updateFormData('external_sync_reply_message', e.target.value)}
                            placeholder={`Merci pour votre message. Pour toute assistance, contactez notre équipe au ${formData.escalation_phone || '+225XXXXXXXXX'}.`}
                            rows={4}
                            style={{ ...inputStyle, resize: 'vertical' as const }}
                        />
                    </div>
                </div>
            )}

            {formData.mission && agentType === 'conversationnel' && (
                <div style={{
                    padding: 16,
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <Shield size={20} color="#34d399" />
                    <div>
                        <h4 style={{ color: '#34d399', fontWeight: 600, fontSize: 14 }}>Mode Sécurisé Activé</h4>
                        <p style={{ color: '#94a3b8', fontSize: 13 }}>
                            L&apos;IA est maintenant configurée pour suivre strictement le scénario <strong>{missionTemplates.find(tmpl => tmpl.id === formData.mission)?.title}</strong>.
                        </p>
                    </div>
                </div>
            )}

            {isSupportClient && (
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Contexte supplémentaire (optionnel)
                    </label>
                    <textarea
                        value={formData.agent_context}
                        onChange={(e) => updateFormData('agent_context', e.target.value)}
                        placeholder="Informations complémentaires sur votre activité, produits ou politiques que l'IA doit connaître..."
                        rows={4}
                        style={{
                            width: '100%',
                            padding: 16,
                            borderRadius: 12,
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            background: 'rgba(99, 102, 241, 0.05)',
                            color: 'white',
                            outline: 'none',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            lineHeight: 1.6,
                        }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Ce contexte est injecté dans chaque réponse du mode Support Client.
                    </p>
                </div>
            )}
            {isSupportClient && (
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Message d&apos;accueil (optionnel)
                    </label>
                    <textarea
                        value={formData.welcome_message}
                        onChange={(e) => updateFormData('welcome_message', e.target.value)}
                        placeholder="Ex: Je peux vous renseigner sur nos formations, les tarifs et le processus d'inscription."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: 16,
                            borderRadius: 12,
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(16, 185, 129, 0.05)',
                            color: 'white',
                            outline: 'none',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            lineHeight: 1.6,
                        }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Affiché après le nom de l&apos;agent lors du premier message.
                    </p>
                </div>
            )}
            {isSupportClient && (
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Message de redirection (optionnel)
                    </label>
                    <input
                        type="text"
                        value={formData.fallback_contact_message}
                        onChange={(e) => updateFormData('fallback_contact_message', e.target.value)}
                        placeholder="Ex: Pour plus de détails, appelez le +225 07 00 00 00 ou visitez notre site."
                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Phrase ajoutée automatiquement quand l&apos;agent n&apos;a pas l&apos;information. Laissez vide pour un comportement par défaut.
                    </p>
                </div>
            )}
        </div>
    )
}
