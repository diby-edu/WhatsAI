const crypto = require('crypto')

// CinetPay Configuration
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || ''
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY || ''
const CINETPAY_SECRET_KEY = process.env.CINETPAY_SECRET_KEY || ''
const CINETPAY_MODE = process.env.CINETPAY_MODE || 'sandbox'

const BASE_URL = CINETPAY_MODE === 'live'
    ? 'https://api-checkout.cinetpay.com/v2'
    : 'https://api-checkout.cinetpay.com/v2'

/**
 * Initialize a payment with CinetPay
 */
async function initializePayment(data) {
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
            error: error.message,
        }
    }
}

/**
 * Check payment status
 */
async function checkPaymentStatus(transactionId) {
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

            let paymentStatus
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
            message: error.message,
        }
    }
}

function verifyWebhookSignature(payload, signature) {
    if (!CINETPAY_SECRET_KEY) return true // Skip verification in development

    const expectedSignature = crypto
        .createHmac('sha256', CINETPAY_SECRET_KEY)
        .update(payload)
        .digest('hex')

    return signature === expectedSignature
}

module.exports = {
    initializePayment,
    checkPaymentStatus,
    verifyWebhookSignature
}
