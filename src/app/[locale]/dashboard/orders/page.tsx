'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ShoppingBag, Search, Filter, Eye,
    CheckCircle, XCircle, Clock, Truck, Package,
    Loader2, Image as ImageIcon, Check, X,
    CalendarCheck, ChevronDown, Users, MapPin,
    FileText, Layers
} from 'lucide-react'
import { useTranslations, useFormatter } from 'next-intl'

interface Order {
    id: string
    order_number: string
    customer_name: string | null
    customer_phone: string
    status: string
    total_amount: number
    total_fcfa: number
    payment_method: 'online' | 'cod' | 'mobile_money_direct' | null
    payment_verification_status: string | null
    payment_screenshot_url: string | null
    created_at: string
    items_count: number
    items?: {
        product?: {
            product_type: string
        }
    }[]
}

interface Booking {
    id: string
    customer_name: string | null
    customer_phone: string
    booking_type: string
    service_name: string | null
    status: string
    start_time: string
    party_size: number
    location: string | null
    notes: string | null
    price_fcfa: number
    created_at: string
}

export default function OrdersPage() {
    const t = useTranslations('Orders.List')
    const tStatus = useTranslations('Orders.Status')
    const format = useFormatter()
    const router = useRouter()
    const [orders, setOrders] = useState<Order[]>([])
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [activeTab, setActiveTab] = useState<'cinetpay' | 'mobile_money' | 'bookings'>('cinetpay')
    const [verifyingId, setVerifyingId] = useState<string | null>(null)
    const [screenshotModal, setScreenshotModal] = useState<string | null>(null)
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

    useEffect(() => {
        fetchOrders()
        fetchBookings()
    }, [])

    const fetchOrders = async () => {
        try {
            const res = await fetch('/api/orders')
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

    const fetchBookings = async () => {
        try {
            const res = await fetch('/api/bookings')
            const data = await res.json()
            if (data.data?.bookings) {
                setBookings(data.data.bookings)
            }
        } catch (err) {
            console.error('Error fetching bookings:', err)
        }
    }

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setUpdatingStatusId(orderId)
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                fetchOrders()
            } else {
                const data = await res.json()
                alert(data.error || 'Erreur lors du changement de statut')
            }
        } catch (err) {
            console.error('Status change error:', err)
        } finally {
            setUpdatingStatusId(null)
        }
    }

    const handleBookingStatusChange = async (bookingId: string, newStatus: string) => {
        setUpdatingStatusId(bookingId)
        try {
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            if (res.ok) {
                fetchBookings()
            } else {
                const data = await res.json()
                alert(data.error || 'Erreur lors du changement de statut')
            }
        } catch (err) {
            console.error('Booking status change error:', err)
        } finally {
            setUpdatingStatusId(null)
        }
    }

    // Status options for orders (based on payment method)
    const getNextStatusOptions = (order: Order) => {
        const isCOD = order.payment_method === 'cod'
        switch (order.status) {
            case 'pending':
                return isCOD ? [{ value: 'shipped', label: '📦 Expédier' }] : []
            case 'paid':
                return [{ value: 'shipped', label: '📦 Expédier' }]
            case 'shipped':
                return [{ value: 'delivered', label: '✅ Livré' }]
            default:
                return []
        }
    }

    // Status options for bookings
    const getBookingStatusOptions = (status: string) => {
        switch (status) {
            case 'pending':
                return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'cancelled', label: '❌ Annuler' }
                ]
            case 'confirmed':
                return [
                    { value: 'completed', label: '🎉 Terminé' },
                    { value: 'cancelled', label: '❌ Annuler' }
                ]
            default:
                return []
        }
    }

    const handleVerify = async (orderId: string, action: 'verify' | 'reject') => {
        setVerifyingId(orderId)
        try {
            const res = await fetch(`/api/orders/${orderId}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })
            if (res.ok) {
                // Refresh orders
                fetchOrders()
            } else {
                const data = await res.json()
                alert(data.error || 'Erreur lors de la vérification')
            }
        } catch (err) {
            console.error('Verify error:', err)
            alert('Erreur réseau')
        } finally {
            setVerifyingId(null)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#fbbf24'
            case 'pending_delivery': return '#f59e0b'
            case 'paid': return '#10b981'
            case 'confirmed': return '#34d399'
            case 'processing': return '#60a5fa'
            case 'shipped': return '#a78bfa'
            case 'delivered': return '#10b981'
            case 'cancelled': return '#f87171'
            default: return '#94a3b8'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock size={16} />
            case 'pending_delivery': return <Truck size={16} />
            case 'paid': return <CheckCircle size={16} />
            case 'confirmed': return <CheckCircle size={16} />
            case 'processing': return <Loader2 size={16} />
            case 'shipped': return <Truck size={16} />
            case 'delivered': return <Package size={16} />
            case 'cancelled': return <XCircle size={16} />
            default: return <Clock size={16} />
        }
    }

    const getStatusLabel = (status: string) => {
        try {
            return tStatus(status as any)
        } catch {
            return status
        }
    }

    // Helper to determine order type
    const getOrderType = (order: Order): 'physical' | 'digital' | 'mixed' | 'unknown' => {
        if (!order.items || order.items.length === 0) return 'unknown'

        let hasPhysical = false
        let hasDigital = false

        order.items.forEach(item => {
            const type = item.product?.product_type
            if (type === 'digital') hasDigital = true
            else hasPhysical = true // Default to physical if unknown or explicit
        })

        if (hasPhysical && hasDigital) return 'mixed'
        if (hasDigital) return 'digital'
        return 'physical'
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'physical': return <Package size={24} />
            case 'digital': return <FileText size={24} />
            case 'mixed': return <Layers size={24} />
            default: return <ShoppingBag size={24} />
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'physical': return 'Physique'
            case 'digital': return 'Numérique'
            case 'mixed': return 'Mixte'
            default: return ''
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'physical': return '#f59e0b' // Orange
            case 'digital': return '#3b82f6' // Blue
            case 'mixed': return '#8b5cf6' // Purple
            default: return '#64748b'
        }
    }

    // Filter orders by tab
    const mobileMoneyOrders = orders.filter(o =>
        o.payment_verification_status &&
        ['awaiting_screenshot', 'awaiting_verification', 'verified', 'rejected', 'expired'].includes(o.payment_verification_status)
    )
    const cinetpayOrders = orders.filter(o => !o.payment_verification_status)

    const pendingVerificationCount = mobileMoneyOrders.filter(
        o => o.payment_verification_status === 'awaiting_verification'
    ).length

    const displayOrders = activeTab === 'mobile_money' ? mobileMoneyOrders : cinetpayOrders

    const startFilter = displayOrders.filter(o =>
        (o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.customer_phone.includes(searchTerm) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(searchTerm.toLowerCase())))
        &&
        (filterStatus ? o.status === filterStatus : true)
    )

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA'
    }

    const getScreenshotUrl = (path: string) => {
        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/verification-images/${path}`
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
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
                    <p style={{ color: '#94a3b8' }}>{t('count', { count: orders.length })}</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                        <input
                            placeholder={t('search')}
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
                    <div style={{ position: 'relative' }}>
                        <Filter style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b', pointerEvents: 'none' }} />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            style={{
                                padding: '12px 12px 12px 44px',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                width: 180,
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">{t('filter.all')}</option>
                            <option value="pending">{t('filter.pending')}</option>
                            <option value="pending_delivery">{t('filter.pending_delivery')}</option>
                            <option value="paid">{t('filter.paid')}</option>
                            <option value="delivered">{t('filter.delivered')}</option>
                            <option value="cancelled">{t('filter.cancelled')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: 16 }}>
                <button
                    onClick={() => setActiveTab('cinetpay')}
                    style={{
                        padding: '12px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: activeTab === 'cinetpay' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: activeTab === 'cinetpay' ? '#10b981' : '#94a3b8',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    🔄 CinetPay ({cinetpayOrders.length})
                </button>
                <button
                    onClick={() => setActiveTab('mobile_money')}
                    style={{
                        padding: '12px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: activeTab === 'mobile_money' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: activeTab === 'mobile_money' ? '#f59e0b' : '#94a3b8',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    📱 Mobile Money
                    {pendingVerificationCount > 0 && (
                        <span style={{
                            background: '#ef4444',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 100,
                            fontSize: 12,
                            fontWeight: 700
                        }}>
                            {pendingVerificationCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('bookings')}
                    style={{
                        padding: '12px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: activeTab === 'bookings' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                        color: activeTab === 'bookings' ? '#a78bfa' : '#94a3b8',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    🛎️ Réservations ({bookings.length})
                    {bookings.filter(b => b.status === 'pending').length > 0 && (
                        <span style={{
                            background: '#8b5cf6',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 100,
                            fontSize: 12,
                            fontWeight: 700
                        }}>
                            {bookings.filter(b => b.status === 'pending').length}
                        </span>
                    )}
                </button>
            </div>

            {/* Mobile Money Alert */}
            {activeTab === 'mobile_money' && pendingVerificationCount > 0 && (
                <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <span style={{ fontSize: 24 }}>🔔</span>
                    <div>
                        <div style={{ color: '#f59e0b', fontWeight: 600 }}>
                            {pendingVerificationCount} paiement(s) en attente de vérification
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 14 }}>
                            Vérifiez les captures d'écran et confirmez ou rejetez les paiements.
                        </div>
                    </div>
                </div>
            )}

            {/* Orders List - Show only when NOT on bookings tab */}
            {activeTab !== 'bookings' && (startFilter.length === 0 ? (
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    padding: 48,
                    textAlign: 'center'
                }}>
                    <ShoppingBag style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{t('empty.title')}</h3>
                    <p style={{ color: '#64748b', fontSize: 14 }}>
                        {activeTab === 'mobile_money'
                            ? "Aucune commande Mobile Money pour le moment."
                            : t('empty.message')}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {startFilter.map((order, i) => (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: order.payment_verification_status === 'awaiting_verification'
                                    ? '2px solid rgba(245, 158, 11, 0.5)'
                                    : '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                padding: 20,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 20
                            }}
                        >
                            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: `${getTypeColor(getOrderType(order))}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: getTypeColor(getOrderType(order))
                                }}>
                                    {getTypeIcon(getOrderType(order))}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                        <h3 style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>
                                            #{order.order_number}
                                        </h3>
                                        {/* TYPE BADGE */}
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 6,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            background: `${getTypeColor(getOrderType(order))}20`,
                                            color: getTypeColor(getOrderType(order)),
                                            border: `1px solid ${getTypeColor(getOrderType(order))}40`
                                        }}>
                                            {getTypeLabel(getOrderType(order))}
                                        </span>

                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: 100,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            background: `${getStatusColor(order.status)}20`,
                                            color: getStatusColor(order.status)
                                        }}>
                                            {getStatusIcon(order.status)}
                                            {getStatusLabel(order.status)}
                                        </span>
                                        {/* Mobile Money Status Badge */}
                                        {order.payment_verification_status && (
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 100,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: order.payment_verification_status === 'awaiting_verification'
                                                    ? 'rgba(245, 158, 11, 0.2)'
                                                    : order.payment_verification_status === 'verified'
                                                        ? 'rgba(16, 185, 129, 0.2)'
                                                        : order.payment_verification_status === 'rejected'
                                                            ? 'rgba(239, 68, 68, 0.2)'
                                                            : 'rgba(148, 163, 184, 0.2)',
                                                color: order.payment_verification_status === 'awaiting_verification'
                                                    ? '#f59e0b'
                                                    : order.payment_verification_status === 'verified'
                                                        ? '#10b981'
                                                        : order.payment_verification_status === 'rejected'
                                                            ? '#ef4444'
                                                            : '#94a3b8'
                                            }}>
                                                {order.payment_verification_status === 'awaiting_screenshot' && '📷 En attente capture'}
                                                {order.payment_verification_status === 'awaiting_verification' && '🔍 À vérifier'}
                                                {order.payment_verification_status === 'verified' && '✅ Vérifié'}
                                                {order.payment_verification_status === 'rejected' && '❌ Rejeté'}
                                                {order.payment_verification_status === 'expired' && '⏰ Expiré'}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: 14 }}>
                                        {order.customer_name || order.customer_phone} • {format.dateTime(new Date(order.created_at), { dateStyle: 'medium', timeStyle: 'short' })}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>
                                        {formatPrice(order.total_fcfa || order.total_amount)}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 13 }}>
                                        {order.items_count} articles
                                    </div>
                                </div>

                                {/* Verification Buttons (Mobile Money) */}
                                {order.payment_verification_status === 'awaiting_verification' && order.payment_screenshot_url && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => setScreenshotModal(order.payment_screenshot_url!)}
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                color: '#60a5fa',
                                                border: 'none',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}
                                        >
                                            <ImageIcon size={16} /> Voir
                                        </button>
                                        <button
                                            onClick={() => handleVerify(order.id, 'verify')}
                                            disabled={verifyingId === order.id}
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: 'rgba(16, 185, 129, 0.15)',
                                                color: '#10b981',
                                                border: 'none',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                opacity: verifyingId === order.id ? 0.5 : 1
                                            }}
                                        >
                                            <Check size={16} /> Confirmer
                                        </button>
                                        <button
                                            onClick={() => handleVerify(order.id, 'reject')}
                                            disabled={verifyingId === order.id}
                                            style={{
                                                padding: '10px 14px',
                                                borderRadius: 10,
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#ef4444',
                                                border: 'none',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                opacity: verifyingId === order.id ? 0.5 : 1
                                            }}
                                        >
                                            <X size={16} /> Rejeter
                                        </button>
                                    </div>
                                )}

                                {/* Regular Details Button */}
                                {order.payment_verification_status !== 'awaiting_verification' && (
                                    <button
                                        onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: 10,
                                            background: 'rgba(59, 130, 246, 0.15)',
                                            color: '#60a5fa',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8
                                        }}
                                    >
                                        <Eye size={16} />
                                        {t('card.details')}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            ))}

            {/* Bookings List - Show only on bookings tab */}
            {activeTab === 'bookings' && (
                bookings.length === 0 ? (
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        padding: 48,
                        textAlign: 'center'
                    }}>
                        <CalendarCheck style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 16px' }} />
                        <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>Aucune réservation</h3>
                        <p style={{ color: '#64748b', fontSize: 14 }}>
                            Les réservations de services (hôtel, restaurant, coiffeur...) apparaîtront ici.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {bookings.map((booking, i) => (
                            <motion.div
                                key={booking.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                style={{
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: booking.status === 'pending'
                                        ? '2px solid rgba(139, 92, 246, 0.5)'
                                        : '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 16,
                                    padding: 20,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 20
                                }}
                            >
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        background: 'rgba(139, 92, 246, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#a78bfa'
                                    }}>
                                        <CalendarCheck size={24} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                            <h3 style={{ color: 'white', fontWeight: 600, fontSize: 16 }}>
                                                {booking.service_name || booking.booking_type}
                                            </h3>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 100,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: booking.status === 'pending' ? 'rgba(251, 191, 36, 0.2)'
                                                    : booking.status === 'confirmed' ? 'rgba(16, 185, 129, 0.2)'
                                                        : booking.status === 'completed' ? 'rgba(59, 130, 246, 0.2)'
                                                            : 'rgba(239, 68, 68, 0.2)',
                                                color: booking.status === 'pending' ? '#fbbf24'
                                                    : booking.status === 'confirmed' ? '#10b981'
                                                        : booking.status === 'completed' ? '#60a5fa'
                                                            : '#ef4444'
                                            }}>
                                                {booking.status === 'pending' && '🟡 En attente'}
                                                {booking.status === 'confirmed' && '✅ Confirmé'}
                                                {booking.status === 'completed' && '🎉 Terminé'}
                                                {booking.status === 'cancelled' && '❌ Annulé'}
                                            </span>
                                        </div>
                                        <p style={{ color: '#94a3b8', fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span>{booking.customer_name || booking.customer_phone}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Users size={14} /> {booking.party_size}
                                            </span>
                                            <span>📅 {format.dateTime(new Date(booking.start_time), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                        </p>
                                        {booking.location && (
                                            <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <MapPin size={12} /> {booking.location}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {booking.price_fcfa > 0 && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>
                                                {formatPrice(booking.price_fcfa)}
                                            </div>
                                        </div>
                                    )}

                                    {/* Booking Status Actions */}
                                    {getBookingStatusOptions(booking.status).length > 0 && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {getBookingStatusOptions(booking.status).map(option => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => handleBookingStatusChange(booking.id, option.value)}
                                                    disabled={updatingStatusId === booking.id}
                                                    style={{
                                                        padding: '10px 14px',
                                                        borderRadius: 10,
                                                        background: option.value === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                        color: option.value === 'cancelled' ? '#ef4444' : '#10b981',
                                                        border: 'none',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        opacity: updatingStatusId === booking.id ? 0.5 : 1
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )
            )}

            {/* Screenshot Modal */}
            {screenshotModal && (
                <div
                    onClick={() => setScreenshotModal(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        cursor: 'pointer'
                    }}
                >
                    <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img
                            src={getScreenshotUrl(screenshotModal)}
                            alt="Capture d'écran paiement"
                            style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12 }}
                        />
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <button
                                onClick={() => setScreenshotModal(null)}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: 10,
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
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
