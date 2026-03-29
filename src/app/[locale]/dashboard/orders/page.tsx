'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
    ShoppingBag, Search, Filter, Eye,
    CheckCircle, XCircle, Clock, Truck, Package,
    Loader2, Image as ImageIcon, Check, X,
    CalendarCheck, Users, MapPin,
    FileText, Layers
} from 'lucide-react'
import { useTranslations, useFormatter } from 'next-intl'
import { useCurrency } from '@/contexts/CurrencyContext'

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
    fulfillment_mode?: 'takeaway' | 'delivery' | null
    pickup_at?: string | null
    created_at: string
    items_count: number
    items?: {
        product_name?: string
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
    start_time: string | null
    party_size: number
    location: string | null
    notes: string | null
    price_fcfa: number
    created_at: string
    booking_source?: string | null
    fulfillment_mode?: string | null
    payment_method?: string | null
    deposit_required?: boolean | null
    deposit_amount_fcfa?: number | null
    deposit_status?: string | null
    transaction_id?: string | null
    provider_payment_url?: string | null
    items_count?: number
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
    const { formatFromFcfa } = useCurrency()

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

    const handleBookingDepositStatusChange = async (bookingId: string, depositStatus: string) => {
        setUpdatingStatusId(bookingId)
        try {
            const res = await fetch(`/api/bookings/${bookingId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deposit_status: depositStatus })
            })
            if (res.ok) {
                fetchBookings()
            } else {
                const data = await res.json()
                alert(data.error || 'Erreur lors de la mise a jour de l acompte')
            }
        } catch (err) {
            console.error('Booking deposit status change error:', err)
        } finally {
            setUpdatingStatusId(null)
        }
    }

    // Tous les statuts cibles atteignables — le marchand clique directement sur l'état final
    const getNextStatusOptions = (order: Order) => {
        const isCOD = order.payment_method === 'cod'
        const orderType = getOrderType(order)
        const isService = orderType === 'service'
        const isPickupOrder = order.fulfillment_mode === 'takeaway' || order.status === 'pending_pickup'

        switch (order.status) {
            case 'pending':
                if (isCOD) {
                    if (isPickupOrder) return [
                        { value: 'pending_pickup', label: '🛍️ Prêt retrait' },
                        { value: 'cancelled', label: '❌ Annuler' },
                    ]
                    if (isService) return [
                        { value: 'confirmed', label: '✅ Confirmer' },
                        { value: 'delivered', label: '🎉 Terminé' },
                        { value: 'cancelled', label: '❌ Annuler' },
                    ]
                    return [
                        { value: 'shipped', label: '📦 Expédier' },
                        { value: 'delivered', label: '✅ Livré' },
                        { value: 'cancelled', label: '❌ Annuler' },
                    ]
                }
                // Mobile Money Direct : paiement obligatoire avant livraison
                if (order.payment_method === 'mobile_money_direct')
                    return [{ value: 'paid', label: '✅ Valider paiement' }, { value: 'cancelled', label: '❌ Annuler' }]
                // CinetPay ('online') : validé automatiquement par webhook
                return [{ value: 'cancelled', label: '❌ Annuler' }]
            case 'pending_pickup':
                return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'delivered', label: '🎉 Retirée' },
                ]
            case 'pending_delivery':
                if (isService) return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'delivered', label: '🎉 Terminé' },
                ]
                return [
                    { value: 'shipped', label: '📦 Expédier' },
                    { value: 'delivered', label: '✅ Livré' },
                ]
            case 'paid':
                if (orderType === 'digital') return [] // Auto-delivered after payment
                if (isPickupOrder) return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'delivered', label: '🎉 Retirée' },
                ]
                if (isService) return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'delivered', label: '🎉 Terminé' },
                ]
                return [
                    { value: 'shipped', label: '📦 Expédier' },
                    { value: 'delivered', label: '✅ Livré' },
                ]
            case 'confirmed':
                if (isPickupOrder) return [{ value: 'delivered', label: '🎉 Retirée' }]
                if (isService) return [{ value: 'delivered', label: '🎉 Marquer terminé' }]
                return [
                    { value: 'shipped', label: '📦 Expédier' },
                    { value: 'delivered', label: '✅ Livré' },
                ]
            case 'processing':
                if (isPickupOrder) return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'delivered', label: '🎉 Retirée' },
                ]
                if (isService) return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'delivered', label: '🎉 Terminé' },
                ]
                return [
                    { value: 'shipped', label: '📦 Expédier' },
                    { value: 'delivered', label: '✅ Livré' },
                ]
            case 'shipped':
                return [{ value: 'delivered', label: '✅ Livré' }]
            default:
                return []
        }
    }

    // Status options for bookings
    const getBookingStatusOptionsLegacy = (status: string) => {
        switch (status) {
            case 'pending':
                return [
                    { value: 'confirmed', label: '✅ Confirmer' },
                    { value: 'cancelled', label: '❌ Annuler' }
                ]
            case 'inscription_pending':
                return [
                    { value: 'confirmed', label: '✅ Paiement reçu — Confirmer' },
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

    const getBookingKind = (booking: Booking) => {
        if (booking.booking_source === 'restaurant') return 'restaurant'
        if (booking.booking_type === 'stay') return 'stay'
        if (booking.booking_type === 'slot') return 'slot'
        if (booking.booking_type === 'inscription') return 'inscription'
        if (booking.booking_type === 'table') return 'table'
        return booking.booking_type || 'other'
    }

    const getBookingKindLabel = (booking: Booking) => {
        switch (getBookingKind(booking)) {
            case 'restaurant': return 'Restaurant'
            case 'stay': return 'Hebergement'
            case 'slot': return 'Service'
            case 'inscription': return 'Inscription'
            case 'table': return 'Table / Event'
            default: return booking.booking_type
        }
    }

    const getBookingPaymentLabel = (booking: Booking) => {
        switch (booking.payment_method) {
            case 'online': return 'En ligne'
            case 'onsite': return 'Sur place'
            case 'cod': return booking.fulfillment_mode === 'delivery' ? 'A la livraison' : 'Au retrait'
            default: return 'Non defini'
        }
    }

    const getBookingDepositLabel = (booking: Booking) => {
        switch (booking.deposit_status) {
            case 'paid': return 'Acompte paye'
            case 'pending': return 'Acompte en attente'
            case 'waived': return 'Acompte leve'
            case 'expired': return 'Acompte expire'
            default: return booking.deposit_required ? 'Acompte requis' : 'Sans acompte'
        }
    }

    const getBookingModeLabel = (booking: Booking) => {
        switch (booking.fulfillment_mode) {
            case 'dine_in': return 'Sur place'
            case 'booking_only': return 'Reservation simple'
            case 'takeaway': return 'A emporter'
            case 'delivery': return 'Livraison'
            default: return null
        }
    }

    const getBookingStatusOptions = (booking: Booking) => {
        if (booking.deposit_required && booking.deposit_status === 'pending') {
            return [
                { value: 'cancelled', label: '❌ Annuler' }
            ]
        }

        return getBookingStatusOptionsLegacy(booking.status)
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
            case 'pending_pickup': return '#f97316'
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
            case 'pending_pickup': return <Package size={16} />
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
        if (status === 'pending_pickup') return 'Prête pour retrait'
        try {
            return tStatus(status as never)
        } catch {
            return status
        }
    }

    // Helper to determine order type
    const getOrderType = (order: Order): 'physical' | 'digital' | 'service' | 'mixed' | 'unknown' => {
        if (!order.items || order.items.length === 0) return 'unknown'

        let hasPhysical = false
        let hasDigital = false
        let hasService = false

        order.items.forEach(item => {
            let type = item.product?.product_type?.toLowerCase()

            // 🤖 FALLBACK: If no product link, infer from name
            if (!type && item.product_name) {
                const lowerName = item.product_name.toLowerCase()

                // Common Digital Keywords
                if (lowerName.match(/office|windows|licence|license|clé|key|ebook|pdf|numérique|digital/)) {
                    type = 'digital'
                }
                // Common Service Keywords
                else if (lowerName.match(/service|consultation|coaching|formation|cours|atelier|réservation|hotel|restaurant|soin/)) {
                    type = 'service'
                }
                // Default to physical
                else {
                    type = 'physical'
                }
            }

            if (type === 'digital') hasDigital = true
            else if (type === 'service') hasService = true
            else hasPhysical = true // Default to physical if unknown or explicit
        })

        if ((hasPhysical && hasDigital) || (hasPhysical && hasService) || (hasDigital && hasService)) return 'mixed'
        if (hasService) return 'service'
        if (hasDigital) return 'digital'
        return 'physical'
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'physical': return <Package size={24} />
            case 'digital': return <FileText size={24} />
            case 'service': return <CalendarCheck size={24} />
            case 'mixed': return <Layers size={24} />
            default: return <ShoppingBag size={24} />
        }
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'physical': return 'Physique'
            case 'digital': return 'Numérique'
            case 'service': return 'Service'
            case 'mixed': return 'Mixte'
            default: return ''
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'physical': return '#f59e0b' // Orange
            case 'digital': return '#3b82f6' // Blue
            case 'service': return '#ec4899' // Pink
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

    const formatPrice = formatFromFcfa

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
                    <h1 style={{ fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>{t('title')}</h1>
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
                                width: '100%',
                                maxWidth: 200,
                                minWidth: 120
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
                                width: '100%',
                                maxWidth: 180,
                                minWidth: 140,
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">{t('filter.all')}</option>
                            <option value="pending">{t('filter.pending')}</option>
                            <option value="pending_delivery">{t('filter.pending_delivery')}</option>
                            <option value="pending_pickup">Prête pour retrait</option>
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
                    {bookings.filter(b => b.status === 'pending' || b.status === 'inscription_pending').length > 0 && (
                        <span style={{
                            background: '#8b5cf6',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 100,
                            fontSize: 12,
                            fontWeight: 700
                        }}>
                            {bookings.filter(b => b.status === 'pending' || b.status === 'inscription_pending').length}
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
                                        {order.fulfillment_mode && (
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 100,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: order.fulfillment_mode === 'takeaway' ? 'rgba(249, 115, 22, 0.18)' : 'rgba(59, 130, 246, 0.18)',
                                                color: order.fulfillment_mode === 'takeaway' ? '#fb923c' : '#60a5fa'
                                            }}>
                                                {order.fulfillment_mode === 'takeaway' ? 'À emporter' : 'Livraison'}
                                            </span>
                                        )}
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

                                {/* Inline Status Buttons */}
                                {getNextStatusOptions(order).length > 0 && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {getNextStatusOptions(order).map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleStatusChange(order.id, opt.value)}
                                                disabled={updatingStatusId === order.id}
                                                style={{
                                                    padding: '10px 14px',
                                                    borderRadius: 10,
                                                    background: `${getStatusColor(opt.value)}20`,
                                                    color: getStatusColor(opt.value),
                                                    border: `1px solid ${getStatusColor(opt.value)}40`,
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontSize: 13,
                                                    opacity: updatingStatusId === order.id ? 0.5 : 1,
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {updatingStatusId === order.id
                                                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                    : getStatusIcon(opt.value)
                                                }
                                                {opt.label.replace(/^[^\s]+\s/, '')}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Details Button — always visible */}
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
                                                {booking.service_name || getBookingKindLabel(booking)}
                                            </h3>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 100,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: booking.booking_source === 'restaurant'
                                                    ? 'rgba(16, 185, 129, 0.15)'
                                                    : 'rgba(139, 92, 246, 0.12)',
                                                color: booking.booking_source === 'restaurant' ? '#34d399' : '#a78bfa'
                                            }}>
                                                {getBookingKindLabel(booking)}
                                            </span>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: 100,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: booking.status === 'pending' ? 'rgba(251, 191, 36, 0.2)'
                                                    : booking.status === 'inscription_pending' ? 'rgba(139, 92, 246, 0.2)'
                                                    : booking.status === 'confirmed' ? 'rgba(16, 185, 129, 0.2)'
                                                    : booking.status === 'completed' ? 'rgba(59, 130, 246, 0.2)'
                                                    : 'rgba(239, 68, 68, 0.2)',
                                                color: booking.status === 'pending' ? '#fbbf24'
                                                    : booking.status === 'inscription_pending' ? '#a78bfa'
                                                    : booking.status === 'confirmed' ? '#10b981'
                                                    : booking.status === 'completed' ? '#60a5fa'
                                                    : '#ef4444'
                                            }}>
                                                {booking.status === 'pending' && '🟡 En attente'}
                                                {booking.status === 'inscription_pending' && '📚 Inscription'}
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
                                            {getBookingModeLabel(booking) && (
                                                <span>🍽️ {getBookingModeLabel(booking)}</span>
                                            )}
                                            {booking.start_time
                                                ? <span>📅 {format.dateTime(new Date(booking.start_time), { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                : <span style={{ color: '#a78bfa' }}>📚 Inscription</span>
                                            }
                                        </p>
                                        <div style={{ color: '#64748b', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                            <span>Paiement: {getBookingPaymentLabel(booking)}</span>
                                            {booking.deposit_required ? (
                                                <span>
                                                    {getBookingDepositLabel(booking)}
                                                    {booking.deposit_amount_fcfa ? ` • ${formatPrice(booking.deposit_amount_fcfa)}` : ''}
                                                </span>
                                            ) : (
                                                <span>Sans acompte</span>
                                            )}
                                            {typeof booking.items_count === 'number' && booking.items_count > 0 && (
                                                <span>{booking.items_count} article{booking.items_count > 1 ? 's' : ''} precommande{booking.items_count > 1 ? 's' : ''}</span>
                                            )}
                                        </div>
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
                                    {(booking.deposit_required && booking.deposit_status === 'pending') && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {booking.provider_payment_url && (
                                                <button
                                                    onClick={() => window.open(booking.provider_payment_url || '', '_blank', 'noopener,noreferrer')}
                                                    disabled={updatingStatusId === booking.id}
                                                    style={{
                                                        padding: '10px 12px',
                                                        borderRadius: 10,
                                                        background: 'rgba(59, 130, 246, 0.15)',
                                                        color: '#60a5fa',
                                                        border: 'none',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        opacity: updatingStatusId === booking.id ? 0.5 : 1
                                                    }}
                                                    title={booking.transaction_id ? `Ouvrir le lien ${booking.transaction_id}` : 'Ouvrir le lien de paiement'}
                                                >
                                                    Ouvrir lien
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleBookingDepositStatusChange(booking.id, 'paid')}
                                                disabled={updatingStatusId === booking.id}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 10,
                                                    background: 'rgba(34, 197, 94, 0.15)',
                                                    color: '#4ade80',
                                                    border: 'none',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    opacity: updatingStatusId === booking.id ? 0.5 : 1
                                                }}
                                                title="Marquer acompte paye"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => handleBookingDepositStatusChange(booking.id, 'waived')}
                                                disabled={updatingStatusId === booking.id}
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: 10,
                                                    background: 'rgba(59, 130, 246, 0.15)',
                                                    color: '#60a5fa',
                                                    border: 'none',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    opacity: updatingStatusId === booking.id ? 0.5 : 1
                                                }}
                                                title="Lever l acompte"
                                            >
                                                Sans acompte
                                            </button>
                                            <button
                                                onClick={() => handleBookingDepositStatusChange(booking.id, 'expired')}
                                                disabled={updatingStatusId === booking.id}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 10,
                                                    background: 'rgba(251, 191, 36, 0.15)',
                                                    color: '#fbbf24',
                                                    border: 'none',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    opacity: updatingStatusId === booking.id ? 0.5 : 1
                                                }}
                                                title="Marquer acompte expire"
                                            >
                                                !
                                            </button>
                                        </div>
                                    )}
                                    {getBookingStatusOptions(booking).length > 0 && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {getBookingStatusOptions(booking).map(option => (
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
                        <Image
                            src={getScreenshotUrl(screenshotModal)}
                            width={1200}
                            height={1600}
                            unoptimized
                            alt="Capture d'écran paiement"
                            style={{ maxWidth: '100%', height: 'auto', maxHeight: '85vh', borderRadius: 12 }}
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
        </div>
    )
}
