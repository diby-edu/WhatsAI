'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft, Package, User, Phone, MapPin, Clock,
    Loader2, CheckCircle, XCircle, Truck, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

interface OrderItem {
    id: string
    product_name: string
    quantity: number
    unit_price_fcfa: number
}

interface Order {
    id: string
    order_number: string
    customer_phone: string
    customer_name: string | null
    status: string
    total_fcfa: number
    notes: string | null
    created_at: string
    updated_at: string
    items: OrderItem[]
}

export default function OrderDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        fetchOrder()
    }, [params.id])

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/orders/${params.id}`)
            const data = await res.json()
            if (data.data?.order) {
                setOrder(data.data.order)
            }
        } catch (err) {
            console.error('Error fetching order:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (newStatus: string) => {
        if (!order) return
        setUpdating(true)
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                fetchOrder()
            }
        } catch (err) {
            console.error('Error updating status:', err)
        } finally {
            setUpdating(false)
        }
    }

    const getStatusInfo = (status: string) => {
        const statuses: Record<string, { label: string; color: string; bg: string; icon: any }> = {
            pending: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock },
            confirmed: { label: 'Confirmée', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: CheckCircle },
            processing: { label: 'En cours', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Package },
            shipped: { label: 'Expédiée', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', icon: Truck },
            delivered: { label: 'Livrée', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle },
            cancelled: { label: 'Annulée', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle }
        }
        return statuses[status] || statuses.pending
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA'
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    if (!order) {
        return (
            <div style={{ textAlign: 'center', padding: 48 }}>
                <AlertCircle size={48} style={{ color: '#f87171', marginBottom: 16 }} />
                <p style={{ color: '#f87171' }}>Commande introuvable</p>
                <Link href="/dashboard/orders" style={{ color: '#3b82f6', marginTop: 16, display: 'inline-block' }}>
                    Retour aux commandes
                </Link>
            </div>
        )
    }

    const statusInfo = getStatusInfo(order.status)

    return (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <Link
                    href="/dashboard/orders"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#94a3b8',
                        textDecoration: 'none',
                        marginBottom: 16
                    }}
                >
                    <ArrowLeft size={16} />
                    Retour aux commandes
                </Link>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                            Commande {order.order_number}
                        </h1>
                        <p style={{ color: '#64748b' }}>Créée le {formatDate(order.created_at)}</p>
                    </div>
                    <div style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        background: statusInfo.bg,
                        color: statusInfo.color,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 600
                    }}>
                        <statusInfo.icon size={18} />
                        {statusInfo.label}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
                {/* Main Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Items */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 24
                        }}
                    >
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>
                            Articles ({order.items?.length || 0})
                        </h2>

                        {order.items && order.items.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {order.items.map((item) => (
                                    <div key={item.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 16,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        borderRadius: 12
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 10,
                                                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Package size={24} style={{ color: 'white' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'white' }}>{item.product_name}</div>
                                                <div style={{ fontSize: 14, color: '#64748b' }}>
                                                    {formatPrice(item.unit_price_fcfa)} × {item.quantity}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 700, color: '#34d399', fontSize: 18 }}>
                                            {formatPrice(item.unit_price_fcfa * item.quantity)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                                Aucun article
                            </div>
                        )}

                        {/* Total */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 20,
                            paddingTop: 20,
                            borderTop: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                            <span style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>Total</span>
                            <span style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>
                                {formatPrice(order.total_fcfa)}
                            </span>
                        </div>
                    </motion.div>

                    {/* Notes */}
                    {order.notes && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                padding: 24
                            }}
                        >
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 12 }}>Notes</h2>
                            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{order.notes}</p>
                        </motion.div>
                    )}
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Customer Info */}
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
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16 }}>Client</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <User size={18} style={{ color: '#64748b' }} />
                                <span style={{ color: '#e2e8f0' }}>{order.customer_name || 'Non renseigné'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Phone size={18} style={{ color: '#64748b' }} />
                                <span style={{ color: '#e2e8f0' }}>{order.customer_phone}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Status Actions */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 24
                        }}
                    >
                        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16 }}>Actions</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {order.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => updateStatus('confirmed')}
                                        disabled={updating}
                                        style={{
                                            padding: 12,
                                            background: 'rgba(59, 130, 246, 0.15)',
                                            color: '#3b82f6',
                                            border: 'none',
                                            borderRadius: 10,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Confirmer
                                    </button>
                                    <button
                                        onClick={() => updateStatus('cancelled')}
                                        disabled={updating}
                                        style={{
                                            padding: 12,
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#f87171',
                                            border: 'none',
                                            borderRadius: 10,
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Annuler
                                    </button>
                                </>
                            )}
                            {order.status === 'confirmed' && (
                                <button
                                    onClick={() => updateStatus('processing')}
                                    disabled={updating}
                                    style={{
                                        padding: 12,
                                        background: 'rgba(139, 92, 246, 0.15)',
                                        color: '#a78bfa',
                                        border: 'none',
                                        borderRadius: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Mettre en préparation
                                </button>
                            )}
                            {order.status === 'processing' && (
                                <button
                                    onClick={() => updateStatus('shipped')}
                                    disabled={updating}
                                    style={{
                                        padding: 12,
                                        background: 'rgba(6, 182, 212, 0.15)',
                                        color: '#22d3ee',
                                        border: 'none',
                                        borderRadius: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Marquer comme expédiée
                                </button>
                            )}
                            {order.status === 'shipped' && (
                                <button
                                    onClick={() => updateStatus('delivered')}
                                    disabled={updating}
                                    style={{
                                        padding: 12,
                                        background: 'rgba(16, 185, 129, 0.15)',
                                        color: '#34d399',
                                        border: 'none',
                                        borderRadius: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Marquer comme livrée
                                </button>
                            )}
                            {(order.status === 'delivered' || order.status === 'cancelled') && (
                                <div style={{ textAlign: 'center', padding: 12, color: '#64748b' }}>
                                    Commande terminée
                                </div>
                            )}
                        </div>
                    </motion.div>
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
