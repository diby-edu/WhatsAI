'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
    CreditCard,
    Sparkles,
    Crown,
    Zap,
    Package,
    TrendingUp,
    AlertCircle,
    Loader2,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Star,
    Calendar
} from 'lucide-react'
import { useTranslations, useFormatter } from 'next-intl'
import { useCurrency } from '@/contexts/CurrencyContext'
import { createClient } from '@/lib/supabase/client'
import {
    listFeexPayCountries,
    listFeexPayNetworksByCountry,
    isFeexPayOtpNetwork,
    type FeexPayCountryCode,
    type FeexPayNetworkCode,
} from '@/lib/payments/feexpay-networks'

interface Plan {
    id: string
    name: string
    price: number
    credits: number
    features: string[]
    is_popular: boolean
}

interface CreditPack {
    id: string
    name?: string
    credits: number
    price: number
    savings: number
}

interface UserData {
    plan: string
    credits_balance: number
    credits_used_this_month: number
    subscription_end: string | null
}

interface Payment {
    id: string
    amount_fcfa: number
    description: string
    status: string
    payment_provider?: string | null
    payment_channel?: string | null
    payment_channel_detail?: string | null
    reference?: string | null
    created_at: string
    completed_at?: string | null
}

type SupportedPaymentProvider = 'cinetpay' | 'paystack' | 'feexpay'

type FeexPayPaymentIntent = {
    type: 'subscription' | 'credits'
    targetId: string
}

export default function BillingPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <BillingContent />
        </Suspense>
    )
}

