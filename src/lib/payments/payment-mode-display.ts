export type AgentPaymentMode = 'cinetpay' | 'mobile_money_direct'
export type OrderPaymentDisplayMode = 'online' | 'manual' | 'onsite'

const HOSTED_LINK_AGENT_PAYMENT_MODE_VALUES = new Set([
    'cinetpay',
    'hosted_link',
    'payment_link',
    'automatic',
    'automatic_link',
    'lien_automatique',
])

const MANUAL_AGENT_PAYMENT_MODE_VALUES = new Set([
    'mobile_money_direct',
    'manual',
    'manual_payment',
    'paiement_manuel',
])

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

export function parseAgentPaymentMode(mode?: string | null): AgentPaymentMode | null {
    const normalized = String(mode || '').trim().toLowerCase()

    if (!normalized) return null
    if (HOSTED_LINK_AGENT_PAYMENT_MODE_VALUES.has(normalized)) return 'cinetpay'
    if (MANUAL_AGENT_PAYMENT_MODE_VALUES.has(normalized)) return 'mobile_money_direct'

    return null
}

export function normalizeAgentPaymentMode(mode?: string | null): AgentPaymentMode {
    return parseAgentPaymentMode(mode) || 'cinetpay'
}

export function coerceAgentPaymentModeOrThrow(mode?: string | null): AgentPaymentMode | null {
    const parsed = parseAgentPaymentMode(mode)
    if (parsed) return parsed

    const normalized = String(mode || '').trim()
    if (!normalized) return null

    throw new Error(`Unsupported agent payment mode: ${normalized}`)
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
