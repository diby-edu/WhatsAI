import type { CSSProperties } from 'react'
import {
    AUTOMATIC_PAYMENT_MODE_DESCRIPTION,
    AUTOMATIC_PAYMENT_MODE_HINT,
    AUTOMATIC_PAYMENT_MODE_LABEL,
    MANUAL_PAYMENT_METHODS_LABEL,
    MANUAL_PAYMENT_MODE_DESCRIPTION,
    MANUAL_PAYMENT_MODE_HINT,
    MANUAL_PAYMENT_MODE_LABEL,
} from '@/lib/payments/payment-mode-display'
import type { NewAgentFormData } from '../types'

interface StepPaymentProps {
    formData: NewAgentFormData
    updateFormData: (field: string, value: any) => void
    inputStyle: CSSProperties
    isExternalSync: boolean
    isSupportClient: boolean
}

export function StepPayment({ formData, updateFormData, inputStyle, isExternalSync, isSupportClient }: StepPaymentProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
        </div>
    )
}
