'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
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
                setError('Le paiement a ete refuse ou annule.')
                setNotice('')
                return String(data.status || 'UNKNOWN')
            } else if (data.status === 'PENDING') {
                setStatus('processing')
                setNotice('Demande envoyee. Confirmez le paiement sur votre telephone...')
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
        setNotice('Demande envoyee. Confirmez le paiement sur votre telephone...')

        try {
            for (let attempt = 0; attempt < 18; attempt += 1) {
                const statusResult = await verifyReturnPayment(normalizedTransactionId)
                if (statusResult === 'ACCEPTED' || statusResult === 'REFUSED' || statusResult === 'CANCELLED') {
                    return
                }
                await new Promise((resolve) => setTimeout(resolve, 3000))
            }

            setStatus('processing')
            setNotice('Paiement en attente. Validez sur votre telephone puis actualisez cette page.')
        } finally {
            pollingRef.current = false
        }
    }

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/public/orders/${params.orderId}`)
            const data = await res.json()

            if (!res.ok || data.error) {
                throw new Error(data.error || 'Order not found')
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
                setError('Le paiement a ete annule.')
                setNotice('')
            } else if (paymentMarker === 'pending') {
                const pendingTx = provider === 'feexpay'
                    ? String(data.order.transaction_id || queryTransactionId || '').trim()
                    : String(queryTransactionId || data.order.transaction_id || '').trim()

                if (pendingTx) {
                    await waitForPaymentSettlement(pendingTx)
                } else {
                    setStatus('processing')
                    setNotice('Paiement en attente de confirmation...')
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
            setError(err.message || 'Commande introuvable')
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
                setError('Choisissez le pays et le reseau de paiement avant de continuer.')
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
                throw new Error(data.error || 'Echec de l initialisation du paiement')
            }

            const paymentUrl = String(data.payment_url || '').trim()
            if (!paymentUrl) {
                throw new Error('Aucune URL de paiement retournee')
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
            setError(err.message || 'Erreur de paiement')
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
                    <h1 className="text-2xl font-bold mb-2">Oups !</h1>
                    <p className="text-slate-400">{error || 'Erreur inconnue'}</p>
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
                    <h1 className="text-2xl font-bold mb-2">Paiement reussi !</h1>
                    <p className="text-slate-400 mb-6">
                        {isDepositPayment ? 'Votre acompte a ete confirme.' : 'Merci pour votre commande.'}
                    </p>
                    <div className="bg-slate-950/50 rounded-xl p-4 mb-6 text-left">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Commande</span>
                            <span className="font-mono">#{order.id.substring(0, 8)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">{isDepositPayment ? 'Acompte' : 'Total'}</span>
                            <span className="font-semibold">{payableAmount.toLocaleString('fr-FR')} FCFA</span>
                        </div>
                        {isDepositPayment && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Commande totale</span>
                                <span>{Number(order.total_fcfa || 0).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
                        <p className="text-emerald-400 text-sm">
                            Vous allez recevoir une confirmation sur WhatsApp
                        </p>
                    </div>

                    <button
                        onClick={() => window.close()}
                        className="inline-flex items-center justify-center w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors"
                    >
                        Fermer cette page
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
                    <h1 className="text-2xl font-bold">Resume de la commande</h1>
                    <p className="text-slate-400">{isDepositPayment ? 'Acompte a payer' : 'Total a payer'}</p>
                    <div className="text-4xl font-bold text-white mt-2">
                        {payableAmount.toLocaleString('fr-FR')} <span className="text-lg text-slate-500">FCFA</span>
                    </div>
                    {isDepositPayment && (
                        <p className="text-sm text-slate-500 mt-2">
                            Total commande: {Number(order.total_fcfa || 0).toLocaleString('fr-FR')} FCFA
                        </p>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                        <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">Articles</h3>
                    </div>
                    <div className="divide-y divide-slate-800">
                        {items.map((item: any, i: number) => (
                            <div key={i} className="p-4 flex justify-between items-center">
                                <div>
                                    <div className="font-medium">{item.product_name}</div>
                                    <div className="text-sm text-slate-500">Quantite: {item.quantity}</div>
                                </div>
                                <div className="text-right">
                                    {(item.unit_price_fcfa * item.quantity).toLocaleString('fr-FR')} FCFA
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8">
                    <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-2">
                        {order.fulfillment_mode === 'takeaway' ? 'Retrait' : 'Livraison'}
                    </h3>
                    <p>
                        {order.fulfillment_mode === 'takeaway'
                            ? (order.pickup_at ? `Retrait prevu a ${order.pickup_at}` : 'Retrait sur place')
                            : (order.delivery_address || 'Pas d adresse specifiee')
                        }
                    </p>
                </div>

                {status === 'processing' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6">
                        <p className="text-sm text-blue-200">
                            {notice || 'Paiement initie. Confirmez la demande sur votre telephone. Cette page met a jour le statut automatiquement.'}
                        </p>
                    </div>
                )}

                {isFeexPay && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
                        <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">
                            Paiement mobile money
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex flex-col gap-2">
                                <span className="text-xs text-slate-400">Pays</span>
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
                                    <option value="" disabled>Selectionner un pays</option>
                                    {feexPayCountries.map((country) => (
                                        <option key={country.code} value={country.code}>
                                            {country.name} (+{country.dialCode})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-xs text-slate-400">Reseau</span>
                                <select
                                    value={selectedNetwork}
                                    onChange={(event) => setSelectedNetwork(event.target.value)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white p-3"
                                    disabled={!selectedCountry}
                                >
                                    <option value="" disabled>Selectionner un reseau</option>
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
                                Ce reseau peut demander une validation OTP operateur.
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
                            {isDepositPayment ? 'Payer l acompte' : 'Payer maintenant'}
                        </>
                    )}
                </button>
            </motion.div>
        </div>
    )
}
