import type { ReactNode } from 'react'
import type { useTranslations, useFormatter } from 'next-intl'
import type { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, Loader2, Image as ImageIcon, Check, X } from 'lucide-react'
import type { Order } from '../types'

interface OrderCardProps {
    order: Order
    index: number
    t: ReturnType<typeof useTranslations>
    format: ReturnType<typeof useFormatter>
    router: ReturnType<typeof useRouter>
    getOrderType: (order: Order) => 'physical' | 'digital' | 'service' | 'mixed' | 'unknown'
    getStatusColor: (status: string) => string
    getStatusIcon: (status: string) => ReactNode
    getStatusLabel: (status: string) => string
    getTypeColor: (type: string) => string
    getTypeIcon: (type: string) => ReactNode
    getTypeLabel: (type: string) => string
    formatPrice: (amountFcfa: number) => string
    getOrderPaymentLabel: (order: Order) => string
    getNextStatusOptions: (order: Order) => { value: string, label: string }[]
    openScreenshotModal: (orderId: string) => void
    handleVerify: (orderId: string, action: 'verify' | 'reject') => void
    verifyingId: string | null
    handleStatusChange: (orderId: string, newStatus: string) => void
    updatingStatusId: string | null
}

export function OrderCard({
    order,
    index,
    t,
    format,
    router,
    getOrderType,
    getStatusColor,
    getStatusIcon,
    getStatusLabel,
    getTypeColor,
    getTypeIcon,
    getTypeLabel,
    formatPrice,
    getOrderPaymentLabel,
    getNextStatusOptions,
    openScreenshotModal,
    handleVerify,
    verifyingId,
    handleStatusChange,
    updatingStatusId,
}: OrderCardProps) {
    const nextStatusOptions = getNextStatusOptions(order)
    return (
        <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
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
                                {order.fulfillment_mode === 'takeaway' ? t('fulfillmentBadge.takeaway') : t('fulfillmentBadge.delivery')}
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
                                {order.payment_verification_status === 'awaiting_screenshot' && t('verifyBadge.awaitingScreenshot')}
                                {order.payment_verification_status === 'awaiting_verification' && t('verifyBadge.awaitingVerification')}
                                {order.payment_verification_status === 'verified' && t('verifyBadge.verified')}
                                {order.payment_verification_status === 'rejected' && t('verifyBadge.rejected')}
                                {order.payment_verification_status === 'expired' && t('verifyBadge.expired')}
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
                        {t('card.itemsCountLabel', { count: order.items_count })}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                        {t('card.paymentPrefix', { label: getOrderPaymentLabel(order) })}
                    </div>
                    {order.deposit_required && (
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                            {t('card.depositPrefix', { amount: formatPrice(order.deposit_amount_fcfa || 0) })}
                            {order.deposit_status ? ` • ${order.deposit_status}` : ''}
                        </div>
                    )}
                </div>

                {/* Verification Buttons (Mobile Money) */}
                {order.payment_verification_status === 'awaiting_verification' && order.payment_screenshot_url && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => openScreenshotModal(order.id)}
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
                            <ImageIcon size={16} /> {t('card.viewButton')}
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
                            <Check size={16} /> {t('card.confirmButton')}
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
                            <X size={16} /> {t('card.rejectButton')}
                        </button>
                    </div>
                )}

                {/* Inline Status Buttons */}
                {nextStatusOptions.length > 0 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                        {nextStatusOptions.map(opt => (
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
    )
}
