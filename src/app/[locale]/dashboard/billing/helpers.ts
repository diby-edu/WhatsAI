import type { Payment } from './types'

export function formatHistoryProvider(provider?: string | null) {
    const normalized = String(provider || '').trim().toLowerCase()
    if (normalized === 'paystack') return 'Paystack'
    if (normalized === 'feexpay') return 'FeexPay'
    if (normalized === 'paydunya') return 'PayDunya'
    if (normalized === 'cinetpay') return 'CinetPay'
    if (normalized === 'admin') return 'Ajout administrateur'
    return provider || 'Paiement'
}

export function formatHistoryChannel(value?: string | null) {
    const raw = String(value || '').trim()
    if (!raw) return null

    const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_')
    const mapped: Record<string, string> = {
        mobile_money: 'Mobile Money',
        bank_transfer: 'Bank Transfer',
        direct_debit: 'Direct Debit',
        apple_pay: 'Apple Pay',
        ussd: 'USSD',
        qr: 'QR',
        card: 'Card',
        bank: 'Bank',
    }

    if (mapped[normalized]) {
        return mapped[normalized]
    }

    if (normalized === raw.toLowerCase()) {
        return raw
            .split(/[_\s-]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
    }

    return raw
}

export function getHistoryProviderLine(payment: Payment) {
    const providerLabel = formatHistoryProvider(payment.payment_provider)
    const detailLabel = formatHistoryChannel(payment.payment_channel_detail)
        || formatHistoryChannel(payment.payment_channel)

    return detailLabel
        ? `${providerLabel} - ${detailLabel}`
        : providerLabel
}
