'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ShoppingBag, Search, Loader2, Eye, Clock, Check,
    Truck, Package, XCircle, Phone
} from 'lucide-react'

interface Order {
    id: string
    order_number: string
    customer_name: string | null
    customer_phone: string
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
    total_fcfa: number
    created_at: string
    items: any[]
}

const statusConfig = {
    pending: { label: 'En attente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock },
    confirmed: { label: 'Confirmée', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: Check },
    processing: { label: 'En cours', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Package },
    shipped: { label: 'Expédiée', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Truck },
    delivered: { label: 'Livrée', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: Check },
    cancelled: { label: 'Annulée', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle }
}

export default function OrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchOrders()
    }, [filterStatus])

    const fetchOrders = async () => {
        try {
            let url = '/api/orders'
            if (filterStatus) url += `?status=${filterStatus}`

            const res = await fetch(url)
            const data = await res.json()
            if (data.data?.orders) {
                setOrders(data.data.orders)
            }
        } catch (err) {
            console.error('Error fetching orders:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            fetchOrders()
        } catch (err) {
            console.error('Error updating order:', err)
        }
    }

    const filteredOrders = orders.filter(o =>
        o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_phone.includes(searchTerm) ||
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA'
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Commandes</h1>
                    <p style={{ color: '#94a3b8' }}>{orders.length} commandes</p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                        <input
                            placeholder="Rechercher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                padding: '12px 12px 12px 44px',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                width: 200
                            }}
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="">Tous les statuts</option>
                        <option value="pending">En attente</option>
                        <option value="confirmed">Confirmées</option>
                        <option value="processing">En cours</option>
                        <option value="shipped">Expédiées</option>
                        <option value="delivered">Livrées</option>
                        <option value="cancelled">Annulées</option>
                    </select>
                </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 48,
                    textAlign: 'center'
                }}>
                    <ShoppingBag style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>Aucune commande</h3>
                    <p style={{ color: '#64748b', fontSize: 14 }}>
                        Les commandes créées par le bot apparaîtront ici.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredOrders.map((order, i) => {
                        const status = statusConfig[order.status]
                        const StatusIcon = status.icon

                        return (
                            <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 16,
                                    padding: 20
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                            <span style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>
                                                #{order.order_number}
                                            </span>
                                            <span style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '6px 12px',
                                                borderRadius: 100,
                                                fontSize: 13,
                                                fontWeight: 600,
                                                background: status.bg,
                                                color: status.color
                                            }}>
                                                <StatusIcon size={14} />
                                                {status.label}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 14 }}>
                                            <Phone size={14} />
                                            {order.customer_name || order.customer_phone}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>
                                            {formatPrice(order.total_fcfa)}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            {formatDate(order.created_at)}
                                        </div>
                                    </div>
                                </div>

                                {/* Items preview */}
                                {order.items && order.items.length > 0 && (
                                    <div style={{ marginBottom: 16, padding: 12, background: 'rgba(15, 23, 42, 0.5)', borderRadius: 10 }}>
                                        {order.items.slice(0, 3).map((item: any, idx: number) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 14, paddingBlock: 4 }}>
                                                <span>{item.quantity}x {item.product_name}</span>
                                                <span>{formatPrice(item.unit_price_fcfa * item.quantity)}</span>
                                            </div>
                                        ))}
                                        {order.items.length > 3 && (
                                            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
                                                +{order.items.length - 3} autres articles
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            background: 'rgba(51, 65, 85, 0.5)',
                                            border: 'none',
                                            color: 'white',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 14
                                        }}
                                    >
                                        <Eye size={16} />
                                        Détails
                                    </button>

                                    {order.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                                style={{
                                                    padding: '10px 16px',
                                                    borderRadius: 10,
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    border: 'none',
                                                    color: '#34d399',
                                                    cursor: 'pointer',
                                                    fontSize: 14
                                                }}
                                            >
                                                ✓ Confirmer
                                            </button>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                                style={{
                                                    padding: '10px 16px',
                                                    borderRadius: 10,
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    border: 'none',
                                                    color: '#f87171',
                                                    cursor: 'pointer',
                                                    fontSize: 14
                                                }}
                                            >
                                                ✕ Annuler
                                            </button>
                                        </>
                                    )}

                                    {order.status === 'confirmed' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'processing')}
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: 10,
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                border: 'none',
                                                color: '#3b82f6',
                                                cursor: 'pointer',
                                                fontSize: 14
                                            }}
                                        >
                                            Passer en traitement
                                        </button>
                                    )}

                                    {order.status === 'processing' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'shipped')}
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: 10,
                                                background: 'rgba(139, 92, 246, 0.15)',
                                                border: 'none',
                                                color: '#a78bfa',
                                                cursor: 'pointer',
                                                fontSize: 14
                                            }}
                                        >
                                            Marquer expédiée
                                        </button>
                                    )}

                                    {order.status === 'shipped' && (
                                        <button
                                            onClick={() => updateOrderStatus(order.id, 'delivered')}
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: 10,
                                                background: 'rgba(34, 197, 94, 0.15)',
                                                border: 'none',
                                                color: '#22c55e',
                                                cursor: 'pointer',
                                                fontSize: 14
                                            }}
                                        >
                                            Marquer livrée
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
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
