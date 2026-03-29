'use client'

import { useState, useEffect } from 'react'
import {
    Calendar, Search, CheckCircle, XCircle, Clock,
    Loader2, RefreshCw, Users, Hotel, Utensils, Scissors, ArrowLeft, BookOpen
} from 'lucide-react'
import Link from 'next/link'

interface Booking {
    id: string
    customer_name: string | null
    customer_phone: string
    booking_type: string
    booking_source?: string | null
    service_name?: string | null
    status: string
    start_time: string | null
    preferred_date?: string | null
    preferred_time?: string | null
    party_size: number
    notes: string | null
    price_fcfa?: number
    fulfillment_mode?: string | null
    payment_method?: string | null
    deposit_required?: boolean
    deposit_amount_fcfa?: number
    deposit_status?: string | null
    items_count?: number
    created_at: string
    agent_name?: string
    vendor_name?: string | null
    vendor_email?: string | null
}

async function fetchAdminBookings(typeFilter: string) {
    const url = typeFilter === 'all'
        ? '/api/admin/bookings'
        : `/api/admin/bookings?type=${typeFilter}`

    const res = await fetch(url)
    const data = await res.json()
    return data.data?.bookings || []
}

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        const loadBookings = async () => {
            setLoading(true)
            try {
                const nextBookings = await fetchAdminBookings(typeFilter)
                setBookings(nextBookings)
            } catch (err) {
                console.error('Error fetching bookings:', err)
            } finally {
                setLoading(false)
            }
        }

        loadBookings()
    }, [typeFilter])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const nextBookings = await fetchAdminBookings(typeFilter)
            setBookings(nextBookings)
        } catch (err) {
            console.error('Error fetching bookings:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateBooking = async (bookingId: string, payload: Record<string, string>) => {
        try {
            await fetch(`/api/admin/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            fetchBookings()
        } catch (err) {
            console.error('Error updating booking:', err)
        }
    }

    const updateBookingStatus = async (bookingId: string, newStatus: string) => {
        await updateBooking(bookingId, { status: newStatus })
    }

    const updateBookingDepositStatus = async (bookingId: string, depositStatus: string) => {
        await updateBooking(bookingId, { deposit_status: depositStatus })
    }

    const getBookingKind = (booking: Booking) => {
        if (booking.booking_source === 'restaurant') return 'restaurant'
        if (booking.booking_type === 'stay') return 'stay'
        if (booking.booking_type === 'slot') return 'slot'
        if (booking.booking_type === 'inscription') return 'inscription'
        if (booking.booking_type === 'table') return 'table'
        return booking.booking_type || 'other'
    }

    const getTypeIcon = (booking: Booking) => {
        switch (getBookingKind(booking)) {
            case 'restaurant': return Utensils
            case 'stay': return Hotel
            case 'slot': return Scissors
            case 'inscription': return BookOpen
            case 'table': return Calendar
            default: return Calendar
        }
    }

    const getTypeLabel = (booking: Booking) => {
        switch (getBookingKind(booking)) {
            case 'restaurant': return 'Restaurant'
            case 'stay': return 'Hebergement'
            case 'slot': return 'Service'
            case 'inscription': return 'Inscription'
            case 'table': return 'Table / Event'
            default: return booking.booking_type
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
            case 'pending': return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }
            case 'inscription_pending': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
            case 'cancelled': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
            case 'completed': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
        }
    }

    const getStatusLabel = (status: string) => {
        if (status === 'inscription_pending') return 'INSCRIPTION'
        return status.toUpperCase()
    }

    const getDepositStatusColor = (depositStatus?: string | null) => {
        switch (depositStatus) {
            case 'paid': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
            case 'pending': return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }
            case 'waived': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            case 'expired': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
        }
    }

    const getDepositStatusLabel = (depositStatus?: string | null) => {
        switch (depositStatus) {
            case 'paid': return 'Acompte paye'
            case 'pending': return 'Acompte en attente'
            case 'waived': return 'Acompte leve'
            case 'expired': return 'Acompte expire'
            case 'not_required': return 'Sans acompte'
            default: return 'Sans acompte'
        }
    }

    const getPaymentLabel = (booking: Booking) => {
        switch (booking.payment_method) {
            case 'online': return 'En ligne'
            case 'onsite': return 'Sur place'
            case 'cod': return 'A la livraison'
            default: return 'Non defini'
        }
    }

    const filteredBookings = bookings.filter(booking => {
        if (!searchTerm) return true
        const search = searchTerm.toLowerCase()
        return (
            booking.customer_phone?.toLowerCase().includes(search) ||
            booking.customer_name?.toLowerCase().includes(search) ||
            booking.service_name?.toLowerCase().includes(search) ||
            booking.agent_name?.toLowerCase().includes(search) ||
            booking.vendor_name?.toLowerCase().includes(search) ||
            booking.id.toLowerCase().includes(search)
        )
    })

    const stats = {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        pending: bookings.filter(b => b.status === 'pending').length,
        today: bookings.filter(b => {
            if (!b.start_time) return false
            const bookingDate = new Date(b.start_time).toDateString()
            const today = new Date().toDateString()
            return bookingDate === today
        }).length
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href="/admin" style={{ color: '#64748b' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                            Gestion des Réservations
                        </h1>
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                            {stats.total} réservations • {stats.today} aujourd'hui
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchBookings}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', background: 'rgba(52, 211, 153, 0.1)',
                        border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: 10,
                        color: '#34d399', cursor: 'pointer', fontSize: 13, fontWeight: 500
                    }}
                >
                    <RefreshCw size={16} />
                    Rafraîchir
                </button>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {[
                    { label: 'Total', value: stats.total, icon: Calendar, color: '#8b5cf6' },
                    { label: 'Confirmées', value: stats.confirmed, icon: CheckCircle, color: '#4ade80' },
                    { label: 'En attente', value: stats.pending, icon: Clock, color: '#fbbf24' },
                    { label: 'Aujourd\'hui', value: stats.today, icon: Users, color: '#60a5fa' }
                ].map((stat, i) => (
                    <div key={i} style={{
                        padding: 16, background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 12
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <stat.icon size={18} style={{ color: stat.color }} />
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>{stat.label}</span>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10
                }}>
                    <Search size={16} style={{ color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Rechercher par téléphone ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'white', fontSize: 14
                        }}
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    style={{
                        padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10,
                        color: 'white', fontSize: 14, cursor: 'pointer'
                    }}
                >
                    <option value="all">Tous les types</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="table">Table / Event</option>
                    <option value="stay">Hebergement</option>
                    <option value="slot">Service</option>
                    <option value="inscription">Inscription</option>
                </select>
            </div>

            {/* Bookings Table */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 14, overflow: 'hidden'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <Loader2 size={24} style={{ color: '#34d399', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : filteredBookings.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <Calendar size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <p>Aucune réservation trouvée</p>
                    </div>
                ) : (
                    <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                {['Type', 'Client', 'Vendeur', 'Date/Heure', 'Personnes', 'Paiement', 'Statut', 'Actions'].map(h => (
                                    <th key={h} style={{
                                        padding: '14px 16px', textAlign: 'left', fontSize: 11,
                                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                                        color: '#64748b'
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBookings.map((booking) => {
                                const statusStyle = getStatusColor(booking.status)
                                const depositStyle = getDepositStatusColor(booking.deposit_status)
                                const TypeIcon = getTypeIcon(booking)
                                return (
                                    <tr key={booking.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 10,
                                                    background: 'rgba(139, 92, 246, 0.15)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    <TypeIcon size={18} style={{ color: '#a78bfa' }} />
                                                </div>
                                                <div>
                                                    <div style={{ color: 'white', fontSize: 13, textTransform: 'capitalize' }}>
                                                        {getTypeLabel(booking)}
                                                    </div>
                                                    {booking.service_name && (
                                                        <div style={{ color: '#64748b', fontSize: 11 }}>
                                                            {booking.service_name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>
                                                {booking.customer_name || 'Client'}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>
                                                {booking.customer_phone}
                                            </div>
                                            {booking.notes && (
                                                <div style={{ color: '#64748b', fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {booking.notes}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            {booking.vendor_name ? (
                                                <>
                                                    <div style={{ color: '#a78bfa', fontWeight: 500, fontSize: 13 }}>{booking.vendor_name}</div>
                                                    <div style={{ color: '#64748b', fontSize: 11 }}>{booking.agent_name || ''}</div>
                                                </>
                                            ) : (
                                                <span style={{ color: '#475569', fontSize: 12 }}>{booking.agent_name || '-'}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            {booking.start_time ? (
                                                <>
                                                    <div style={{ color: 'white', fontSize: 14 }}>
                                                        {new Date(booking.start_time).toLocaleDateString('fr-FR')}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: 12 }}>
                                                        {new Date(booking.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </>
                                            ) : (
                                                <span style={{ color: '#64748b', fontSize: 12 }}>
                                                    {booking.preferred_date
                                                        ? `${booking.preferred_date}${booking.preferred_time ? ` ${booking.preferred_time}` : ''}`
                                                        : 'Sans date fixe'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ color: 'white', fontSize: 14 }}>
                                                {booking.party_size} pers.
                                            </span>
                                            {typeof booking.items_count === 'number' && booking.items_count > 0 && (
                                                <div style={{ color: '#64748b', fontSize: 11 }}>
                                                    {booking.items_count} article{booking.items_count > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>
                                                {getPaymentLabel(booking)}
                                            </div>
                                            {booking.deposit_required ? (
                                                <>
                                                    <div style={{ color: '#94a3b8', fontSize: 11 }}>
                                                        Acompte {Number(booking.deposit_amount_fcfa || 0).toLocaleString('fr-FR')} FCFA
                                                    </div>
                                                    <div style={{ marginTop: 6 }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            borderRadius: 100,
                                                            background: depositStyle.bg,
                                                            color: depositStyle.color
                                                        }}>
                                                            {getDepositStatusLabel(booking.deposit_status)}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ color: '#64748b', fontSize: 11 }}>
                                                    Sans acompte
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                                borderRadius: 100, background: statusStyle.bg, color: statusStyle.color
                                            }}>
                                                {getStatusLabel(booking.status)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {booking.deposit_required && booking.deposit_status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => updateBookingDepositStatus(booking.id, 'paid')}
                                                            title="Marquer acompte paye"
                                                            style={{
                                                                width: 32, height: 32, borderRadius: 8,
                                                                background: 'rgba(34, 197, 94, 0.1)',
                                                                border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}
                                                        >
                                                            <CheckCircle size={16} style={{ color: '#4ade80' }} />
                                                        </button>
                                                        <button
                                                            onClick={() => updateBookingDepositStatus(booking.id, 'waived')}
                                                            title="Lever l acompte"
                                                            style={{
                                                                padding: '0 10px', height: 32, borderRadius: 8,
                                                                background: 'rgba(59, 130, 246, 0.1)',
                                                                border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: '#60a5fa', fontSize: 11, fontWeight: 600
                                                            }}
                                                        >
                                                            Sans acompte
                                                        </button>
                                                        <button
                                                            onClick={() => updateBookingDepositStatus(booking.id, 'expired')}
                                                            title="Marquer acompte expire"
                                                            style={{
                                                                width: 32, height: 32, borderRadius: 8,
                                                                background: 'rgba(251, 191, 36, 0.1)',
                                                                border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}
                                                        >
                                                            <Clock size={16} style={{ color: '#fbbf24' }} />
                                                        </button>
                                                    </>
                                                )}
                                                {booking.status === 'inscription_pending' && (
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                                        title="Confirmer l'inscription (paiement reçu)"
                                                        style={{
                                                            width: 32, height: 32, borderRadius: 8,
                                                            background: 'rgba(34, 197, 94, 0.1)',
                                                            border: 'none', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                    >
                                                        <CheckCircle size={16} style={{ color: '#4ade80' }} />
                                                    </button>
                                                )}
                                                {booking.status === 'confirmed' && (
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, 'completed')}
                                                        title="Marquer terminée"
                                                        style={{
                                                            width: 32, height: 32, borderRadius: 8,
                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                            border: 'none', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                    >
                                                        <CheckCircle size={16} style={{ color: '#60a5fa' }} />
                                                    </button>
                                                )}
                                                {(booking.status === 'confirmed' || booking.status === 'pending' || booking.status === 'inscription_pending') && (
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                                        title="Annuler"
                                                        style={{
                                                            width: 32, height: 32, borderRadius: 8,
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: 'none', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                    >
                                                        <XCircle size={16} style={{ color: '#f87171' }} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    )
}
