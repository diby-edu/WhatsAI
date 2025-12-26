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
    Clock,
    AlertCircle,
    Loader2,
    CheckCircle2,
    XCircle,
    ExternalLink
} from 'lucide-react'

const plans = [
    { id: 'starter', name: 'Starter', price: 15000, credits: 2000, icon: Zap, color: '#3b82f6' },
    { id: 'pro', name: 'Pro', price: 35000, credits: 5000, icon: Crown, color: '#10b981', popular: true },
    { id: 'business', name: 'Business', price: 85000, credits: 30000, icon: TrendingUp, color: '#a855f7' },
]

const creditPacks = [
    { id: 'pack_500', credits: 500, price: 5000, savings: 0 },
    { id: 'pack_1000', credits: 1000, price: 9000, savings: 10 },
    { id: 'pack_2500', credits: 2500, price: 20000, savings: 20 },
    { id: 'pack_5000', credits: 5000, price: 35000, savings: 30 },
]

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
    const searchParams = useSearchParams()
    const [isLoading, setIsLoading] = useState<string | null>(null)
    const [userData, setUserData] = useState<UserData | null>(null)
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)
    const [paymentStatus, setPaymentStatus] = useState<'success' | 'failed' | null>(null)

    // Check for payment return
    useEffect(() => {
        const paymentId = searchParams.get('payment')
        if (paymentId) {
            checkPaymentStatus(paymentId)
        }
    }, [searchParams])

    // Fetch user data and payments
    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            // Fetch profile
            const profileRes = await fetch('/api/profile')
            if (profileRes.ok) {
                const data = await profileRes.json()
                setUserData(data.data?.profile)
            }

            // Fetch payments (would need to create this endpoint)
            // For now we use mock data
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }

    const checkPaymentStatus = async (paymentId: string) => {
        try {
            const res = await fetch(`/api/payments/initialize?paymentId=${paymentId}`)
            const data = await res.json()

            if (data.data?.payment?.status === 'completed') {
                setPaymentStatus('success')
                fetchData() // Refresh data
            } else if (data.data?.payment?.status === 'failed') {
                setPaymentStatus('failed')
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

    const cardStyle = {
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 16,
        padding: 24
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Facturation</h1>
                <p style={{ color: '#94a3b8' }}>Gérez votre abonnement et vos crédits</p>
            </div>

            {/* Payment Status Notification */}
            {paymentStatus && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: 16,
                        borderRadius: 12,
                        background: paymentStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${paymentStatus === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                    }}
                >
                    {paymentStatus === 'success' ? (
                        <>
                            <CheckCircle2 style={{ width: 24, height: 24, color: '#34d399' }} />
                            <div>
                                <div style={{ fontWeight: 500, color: '#34d399' }}>Paiement réussi !</div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>Vos crédits ont été ajoutés à votre compte.</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <XCircle style={{ width: 24, height: 24, color: '#f87171' }} />
                            <div>
                                <div style={{ fontWeight: 500, color: '#f87171' }}>Paiement échoué</div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>Le paiement n'a pas pu être effectué.</div>
                            </div>
                        </>
                    )}
                </motion.div>
            )}

            {/* Current Plan Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={cardStyle}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: 'rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Crown style={{ width: 24, height: 24, color: '#34d399' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, color: '#64748b' }}>Plan actuel</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white', textTransform: 'capitalize' }}>
                                {currentPlan}
                            </div>
                        </div>
                    </div>
                    {userData?.subscription_end && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#64748b' }}>
                            <Clock style={{ width: 16, height: 16 }} />
                            Renouvellement le {new Date(userData.subscription_end).toLocaleDateString('fr-FR')}
                        </div>
                    )}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={cardStyle}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: 'rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Sparkles style={{ width: 24, height: 24, color: '#60a5fa' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, color: '#64748b' }}>Crédits restants</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
                                {creditsBalance.toLocaleString()}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        height: 8,
                        borderRadius: 4,
                        background: 'rgba(51, 65, 85, 0.5)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min((creditsBalance / (creditsBalance + creditsUsed || 1)) * 100, 100)}%`,
                            background: 'linear-gradient(90deg, #10b981, #34d399)',
                            borderRadius: 4
                        }} />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={cardStyle}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: 'rgba(168, 85, 247, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <TrendingUp style={{ width: 24, height: 24, color: '#c084fc' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, color: '#64748b' }}>Utilisés ce mois</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
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
                        padding: 16,
                        borderRadius: 12,
                        background: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16
                    }}
                >
                    <AlertCircle style={{ width: 24, height: 24, color: '#facc15', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontWeight: 500, color: '#facc15' }}>Crédits bientôt épuisés</div>
                        <div style={{ fontSize: 14, color: 'rgba(250, 204, 21, 0.7)' }}>
                            Il vous reste moins de 50 crédits. Achetez un pack pour continuer à utiliser WhatsAI.
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Subscription Plans */}
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 24 }}>Changer de plan</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            style={{
                                ...cardStyle,
                                position: 'relative',
                                border: plan.popular ? '2px solid rgba(16, 185, 129, 0.3)' : cardStyle.border
                            }}
                        >
                            {plan.popular && (
                                <div style={{
                                    position: 'absolute',
                                    top: -12,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    padding: '4px 12px',
                                    borderRadius: 100,
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'white'
                                }}>
                                    Populaire
                                </div>
                            )}

                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: `${plan.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16
                            }}>
                                <plan.icon style={{ width: 24, height: 24, color: plan.color }} />
                            </div>

                            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4 }}>{plan.name}</h3>
                            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                                {plan.credits.toLocaleString()} crédits/mois
                            </p>

                            <div style={{ marginBottom: 24 }}>
                                <span style={{ fontSize: 32, fontWeight: 700, color: 'white' }}>
                                    {plan.price.toLocaleString()}
                                </span>
                                <span style={{ color: '#64748b' }}> FCFA/mois</span>
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSubscribe(plan.id)}
                                disabled={isLoading === plan.id || currentPlan === plan.id}
                                style={{
                                    width: '100%',
                                    padding: '14px 24px',
                                    borderRadius: 12,
                                    fontWeight: 600,
                                    fontSize: 15,
                                    border: 'none',
                                    cursor: currentPlan === plan.id ? 'not-allowed' : 'pointer',
                                    background: currentPlan === plan.id
                                        ? 'rgba(51, 65, 85, 0.5)'
                                        : plan.popular
                                            ? 'linear-gradient(135deg, #10b981, #059669)'
                                            : 'rgba(51, 65, 85, 0.5)',
                                    color: currentPlan === plan.id ? '#64748b' : 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                {isLoading === plan.id ? (
                                    <>
                                        <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                                        Chargement...
                                    </>
                                ) : currentPlan === plan.id ? (
                                    'Plan actuel'
                                ) : (
                                    <>
                                        Choisir
                                        <ExternalLink style={{ width: 16, height: 16 }} />
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Credit Packs */}
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package style={{ width: 20, height: 20, color: '#34d399' }} />
                    Acheter des crédits
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {creditPacks.map((pack, index) => (
                        <motion.div
                            key={pack.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                            style={{
                                ...cardStyle,
                                padding: 20
                            }}
                        >
                            {pack.savings > 0 && (
                                <span style={{
                                    display: 'inline-block',
                                    padding: '4px 8px',
                                    borderRadius: 100,
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#34d399',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    marginBottom: 12
                                }}>
                                    -{pack.savings}%
                                </span>
                            )}
                            <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                                {pack.credits.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>crédits</div>
                            <div style={{ fontSize: 18, fontWeight: 600, color: '#34d399', marginBottom: 16 }}>
                                {pack.price.toLocaleString()} FCFA
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleBuyCredits(pack.id)}
                                disabled={isLoading === pack.id}
                                style={{
                                    width: '100%',
                                    padding: '12px 20px',
                                    borderRadius: 10,
                                    background: 'rgba(51, 65, 85, 0.5)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 500,
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                {isLoading === pack.id ? (
                                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    'Acheter'
                                )}
                            </motion.button>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Payment History */}
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard style={{ width: 20, height: 20, color: '#34d399' }} />
                    Historique des paiements
                </h2>
                <div style={cardStyle}>
                    {payments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                            <CreditCard style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.5 }} />
                            <p>Aucun paiement pour le moment</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                        <div style={{ fontWeight: 500, color: 'white' }}>{payment.description}</div>
                                        <div style={{ fontSize: 13, color: '#64748b' }}>
                                            {new Date(payment.created_at).toLocaleDateString('fr-FR')}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 600, color: 'white' }}>
                                            {payment.amount_fcfa.toLocaleString()} FCFA
                                        </div>
                                        <div style={{
                                            fontSize: 12,
                                            color: payment.status === 'completed' ? '#34d399' : '#f87171'
                                        }}>
                                            {payment.status === 'completed' ? 'Réussi' : 'Échoué'}
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
