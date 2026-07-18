import type { useTranslations, useFormatter } from 'next-intl'
import { motion } from 'framer-motion'
import { CalendarCheck, Users, MapPin } from 'lucide-react'
import type { Booking } from '../types'

interface BookingCardProps {
    booking: Booking
    index: number
    t: ReturnType<typeof useTranslations>
    format: ReturnType<typeof useFormatter>
    getBookingKindLabel: (booking: Booking) => string
    getBookingStatusBadgeLabel: (booking: Booking) => string
    getBookingModeLabel: (booking: Booking) => string | null
    getBookingPaymentLabel: (booking: Booking) => string
    getBookingDepositLabel: (booking: Booking) => string
    isFullBookingPayment: (booking: Booking) => boolean
    formatPrice: (amountFcfa: number) => string
    updatingStatusId: string | null
    handleBookingDepositStatusChange: (bookingId: string, depositStatus: string) => void
    handleBookingStatusChange: (bookingId: string, newStatus: string) => void
    getBookingStatusOptions: (booking: Booking) => { value: string, label: string }[]
}

export function BookingCard({
    booking,
    index,
    t,
    format,
    getBookingKindLabel,
    getBookingStatusBadgeLabel,
    getBookingModeLabel,
    getBookingPaymentLabel,
    getBookingDepositLabel,
    isFullBookingPayment,
    formatPrice,
    updatingStatusId,
    handleBookingDepositStatusChange,
    handleBookingStatusChange,
    getBookingStatusOptions,
}: BookingCardProps) {
    return (
        <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
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
                            {getBookingStatusBadgeLabel(booking)}
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
                            : <span style={{ color: '#a78bfa' }}>{t('bookingStatusBadge.inscriptionPending')}</span>
                        }
                    </p>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span>{t('card.paymentPrefix', { label: getBookingPaymentLabel(booking) })}</span>
                        {booking.deposit_required ? (
                            <span>
                                {getBookingDepositLabel(booking)}
                                {booking.deposit_amount_fcfa ? ` • ${formatPrice(booking.deposit_amount_fcfa)}` : ''}
                            </span>
                        ) : (
                            <span>{isFullBookingPayment(booking) ? t('depositLabel.noOnlinePayment') : t('depositLabel.noDeposit')}</span>
                        )}
                        {typeof booking.items_count === 'number' && booking.items_count > 0 && (
                            <span>{t('card.itemsPrecommande', { count: booking.items_count, plural: booking.items_count > 1 ? 's' : '' })}</span>
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
                                title={booking.transaction_id ? t('card.openLinkTitle', { transactionId: booking.transaction_id }) : t('card.openPaymentLinkTitle')}
                            >
                                {t('card.openLink')}
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
                            title={isFullBookingPayment(booking) ? t('card.markPaidPaymentTitle') : t('card.markPaidDepositTitle')}
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
                            title={isFullBookingPayment(booking) ? t('card.waivePaymentTitle') : t('card.waiveDepositTitle')}
                        >
                            {isFullBookingPayment(booking) ? t('card.waivedPaymentShort') : t('depositLabel.noDeposit')}
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
                            title={isFullBookingPayment(booking) ? t('card.markExpiredPaymentTitle') : t('card.markExpiredDepositTitle')}
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
    )
}
