export type AgentPaymentMode = 'cinetpay' | 'mobile_money_direct'
export type OrderPaymentDisplayMode = 'online' | 'manual' | 'onsite'

export const AUTOMATIC_PAYMENT_MODE_LABEL = 'Lien de paiement automatique'
export const AUTOMATIC_PAYMENT_MODE_DESCRIPTION =
    "Le client recoit un lien de paiement securise. Le paiement est d'abord collecte par la plateforme, puis vous est reverse."
export const AUTOMATIC_PAYMENT_MODE_HINT =
    'Le fournisseur actif de la plateforme est utilise automatiquement.'

export const MANUAL_PAYMENT_MODE_LABEL = 'Paiement manuel'
export const MANUAL_PAYMENT_MODE_DESCRIPTION =
    'Le client paie sur vos numeros ou autres moyens configures. Vous verifiez ensuite manuellement le paiement avant confirmation.'
export const MANUAL_PAYMENT_MODE_HINT =
    'Utilisez ce mode si vous souhaitez valider chaque paiement vous-meme.'

export const MANUAL_PAYMENT_METHODS_LABEL = 'Vos moyens de paiement manuels'

export interface OrderPaymentDisplayInput {
    paymentMethod?: string | null
    agentPaymentMode?: string | null
    fulfillmentMode?: string | null
    paymentProvider?: string | null
}

export interface OrderPaymentDisplay {
    mode: OrderPaymentDisplayMode
    modeLabel: string
    providerLabel: string | null
    usesHostedProvider: boolean
}

export function normalizeAgentPaymentMode(mode?: string | null): AgentPaymentMode {
    return String(mode || '').trim().toLowerCase() === 'mobile_money_direct'
        ? 'mobile_money_direct'
        : 'cinetpay'
}

export function formatPaymentProviderLabel(provider?: string | null): string | null {
    const normalized = String(provider || '').trim().toLowerCase()

    if (!normalized) return null
    if (normalized === 'paystack') return 'Paystack'
    if (normalized === 'cinetpay') return 'CinetPay'

    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function resolveOrderPaymentDisplay(input: OrderPaymentDisplayInput): OrderPaymentDisplay {
    const paymentMethod = String(input.paymentMethod || '').trim().toLowerCase()
    const agentPaymentMode = normalizeAgentPaymentMode(input.agentPaymentMode)

    if (paymentMethod === 'mobile_money_direct' || (!paymentMethod && agentPaymentMode === 'mobile_money_direct')) {
        return {
            mode: 'manual',
            modeLabel: 'Manuel',
            providerLabel: null,
            usesHostedProvider: false,
        }
    }

    if (paymentMethod === 'cod') {
        if (input.fulfillmentMode === 'delivery') {
            return {
                mode: 'onsite',
                modeLabel: 'A la livraison',
                providerLabel: null,
                usesHostedProvider: false,
            }
        }

        if (input.fulfillmentMode === 'takeaway') {
            return {
                mode: 'onsite',
                modeLabel: 'Au retrait',
                providerLabel: null,
                usesHostedProvider: false,
            }
        }

        return {
            mode: 'onsite',
            modeLabel: 'Sur place',
            providerLabel: null,
            usesHostedProvider: false,
        }
    }

    return {
        mode: 'online',
        modeLabel: 'En ligne',
        providerLabel: formatPaymentProviderLabel(input.paymentProvider),
        usesHostedProvider: true,
    }
}
