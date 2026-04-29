'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    CreditCard, Loader2, CheckCircle, XCircle,
    Search, RefreshCw, AlertTriangle, Clock, Eye
} from 'lucide-react'

interface Payment {
    id: string
    user_id: string
    amount: number
    currency: string
    status: string
    payment_provider?: string | null
    payment_method?: string
    payment_channel?: string | null
    payment_channel_detail?: string | null
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
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [checkingPayment, setCheckingPayment] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    useEffect(() => {
        fetchPayments()
    }, [])

    const fetchPayments = async () => {
        try {
            setError(null)
            const res = await fetch('/api/admin/payments')
            if (!res.ok) {
                throw new Error('Erreur lors du chargement des paiements')
            }
            const data = await res.json()
            setPayments(data.data?.payments || [])
        } catch (err: any) {
            console.error('Error:', err)
            setError(err.message || 'Erreur de chargement')
            setPayments([])
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => {
        setRefreshing(true)
        fetchPayments()
    }

    // Verify payment status via the configured provider
    const verifyPaymentStatus = async (transactionId: string) => {
        setCheckingPayment(transactionId)
        try {
            const res = await fetch('/api/payments/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transaction_id: transactionId })
            })
            const data = await res.json()

            // Update local state if status changed
            if (data.data?.status) {
                setPayments(prev => prev.map(p =>
                    p.transaction_id === transactionId
                        ? { ...p, status: mapHostedPaymentStatus(data.data.status) }
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

    const mapHostedPaymentStatus = (providerStatus: string): string => {
        switch (providerStatus) {
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
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: s.bg,
                color: s.color
            }}>
                {s.text}
            </span>
        )
    }

    const filteredPayments = payments.filter(p => {
        const matchesSearch =
            (p.transaction_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (p.profiles?.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (p.profiles?.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter
        return matchesSearch && matchesStatus
    })

    // Stats
    const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0)
    const pendingCount = payments.filter(p => p.status === 'pending').length
    const completedCount = payments.filter(p => p.status === 'completed').length
    const failedCount = payments.filter(p => p.status === 'failed').length

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 24, height: 24, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                    Gestion des Paiements
                </h1>
                <p style={{ color: '#64748b', fontSize: 13 }}>
                    Consultez et vérifiez les paiements en ligne
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: 14,
                    marginBottom: 20,
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    fontSize: 14
                }}>
                    {error}
                </div>
            )}

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>
                        {totalRevenue.toLocaleString('fr-FR')} FCFA
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>Revenus (FCFA)</div>
                </div>
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80' }}>{completedCount}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>Réussis</div>
                </div>
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>{pendingCount}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>En attente</div>
                </div>
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#f87171' }}>{failedCount}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>Échoués</div>
                </div>
            </div>

            <>
                    {/* Filters */}
                    <div style={{
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 20,
                        padding: 14,
                        background: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: 12,
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 16,
                                height: 16,
                                color: '#64748b'
                            }} />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 10px 10px 38px',
                                    borderRadius: 8,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 13
                                }}
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                padding: '10px 14px',
                                borderRadius: 8,
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                fontSize: 13
                            }}
                        >
                            <option value="all">Tous</option>
                            <option value="completed">Réussi</option>
                            <option value="pending">En attente</option>
                            <option value="failed">Échoué</option>
                        </select>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            style={{
                                padding: '10px 16px',
                                borderRadius: 8,
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: 'none',
                                color: '#34d399',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 500,
                                fontSize: 13
                            }}
                        >
                            <RefreshCw style={{
                                width: 14,
                                height: 14,
                                animation: refreshing ? 'spin 1s linear infinite' : 'none'
                            }} />
                            Actualiser
                        </button>
                    </div>

                    {/* Payments Table */}
                    <div className="admin-table-wrap" style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: 12,
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        overflowX: 'auto'
                    }}>
                        {filteredPayments.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                <CreditCard style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.5 }} />
                                <p style={{ fontSize: 14 }}>Aucun paiement trouvé</p>
                            </div>
                        ) : (
                            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                                <thead>
                                    <tr style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                                        {['Transaction', 'Utilisateur', 'Montant', 'Statut', 'Date', 'Actions'].map(h => (
                                            <th key={h} style={{
                                                padding: '12px 14px',
                                                textAlign: 'left',
                                                fontSize: 11,
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                color: '#64748b'
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.map((payment) => (
                                        <tr key={payment.id} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' }}>
                                                    {payment.transaction_id?.slice(0, 16) || 'N/A'}...
                                                </div>
                                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                                    {(payment.payment_provider || payment.payment_method || 'provider').toUpperCase()}
                                                    {payment.payment_channel_detail
                                                        ? ` - ${payment.payment_channel_detail}`
                                                        : payment.payment_channel
                                                            ? ` - ${payment.payment_channel}`
                                                            : ''}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ fontSize: 13, color: 'white' }}>
                                                    {payment.profiles?.full_name || 'Utilisateur'}
                                                </div>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                                    {payment.profiles?.email || '-'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                <span style={{ fontWeight: 600, color: '#34d399', fontSize: 14 }}>
                                                    {(payment.amount || 0).toLocaleString()} {payment.currency || '$'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                {getStatusBadge(payment.status)}
                                            </td>
                                            <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12 }}>
                                                {new Date(payment.created_at).toLocaleString('fr-FR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                            <td style={{ padding: '12px 14px' }}>
                                                {payment.transaction_id && (payment.status === 'pending' || payment.status === 'processing') && (
                                                    <button
                                                        onClick={() => verifyPaymentStatus(payment.transaction_id!)}
                                                        disabled={checkingPayment === payment.transaction_id}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: 6,
                                                            background: 'rgba(59, 130, 246, 0.15)',
                                                            border: 'none',
                                                            color: '#3b82f6',
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            fontWeight: 500
                                                        }}
                                                    >
                                                        {checkingPayment === payment.transaction_id ? (
                                                            <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                                                        ) : (
                                                            'Vérifier'
                                                        )}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
            </>
        </div>
    )
}
