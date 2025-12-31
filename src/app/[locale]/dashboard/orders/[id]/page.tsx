'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft, Loader2, Package, CheckCircle, XCircle, Truck, Clock,
    MapPin, Phone, User
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations, useFormatter } from 'next-intl'

interface OrderItem {
    id: string
    quantity: number
    unit_price: number
    total_price: number
    product: {
        name: string
        image_url: string | null
    }
}

interface Order {
    id: string
    order_number: string
    status: string
    total_amount: number
    created_at: string
    notes: string | null
    customer_name: string | null
    customer_phone: string
    delivery_address: string | null
    items: OrderItem[]
}

export default function OrderDetailsPage() {
    const t = useTranslations('Orders.Detail')
    const tStatus = useTranslations('Orders.Status')
    const format = useFormatter()
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
        setUpdating(true)
        try {
            const res = await fetch(`/api/orders/${params.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                setOrder(prev => prev ? { ...prev, status: newStatus } : null)
            }
        } catch (err) {
            console.error('Error updating status:', err)
        } finally {
            setUpdating(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#fbbf24'
            case 'confirmed': return '#34d399'
            case 'processing': return '#60a5fa'
            case 'shipped': return '#a78bfa'
            case 'delivered': return '#10b981'
            case 'cancelled': return '#f87171'
            default: return '#94a3b8'
        }
    }

    const getStatusLabel = (status: string) => {
        try {
            return tStatus(status as any)
        } catch {
            return status
        }
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
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                {t('not_found')}
            </div>
        )
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
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
                    {t('return')}
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                            {t('title', { number: order.order_number })}
                        </h1>
                        <p style={{ color: '#64748b' }}>
                            {t('created_on', { date: format.dateTime(new Date(order.created_at), { dateStyle: 'full', timeStyle: 'short' }) })}
                        </p>
                    </div>
                    <div style={{
                        padding: '8px 16px',
                        borderRadius: 100,
                        background: `${getStatusColor(order.status)}20`,
                        color: getStatusColor(order.status),
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        {order.status === 'pending' && <Clock size={16} />}
                        {order.status === 'confirmed' && <CheckCircle size={16} />}
                        {order.status === 'processing' && <Loader2 size={16} />}
                        {order.status === 'shipped' && <Truck size={16} />}
                        {order.status === 'delivered' && <Package size={16} />}
                        {order.status === 'cancelled' && <XCircle size={16} />}
                        {getStatusLabel(order.status)}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
                {/* Main Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                            {t('items.title', { count: order.items.length })}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {order.items.map((item) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 8,
                                            background: item.product.image_url
                                                ? `url(${item.product.image_url}) center/cover`
                                                : 'rgba(59, 130, 246, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {!item.product.image_url && <Package size={20} color="#60a5fa" />}
                                        </div>
                                        <div>
                                            <div style={{ color: 'white', fontWeight: 500 }}>{item.product.name}</div>
                                            <div style={{ color: '#94a3b8', fontSize: 14 }}>
                                                {formatPrice(item.unit_price)} × {item.quantity}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ color: 'white', fontWeight: 600 }}>
                                        {formatPrice(item.total_price)}
                                    </div>
                                </div>
                            ))}
                            <div style={{ height: 1, background: 'rgba(148, 163, 184, 0.1)', margin: '8px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#94a3b8' }}>{t('items.total')}</span>
                                <span style={{ fontSize: 20, fontWeight: 700, color: '#34d399' }}>
                                    {formatPrice(order.total_amount)}
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Notes */}
                    {order.notes && (
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 24
                        }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 12 }}>
                                {t('notes')}
                            </h2>
                            <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{order.notes}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Customer */}
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
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>
                            {t('customer.title')}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <User size={18} color="#64748b" />
                                <span style={{ color: 'white' }}>{order.customer_name || t('customer.unknown')}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Phone size={18} color="#64748b" />
                                <span style={{ color: 'white' }}>{order.customer_phone}</span>
                            </div>
                            {order.delivery_address && (
                                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                                    <MapPin size={18} color="#64748b" style={{ marginTop: 2 }} />
                                    <span style={{ color: 'white', lineHeight: 1.4 }}>{order.delivery_address}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 24
                        }}
                    >
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 20 }}>
                            {t('actions.title')}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {order.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => updateStatus('confirmed')}
                                        disabled={updating}
                                        style={{
                                            padding: 12,
                                            borderRadius: 10,
                                            border: 'none',
                                            background: '#34d399',
                                            color: '#064e3b',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8
                                        }}
                                    >
                                        {updating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                        {t('actions.confirm')}
                                    </button>
                                    <button
                                        onClick={() => updateStatus('cancelled')}
                                        disabled={updating}
                                        style={{
                                            padding: 12,
                                            borderRadius: 10,
                                            border: 'none',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#f87171',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('actions.cancel')}
                                    </button>
                                </>
                            )}

                            {order.status === 'confirmed' && (
                                <button
                                    onClick={() => updateStatus('processing')}
                                    disabled={updating}
                                    style={{
                                        padding: 12,
                                        borderRadius: 10,
                                        border: 'none',
                                        background: '#60a5fa',
                                        color: '#1e3a8a',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    {updating ? <Loader2 className="animate-spin" size={18} /> : <Loader2 size={18} />}
                                    {t('actions.process')}
                                </button>
                            )}

                            {order.status === 'processing' && (
                                <button
                                    onClick={() => updateStatus('shipped')}
                                    disabled={updating}
                                    style={{
                                        padding: 12,
                                        borderRadius: 10,
                                        border: 'none',
                                        background: '#a78bfa',
                                        color: '#4c1d95',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    {updating ? <Loader2 className="animate-spin" size={18} /> : <Truck size={18} />}
                                    {t('actions.ship')}
                                </button>
                            )}

                            {order.status === 'shipped' && (
                                <button
                                    onClick={() => updateStatus('delivered')}
                                    disabled={updating}
                                    style={{
                                        padding: 12,
                                        borderRadius: 10,
                                        border: 'none',
                                        background: '#10b981',
                                        color: 'white',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    {updating ? <Loader2 className="animate-spin" size={18} /> : <Package size={18} />}
                                    {t('actions.deliver')}
                                </button>
                            )}

                            {['delivered', 'cancelled'].includes(order.status) && (
                                <div style={{ textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                                    {t('actions.completed')}
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
