'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    CreditCard, Loader2, CheckCircle, XCircle,
    Send, Phone, DollarSign, User
} from 'lucide-react'

export default function AdminPaymentTestPage() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)

    const [formData, setFormData] = useState({
        amount: 1000,
        customer_phone: '2250700000000',
        customer_name: 'Test Client',
        description: 'Test de paiement'
    })

    const initiateTestPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setResult(null)

        try {
            const res = await fetch('/api/payments/cinetpay/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    test_mode: true
                })
            })

            const data = await res.json()
            setResult(data)

            if (data.data?.payment_url) {
                // Open payment URL in new tab
                window.open(data.data.payment_url, '_blank')
            }
        } catch (err) {
            setResult({ error: 'Erreur lors de l\'initiation du paiement' })
        } finally {
            setLoading(false)
        }
    }

    const checkPaymentStatus = async (transactionId: string) => {
        try {
            const res = await fetch(`/api/payments/cinetpay/status?transaction_id=${transactionId}`)
            const data = await res.json()
            setResult(data)
        } catch (err) {
            setResult({ error: 'Erreur lors de la vérification' })
        }
    }

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    Test de Paiement CinetPay
                </h1>
                <p style={{ color: '#94a3b8' }}>
                    Simulez un paiement pour tester l'intégration
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        padding: 24
                    }}
                >
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>
                        Initier un paiement test
                    </h2>

                    <form onSubmit={initiateTestPayment}>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                <DollarSign size={16} style={{ display: 'inline', marginRight: 8 }} />
                                Montant (FCFA)
                            </label>
                            <input
                                type="number"
                                required
                                min={100}
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 18,
                                    fontWeight: 600
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                <Phone size={16} style={{ display: 'inline', marginRight: 8 }} />
                                Téléphone client
                            </label>
                            <input
                                required
                                value={formData.customer_phone}
                                onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                                placeholder="2250700000000"
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                <User size={16} style={{ display: 'inline', marginRight: 8 }} />
                                Nom du client
                            </label>
                            <input
                                required
                                value={formData.customer_name}
                                onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                Description
                            </label>
                            <input
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: 16,
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 12,
                                fontWeight: 600,
                                fontSize: 16,
                                cursor: loading ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10
                            }}
                        >
                            {loading ? (
                                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <CreditCard size={20} />
                            )}
                            {loading ? 'Initialisation...' : 'Lancer le paiement test'}
                        </button>
                    </form>
                </motion.div>

                {/* Result */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        padding: 24
                    }}
                >
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>
                        Résultat
                    </h2>

                    {!result && (
                        <div style={{
                            textAlign: 'center',
                            padding: 40,
                            color: '#64748b'
                        }}>
                            <CreditCard size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                            <p>Lancez un test pour voir le résultat</p>
                        </div>
                    )}

                    {result && (
                        <div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 20,
                                padding: 16,
                                borderRadius: 12,
                                background: result.error
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'rgba(16, 185, 129, 0.1)'
                            }}>
                                {result.error ? (
                                    <XCircle size={24} style={{ color: '#f87171' }} />
                                ) : (
                                    <CheckCircle size={24} style={{ color: '#34d399' }} />
                                )}
                                <span style={{
                                    color: result.error ? '#f87171' : '#34d399',
                                    fontWeight: 600
                                }}>
                                    {result.error ? 'Erreur' : 'Succès'}
                                </span>
                            </div>

                            <pre style={{
                                background: 'rgba(15, 23, 42, 0.5)',
                                padding: 16,
                                borderRadius: 10,
                                overflow: 'auto',
                                maxHeight: 400,
                                fontSize: 13,
                                color: '#94a3b8'
                            }}>
                                {JSON.stringify(result, null, 2)}
                            </pre>

                            {result.data?.transaction_id && (
                                <button
                                    onClick={() => checkPaymentStatus(result.data.transaction_id)}
                                    style={{
                                        marginTop: 16,
                                        padding: '12px 20px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#3b82f6',
                                        border: 'none',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}
                                >
                                    <Send size={16} />
                                    Vérifier le statut
                                </button>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Info Box */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    marginTop: 24,
                    padding: 20,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: 12
                }}
            >
                <h3 style={{ color: '#3b82f6', fontWeight: 600, marginBottom: 8 }}>
                    💡 Mode test CinetPay
                </h3>
                <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
                    Les paiements en mode test utilisent l'environnement sandbox de CinetPay.
                    Aucune transaction réelle n'est effectuée. Utilisez les cartes de test fournies
                    par CinetPay pour simuler différents scénarios (succès, échec, etc.).
                </p>
            </motion.div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
