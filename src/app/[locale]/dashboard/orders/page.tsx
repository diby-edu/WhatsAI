'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ShoppingBag, Search, Filter,
    CheckCircle, XCircle, Clock, Truck, Package,
    Loader2, CalendarCheck,
    FileText, Layers
} from 'lucide-react'
import { useTranslations, useFormatter } from 'next-intl'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useToast } from '@/components/ui/Toast'
import { OrderCard } from './components/OrderCard'
import { BookingCard } from './components/BookingCard'
import { ScreenshotModal } from './components/ScreenshotModal'
import type { Order, Booking } from './types'

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
    const [filterType, setFilterType] = useState('')
    const [filterPayment, setFilterPayment] = useState('')
    const [activeTab, setActiveTab] = useState<'orders' | 'mobile_money' | 'bookings'>('orders')
    const [verifyingId, setVerifyingId] = useState<string | null>(null)
    const [screenshotModal, setScreenshotModal] = useState<string | null>(null)
    const [screenshotSignedUrl, setScreenshotSignedUrl] = useState<string | null>(null)
    const [screenshotLoading, setScreenshotLoading] = useState(false)
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
    const { formatFromFcfa } = useCurrency()
    const toast = useToast()

    useEffect(() => {
        fetchOrders()
        fetchBookings()
    }, [])

    useEffect(() => {
        setFilterStatus('')
        setFilterType('')
        setFilterPayment('')
    }, [activeTab])

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
                toast.error(data.error || 'Erreur lors du changement de statut')
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
                toast.error(data.error || 'Erreur lors du changement de statut')
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
                toast.error(data.error || t('errors.paymentUpdateFailed'))
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
                        { value: 'pending_pickup', label: t('actions.readyForPickup') },
                        { value: 'cancelled', label: t('actions.cancel') },
                    ]
                    if (isService) return [
                        { value: 'confirmed', label: t('actions.confirm') },
                        { value: 'delivered', label: t('actions.finished') },
                        { value: 'cancelled', label: t('actions.cancel') },
                    ]
                    return [
                        { value: 'shipped', label: t('actions.ship') },
                        { value: 'delivered', label: t('actions.delivered') },
                        { value: 'cancelled', label: t('actions.cancel') },
                    ]
                }
                // Mobile Money Direct : paiement obligatoire avant livraison
                if (order.payment_method === 'mobile_money_direct')
                    return [{ value: 'paid', label: t('actions.validatePayment') }, { value: 'cancelled', label: t('actions.cancel') }]
                // CinetPay ('online') : validé automatiquement par webhook
                return [{ value: 'cancelled', label: t('actions.cancel') }]
            case 'pending_pickup':
                return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'delivered', label: t('actions.pickedUp') },
                ]
            case 'pending_delivery':
                if (isService) return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'delivered', label: t('actions.finished') },
                ]
                return [
                    { value: 'shipped', label: t('actions.ship') },
                    { value: 'delivered', label: t('actions.delivered') },
                ]
            case 'paid':
                if (orderType === 'digital') return [] // Auto-delivered after payment
                if (isPickupOrder) return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'delivered', label: t('actions.pickedUp') },
                ]
                if (isService) return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'delivered', label: t('actions.finished') },
                ]
                return [
                    { value: 'shipped', label: t('actions.ship') },
                    { value: 'delivered', label: t('actions.delivered') },
                ]
            case 'confirmed':
                if (isPickupOrder) return [{ value: 'delivered', label: t('actions.pickedUp') }]
                if (isService) return [{ value: 'delivered', label: t('actions.markFinished') }]
                return [
                    { value: 'shipped', label: t('actions.ship') },
                    { value: 'delivered', label: t('actions.delivered') },
                ]
            case 'processing':
                if (isPickupOrder) return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'delivered', label: t('actions.pickedUp') },
                ]
                if (isService) return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'delivered', label: t('actions.finished') },
                ]
                return [
                    { value: 'shipped', label: t('actions.ship') },
                    { value: 'delivered', label: t('actions.delivered') },
                ]
            case 'shipped':
                return [{ value: 'delivered', label: t('actions.delivered') }]
            default:
                return []
        }
    }

    // Status options for bookings
    const getBookingStatusOptionsLegacy = (booking: Booking) => {
        switch (booking.status) {
            case 'pending':
                return [
                    { value: 'confirmed', label: t('actions.confirm') },
                    { value: 'cancelled', label: t('actions.cancel') }
                ]
            case 'inscription_pending':
                return [
                    { value: 'confirmed', label: t('actions.paymentReceivedConfirm') },
                    { value: 'cancelled', label: t('actions.cancel') }
                ]
            case 'confirmed':
                return [
                    { value: 'completed', label: booking.booking_source === 'restaurant' ? t('actions.customerServed') : t('actions.finished') },
                    { value: 'cancelled', label: t('actions.cancel') }
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
            case 'restaurant': return t('bookingKindLabel.restaurant')
            case 'stay': return t('bookingKindLabel.stay')
            case 'slot': return t('bookingKindLabel.slot')
            case 'inscription': return t('bookingKindLabel.inscription')
            case 'table': return t('bookingKindLabel.table')
            default: return booking.booking_type
        }
    }

    const getBookingPaymentCategory = (booking: Booking) => {
        if (booking.payment_method === 'mobile_money_direct') return 'mobile_money_direct'
        if (booking.payment_method === 'online') return 'online'
        if (booking.payment_method === 'onsite') return 'onsite'
        if (booking.payment_method === 'cod') {
            if (booking.fulfillment_mode === 'delivery') return 'delivery'
            if (booking.fulfillment_mode === 'takeaway') return 'pickup'
            return 'onsite'
        }
        return 'unknown'
    }

    const getBookingPaymentLabel = (booking: Booking) => {
        switch (getBookingPaymentCategory(booking)) {
            case 'online': return t('paymentLabel.online')
            case 'mobile_money_direct': return t('paymentLabel.mobileMoneyDirect')
            case 'delivery': return t('paymentLabel.delivery')
            case 'pickup': return t('paymentLabel.pickup')
            case 'onsite': return t('paymentLabel.onsite')
            default: return t('paymentLabel.undefined')
        }
    }

    const isFullBookingPayment = (booking: Booking) => {
        const total = Number(booking.price_fcfa || 0)
        const charged = Number(booking.deposit_amount_fcfa || 0)
        return booking.booking_source !== 'restaurant'
            && booking.payment_method === 'online'
            && total > 0
            && charged >= total
    }

    const getBookingDepositLabel = (booking: Booking) => {
        const paymentLabel = isFullBookingPayment(booking) ? t('depositLabel.payment') : t('depositLabel.deposit')
        switch (booking.deposit_status) {
            case 'paid': return t('depositLabel.paid', { label: paymentLabel })
            case 'pending': return t('depositLabel.pending', { label: paymentLabel })
            case 'waived': return isFullBookingPayment(booking) ? t('depositLabel.waivedPayment') : t('depositLabel.waivedDeposit')
            case 'expired': return t('depositLabel.expired', { label: paymentLabel })
            default: return booking.deposit_required
                ? (isFullBookingPayment(booking) ? t('depositLabel.requiredPayment') : t('depositLabel.requiredDeposit'))
                : (isFullBookingPayment(booking) ? t('depositLabel.noOnlinePayment') : t('depositLabel.noDeposit'))
        }
    }

    const getBookingModeLabel = (booking: Booking) => {
        switch (booking.fulfillment_mode) {
            case 'dine_in': return t('modeLabel.onsite')
            case 'booking_only': return t('modeLabel.bookingOnly')
            case 'takeaway': return t('modeLabel.takeaway')
            case 'delivery': return t('modeLabel.delivery')
            default: return null
        }
    }

    const getBookingStatusBadgeLabel = (booking: Booking) => {
        if (booking.status === 'pending') return t('bookingStatusBadge.pending')
        if (booking.status === 'inscription_pending') return t('bookingStatusBadge.inscriptionPending')
        if (booking.status === 'confirmed') return t('bookingStatusBadge.confirmed')
        if (booking.status === 'completed') {
            return booking.booking_source === 'restaurant' ? t('bookingStatusBadge.honored') : t('bookingStatusBadge.finished')
        }
        if (booking.status === 'cancelled') return t('bookingStatusBadge.cancelled')
        return booking.status
    }

    const getOrderPaymentCategory = (order: Order) => {
        if (order.payment_method === 'mobile_money_direct') return 'mobile_money_direct'
        if (order.payment_method === 'online') return 'online'
        if (order.payment_method === 'cod') {
            if (order.fulfillment_mode === 'delivery' || order.status === 'pending_delivery') return 'delivery'
            if (order.fulfillment_mode === 'takeaway' || order.status === 'pending_pickup') return 'pickup'
            return 'onsite'
        }
        return 'unknown'
    }

    const getOrderPaymentLabel = (order: Order) => {
        switch (getOrderPaymentCategory(order)) {
            case 'online': return t('paymentLabel.online')
            case 'mobile_money_direct': return t('paymentLabel.mobileMoneyDirect')
            case 'delivery': return t('paymentLabel.delivery')
            case 'pickup': return t('paymentLabel.pickup')
            case 'onsite': return t('paymentLabel.onsite')
            default: return t('paymentLabel.undefined')
        }
    }

    const getBookingStatusOptions = (booking: Booking) => {
        if (booking.deposit_required && booking.deposit_status === 'pending') {
            return [
                { value: 'cancelled', label: '❌ Annuler' }
            ]
        }

        return getBookingStatusOptionsLegacy(booking)
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
                toast.error(data.error || t('errors.verificationFailed'))
            }
        } catch (err) {
            console.error('Verify error:', err)
            toast.error(t('errors.networkError'))
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
            case 'completed': return '#10b981'
            case 'cancelled': return '#f87171'
            case 'refunded': return '#fb923c'
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
            case 'completed': return <CheckCircle size={16} />
            case 'cancelled': return <XCircle size={16} />
            case 'refunded': return <XCircle size={16} />
            default: return <Clock size={16} />
        }
    }

    const getStatusLabel = (status: string) => {
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
            case 'physical': return t('typeLabel.physical')
            case 'digital': return t('typeLabel.digital')
            case 'service': return t('typeLabel.service')
            case 'mixed': return t('typeLabel.mixed')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const mobileMoneyOrders = useMemo(() => orders.filter(o =>
        o.payment_verification_status &&
        ['awaiting_screenshot', 'awaiting_verification', 'verified', 'rejected', 'expired'].includes(o.payment_verification_status)
    ), [orders])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const regularOrders = useMemo(() => orders.filter(o => !o.payment_verification_status), [orders])

    const pendingVerificationCount = useMemo(() => mobileMoneyOrders.filter(
        o => o.payment_verification_status === 'awaiting_verification'
    ).length, [mobileMoneyOrders])

    const pendingBookingsCount = useMemo(() => bookings.filter(
        b => b.status === 'pending' || b.status === 'inscription_pending'
    ).length, [bookings])

    const displayOrders = activeTab === 'mobile_money' ? mobileMoneyOrders : regularOrders

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const filteredOrders = useMemo(() => displayOrders.filter(order => {
        const orderType = getOrderType(order)
        const orderPaymentCategory = getOrderPaymentCategory(order)
        const normalizedSearch = searchTerm.toLowerCase()

        const matchesSearch = !searchTerm
            || order.order_number.toLowerCase().includes(normalizedSearch)
            || order.customer_phone.includes(searchTerm)
            || (order.customer_name && order.customer_name.toLowerCase().includes(normalizedSearch))
        const matchesStatus = !filterStatus || order.status === filterStatus
        const matchesType = !filterType || orderType === filterType
        const matchesPayment = !filterPayment || orderPaymentCategory === filterPayment

        return matchesSearch && matchesStatus && matchesType && matchesPayment
    }), [displayOrders, searchTerm, filterStatus, filterType, filterPayment])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const filteredBookings = useMemo(() => bookings.filter(booking => {
        const bookingKind = getBookingKind(booking)
        const bookingPaymentCategory = getBookingPaymentCategory(booking)
        const normalizedSearch = searchTerm.toLowerCase()

        const matchesSearch = !searchTerm
            || booking.customer_phone.includes(searchTerm)
            || (booking.customer_name && booking.customer_name.toLowerCase().includes(normalizedSearch))
            || (booking.service_name && booking.service_name.toLowerCase().includes(normalizedSearch))
        const matchesStatus = !filterStatus || booking.status === filterStatus
        const matchesType = !filterType || bookingKind === filterType
        const matchesPayment = !filterPayment || bookingPaymentCategory === filterPayment

        return matchesSearch && matchesStatus && matchesType && matchesPayment
    }), [bookings, searchTerm, filterStatus, filterType, filterPayment])
    const statusOptions = activeTab === 'bookings'
        ? [
            { value: '', label: t('filter.all') },
            { value: 'pending', label: t('bookingStatusBadge.pending').replace(/^[^\s]+\s/, '') },
            { value: 'inscription_pending', label: t('filterStatus.inscriptionPending') },
            { value: 'confirmed', label: t('filterStatus.confirmed') },
            { value: 'completed', label: t('filterStatus.completedHonored') },
            { value: 'cancelled', label: t('filterStatus.cancelledBooking') },
        ]
        : [
            { value: '', label: t('filter.all') },
            { value: 'pending', label: t('filter.pending') },
            { value: 'pending_delivery', label: t('filter.pending_delivery') },
            { value: 'pending_pickup', label: t('filterStatus.pendingPickup') },
            { value: 'paid', label: t('filter.paid') },
            { value: 'delivered', label: t('filter.delivered') },
            { value: 'cancelled', label: t('filter.cancelled') },
        ]
    const countLabel = activeTab === 'bookings'
        ? t('countBookings', { count: filteredBookings.length })
        : t('count', { count: filteredOrders.length })

    const typeOptions = activeTab === 'bookings'
        ? [
            { value: '', label: t('filterType.all') },
            { value: 'restaurant', label: t('bookingKindLabel.restaurant') },
            { value: 'stay', label: t('bookingKindLabel.stay') },
            { value: 'slot', label: t('bookingKindLabel.slot') },
            { value: 'inscription', label: t('bookingKindLabel.inscription') },
            { value: 'table', label: t('bookingKindLabel.table') },
        ]
        : [
            { value: '', label: t('filterType.all') },
            { value: 'physical', label: t('typeLabel.physical') },
            { value: 'digital', label: t('typeLabel.digital') },
            { value: 'service', label: t('typeLabel.service') },
            { value: 'mixed', label: t('typeLabel.mixed') },
            { value: 'unknown', label: t('typeLabel.unknown') },
        ]

    const paymentOptions = activeTab === 'bookings'
        ? [
            { value: '', label: t('filterPayment.all') },
            { value: 'online', label: t('paymentLabel.online') },
            { value: 'mobile_money_direct', label: t('paymentLabel.mobileMoneyDirect') },
            { value: 'onsite', label: t('paymentLabel.onsite') },
            { value: 'pickup', label: t('paymentLabel.pickup') },
            { value: 'delivery', label: t('paymentLabel.delivery') },
        ]
        : activeTab === 'mobile_money'
            ? [
                { value: '', label: t('filterPayment.all') },
                { value: 'mobile_money_direct', label: t('paymentLabel.mobileMoneyDirect') },
            ]
            : [
                { value: '', label: t('filterPayment.all') },
                { value: 'online', label: t('paymentLabel.online') },
                { value: 'onsite', label: t('paymentLabel.onsite') },
                { value: 'pickup', label: t('paymentLabel.pickup') },
                { value: 'delivery', label: t('paymentLabel.delivery') },
            ]

    const formatPrice = formatFromFcfa

    const openScreenshotModal = async (orderId: string) => {
        setScreenshotModal(orderId)
        setScreenshotSignedUrl(null)
        setScreenshotLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderId}/screenshot-url`)
            const json = await res.json()
            if (res.ok && json?.data?.url) {
                setScreenshotSignedUrl(json.data.url)
            }
        } catch {
            // le rendu affiche déjà un état de chargement figé si l'appel échoue
        } finally {
            setScreenshotLoading(false)
        }
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
                    <p style={{ color: '#94a3b8' }}>{countLabel}</p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                    <div style={{ position: 'relative', display: 'none' }}>
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
                            <option value="pending_pickup">{t('filterStatus.pendingPickup')}</option>
                            <option value="paid">{t('filter.paid')}</option>
                            <option value="delivered">{t('filter.delivered')}</option>
                            <option value="cancelled">{t('filter.cancelled')}</option>
                        </select>
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
                            {statusOptions.map((option) => (
                                <option key={`status-${option.value || 'all'}`} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Layers style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b', pointerEvents: 'none' }} />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
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
                            {typeOptions.map((option) => (
                                <option key={`type-${option.value || 'all'}`} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <CheckCircle style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b', pointerEvents: 'none' }} />
                        <select
                            value={filterPayment}
                            onChange={(e) => setFilterPayment(e.target.value)}
                            style={{
                                padding: '12px 12px 12px 44px',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                width: '100%',
                                maxWidth: 190,
                                minWidth: 150,
                                appearance: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {paymentOptions.map((option) => (
                                <option key={`payment-${option.value || 'all'}`} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: 16 }}>
                <button
                    onClick={() => setActiveTab('orders')}
                    style={{
                        padding: '12px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: activeTab === 'orders' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: activeTab === 'orders' ? '#10b981' : '#94a3b8',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    {t('tabs.orders', { count: regularOrders.length })}
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
                    {t('tabs.mobileMoney')}
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
                    {t('tabs.bookings', { count: bookings.length })}
                    {pendingBookingsCount > 0 && (
                        <span style={{
                            background: '#8b5cf6',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: 100,
                            fontSize: 12,
                            fontWeight: 700
                        }}>
                            {pendingBookingsCount}
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
                            {t('mobileMoneyAlert.pendingCount', { count: pendingVerificationCount })}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 14 }}>
                            {t('mobileMoneyAlert.instructions')}
                        </div>
                    </div>
                </div>
            )}

            {/* Orders List - Show only when NOT on bookings tab */}
            {activeTab !== 'bookings' && (filteredOrders.length === 0 ? (
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
                            ? t('empty.mobileMoneyMessage')
                            : t('empty.noOrdersMessage')}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {filteredOrders.map((order, i) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            index={i}
                            t={t}
                            format={format}
                            router={router}
                            getOrderType={getOrderType}
                            getStatusColor={getStatusColor}
                            getStatusIcon={getStatusIcon}
                            getStatusLabel={getStatusLabel}
                            getTypeColor={getTypeColor}
                            getTypeIcon={getTypeIcon}
                            getTypeLabel={getTypeLabel}
                            formatPrice={formatPrice}
                            getOrderPaymentLabel={getOrderPaymentLabel}
                            getNextStatusOptions={getNextStatusOptions}
                            openScreenshotModal={openScreenshotModal}
                            handleVerify={handleVerify}
                            verifyingId={verifyingId}
                            handleStatusChange={handleStatusChange}
                            updatingStatusId={updatingStatusId}
                        />
                    ))}
                </div>
            ))}

            {/* Bookings List - Show only on bookings tab */}
            {activeTab === 'bookings' && (
                filteredBookings.length === 0 ? (
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        padding: 48,
                        textAlign: 'center'
                    }}>
                        <CalendarCheck style={{ width: 48, height: 48, color: '#64748b', margin: '0 auto 16px' }} />
                        <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>{t('empty.noBookingsTitle')}</h3>
                        <p style={{ color: '#64748b', fontSize: 14 }}>
                            {t('empty.noBookingsMessage')}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {filteredBookings.map((booking, i) => (
                            <BookingCard
                                key={booking.id}
                                booking={booking}
                                index={i}
                                t={t}
                                format={format}
                                getBookingKindLabel={getBookingKindLabel}
                                getBookingStatusBadgeLabel={getBookingStatusBadgeLabel}
                                getBookingModeLabel={getBookingModeLabel}
                                getBookingPaymentLabel={getBookingPaymentLabel}
                                getBookingDepositLabel={getBookingDepositLabel}
                                isFullBookingPayment={isFullBookingPayment}
                                formatPrice={formatPrice}
                                updatingStatusId={updatingStatusId}
                                handleBookingDepositStatusChange={handleBookingDepositStatusChange}
                                handleBookingStatusChange={handleBookingStatusChange}
                                getBookingStatusOptions={getBookingStatusOptions}
                            />
                        ))}
                    </div>
                )
            )}

            {/* Screenshot Modal */}
            {screenshotModal && (
                <ScreenshotModal
                    t={t}
                    setScreenshotModal={setScreenshotModal}
                    screenshotSignedUrl={screenshotSignedUrl}
                    setScreenshotSignedUrl={setScreenshotSignedUrl}
                    screenshotLoading={screenshotLoading}
                />
            )}
        </div>
    )
}
