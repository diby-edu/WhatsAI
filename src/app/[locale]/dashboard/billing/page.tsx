'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
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
    Star
} from 'lucide-react'
import { useTranslations, useFormatter } from 'next-intl'

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
    created_at: string
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

    const [isLoading, setIsLoading] = useState<string | null>(null)
    const [userData, setUserData] = useState<UserData | null>(null)
    const [payments, setPayments] = useState<Payment[]>([])
    const [plans, setPlans] = useState<Plan[]>([])
    const [creditPacks, setCreditPacks] = useState<CreditPack[]>([])
    const [loading, setLoading] = useState(true)
    const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | null>(null)

    const [currency, setCurrency] = useState('USD')

    // Check for payment return
    useEffect(() => {
        const paymentParam = searchParams.get('payment')
        const transactionId = searchParams.get('transaction_id')

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
        } else if (transactionId) {
            // Check specific transaction
            checkPaymentStatus(transactionId)
        }
    }, [searchParams])

    const fetchProfileCurrency = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            if (data.data?.profile?.currency) {
                setCurrency(data.data.profile.currency)
            }
        } catch (e) { }
    }

    const formatPrice = (price: number) => {
        let convertedPrice = price
        if (currency === 'XOF') convertedPrice = price * 655
        else if (currency === 'EUR') convertedPrice = price * 0.92

        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: currency === 'XOF' ? 0 : 2
        }).format(convertedPrice)
    }

    // Fetch user data, plans, payments and credit packs
    useEffect(() => {
        fetchData()
        fetchPlans()
        fetchCreditPacks()
        fetchPayments()
    }, [])

    const fetchPlans = async () => {
        try {
            const res = await fetch('/api/plans')
            const data = await res.json()
            if (data.plans) {
                // Filter out free plans (price = 0)
                const paidPlans = data.plans.filter((p: Plan) => p.price > 0)
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
                // Fallback to defaults
                setCreditPacks([
                    { id: 'pack_500', credits: 500, price: 5000, savings: 0 },
                    { id: 'pack_1000', credits: 1000, price: 9000, savings: 10 },
                    { id: 'pack_2500', credits: 2500, price: 20000, savings: 20 },
                    { id: 'pack_5000', credits: 5000, price: 35000, savings: 30 },
                ])
            }
        } catch (err) {
            console.error('Error fetching credit packs:', err)
            // Fallback to defaults
            setCreditPacks([
                { id: 'pack_500', credits: 500, price: 5000, savings: 0 },
                { id: 'pack_1000', credits: 1000, price: 9000, savings: 10 },
                { id: 'pack_2500', credits: 2500, price: 20000, savings: 20 },
                { id: 'pack_5000', credits: 5000, price: 35000, savings: 30 },
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

    const checkPaymentStatus = async (paymentId: string) => {
        try {
            // Call verify API which checks with CinetPay directly and credits user
            const res = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: paymentId, transactionId: paymentId }), // Send as both to be safe
            })
            const data = await res.json()

            if (data.success && data.credits_added) {
                setPaymentStatus('success')
                fetchData() // Refresh user data to show new balance
            } else if (data.cinetpay_status === 'REFUSED' || data.cinetpay_status === 'CANCELLED') {
                setPaymentStatus('failed')
            } else if (data.current_status === 'completed') {
                setPaymentStatus('success')
                fetchData()
            } else {
                // Payment still pending, check again in 3 seconds
                setTimeout(() => checkPaymentStatus(paymentId), 3000)
            }
        } catch (err) {
            console.error('Error checking payment:', err)
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

    const getPlanIcon = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes('business') || lower.includes('enterprise')) return TrendingUp
        if (lower.includes('pro')) return Crown
        return Zap
    }

    const getPlanColor = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes('business') || lower.includes('enterprise')) return '#a855f7'
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
                        background: paymentStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${paymentStatus === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
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

            {/* Current Plan Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
            </div>

            {/* Low credits warning */}
            {creditsBalance < 50 && (
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
                            {t('Overview.lowCredits.message')}
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
                                    <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>
                                        {t('Plans.creditsPerMonth', { count: plan.credits })}
                                    </p>

                                    <div style={{ marginBottom: 16 }}>
                                        <span style={{ fontSize: 26, fontWeight: 700, color: 'white' }}>
                                            {formatPrice(plan.price)}
                                        </span>
                                        <span style={{ color: '#64748b', fontSize: 13 }}> / {t('Plans.period')}</span>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSubscribe(plan.id)}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
                                {formatPrice(pack.price)}
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleBuyCredits(pack.id)}
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
                            {payments.map((payment) => (
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
                                            {format.dateTime(new Date(payment.created_at), { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>
                                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(payment.amount_fcfa)}
                                        </div>
                                        <div style={{
                                            fontSize: 11,
                                            color: payment.status === 'completed' ? '#34d399' : '#f87171'
                                        }}>
                                            {payment.status === 'completed' ? t('History.status.completed') : t('History.status.failed')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
