import type { CSSProperties } from 'react'
import type { useTranslations } from 'next-intl'
import { Loader2, Sparkles, MapPin } from 'lucide-react'
import { isValidEscalationPhone } from '../helpers'
import type { NewAgentFormData } from '../types'

interface StepInfoProps {
    t: ReturnType<typeof useTranslations>
    formData: NewAgentFormData
    updateFormData: (field: string, value: any) => void
    inputStyle: CSSProperties
    isExternalSync: boolean
    isSupportClient: boolean
    generating: boolean
    handleGenerate: () => void
    getLocation: () => void
}

export function StepInfo({ t, formData, updateFormData, inputStyle, isExternalSync, isSupportClient, generating, handleGenerate, getLocation }: StepInfoProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {isExternalSync && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: 10, fontSize: 13, color: '#bae6fd' }}>
                    <span>ℹ️</span>
                    <span>Définissez ici l&apos;identité de votre agent. Il servira de canal de notification WhatsApp pour votre plateforme.</span>
                </div>
            )}
            {isSupportClient && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10, fontSize: 13, color: '#a5b4fc' }}>
                    <span>ℹ️</span>
                    <span>En mode Support Client, la description et l'adresse s'activent automatiquement si vous ajoutez des produits à cet agent.</span>
                </div>
            )}
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    {t('Form.name.label')} *
                </label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder={t('Form.name.placeholder')}
                    style={inputStyle}
                />
            </div>

            {!isExternalSync && (
            <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    {t('Form.description.label')}
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            cursor: 'pointer'
                        }}
                    >
                        {generating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        Générer (1 crédit)
                    </button>
                </label>
                <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    placeholder={t('Form.description.placeholder')}
                    rows={3}
                    style={{ ...inputStyle, resize: 'none' }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', background: 'rgba(30, 41, 59, 0.3)', padding: 12, borderRadius: 8 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>Dites-moi qui je suis ! Exemples :</p>
                    <ul style={{ listStyle: 'disc', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <li>"Assistant chaleureux pour une pizzeria, je tutoie les clients et je propose toujours le supplément fromage."</li>
                        <li>"Réceptionniste d'hôtel de luxe, poli et distingué, je demande toujours les dates de séjour."</li>
                        <li>"Vendeur expert en smartphone, technique mais accessible, je pousse à l'achat."</li>
                    </ul>
                </div>
            </div>
            )}

            {/* Toggle boutique en ligne */}
            {!isExternalSync && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 10 }}>
                <input
                    type="checkbox"
                    id="is_online_only"
                    checked={formData.is_online_only}
                    onChange={(e) => updateFormData('is_online_only', e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#818cf8' }}
                />
                <label htmlFor="is_online_only" style={{ cursor: 'pointer', color: '#e2e8f0', fontSize: 14 }}>
                    Boutique 100% en ligne (pas d'adresse physique)
                    <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>L'IA ne mentionnera jamais d'adresse physique.</span>
                </label>
            </div>}

            {/* NEW FIELDS: Address & Contact */}
            {!isExternalSync && <div style={{ display: formData.is_online_only ? 'none' : undefined }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    Adresse Physique
                </label>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        value={formData.business_address}
                        onChange={(e) => updateFormData('business_address', e.target.value)}
                        placeholder="Ex: Abidjan, Cocody..."
                        style={inputStyle}
                    />
                    <MapPin size={16} style={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8' }} />
                </div>
            </div>}

            {!isExternalSync && <div className="agent-grid-2" style={{ display: formData.is_online_only ? 'none' : undefined }}>
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Latitude
                    </label>
                    <input
                        type="number"
                        value={formData.latitude}
                        onChange={(e) => updateFormData('latitude', e.target.value)}
                        placeholder="0.0000"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Longitude
                        <span onClick={getLocation} style={{ color: '#10b981', cursor: 'pointer', fontSize: 12 }}>Ma position</span>
                    </label>
                    <input
                        type="number"
                        value={formData.longitude}
                        onChange={(e) => updateFormData('longitude', e.target.value)}
                        placeholder="0.0000"
                        style={inputStyle}
                    />
                </div>
            </div>}

            <div className="agent-grid-2">
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Numéro d'Escalade / SAV * <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(+indicatif)</span>
                    </label>
                    <input
                        type="text"
                        value={formData.escalation_phone}
                        onChange={(e) => updateFormData('escalation_phone', e.target.value)}
                        placeholder="+2250701010101"
                        style={{
                            ...inputStyle,
                            border: !isValidEscalationPhone(formData.escalation_phone) ? '1px solid #f87171' : inputStyle.border
                        }}
                    />
                    <p style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                        {!isValidEscalationPhone(formData.escalation_phone) ? 'Format : +225XXXXXXXXX (+ indicatif obligatoire, chiffres uniquement)' : ''}
                    </p>
                </div>
                {!isExternalSync && (
                <div>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                        Site Web
                    </label>
                    <input
                        type="text"
                        value={formData.site_url}
                        onChange={(e) => updateFormData('site_url', e.target.value)}
                        placeholder="https://"
                        style={inputStyle}
                    />
                </div>
                )}
            </div>
        </div>
    )
}