function BillingContent() {
    const t = useTranslations('Billing')
    const format = useFormatter()
    const searchParams = useSearchParams()
    const { formatFromFcfa } = useCurrency()

    const [isLoading, setIsLoading] = useState<string | null>(null)
    const [userData, setUserData] = useState<UserData | null>(null)
    const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null)
    const [creditsIncluded, setCreditsIncluded] = useState<number>(0)
    const [creditsFrozenAt, setCreditsFrozenAt] = useState<string | null>(null)
    const [creditsExpireAt, setCreditsExpireAt] = useState<string | null>(null)
    const [payments, setPayments] = useState<Payment[]>([])
    const [plans, setPlans] = useState<Plan[]>([])
    const [creditPacks, setCreditPacks] = useState<CreditPack[]>([])
    const [loading, setLoading] = useState(true)
    const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | 'pending' | null>(null)
    const [defaultPaymentProvider, setDefaultPaymentProvider] = useState<SupportedPaymentProvider>('cinetpay')
    const [feexPayIntent, setFeexPayIntent] = useState<FeexPayPaymentIntent | null>(null)
    const [showFeexPayModal, setShowFeexPayModal] = useState(false)
    const [feexPayCountry, setFeexPayCountry] = useState<FeexPayCountryCode>('CI')
    const [feexPayNetwork, setFeexPayNetwork] = useState<FeexPayNetworkCode | ''>('')
    const [feexPayPhone, setFeexPayPhone] = useState('')
    const [feexPayOtp, setFeexPayOtp] = useState('')
    const [feexPayError, setFeexPayError] = useState<string | null>(null)
    const [isBrowser, setIsBrowser] = useState(false)

    const feexPayCountries = listFeexPayCountries()
    const feexPayNetworks = listFeexPayNetworksByCountry(feexPayCountry)
    const selectedFeexPayNetwork = feexPayNetworks.find((network) => network.code === feexPayNetwork) || null
    const feexPayNeedsOtp = isFeexPayOtpNetwork(feexPayNetwork)

    const getHistoryStatusMeta = (status: string) => {
        const normalized = String(status || '').trim().toLowerCase()

        if (normalized === 'completed') {
            return {
                color: '#34d399',
                label: t('History.status.completed'),
            }
        }

        if (normalized === 'processing' || normalized === 'pending') {
            return {
                color: '#fbbf24',
                label: 'En cours',
            }
        }

        return {
            color: '#f87171',
            label: t('History.status.failed'),
        }
    }

    const getHistoryTimestamp = (payment: Payment) => {
        const dateSource = payment.status === 'completed' && payment.completed_at
            ? payment.completed_at
            : payment.created_at

        return format.dateTime(new Date(dateSource), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const formatHistoryProvider = (provider?: string | null) => {
        const normalized = String(provider || '').trim().toLowerCase()
        if (normalized === 'paystack') return 'Paystack'
        if (normalized === 'feexpay') return 'FeexPay'
        if (normalized === 'cinetpay') return 'CinetPay'
        return provider || 'Paiement'
    }

    const formatHistoryChannel = (value?: string | null) => {
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

    const getHistoryProviderLine = (payment: Payment) => {
        const providerLabel = formatHistoryProvider(payment.payment_provider)
        const detailLabel = formatHistoryChannel(payment.payment_channel_detail)
            || formatHistoryChannel(payment.payment_channel)

        return detailLabel
            ? `${providerLabel} - ${detailLabel}`
            : providerLabel
    }

    // Check for payment return
    useEffect(() => {
        const paymentParam = searchParams.get('payment')
        const transactionId = searchParams.get('transaction_id')
        const paystackReference = searchParams.get('reference') || searchParams.get('trxref')

        // CinetPay specific params
        const cpmTransId = searchParams.get('cpm_trans_id')
        // const cpmSiteId = searchParams.get('cpm_site_id') // Unused

        if (paymentParam === 'success' || cpmTransId) {
            // User returned from successful payment
            setPaymentStatus('success')

            // If we have a transaction ID (CinetPay), verify it
            if (cpmTransId) {
                checkPaymentStatus(cpmTransId)
            } else {
                fetchData() // Refresh to get updated credits
            }
        } else if (paymentParam === 'cancelled') {
            setPaymentStatus('failed')
        } else if (paymentParam === 'pending' && transactionId) {
            setPaymentStatus('pending')
            checkPaymentStatus(transactionId)
        } else if (paystackReference) {
            setPaymentStatus('success')
            checkPaymentStatus(paystackReference)
        } else if (transactionId) {
            // Check specific transaction
            checkPaymentStatus(transactionId)
        }
    }, [searchParams])

    // Fetch user data, plans, payments and credit packs
    useEffect(() => {
        fetchData()
        fetchPlans()
        fetchCreditPacks()
        fetchPayments()
        fetchPaymentConfig()
    }, [])

    useEffect(() => {
        setIsBrowser(true)
    }, [])

    useEffect(() => {
        if (!isBrowser) return

        const previousOverflow = document.body.style.overflow
        if (showFeexPayModal) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = previousOverflow || ''
        }

        return () => {
            document.body.style.overflow = previousOverflow || ''
        }
    }, [showFeexPayModal, isBrowser])

    useEffect(() => {
        if (!feexPayNetworks.length) {
            setFeexPayNetwork('')
            return
        }

        const hasCurrentNetwork = feexPayNetworks.some((network) => network.code === feexPayNetwork)
        if (!hasCurrentNetwork) {
            setFeexPayNetwork(feexPayNetworks[0].code)
        }
    }, [feexPayCountry, feexPayNetwork, feexPayNetworks])

    const fetchPlans = async () => {
        try {
            const res = await fetch('/api/plans')
            const data = await res.json()
            if (data.plans) {
                // Filter out free plans (price = 0)
                const paidPlans = data.plans.filter((p: Plan) => p.price > 0)
                // Ensure Scale plan always shows even if not in DB yet
                const hasScale = paidPlans.some((p: Plan) => p.name.toLowerCase().includes('scale'))
                if (!hasScale) {
                    paidPlans.push({
                        id: 'scale',
                        name: 'Scale',
                        price: 129900,
                        credits: 20000,
                        features: [],
                        is_popular: false
                    })
                }
                setPlans(paidPlans)
            }
        } catch (err) {
            console.error('Error fetching plans:', err)
        }
    }

    const fetchCreditPacks = async () => {
        try {
            const res = await fetch('/api/credit-packs')
            const data = await res.json()
            if (data.packs && data.packs.length > 0) {
                setCreditPacks(data.packs)
            } else {
                // Fallback Boost packs (prices in FCFA)
                setCreditPacks([
                    { id: 'boost_mini', credits: 200, price: 3000, savings: 0 },
                    { id: 'boost_s', credits: 500, price: 7000, savings: 7 },
                    { id: 'boost_m', credits: 2000, price: 25000, savings: 17 },
                    { id: 'boost_l', credits: 5000, price: 55000, savings: 27 },
                    { id: 'boost_xl', credits: 12000, price: 110000, savings: 39 },
                ])
            }
        } catch (err) {
            console.error('Error fetching credit packs:', err)
            // Fallback Boost packs (prices in FCFA)
            setCreditPacks([
                { id: 'boost_mini', credits: 200, price: 3000, savings: 0 },
                { id: 'boost_s', credits: 500, price: 7000, savings: 7 },
                { id: 'boost_m', credits: 2000, price: 25000, savings: 17 },
                { id: 'boost_l', credits: 5000, price: 55000, savings: 27 },
                { id: 'boost_xl', credits: 12000, price: 110000, savings: 39 },
            ])
        }
    }

    const fetchData = async () => {
        try {
            // Fetch profile
            const profileRes = await fetch('/api/profile')
            if (profileRes.ok) {
                const data = await profileRes.json()
                setUserData(data.data?.profile)
            }

            // Fetch active subscription to get expiry date
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: sub } = await supabase
                    .from('subscriptions')
                    .select('current_period_end, credits_included')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .gte('current_period_end', new Date().toISOString())
                    .maybeSingle()
                setSubscriptionEnd(sub?.current_period_end || null)
                setCreditsIncluded(sub?.credits_included || 0)

                const { data: profileExtra } = await supabase
                    .from('profiles')
                    .select('credits_frozen_at, credits_expire_at')
                    .eq('id', user.id)
                    .single()
                setCreditsFrozenAt(profileExtra?.credits_frozen_at || null)
                setCreditsExpireAt(profileExtra?.credits_expire_at || null)
            }
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchPayments = async () => {
        try {
            const res = await fetch('/api/payments')
            if (res.ok) {
                const data = await res.json()
                setPayments(data.data?.payments || [])
            }
        } catch (err) {
            console.error('Error fetching payments:', err)
        }
    }

    const fetchPaymentConfig = async () => {
        try {
            const res = await fetch('/api/payments/config')
            if (!res.ok) return
            const data = await res.json()
            const provider = String(data?.data?.defaultPaymentProvider || '').trim().toLowerCase()
            if (provider === 'paystack' || provider === 'cinetpay' || provider === 'feexpay') {
                setDefaultPaymentProvider(provider)
            }
        } catch (err) {
            console.error('Error fetching payment config:', err)
        }
    }

    const checkPaymentStatus = async (paymentId: string) => {
        try {
            // Call verify API which checks with the configured provider and credits user
            const res = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: paymentId, transactionId: paymentId }), // Send as both to be safe
            })
            const data = await res.json()

            if (!res.ok) {
                setPaymentStatus('failed')
                fetchPayments()
                return
            }

            const providerStatus = String(data.provider_status || '').trim().toUpperCase()
            const currentStatus = String(data.current_status || '').trim().toLowerCase()

            if (data.success && (data.credits_added || currentStatus === 'completed')) {
                setPaymentStatus('success')
                fetchData() // Refresh user data to show new balance
                fetchPayments()
            } else if (
                providerStatus === 'REFUSED'
                || providerStatus === 'CANCELLED'
                || currentStatus === 'failed'
            ) {
                setPaymentStatus('failed')
                fetchPayments()
            } else {
                // Payment still pending, check again in 3 seconds.
                setPaymentStatus('pending')
                setTimeout(() => checkPaymentStatus(paymentId), 3000)
            }
        } catch (err) {
            console.error('Error checking payment:', err)
            setPaymentStatus('failed')
        }
    }

    const handleSubscribe = async (planId: string) => {
        setIsLoading(planId)
        try {
            const res = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'subscription', planId }),
            })
            const data = await res.json()

            if (data.data?.paymentUrl) {
                window.location.href = data.data.paymentUrl
            } else {
                alert(data.error || 'Erreur lors de l\'initialisation du paiement')
            }
        } catch (err) {
            console.error(err)
            alert('Erreur réseau')
        } finally {
            setIsLoading(null)
        }
    }

    const handleBuyCredits = async (packId: string) => {
        setIsLoading(packId)
        try {
            const res = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'credits', packId }),
            })
            const data = await res.json()

            if (data.data?.paymentUrl) {
                window.location.href = data.data.paymentUrl
            } else {
                alert(data.error || 'Erreur lors de l\'initialisation du paiement')
            }
        } catch (err) {
            console.error(err)
            alert('Erreur réseau')
        } finally {
            setIsLoading(null)
        }
    }

    const openFeexPayModal = (intent: FeexPayPaymentIntent) => {
        setFeexPayIntent(intent)
        setFeexPayError(null)
        setFeexPayOtp('')
        setFeexPayPhone('')
        setShowFeexPayModal(true)
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const closeFeexPayModal = () => {
        if (isLoading) return
        setShowFeexPayModal(false)
        setFeexPayIntent(null)
        setFeexPayError(null)
    }

    const initializePaymentV2 = async (payload: Record<string, any>, loadingKey: string) => {
        setIsLoading(loadingKey)
        try {
            const res = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data?.error || 'Erreur lors de l initialisation du paiement')
            }

            const paymentUrl = String(data?.data?.paymentUrl || '').trim()
            const transactionId = String(data?.data?.transactionId || '').trim()

            if (!paymentUrl) {
                throw new Error('URL de paiement manquante')
            }

            const isPendingFallbackUrl = paymentUrl.includes('/dashboard/billing') && paymentUrl.includes('payment=pending')

            if (isPendingFallbackUrl) {
                setPaymentStatus('pending')
                fetchPayments()
                if (transactionId) {
                    setTimeout(() => checkPaymentStatus(transactionId), 1500)
                }
                return
            }

            window.location.href = paymentUrl
        } finally {
            setIsLoading(null)
        }
    }

    const submitFeexPayModal = async () => {
        if (!feexPayIntent) return

        if (!feexPayCountry || !feexPayNetwork) {
            setFeexPayError('Veuillez choisir un pays et un reseau')
            return
        }

        const normalizedPhone = feexPayPhone.replace(/\s+/g, '')
        if (!normalizedPhone) {
            setFeexPayError('Le numero payeur est obligatoire')
            return
        }

        if (!normalizedPhone.startsWith('+')) {
            setFeexPayError('Le numero payeur doit etre au format international (ex: +225...)')
            return
        }

        if (feexPayNeedsOtp && !String(feexPayOtp || '').trim()) {
            setFeexPayError('OTP requis pour ce reseau')
            return
        }

        const payload: Record<string, any> = {
            type: feexPayIntent.type,
            feexpay_country: feexPayCountry,
            feexpay_network: feexPayNetwork,
            feexpay_phone: normalizedPhone,
        }

        if (feexPayIntent.type === 'subscription') {
            payload.planId = feexPayIntent.targetId
        } else {
            payload.packId = feexPayIntent.targetId
        }

        if (feexPayNeedsOtp && String(feexPayOtp || '').trim()) {
            payload.feexpay_otp = String(feexPayOtp).trim()
        }

        setFeexPayError(null)
        try {
            await initializePaymentV2(payload, feexPayIntent.targetId)
            setShowFeexPayModal(false)
            setFeexPayIntent(null)
        } catch (err: any) {
            const message = String(err?.message || 'Erreur reseau')
            setFeexPayError(message)
            alert(message)
        }
    }

    const handleSubscribeV2 = async (planId: string) => {
        if (defaultPaymentProvider === 'feexpay') {
            openFeexPayModal({ type: 'subscription', targetId: planId })
            return
        }

        try {
            await initializePaymentV2({ type: 'subscription', planId }, planId)
        } catch (err: any) {
            alert(String(err?.message || 'Erreur reseau'))
        }
    }

    const handleBuyCreditsV2 = async (packId: string) => {
        if (defaultPaymentProvider === 'feexpay') {
            openFeexPayModal({ type: 'credits', targetId: packId })
            return
        }

        try {
            await initializePaymentV2({ type: 'credits', packId }, packId)
        } catch (err: any) {
            alert(String(err?.message || 'Erreur reseau'))
        }
    }

    const getPlanIcon = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes('scale')) return Star
        if (lower.includes('business') || lower.includes('enterprise')) return TrendingUp
        if (lower.includes('pro')) return Crown
        return Zap
    }

    const getPlanColor = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes('scale')) return '#a78bfa'
        if (lower.includes('business') || lower.includes('enterprise')) return '#f59e0b'
        if (lower.includes('pro')) return '#10b981'
        return '#3b82f6'
    }

    const cardStyle = {
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 14,
        padding: 20
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    const creditsBalance = userData?.credits_balance || 0
    const creditsUsed = userData?.credits_used_this_month || 0
    const currentPlan = userData?.plan || 'free'
    const usagePct = creditsIncluded > 0 ? Math.min(Math.round((creditsUsed / creditsIncluded) * 100), 100) : 0
    const progressColor = usagePct >= 85 ? '#ef4444' : usagePct >= 75 ? '#f59e0b' : '#34d399'
    const isScalePlan = currentPlan === 'scale'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>{t('title')}</h1>
                <p style={{ color: '#64748b', fontSize: 13 }}>{t('subtitle')}</p>
            </div>

            {/* Payment Status Notification */}
            {paymentStatus && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: 14,
                        borderRadius: 10,
                        background: paymentStatus === 'success'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : paymentStatus === 'pending'
                                ? 'rgba(245, 158, 11, 0.12)'
                                : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${paymentStatus === 'success'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : paymentStatus === 'pending'
                                ? 'rgba(245, 158, 11, 0.3)'
                                : 'rgba(239, 68, 68, 0.2)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}
                >
                    {paymentStatus === 'success' ? (
                        <>
                            <CheckCircle2 style={{ width: 20, height: 20, color: '#34d399' }} />
                            <div>
                                <div style={{ fontWeight: 500, color: '#34d399', fontSize: 14 }}>{t('status.success.title')}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('status.success.message')}</div>
                            </div>
                        </>
                    ) : paymentStatus === 'pending' ? (
                        <>
                            <Loader2 style={{ width: 20, height: 20, color: '#f59e0b', animation: 'spin 1s linear infinite' }} />
                            <div>
                                <div style={{ fontWeight: 500, color: '#f59e0b', fontSize: 14 }}>
                                    Paiement en attente de confirmation
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                    Confirmez la demande sur votre telephone. Le statut sera mis a jour automatiquement.
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <XCircle style={{ width: 20, height: 20, color: '#f87171' }} />
                            <div>
                                <div style={{ fontWeight: 500, color: '#f87171', fontSize: 14 }}>{t('status.failed.title')}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('status.failed.message')}</div>
                            </div>
                        </>
                    )}
                </motion.div>
            )}

            {isBrowser && showFeexPayModal && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(2, 6, 23, 0.72)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 9999,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 520,
                            background: 'rgba(15, 23, 42, 0.98)',
                            border: '1px solid rgba(148, 163, 184, 0.24)',
                            borderRadius: 14,
                            padding: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>
                            Paiement FeexPay
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.4 }}>
                            Choisissez le pays, le reseau et le numero payeur Mobile Money.
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                                Pays
                                <select
                                    value={feexPayCountry}
                                    onChange={(event) => setFeexPayCountry(event.target.value as FeexPayCountryCode)}
                                    disabled={Boolean(isLoading)}
                                    style={{
                                        height: 40,
                                        borderRadius: 8,
                                        border: '1px solid rgba(148, 163, 184, 0.25)',
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        color: 'white',
                                        padding: '0 10px',
                                    }}
                                >
                                    {feexPayCountries.map((country) => (
                                        <option key={country.code} value={country.code}>
                                            {country.name} (+{country.dialCode})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                                Reseau
                                <select
                                    value={feexPayNetwork}
                                    onChange={(event) => setFeexPayNetwork(event.target.value as FeexPayNetworkCode)}
                                    disabled={Boolean(isLoading)}
                                    style={{
                                        height: 40,
                                        borderRadius: 8,
                                        border: '1px solid rgba(148, 163, 184, 0.25)',
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        color: 'white',
                                        padding: '0 10px',
                                    }}
                                >
                                    {feexPayNetworks.map((network) => (
                                        <option key={network.code} value={network.code}>
                                            {network.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                            Numero payeur (format international)
                            <input
                                type="tel"
                                value={feexPayPhone}
                                onChange={(event) => setFeexPayPhone(event.target.value)}
                                placeholder="+2250700000000"
                                disabled={Boolean(isLoading)}
                                style={{
                                    height: 40,
                                    borderRadius: 8,
                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    color: 'white',
                                    padding: '0 10px',
                                }}
                            />
                        </label>

                        {feexPayNeedsOtp && (
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                                OTP
                                <input
                                    type="text"
                                    value={feexPayOtp}
                                    onChange={(event) => setFeexPayOtp(event.target.value)}
                                    placeholder="Code OTP"
                                    disabled={Boolean(isLoading)}
                                    style={{
                                        height: 40,
                                        borderRadius: 8,
                                        border: '1px solid rgba(148, 163, 184, 0.25)',
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        color: 'white',
                                        padding: '0 10px',
                                    }}
                                />
                            </label>
                        )}

                        {selectedFeexPayNetwork && (
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                Canal: {selectedFeexPayNetwork.label} ({selectedFeexPayNetwork.supportsHostedRedirect ? 'redirection web' : 'confirmation mobile'})
                            </div>
                        )}

                        {feexPayError && (
                            <div style={{ color: '#f87171', fontSize: 12 }}>
                                {feexPayError}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                            <button
                                type="button"
                                onClick={closeFeexPayModal}
                                disabled={Boolean(isLoading)}
                                style={{
                                    height: 38,
                                    borderRadius: 8,
                                    border: '1px solid rgba(148, 163, 184, 0.3)',
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    color: 'white',
                                    padding: '0 14px',
                                    cursor: 'pointer',
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={submitFeexPayModal}
                                disabled={Boolean(isLoading)}
                                style={{
                                    height: 38,
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    padding: '0 14px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                                        Initialisation...
                                    </>
                                ) : 'Continuer'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Frozen credits banner */}
            {creditsFrozenAt && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '14px 18px',
                        borderRadius: 12,
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}
                >
                    <AlertCircle style={{ width: 20, height: 20, color: '#f59e0b', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontWeight: 600, color: '#f59e0b', fontSize: 14 }}>
                            🛡️ Crédits sécurisés (Sursis)
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(245, 158, 11, 0.8)', marginTop: 2 }}>
                            Vos {creditsBalance.toLocaleString()} crédits sont sécurisés
                            {creditsExpireAt && ` jusqu'au ${new Date(creditsExpireAt).toLocaleDateString('fr-FR')}`}.
                            Renouvelez votre abonnement pour les réactiver.
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Current Plan Overview */}
            <div className="billing-stats-grid" style={{ display: 'grid', gap: 16 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(16, 185, 129, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Crown style={{ width: 20, height: 20, color: '#34d399' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{t('Overview.currentPlan')}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'white', textTransform: 'capitalize' }}>
                                {currentPlan}
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(59, 130, 246, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Sparkles style={{ width: 20, height: 20, color: '#60a5fa' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{t('Overview.remainingCredits')}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                                {creditsBalance.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(168, 85, 247, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <TrendingUp style={{ width: 20, height: 20, color: '#c084fc' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{t('Overview.usedThisMonth')}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                                {creditsUsed.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'rgba(245, 158, 11, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Calendar style={{ width: 20, height: 20, color: '#fbbf24' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Renouvellement</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: subscriptionEnd ? 'white' : '#64748b' }}>
                                {subscriptionEnd
                                    ? new Date(subscriptionEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : currentPlan !== 'free'
                                        ? 'Géré manuellement'
                                        : 'Plan gratuit'}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Credit usage progress bar */}
            {creditsIncluded > 0 && !creditsFrozenAt && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '16px 20px',
                        borderRadius: 14,
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8' }}>Utilisation ce mois</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: progressColor }}>
                            {creditsUsed.toLocaleString()} / {creditsIncluded.toLocaleString()} crédits ({usagePct}%)
                        </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${usagePct}%`,
                            borderRadius: 4,
                            background: progressColor,
                            transition: 'width 0.5s ease'
                        }} />
                    </div>
                    {usagePct >= 85 && !isScalePlan && (
                        <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertCircle style={{ width: 14, height: 14 }} />
                            85% atteint — <a href="/dashboard/billing" style={{ color: '#ef4444', textDecoration: 'underline' }}>Passez au plan supérieur</a>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Scale plan advantages */}
            {isScalePlan && subscriptionEnd && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '20px',
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.05))',
                        border: '1px solid rgba(245, 158, 11, 0.25)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Crown style={{ width: 20, height: 20, color: '#f59e0b' }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>Avantages Scale</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles style={{ width: 16, height: 16, color: '#fbbf24', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                                <strong style={{ color: 'white' }}>Rollover 20%</strong> — crédits non utilisés reportés au prochain cycle
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap style={{ width: 16, height: 16, color: '#fbbf24', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                                <strong style={{ color: 'white' }}>+2 000 crédits bonus</strong> automatiques à chaque renouvellement
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Calendar style={{ width: 16, height: 16, color: '#fbbf24', flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                                Prochain renouvellement le <strong style={{ color: 'white' }}>{new Date(subscriptionEnd).toLocaleDateString('fr-FR')}</strong>
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Low credits warning */}
            {creditsBalance < 5 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        padding: 14,
                        borderRadius: 10,
                        background: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}
                >
                    <AlertCircle style={{ width: 20, height: 20, color: '#facc15', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontWeight: 500, color: '#facc15', fontSize: 14 }}>{t('Overview.lowCredits.title')}</div>
                        <div style={{ fontSize: 12, color: 'rgba(250, 204, 21, 0.7)' }}>
                            Il vous reste {creditsBalance} crédit{creditsBalance > 1 ? 's' : ''}.
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Subscription Plans */}
            <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16 }}>{t('Plans.title')}</h2>
                {plans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                        <Loader2 style={{ width: 24, height: 24, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                        <p>{t('Plans.loading')}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                        {plans.map((plan, index) => {
                            const Icon = getPlanIcon(plan.name)
                            const color = getPlanColor(plan.name)
                            return (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * index }}
                                    style={{
                                        ...cardStyle,
                                        position: 'relative',
                                        border: plan.is_popular ? '2px solid rgba(16, 185, 129, 0.3)' : cardStyle.border
                                    }}
                                >
                                    {plan.is_popular && (
                                        <div style={{
                                            position: 'absolute',
                                            top: -10,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            padding: '4px 12px',
                                            borderRadius: 100,
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            <Star size={10} />
                                            {t('Plans.popular')}
                                        </div>
                                    )}

                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: `${color}20`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 12
                                    }}>
                                        <Icon style={{ width: 20, height: 20, color }} />
                                    </div>

                                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 2 }}>{plan.name}</h3>
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>
                                        {t('Plans.creditsPerMonth', { count: plan.credits })}
                                    </p>
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>
                                        {(() => {
                                            const agentsMap: Record<string, number> = { starter: 1, pro: 3, business: 6, scale: -1 }
                                            const n = agentsMap[plan.id?.toLowerCase()] ?? agentsMap[plan.name?.toLowerCase()] ?? 1
                                            return n === -1 ? '∞ agents' : `${n} agent${n > 1 ? 's' : ''}`
                                        })()}
                                    </p>

                                    <div style={{ marginBottom: 16 }}>
                                        <span style={{ fontSize: 26, fontWeight: 700, color: 'white' }}>
                                            {formatFromFcfa(plan.price)}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: 13 }}> / {t('Plans.period')}</span>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSubscribeV2(plan.id)}
                                        disabled={isLoading === plan.id || currentPlan.toLowerCase() === plan.name.toLowerCase()}
                                        style={{
                                            width: '100%',
                                            padding: '12px 20px',
                                            borderRadius: 10,
                                            fontWeight: 600,
                                            fontSize: 13,
                                            border: 'none',
                                            cursor: currentPlan.toLowerCase() === plan.name.toLowerCase() ? 'not-allowed' : 'pointer',
                                            background: currentPlan.toLowerCase() === plan.name.toLowerCase()
                                                ? 'rgba(51, 65, 85, 0.5)'
                                                : plan.is_popular
                                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                                    : 'rgba(51, 65, 85, 0.5)',
                                            color: currentPlan.toLowerCase() === plan.name.toLowerCase() ? '#64748b' : 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6
                                        }}
                                    >
                                        {isLoading === plan.id ? (
                                            <>
                                                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                                {t('Plans.loading')}
                                            </>
                                        ) : currentPlan.toLowerCase() === plan.name.toLowerCase() ? (
                                            t('Plans.current')
                                        ) : (
                                            <>
                                                {t('Plans.choose')}
                                                <ExternalLink style={{ width: 14, height: 14 }} />
                                            </>
                                        )}
                                    </motion.button>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Credit Packs */}
            <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package style={{ width: 18, height: 18, color: '#34d399' }} />
                    {t('Credits.title')}
                </h2>
                <div className="billing-packs-grid" style={{ display: 'grid', gap: 12 }}>
                    {creditPacks.map((pack, index) => (
                        <motion.div
                            key={pack.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            style={{ ...cardStyle, padding: 16 }}
                        >
                            {pack.savings > 0 && (
                                <span style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: 100,
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#34d399',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    marginBottom: 10
                                }}>
                                    -{pack.savings}%
                                </span>
                            )}
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 2 }}>
                                {pack.credits.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{t('Credits.unit')}</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#34d399', marginBottom: 12 }}>
                                {formatFromFcfa(pack.price)}
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleBuyCreditsV2(pack.id)}
                                disabled={isLoading === pack.id}
                                style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    borderRadius: 8,
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 500,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                {isLoading === pack.id ? (
                                    <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    t('Credits.buy')
                                )}
                            </motion.button>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Payment History */}
            <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard style={{ width: 18, height: 18, color: '#34d399' }} />
                    {t('History.title')}
                </h2>
                <div style={cardStyle}>
                    {payments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                            <CreditCard style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.5 }} />
                            <p style={{ fontSize: 13 }}>{t('History.empty')}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {payments.map((payment) => {
                                const statusMeta = getHistoryStatusMeta(payment.status)

                                return (
                                    <div
                                        key={payment.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: 12,
                                            borderRadius: 8,
                                            background: 'rgba(51, 65, 85, 0.3)'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'white', fontSize: 14 }}>{payment.description}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>
                                                {getHistoryTimestamp(payment)}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                {getHistoryProviderLine(payment)}
                                            </div>
                                            {payment.reference && (
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                                    Ref: {payment.reference}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>
                                                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(payment.amount_fcfa)}
                                            </div>
                                            <div style={{
                                                fontSize: 11,
                                                color: statusMeta.color
                                            }}>
                                                {statusMeta.label}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
