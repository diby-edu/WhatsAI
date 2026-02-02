import crypto from 'crypto'

// CinetPay Configuration
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || ''
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY || ''
const CINETPAY_SECRET_KEY = process.env.CINETPAY_SECRET_KEY || ''
const CINETPAY_MODE = process.env.CINETPAY_MODE || 'sandbox'

const BASE_URL = CINETPAY_MODE === 'live'
    ? 'https://api-checkout.cinetpay.com/v2'
    : 'https://api-checkout.cinetpay.com/v2'

export interface PaymentInitData {
    amount: number
    currency?: string
    transactionId: string
    description: string
    customerName: string
    customerEmail: string
    customerPhone: string
    returnUrl: string
    notifyUrl: string
    metadata?: Record<string, any>
}

export interface PaymentInitResponse {
    success: boolean
    paymentUrl?: string
    paymentToken?: string
    error?: string
}

export interface PaymentStatus {
    success: boolean
    status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'
    transactionId: string
    amount?: number
    message?: string
}

/**
 * Initialize a payment with CinetPay
 */
export async function initializePayment(
    data: PaymentInitData
): Promise<PaymentInitResponse> {
    try {
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: data.transactionId,
            amount: data.amount,
            currency: data.currency || 'XOF',
            description: data.description,
            customer_name: data.customerName,
            customer_email: data.customerEmail,
            customer_phone_number: data.customerPhone,
            return_url: data.returnUrl,
            notify_url: data.notifyUrl,
            channels: 'ALL',
            metadata: JSON.stringify(data.metadata || {}),
            lang: 'fr',
        }

        const response = await fetch(`${BASE_URL}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (result.code === '201') {
            return {
                success: true,
                paymentUrl: result.data.payment_url,
                paymentToken: result.data.payment_token,
            }
        } else {
            return {
                success: false,
                error: result.message || 'Payment initialization failed',
            }
        }
    } catch (error) {
        console.error('CinetPay init error:', error)
        return {
            success: false,
            error: (error as Error).message,
        }
    }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(
    transactionId: string
): Promise<PaymentStatus> {
    try {
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
        }

        const response = await fetch(`${BASE_URL}/payment/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (result.code === '00') {
            const status = result.data.status

            let paymentStatus: PaymentStatus['status']
            switch (status) {
                case 'ACCEPTED':
                    paymentStatus = 'ACCEPTED'
                    break
                case 'REFUSED':
                    paymentStatus = 'REFUSED'
                    break
                case 'CANCELLED':
                    paymentStatus = 'CANCELLED'
                    break
                default:
                    paymentStatus = 'PENDING'
            }

            return {
                success: true,
                status: paymentStatus,
                transactionId,
                amount: result.data.amount,
                message: result.data.payment_method,
            }
        } else {
            return {
                success: false,
                status: 'UNKNOWN',
                transactionId,
                message: result.message,
            }
        }
    } catch (error) {
        console.error('CinetPay status check error:', error)
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId,
            message: (error as Error).message,
        }
    }
}

/**
 * Verify webhook signature (Timing-Safe)
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string
): boolean {
    if (!CINETPAY_SECRET_KEY) return true // Skip verification in development

    const expectedSignature = crypto
        .createHmac('sha256', CINETPAY_SECRET_KEY)
        .update(payload)
        .digest('hex')

    // ⭐ SECURITY FIX: Use timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
        return false
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        )
    } catch {
        return false
    }
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(prefix: string = 'WAZZAPAI'): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${prefix}_${timestamp}_${random}`.toUpperCase()
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, currency: string = 'XOF'): string {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}
