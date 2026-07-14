'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useTranslations, useFormatter } from 'next-intl'
import { Loader2, CheckCircle, CreditCard, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'

type FeexPayNetworkOption = {
    code: string
    label: string
    countryCode: string
    requiresOtp: boolean
}

type FeexPayCountryOption = {
    code: string
    name: string
    dialCode: string
    networks: FeexPayNetworkOption[]
}

export default function OrderPaymentPage() {
    const t = useTranslations('Pay')
    const format = useFormatter()
    const params = useParams()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [order, setOrder] = useState<any>(null)
    const [items, setItems] = useState<any[]>([])
    const [status, setStatus] = useState<'pending' | 'processing' | 'success' | 'error'>('pending')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [feexPayCountries, setFeexPayCountries] = useState<FeexPayCountryOption[]>([])
    const [selectedCountry, setSelectedCountry] = useState('')
    const [selectedNetwork, setSelectedNetwork] = useState('')
    const pollingRef = useRef(false)

    useEffect(() => {
        fetchOrder()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.orderId, searchParams.toString()])

    const verifyReturnPayment = async (transactionId: string) => {
        try {
            const response = await fetch(`/api/payments/status?transaction_id=${encodeURIComponent(transactionId)}`)
            const data = await response.json()

            if (data.success && data.status === 'ACCEPTED') {
                setStatus('success')
                setError('')
                setNotice('')
                return 'ACCEPTED'
            } else if (data.status === 'REFUSED' || data.status === 'CANCELLED') {
                setStatus('error')
                setError(t('error.refusedOrCancelled'))
                setNotice('')
                return String(data.status || 'UNKNOWN')
            } else if (data.status === 'PENDING') {
                setStatus('processing')
                setNotice(t('notice.confirmOnPhone'))
                return 'PENDING'
            }
        } catch (err) {
            console.error('Error verifying order payment:', err)
        }
        return 'UNKNOWN'
    }

    const waitForPaymentSettlement = async (transactionId: string) => {
        const normalizedTransactionId = String(transactionId || '').trim()
        if (!normalizedTransactionId || pollingRef.current) {
            return
        }

        pollingRef.current = true
        setStatus('processing')
        setNotice(t('notice.confirmOnPhone'))

        try {
            for (let attempt = 0; attempt < 18; attempt += 1) {
                const statusResult = await verifyReturnPayment(normalizedTransactionId)
                if (statusResult === 'ACCEPTED' || statusResult === 'REFUSED' || statusResult === 'CANCELLED') {
                    return
                }
                await new Promise((resolve) => setTimeout(resolve, 3000))
            }

            setStatus('processing')
            setNotice(t('notice.pendingRefresh'))
        } finally {
            pollingRef.current = false
        }
    }

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/public/orders/${params.orderId}`)
            const data = await res.json()

            if (!res.ok || data.error) {
                throw new Error(data.error || t('error.orderNotFound'))
            }

            setOrder(data.order)
            setItems(data.items || [])

            const countries = Array.isArray(data.feexpay?.countries)
                ? data.feexpay.countries as FeexPayCountryOption[]
                : []
            setFeexPayCountries(countries)

            if ((data.order?.payment_provider || '').toLowerCase() === 'feexpay' && countries.length > 0) {
                const defaultCountry = String(data.feexpay?.default_country || countries[0]?.code || '')
                const countryOption = countries.find((country) => country.code === defaultCountry) || countries[0]
                const requestedDefaultNetwork = String(data.feexpay?.default_network || '')
                const defaultNetwork = countryOption?.networks.find((network) => network.code === requestedDefaultNetwork)?.code
                    || countryOption?.networks[0]?.code
                    || ''

                setSelectedCountry(countryOption?.code || '')
                setSelectedNetwork(defaultNetwork)
            }

            const isDepositPaid = data.order.deposit_required && data.order.deposit_status === 'paid'
            const provider = String(data.order?.payment_provider || '').toLowerCase()
            const queryTransactionId = String(searchParams.get('transaction_id') || '').trim()
            const paymentMarker = String(searchParams.get('payment') || '').trim().toLowerCase()
            const paystackReference = searchParams.get('reference') || searchParams.get('trxref')

            if (data.order.status === 'paid' || data.order.status === 'completed' || isDepositPaid) {
                setStatus('success')
                setNotice('')
            } else if (paymentMarker === 'cancelled') {
                setStatus('error')
                setError(t('error.cancelled'))
                setNotice('')
            } else if (paymentMarker === 'pending') {
                const pendingTx = provider === 'feexpay'
                    ? String(data.order.transaction_id || queryTransactionId || '').trim()
                    : String(queryTransactionId || data.order.transaction_id || '').trim()

                if (pendingTx) {
                    await waitForPaymentSettlement(pendingTx)
                } else {
                    setStatus('processing')
                    setNotice(t('notice.pendingConfirmation'))
                }
            } else if (provider === 'paystack' && paystackReference) {
                await verifyReturnPayment(String(paystackReference))
            } else if (searchParams.get('status') === 'success' && data.order.transaction_id) {
                const successTx = provider === 'feexpay'
                    ? String(data.order.transaction_id || '').trim()
                    : String(paystackReference || data.order.transaction_id || '').trim()
                if (successTx) {
                    await waitForPaymentSettlement(successTx)
                }
            }
        } catch (err: any) {
            console.error('Error fetching order:', err)
            setError(err.message || t('error.orderFetchFailed'))
            setStatus('error')
        } finally {
            setLoading(false)
        }
    }

    const handlePayment = async () => {
        setError('')
        setNotice('')

        if ((order?.payment_provider || '').toLowerCase() === 'feexpay') {
            if (!selectedCountry || !selectedNetwork) {
                setError(t('error.selectCountryNetwork'))
                setStatus('error')
                return
            }
        }

        setStatus('processing')

        try {
            const payload = (order?.payment_provider || '').toLowerCase() === 'feexpay'
                ? {
                    feexpay_country: selectedCountry,
                    feexpay_network: selectedNetwork,
                }
                : {}

            const res = await fetch(`/api/public/orders/${params.orderId}/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok || !data.payment_url) {
                throw new Error(data.error || t('error.initFailed'))
            }

            const paymentUrl = String(data.payment_url || '').trim()
            if (!paymentUrl) {
                throw new Error(t('error.noPaymentUrl'))
            }

            const isInlinePendingReturn = (() => {
                try {
                    const currentUrl = new URL(window.location.href)
                    const targetUrl = new URL(paymentUrl, window.location.origin)
                    return (
                        currentUrl.pathname === targetUrl.pathname
                        && String(targetUrl.searchParams.get('payment') || '').trim().toLowerCase() === 'pending'
                    )
                } catch {
                    return false
                }
            })()

            if (isInlinePendingReturn) {
                const pendingTx = String(data.transaction_id || order?.transaction_id || '').trim()
                if (pendingTx) {
                    await waitForPaymentSettlement(pendingTx)
                    return
                }
            }

            window.location.href = paymentUrl
        } catch (err: any) {
            console.error('Payment failed:', err)
            setError(err.message || t('error.paymentFailed'))
            setStatus('error')
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">{t('errorScreen.title')}</h1>
                    <p className="text-slate-400">{error || t('errorScreen.unknownError')}</p>
                </div>
            </div>
        )
    }

    const isDepositPayment = order.deposit_required && order.deposit_status === 'pending'
    const payableAmount = Number(isDepositPayment ? order.deposit_amount_fcfa : order.total_fcfa || 0)
    const isFeexPay = (order.payment_provider || '').toLowerCase() === 'feexpay'
    const networksForSelectedCountry = feexPayCountries.find((country) => country.code === selectedCountry)?.networks || []

    if (status === 'success') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center"
                >
                    <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold mb-2">{t('success.title')}</h1>
                    <p className="text-slate-400 mb-6">
                        {isDepositPayment ? t('success.depositMessage') : t('success.orderMessage')}
                    </p>
                    <div className="bg-slate-950/50 rounded-xl p-4 mb-6 text-left">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">{t('success.orderLabel')}</span>
                            <span className="font-mono">#{order.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">{isDepositPayment ? t('success.depositLabel') : t('success.totalLabel')}</span>
                            <span className="font-semibold">{format.number(payableAmount)} FCFA</span>
                        </div>
                        {isDepositPayment && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">{t('success.orderTotalLabel')}</span>
                                <span>{format.number(Number(order.total_fcfa || 0))} FCFA</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
                        <p className="text-emerald-400 text-sm">
                            {t('success.whatsappNotice')}
                        </p>
                    </div>

                    <button
                        onClick={() => window.close()}
                        className="inline-flex items-center justify-center w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                    >
                        {t('success.closeButton')}
                    </button>
                </motion.div>
            </div >
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 flex items-center justify-center">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="w-8 h-8 text-blue-500" />
                    </div>
                    <h1 className="text-2xl font-bold">{t('summary.title')}</h1>
                    <p className="text-slate-400">{isDepositPayment ? t('summary.depositDue') : t('summary.totalDue')}</p>
                    <div className="text-4xl font-bold text-white mt-2">
                        {format.number(payableAmount)} <span className="text-lg text-slate-500">FCFA</span>
                    </div>
                    {isDepositPayment && (
                        <p className="text-sm text-slate-500 mt-2">
                            {t('summary.orderTotal', { amount: format.number(Number(order.total_fcfa || 0)) })}
                        </p>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">{t('summary.itemsHeading')}</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        {items.map((item: any, i: number) => (
                            <div key={i} className="p-4 flex justify-between items-center">
                                <div>
                                    <div className="font-medium">{item.product_name}</div>
                                    <div className="text-sm text-slate-500">{t('summary.quantityLabel')} {item.quantity}</div>
                                </div>
                                <div className="text-right">
                                    {format.number(item.unit_price_fcfa * item.quantity)} FCFA
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8">
                    <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-2">
                        {order.fulfillment_mode === 'takeaway' ? t('summary.pickupLabel') : t('summary.deliveryLabel')}
                    </h3>
                    <p>
                        {order.fulfillment_mode === 'takeaway'
                            ? (order.pickup_at ? t('summary.pickupScheduledAt', { time: order.pickup_at }) : t('summary.pickupOnSite'))
                            : (order.delivery_address || t('summary.noAddressSpecified'))
                        }
                    </p>
                </div>

                {status === 'processing' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6">
                        <p className="text-sm text-blue-200">
                            {notice || t('notice.processingDefault')}
                        </p>
                    </div>
                )}

                {isFeexPay && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
                        <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">
                            {t('feexpay.heading')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex flex-col gap-2">
                                <span className="text-xs text-slate-400">{t('feexpay.countryLabel')}</span>
                                <select
                                    value={selectedCountry}
                                    onChange={(event) => {
                                        const nextCountry = event.target.value
                                        const nextCountryOption = feexPayCountries.find((country) => country.code === nextCountry)
                                        setSelectedCountry(nextCountry)
                                        setSelectedNetwork(nextCountryOption?.networks?.[0]?.code || '')
                                    }}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white p-3"
                                >
                                    <option value="" disabled>{t('feexpay.selectCountryPlaceholder')}</option>
                                    {feexPayCountries.map((country) => (
                                        <option key={country.code} value={country.code}>
                                            {country.name} (+{country.dialCode})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-xs text-slate-400">{t('feexpay.networkLabel')}</span>
                                <select
                                    value={selectedNetwork}
                                    onChange={(event) => setSelectedNetwork(event.target.value)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white p-3"
                                    disabled={!selectedCountry}
                                >
                                    <option value="" disabled>{t('feexpay.selectNetworkPlaceholder')}</option>
                                    {networksForSelectedCountry.map((network) => (
                                        <option key={network.code} value={network.code}>
                                            {network.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {selectedNetwork && networksForSelectedCountry.find((network) => network.code === selectedNetwork)?.requiresOtp && (
                            <p className="mt-3 text-xs text-amber-300">
                                {t('feexpay.otpWarning')}
                            </p>
                        )}
                    </div>
                )}

                <button
                    onClick={handlePayment}
                    disabled={status === 'processing'}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === 'processing' ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            <CreditCard className="w-6 h-6" />
                            {isDepositPayment ? t('payButton.deposit') : t('payButton.full')}
                        </>
                    )}
                </button>
            </motion.div>
        </div>
    )
}
