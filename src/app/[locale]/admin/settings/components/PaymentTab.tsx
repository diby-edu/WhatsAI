import type { Dispatch, SetStateAction } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { AdminSettings, PaymentProviderReadiness } from '../types'

interface PaymentTabProps {
    settings: AdminSettings
    setSettings: Dispatch<SetStateAction<AdminSettings>>
    providerReadiness: {
        current: PaymentProviderReadiness
        cinetpay: PaymentProviderReadiness
        paystack: PaymentProviderReadiness
        feexpay: PaymentProviderReadiness
        paydunya: PaymentProviderReadiness
    } | null
    activeProviderReadiness: PaymentProviderReadiness | null
    paymentProviderLabel: (provider: string) => string
}

export function PaymentTab({ settings, setSettings, providerReadiness, activeProviderReadiness, paymentProviderLabel }: PaymentTabProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
                padding: 16,
                borderRadius: 12,
                background: activeProviderReadiness?.ready ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${activeProviderReadiness?.ready ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12
            }}>
                <AlertTriangle style={{
                    width: 20,
                    height: 20,
                    color: activeProviderReadiness?.ready ? '#4ade80' : '#f87171'
                }} />
                <div>
                    <div style={{
                        fontWeight: 600,
                        color: activeProviderReadiness?.ready ? '#4ade80' : '#f87171'
                    }}>
                        {activeProviderReadiness?.ready
                            ? `${paymentProviderLabel(settings.defaultPaymentProvider)} pilote actuellement les nouveaux paiements en ligne`
                            : `${paymentProviderLabel(settings.defaultPaymentProvider)} n est pas pret pour les nouveaux paiements en ligne`}
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>
                        {activeProviderReadiness?.ready
                            ? 'Les nouveaux liens de paiement en ligne peuvent etre generes normalement.'
                            : 'Les nouveaux paiements en ligne sont bloques tant que la configuration requise est incomplete.'}
                    </div>
                    {activeProviderReadiness && !activeProviderReadiness.ready && activeProviderReadiness.missingKeys.length > 0 && (
                        <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 6 }}>
                            Configuration manquante : {activeProviderReadiness.missingKeys.join(', ')}
                        </div>
                    )}
                    {activeProviderReadiness && activeProviderReadiness.warnings.length > 0 && (
                        <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 6 }}>
                            {activeProviderReadiness.warnings.join(' • ')}
                        </div>
                    )}
                </div>
            </div>

            <div>
                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                    Fournisseur de paiement par defaut
                </label>
                <select
                    value={settings.defaultPaymentProvider}
                    onChange={(e) => setSettings({ ...settings, defaultPaymentProvider: e.target.value })}
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: 'white'
                    }}
                >
                    <option
                        value="cinetpay"
                        disabled={Boolean(providerReadiness?.cinetpay && !providerReadiness.cinetpay.ready && settings.defaultPaymentProvider !== 'cinetpay')}
                    >
                        {providerReadiness?.cinetpay && !providerReadiness.cinetpay.ready ? 'CinetPay (non pret)' : 'CinetPay'}
                    </option>
                    <option
                        value="paystack"
                        disabled={Boolean(providerReadiness?.paystack && !providerReadiness.paystack.ready && settings.defaultPaymentProvider !== 'paystack')}
                    >
                        {providerReadiness?.paystack && !providerReadiness.paystack.ready ? 'Paystack (non pret)' : 'Paystack'}
                    </option>
                    <option
                        value="feexpay"
                        disabled={Boolean(providerReadiness?.feexpay && !providerReadiness.feexpay.ready && settings.defaultPaymentProvider !== 'feexpay')}
                    >
                        {providerReadiness?.feexpay && !providerReadiness.feexpay.ready ? 'FeexPay (non pret)' : 'FeexPay'}
                    </option>
                    <option
                        value="paydunya"
                        disabled={Boolean(providerReadiness?.paydunya && !providerReadiness.paydunya.ready && settings.defaultPaymentProvider !== 'paydunya')}
                    >
                        {providerReadiness?.paydunya && !providerReadiness.paydunya.ready ? 'PayDunya (non pret)' : 'PayDunya'}
                    </option>
                </select>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                    Ce choix pilote les nouveaux paiements en ligne crees par la plateforme. Les transactions deja lancees conservent leur fournisseur d origine.
                </p>
            </div>

            <div className="admin-settings-grid-2">
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(148, 163, 184, 0.1)'
                }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>
                        Lien de paiement automatique
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                        Le client recoit un lien de paiement securise. L argent est d abord collecte par la plateforme, puis reverse a l utilisateur par la plateforme.
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                        Fournisseur actif: {paymentProviderLabel(settings.defaultPaymentProvider)}
                        {activeProviderReadiness?.ready ? ' - pret' : ' - non pret'}
                    </div>
                </div>
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.35)',
                    border: '1px solid rgba(148, 163, 184, 0.1)'
                }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>
                        Paiement manuel
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                        Le client paie directement sur les moyens renseignes par le marchand. Le marchand verifie ensuite le paiement avant confirmation.
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                        Aucun lien heberge n est genere dans ce mode.
                    </div>
                </div>
            </div>

            <div>
                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                    Diagnostic CinetPay (lecture seule)
                </label>
                <select
                    value={settings.cinetpayMode}
                    onChange={(e) => setSettings({ ...settings, cinetpayMode: e.target.value })}
                    disabled
                    style={{
                        width: '100%',
                        padding: 14,
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.3)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8'
                    }}
                >
                    <option value="sandbox">Sandbox (Test)</option>
                    <option value="live">Production (Live)</option>
                </select>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                    Information technique uniquement. Les nouveaux paiements en ligne sont surtout pilotes par le fournisseur par defaut et les variables d environnement.
                </p>
            </div>

            <div className="admin-settings-grid-2">
                <div>
                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                        Site ID CinetPay
                    </label>
                    <input
                        type="password"
                        value={settings.cinetpaySiteId}
                        disabled
                        style={{
                            width: '100%',
                            padding: 14,
                            borderRadius: 10,
                            background: 'rgba(15, 23, 42, 0.3)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: '#64748b'
                        }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Configuré via variables d'environnement
                    </p>
                </div>
                <div>
                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                        Devise historique (lecture seule)
                    </label>
                    <select
                        value={settings.currency}
                        onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                        disabled
                        style={{
                            width: '100%',
                            padding: 14,
                            borderRadius: 10,
                            background: 'rgba(15, 23, 42, 0.3)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8'
                        }}
                    >
                        <option value="XOF">FCFA (XOF)</option>
                        <option value="XAF">FCFA (XAF)</option>
                        <option value="USD">Dollar (USD)</option>
                        <option value="EUR">Euro (EUR)</option>
                    </select>
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Cette valeur reste informative ici. Le runtime utilise la configuration serveur des fournisseurs.
                    </p>
                </div>
            </div>

            <div>
                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                    Taux de commission par défaut (%)
                </label>
                <input
                    className="admin-settings-small-input"
                    type="number"
                    value={settings.defaultCommissionRate}
                    onChange={(e) => setSettings({ ...settings, defaultCommissionRate: e.target.valueAsNumber })}
                    style={{
                        width: 150,
                        padding: 14,
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: 'white'
                    }}
                />
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                    Utilisé pour calculer le montant net lors de la création d'un reversement.
                </p>
            </div>
        </div>
    )
}
