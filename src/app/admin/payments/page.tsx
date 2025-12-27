'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    CreditCard, Loader2, CheckCircle, XCircle,
    Send, Phone, DollarSign, User, RefreshCw,
    Clock, History, AlertTriangle, ArrowRight,
    Smartphone, Wallet, Download, Search, Eye,
    Calendar, Filter
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Payment {
    id: string
    user_id: string
    amount: number
    currency: string
    status: string
    payment_method?: string
    transaction_id?: string
    created_at: string
    updated_at: string
    profiles?: {
        email: string
        full_name: string
    }
}

export default function AdminPaymentPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [checkingPayment, setCheckingPayment] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [activeTab, setActiveTab] = useState<'list' | 'verify' | 'config'>('list')
    const [verifyTransactionId, setVerifyTransactionId] = useState('')
    const [verifyResult, setVerifyResult] = useState<any>(null)
    const [verifying, setVerifying] = useState(false)

    useEffect(() => {
        fetchPayments()
    }, [])

    const fetchPayments = async () => {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    *,
                    profiles (
                        email,
                        full_name
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) {
                console.error('Error fetching payments:', error)
            } else {
                setPayments(data || [])
            }
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => {
        setRefreshing(true)
        fetchPayments()
    }

    // Verify payment status via CinetPay API
    const verifyPaymentStatus = async (transactionId: string) => {
        setCheckingPayment(transactionId)
        try {
            const res = await fetch('/api/payments/cinetpay/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: transactionId })
            })
            const data = await res.json()

            // Update local state if status changed
            if (data.data?.status) {
                setPayments(prev => prev.map(p =>
                    p.transaction_id === transactionId
                        ? { ...p, status: mapCinetPayStatus(data.data.status) }
                        : p
                ))
            }

            return data
        } catch (err) {
            console.error('Error verifying payment:', err)
        } finally {
            setCheckingPayment(null)
        }
    }

    // Manual verification from the verify tab
    const handleManualVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!verifyTransactionId.trim()) return

        setVerifying(true)
        setVerifyResult(null)

        try {
            const res = await fetch('/api/payments/cinetpay/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: verifyTransactionId.trim() })
            })
            const data = await res.json()
            setVerifyResult(data)
        } catch (err) {
            setVerifyResult({ error: 'Erreur de connexion à l\'API' })
        } finally {
            setVerifying(false)
        }
    }

    const mapCinetPayStatus = (cinetpayStatus: string): string => {
        switch (cinetpayStatus) {
            case 'ACCEPTED': return 'completed'
            case 'REFUSED': return 'failed'
            case 'CANCELLED': return 'cancelled'
            default: return 'pending'
        }
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; color: string; text: string }> = {
            completed: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', text: 'Réussi' },
            pending: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', text: 'En attente' },
            failed: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', text: 'Échoué' },
            cancelled: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', text: 'Annulé' },
            refunded: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', text: 'Remboursé' }
        }
        const s = styles[status] || styles.pending

        return (
            <span style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: s.bg,
                color: s.color
            }}>
                {s.text}
            </span>
        )
    }

    const filteredPayments = payments.filter(p => {
        const matchesSearch = p.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter
        return matchesSearch && matchesStatus
    })

    // Stats
    const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)
    const pendingCount = payments.filter(p => p.status === 'pending').length
    const completedCount = payments.filter(p => p.status === 'completed').length
    const failedCount = payments.filter(p => p.status === 'failed').length

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1400 }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    Gestion des Paiements
                </h1>
                <p style={{ color: '#94a3b8' }}>
                    Consultez et vérifiez les paiements CinetPay en temps réel
                </p>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#34d399' }}>
                        {totalRevenue.toLocaleString()} FCFA
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Revenus totaux</div>
                </div>
                <div style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{completedCount}</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Paiements réussis</div>
                </div>
                <div style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>{pendingCount}</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>En attente</div>
                </div>
                <div style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f87171' }}>{failedCount}</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Échoués</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 24,
                padding: 6,
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: 14,
                width: 'fit-content'
            }}>
                {[
                    { id: 'list', label: 'Liste des paiements', icon: CreditCard },
                    { id: 'verify', label: 'Vérifier un paiement', icon: Search },
                    { id: 'config', label: 'Configuration', icon: AlertTriangle }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '12px 20px',
                            borderRadius: 10,
                            border: 'none',
                            background: activeTab === tab.id ? '#10b981' : 'transparent',
                            color: activeTab === tab.id ? 'white' : '#94a3b8',
                            cursor: 'pointer',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <tab.icon style={{ width: 18, height: 18 }} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'list' && (
                <>
                    {/* Filters */}
                    <div style={{
                        display: 'flex',
                        gap: 16,
                        marginBottom: 24,
                        padding: 16,
                        background: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: 16,
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ flex: '1 1 300px', position: 'relative' }}>
                            <Search style={{
                                position: 'absolute',
                                left: 14,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 18,
                                height: 18,
                                color: '#64748b'
                            }} />
                            <input
                                type="text"
                                placeholder="Rechercher par ID transaction, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 44px',
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white'
                                }}
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                padding: '12px 16px',
                                borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                minWidth: 150
                            }}
                        >
                            <option value="all">Tous les statuts</option>
                            <option value="completed">Réussi</option>
                            <option value="pending">En attente</option>
                            <option value="failed">Échoué</option>
                            <option value="cancelled">Annulé</option>
                        </select>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            style={{
                                padding: '12px 20px',
                                borderRadius: 10,
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: 'none',
                                color: '#34d399',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500
                            }}
                        >
                            <RefreshCw style={{
                                width: 16,
                                height: 16,
                                animation: refreshing ? 'spin 1s linear infinite' : 'none'
                            }} />
                            Actualiser
                        </button>
                    </div>

                    {/* Payments Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                        <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Transaction ID</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Client</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'right', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Montant</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Statut</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Date</th>
                                        <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                                <CreditCard style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                                                <p>Aucun paiement trouvé</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPayments.map((payment) => (
                                            <tr key={payment.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <div style={{ fontFamily: 'monospace', color: 'white', fontSize: 13 }}>
                                                        {payment.transaction_id || payment.id.substring(0, 12) + '...'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <div style={{ color: 'white', fontWeight: 500 }}>
                                                        {payment.profiles?.full_name || 'Utilisateur'}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: 13 }}>
                                                        {payment.profiles?.email || '-'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: 16 }}>
                                                        {payment.amount.toLocaleString()} {payment.currency || 'FCFA'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                    {getStatusBadge(payment.status)}
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <div style={{ color: '#94a3b8', fontSize: 13 }}>
                                                        {new Date(payment.created_at).toLocaleString('fr-FR')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                    {payment.transaction_id && payment.status === 'pending' && (
                                                        <button
                                                            onClick={() => verifyPaymentStatus(payment.transaction_id!)}
                                                            disabled={checkingPayment === payment.transaction_id}
                                                            style={{
                                                                padding: '8px 14px',
                                                                borderRadius: 8,
                                                                background: 'rgba(59, 130, 246, 0.15)',
                                                                color: '#3b82f6',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                fontSize: 13,
                                                                fontWeight: 500,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 6
                                                            }}
                                                        >
                                                            {checkingPayment === payment.transaction_id ? (
                                                                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                                                            ) : (
                                                                <RefreshCw style={{ width: 14, height: 14 }} />
                                                            )}
                                                            Vérifier
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </>
            )}

            {activeTab === 'verify' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24
                        }}
                    >
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                            Vérifier un paiement CinetPay
                        </h2>
                        <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>
                            Entrez l'ID de transaction pour vérifier son statut en temps réel via l'API CinetPay.
                        </p>

                        <form onSubmit={handleManualVerify}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 10, fontWeight: 500 }}>
                                    ID Transaction
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: TRX123456789"
                                    value={verifyTransactionId}
                                    onChange={(e) => setVerifyTransactionId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 16,
                                        borderRadius: 12,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white',
                                        fontSize: 16,
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={verifying}
                                style={{
                                    width: '100%',
                                    padding: 18,
                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 14,
                                    fontWeight: 700,
                                    fontSize: 16,
                                    cursor: verifying ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 10
                                }}
                            >
                                {verifying ? (
                                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <Search size={20} />
                                )}
                                {verifying ? 'Vérification...' : 'Vérifier le statut'}
                            </motion.button>
                        </form>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 20,
                            padding: 24
                        }}
                    >
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>
                            Résultat API CinetPay
                        </h2>

                        {!verifyResult && (
                            <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
                                <Search size={56} style={{ marginBottom: 16, opacity: 0.3 }} />
                                <p>Entrez un ID de transaction pour voir le résultat</p>
                            </div>
                        )}

                        {verifyResult && (
                            <div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    marginBottom: 20,
                                    padding: 16,
                                    borderRadius: 12,
                                    background: verifyResult.error
                                        ? 'rgba(239, 68, 68, 0.1)'
                                        : verifyResult.data?.status === 'ACCEPTED'
                                            ? 'rgba(16, 185, 129, 0.1)'
                                            : 'rgba(245, 158, 11, 0.1)'
                                }}>
                                    {verifyResult.error ? (
                                        <XCircle size={24} style={{ color: '#f87171' }} />
                                    ) : verifyResult.data?.status === 'ACCEPTED' ? (
                                        <CheckCircle size={24} style={{ color: '#34d399' }} />
                                    ) : (
                                        <AlertTriangle size={24} style={{ color: '#fbbf24' }} />
                                    )}
                                    <span style={{
                                        color: verifyResult.error ? '#f87171' :
                                            verifyResult.data?.status === 'ACCEPTED' ? '#34d399' : '#fbbf24',
                                        fontWeight: 600
                                    }}>
                                        {verifyResult.error ? 'Erreur' :
                                            verifyResult.data?.status === 'ACCEPTED' ? 'Paiement confirmé' :
                                                verifyResult.data?.status === 'REFUSED' ? 'Paiement refusé' : 'En attente'}
                                    </span>
                                </div>

                                <pre style={{
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    padding: 16,
                                    borderRadius: 12,
                                    overflow: 'auto',
                                    maxHeight: 300,
                                    fontSize: 12,
                                    color: '#94a3b8',
                                    lineHeight: 1.6
                                }}>
                                    {JSON.stringify(verifyResult, null, 2)}
                                </pre>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}

            {activeTab === 'config' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 20,
                        padding: 24,
                        maxWidth: 700
                    }}
                >
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                        Configuration CinetPay
                    </h2>

                    <div style={{
                        padding: 20,
                        borderRadius: 14,
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        marginBottom: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CheckCircle style={{ width: 24, height: 24, color: '#34d399' }} />
                            <div>
                                <div style={{ fontWeight: 600, color: '#34d399' }}>Mode Production actif</div>
                                <div style={{ fontSize: 14, color: '#94a3b8' }}>
                                    Tous les paiements sont réels et traités par CinetPay.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: 16 }}>
                        <div style={{
                            padding: 16,
                            borderRadius: 12,
                            background: 'rgba(15, 23, 42, 0.3)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontWeight: 500, color: 'white' }}>CINETPAY_API_KEY</div>
                                <div style={{ fontSize: 13, color: '#64748b' }}>Clé API production</div>
                            </div>
                            <span style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#4ade80',
                                fontSize: 12,
                                fontWeight: 600
                            }}>
                                Configurée
                            </span>
                        </div>

                        <div style={{
                            padding: 16,
                            borderRadius: 12,
                            background: 'rgba(15, 23, 42, 0.3)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontWeight: 500, color: 'white' }}>CINETPAY_SITE_ID</div>
                                <div style={{ fontSize: 13, color: '#64748b' }}>Identifiant du site</div>
                            </div>
                            <span style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#4ade80',
                                fontSize: 12,
                                fontWeight: 600
                            }}>
                                Configurée
                            </span>
                        </div>

                        <div style={{
                            padding: 16,
                            borderRadius: 12,
                            background: 'rgba(15, 23, 42, 0.3)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontWeight: 500, color: 'white' }}>Webhook URL</div>
                                <div style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>
                                    /api/payments/cinetpay/webhook
                                </div>
                            </div>
                            <span style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#3b82f6',
                                fontSize: 12,
                                fontWeight: 600
                            }}>
                                Actif
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
