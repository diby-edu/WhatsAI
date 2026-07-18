import type { CSSProperties } from 'react'
import type { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
    AUTOMATIC_PAYMENT_MODE_DESCRIPTION,
    AUTOMATIC_PAYMENT_MODE_HINT,
    AUTOMATIC_PAYMENT_MODE_LABEL,
    MANUAL_PAYMENT_METHODS_LABEL,
    MANUAL_PAYMENT_MODE_DESCRIPTION,
    MANUAL_PAYMENT_MODE_HINT,
    MANUAL_PAYMENT_MODE_LABEL,
} from '@/lib/payments/payment-mode-display'
import type { NewAgentFormData, Personality } from '../types'

interface StepSettingsProps {
    t: ReturnType<typeof useTranslations>
    formData: NewAgentFormData
    updateFormData: (field: string, value: any) => void
    inputStyle: CSSProperties
    isExternalSync: boolean
    isSupportClient: boolean
    personalities: Personality[]
}

export function StepSettings({ t, formData, updateFormData, inputStyle, isExternalSync, isSupportClient, personalities }: StepSettingsProps) {
    if (isExternalSync) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ padding: 14, background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: 12, color: '#bae6fd', fontSize: 13, lineHeight: 1.6 }}>
                Quand un client répond à une notification, votre agent enverra ce message automatiquement puis redirigera vers le numéro de support.
            </div>
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    Message de redirection <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                    value={formData.external_sync_reply_message}
                    onChange={(e) => updateFormData('external_sync_reply_message', e.target.value)}
                    placeholder={`Merci pour votre message. Pour toute assistance, contactez notre équipe au ${formData.escalation_phone || '[numéro d\'escalade]'}.`}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' as const }}
                />
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                    Ce message est envoyé une seule fois quand le client écrit à votre agent.
                </p>
            </div>
        </div>
    )
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                    {t('Form.settings.language')}
                </label>
                <select
                    value={formData.language}
                    onChange={(e) => updateFormData('language', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="ar">العربية</option>
                </select>
            </div>

            {/* Voice Settings (Premium) — hidden, text-only responses */}
            <div style={{ display: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.enableVoice ? 16 : 0 }}>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                            🎙️ {t('Form.settings.voiceResponse')} <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fbbf24', color: 'black' }}>PREMIUM</span>
                        </h3>
                        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                            {t('Form.settings.voiceDescription')}
                        </p>
                    </div>
                    <button
                        onClick={() => updateFormData('enableVoice', !formData.enableVoice)}
                        style={{
                            width: 48,
                            height: 28,
                            borderRadius: 14,
                            background: formData.enableVoice ? '#10b981' : '#334155',
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
                            left: formData.enableVoice ? 23 : 3,
                            transition: 'left 0.2s'
                        }} />
                    </button>
                </div>

                {formData.enableVoice && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                    >
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            {t('Form.settings.voiceId')}
                        </label>
                        <div className="agent-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(voice => (
                                <button
                                    key={voice}
                                    onClick={() => updateFormData('voiceId', voice)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: formData.voiceId === voice ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                                        background: formData.voiceId === voice ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.3)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        fontSize: 13
                                    }}
                                >
                                    {voice}
                                </button>
                            ))}
                        </div>
                        <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 12 }}>
                            ⚠️ {t('Form.settings.voiceCostWarning', { cost: 5 })}
                        </p>
                    </motion.div>
                )}
            </div>

            {formData.mission === 'restaurant' && <div style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid rgba(16, 185, 129, 0.2)',
                background: formData.restaurant_deposit_enabled
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(15, 23, 42, 0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
                            Acompte reservations restaurant
                        </h3>
                        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            Utilise uniquement pour les reservations restaurant avec precommande.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => updateFormData('restaurant_deposit_enabled', !formData.restaurant_deposit_enabled)}
                        style={{
                            width: 48,
                            height: 28,
                            borderRadius: 14,
                            background: formData.restaurant_deposit_enabled ? '#10b981' : '#334155',
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            flexShrink: 0
                        }}
                    >
                        <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'white',
                            position: 'absolute',
                            top: 3,
                            left: formData.restaurant_deposit_enabled ? 23 : 3,
                            transition: 'left 0.2s'
                        }} />
                    </button>
                </div>

                {formData.restaurant_deposit_enabled && (
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Type d&apos;acompte
                            </label>
                            <div className="agent-grid-2" style={{ gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={() => updateFormData('restaurant_deposit_mode', 'percentage')}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        border: formData.restaurant_deposit_mode === 'percentage' ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                        background: formData.restaurant_deposit_mode === 'percentage' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                        color: formData.restaurant_deposit_mode === 'percentage' ? '#d1fae5' : '#cbd5e1',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Pourcentage
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateFormData('restaurant_deposit_mode', 'fixed')}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        border: formData.restaurant_deposit_mode === 'fixed' ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.15)',
                                        background: formData.restaurant_deposit_mode === 'fixed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                                        color: formData.restaurant_deposit_mode === 'fixed' ? '#d1fae5' : '#cbd5e1',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Montant fixe
                                </button>
                            </div>
                        </div>

                        {formData.restaurant_deposit_mode === 'percentage' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Pourcentage d&apos;acompte: {formData.restaurant_deposit_percentage}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={formData.restaurant_deposit_percentage}
                                        onChange={(e) => updateFormData('restaurant_deposit_percentage', parseInt(e.target.value))}
                                        style={{ width: '100%', accentColor: '#10b981' }}
                                    />
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={formData.restaurant_deposit_percentage}
                                    onChange={(e) => updateFormData('restaurant_deposit_percentage', Math.max(0, Math.min(100, parseInt(e.target.value || '0'))))}
                                    style={inputStyle}
                                />
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                    Exemple: 30% demande un acompte de 30% avant confirmation finale de la reservation.
                                </p>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                        Montant fixe de l&apos;acompte (FCFA)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="500"
                                        value={formData.restaurant_deposit_fixed_amount_fcfa}
                                        onChange={(e) => updateFormData('restaurant_deposit_fixed_amount_fcfa', Math.max(0, parseInt(e.target.value || '0')))}
                                        style={inputStyle}
                                    />
                                </div>
                                <p style={{ fontSize: 12, color: '#94a3b8' }}>
                                    Exemple: 5000 demande toujours 5 000 FCFA d&apos;acompte. Si le total est inferieur, l&apos;acompte sera plafonne au total.
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>}

            {/* Summary */}
            <div style={{
                padding: 20,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 12
            }}>
                <h3 style={{ fontWeight: 600, color: 'white', marginBottom: 16 }}>{t('Form.summary.title')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>{t('Form.summary.name')}</span>
                        <span style={{ color: 'white', fontWeight: 500 }}>{formData.name}</span>
                    </div>
                    {!isSupportClient && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>{t('Form.summary.personality')}</span>
                                <span style={{ color: 'white', fontWeight: 500 }}>
                                    {personalities.find(p => p.id === formData.personality)?.name}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>{t('Form.summary.emojis')}</span>
                                <span style={{ color: 'white', fontWeight: 500 }}>{formData.useEmojis ? 'Oui' : 'Non'}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Payment Settings Section */}
            <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 12 }}>
                    Mode de Paiement
                </label>
                {isExternalSync ? (
                    <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)', lineHeight: 1.6 }}>
                        Les commandes et paiements sont geres par votre plateforme externe. Le checkout natif WazzapAI est desactive pour cet agent.
                    </div>
                ) : isSupportClient ? (
                    <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 10, border: '1px solid rgba(148,163,184,0.1)' }}>
                        Paiement manuel activé automatiquement (mode Support Client).
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div
                            onClick={() => updateFormData('payment_mode', 'cinetpay')}
                            style={{
                                padding: 16,
                                border: `1px solid ${formData.payment_mode === 'cinetpay' ? '#6366f1' : 'rgba(148,163,184,0.1)'}`,
                                borderRadius: 12,
                                background: formData.payment_mode === 'cinetpay' ? 'rgba(99,102,241,0.1)' : 'rgba(30,41,59,0.5)',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{AUTOMATIC_PAYMENT_MODE_LABEL}</div>
                            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{AUTOMATIC_PAYMENT_MODE_DESCRIPTION}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{AUTOMATIC_PAYMENT_MODE_HINT}</div>
                        </div>
                        <div
                            onClick={() => updateFormData('payment_mode', 'mobile_money_direct')}
                            style={{
                                padding: 16,
                                border: `1px solid ${formData.payment_mode === 'mobile_money_direct' ? '#10b981' : 'rgba(148,163,184,0.1)'}`,
                                borderRadius: 12,
                                background: formData.payment_mode === 'mobile_money_direct' ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.5)',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{MANUAL_PAYMENT_MODE_LABEL}</div>
                            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{MANUAL_PAYMENT_MODE_DESCRIPTION}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{MANUAL_PAYMENT_MODE_HINT}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Money Numbers (only if direct mode or support client) */}
            {!isExternalSync && (formData.payment_mode === 'mobile_money_direct' || isSupportClient) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>
                        {MANUAL_PAYMENT_METHODS_LABEL}
                    </label>
                    <div className="agent-grid-2">
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                🟠 Orange Money
                            </label>
                            <input
                                type="text"
                                value={formData.mobile_money_orange}
                                onChange={(e) => updateFormData('mobile_money_orange', e.target.value)}
                                placeholder="+225 07 XX XX XX XX"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                🟡 MTN Money
                            </label>
                            <input
                                type="text"
                                value={formData.mobile_money_mtn}
                                onChange={(e) => updateFormData('mobile_money_mtn', e.target.value)}
                                placeholder="+225 05 XX XX XX XX"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                    <div className="agent-grid-2">
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                🔵 Wave
                            </label>
                            <input
                                type="text"
                                value={formData.mobile_money_wave}
                                onChange={(e) => updateFormData('mobile_money_wave', e.target.value)}
                                placeholder="+225 01 XX XX XX XX"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Custom Payment Methods */}
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Autres Moyens de Paiement
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {formData.custom_payment_methods.map((method, index) => (
                                <div className="agent-inline-fields" key={index} style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text"
                                        value={method.name}
                                        onChange={e => {
                                            const updated = [...formData.custom_payment_methods]
                                            updated[index].name = e.target.value
                                            updateFormData('custom_payment_methods', updated)
                                        }}
                                        placeholder="Nom (ex: PayPal)"
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <input
                                        type="text"
                                        value={method.details}
                                        onChange={e => {
                                            const updated = [...formData.custom_payment_methods]
                                            updated[index].details = e.target.value
                                            updateFormData('custom_payment_methods', updated)
                                        }}
                                        placeholder="Détails (ex: email@paypal.com)"
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = formData.custom_payment_methods.filter((_, i) => i !== index)
                                            updateFormData('custom_payment_methods', updated)
                                        }}
                                        style={{
                                            padding: '12px 16px',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            border: 'none',
                                            borderRadius: 12,
                                            color: '#f87171',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    updateFormData('custom_payment_methods', [...formData.custom_payment_methods, { name: '', details: '' }])
                                }}
                                style={{
                                    padding: '12px 16px',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 12,
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                ➕ Ajouter un moyen de paiement
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: 12, borderRadius: 8 }}>
                        ⚠️ Avec ce mode, les clients enverront une capture d'écran après paiement. Vous devrez vérifier manuellement dans Commandes.
                    </div>
                </div>
            )}

            {isExternalSync && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Live Query URL (optionnel)
                        </label>
                        <input
                            type="text"
                            value={formData.live_query_url}
                            onChange={(e) => updateFormData('live_query_url', e.target.value)}
                            placeholder="https://votre-plateforme.com/api/wazzap/live-query"
                            style={inputStyle}
                        />
                        <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                            Utilise pour interroger votre plateforme en temps reel pendant une conversation entrante.
                        </p>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                            Live Query Secret (optionnel)
                        </label>
                        <input
                            type="password"
                            value={formData.live_query_secret}
                            onChange={(e) => updateFormData('live_query_secret', e.target.value)}
                            placeholder="secret interne pour signer les requetes"
                            style={inputStyle}
                        />
                    </div>
                </div>
            )}

            {/* Section Collecte de Leads (support client + services) */}
            {isSupportClient && (
                <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <label style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                            Collecte de leads
                        </label>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                            Recommandé
                        </span>
                    </div>
                    {!formData.lead_collection_enabled && (
                        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                            <p style={{ color: '#f87171', fontWeight: 600, fontSize: 13, margin: '0 0 4px 0' }}>Les leads sont désactivés — vous perdez des prospects.</p>
                            <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Chaque client qui contacte votre agent est un prospect. Sans collecte, vous ne saurez jamais qui a écrit.</p>
                        </div>
                    )}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: 16, border: `1px solid ${formData.lead_collection_enabled ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.1)'}`, borderRadius: 12, background: formData.lead_collection_enabled ? 'rgba(16,185,129,0.06)' : 'rgba(30,41,59,0.5)', marginBottom: 16
                    }}>
                        <div>
                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>Activer la collecte de leads</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                                L'agent collecte le contact du client intéressé et vous notifie
                            </div>
                        </div>
                        <button type="button"
                            onClick={() => updateFormData('lead_collection_enabled', !formData.lead_collection_enabled)}
                            style={{ width: 48, height: 28, borderRadius: 14, background: formData.lead_collection_enabled ? '#10b981' : '#334155', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                        >
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: formData.lead_collection_enabled ? 23 : 3, transition: 'left 0.2s' }} />
                        </button>
                    </div>

                    {formData.lead_collection_enabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Informations à collecter
                                </label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[{ key: 'name', label: 'Prénom/Nom' }, { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'Email' }, { key: 'location', label: 'Localisation' }, { key: 'company', label: 'Entreprise' }].map(f => (
                                        <button key={f.key} type="button"
                                            onClick={() => {
                                                const cur = formData.lead_collect_fields
                                                updateFormData('lead_collect_fields', cur.includes(f.key) ? cur.filter(x => x !== f.key) : [...cur, f.key])
                                            }}
                                            style={{
                                                padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none',
                                                background: formData.lead_collect_fields.includes(f.key) ? '#10b981' : 'rgba(30,41,59,0.8)',
                                                color: formData.lead_collect_fields.includes(f.key) ? 'white' : '#94a3b8'
                                            }}
                                        >{f.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                    Message après enregistrement du lead
                                </label>
                                <input type="text" value={formData.lead_redirect_message}
                                    onChange={e => updateFormData('lead_redirect_message', e.target.value)}
                                    placeholder="Ex: Merci ! Nos équipes vous recontacteront sous 24h."
                                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                                />
                            </div>
                        </div>
                    )}

                    {!formData.lead_collection_enabled && (
                        <div>
                            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#e2e8f0', marginBottom: 8 }}>
                                Message de redirection (optionnel)
                            </label>
                            <input type="text" value={formData.lead_redirect_message}
                                onChange={e => updateFormData('lead_redirect_message', e.target.value)}
                                placeholder="Ex: Pour commander, appelez le +225 07 00 00 00"
                                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                            />
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                                Ce message sera affiché si un client exprime un intérêt commercial.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
