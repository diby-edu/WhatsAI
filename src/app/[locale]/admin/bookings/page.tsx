'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Calendar, Search, Filter, CheckCircle, XCircle, Clock,
    Loader2, RefreshCw, Users, Hotel, Utensils, Scissors, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

interface Booking {
    id: string
    customer_phone: string
    booking_type: string
    status: string
    start_time: string
    party_size: number
    notes: string | null
    created_at: string
    agent_name?: string
}

export default function AdminBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchBookings()
    }, [typeFilter])

    const fetchBookings = async () => {
        setLoading(true)
        try {
            const url = typeFilter === 'all'
                ? '/api/admin/bookings'
                : `/api/admin/bookings?type=${typeFilter}`
            const res = await fetch(url)
            const data = await res.json()
            if (data.data?.bookings) {
                setBookings(data.data.bookings)
            }
        } catch (err) {
            console.error('Error fetching bookings:', err)
        } finally {
            setLoading(false)
        }
    }

    const updateBookingStatus = async (bookingId: string, newStatus: string) => {
        try {
            await fetch(`/api/admin/bookings/${bookingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            fetchBookings()
        } catch (err) {
            console.error('Error updating booking:', err)
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'restaurant': return Utensils
            case 'hotel': return Hotel
            case 'service': return Scissors
            default: return Calendar
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
            case 'pending': return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }
            case 'cancelled': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
            case 'completed': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
        }
    }

    const filteredBookings = bookings.filter(booking => {
        if (!searchTerm) return true
        const search = searchTerm.toLowerCase()
        return (
            booking.customer_phone?.toLowerCase().includes(search) ||
            booking.id.toLowerCase().includes(search)
        )
    })

    const stats = {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        pending: bookings.filter(b => b.status === 'pending').length,
        today: bookings.filter(b => {
            const bookingDate = new Date(b.start_time).toDateString()
            const today = new Date().toDateString()
            return bookingDate === today
        }).length
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
            <div style={{ display: 'flex', gap: 12 }}>
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
                    <option value="hotel">Hôtel</option>
                    <option value="service">Service</option>
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
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                {['Type', 'Client', 'Date/Heure', 'Personnes', 'Statut', 'Actions'].map(h => (
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
                                const TypeIcon = getTypeIcon(booking.booking_type)
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
                                                <span style={{ color: 'white', fontSize: 13, textTransform: 'capitalize' }}>
                                                    {booking.booking_type}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>
                                                {booking.customer_phone}
                                            </div>
                                            {booking.notes && (
                                                <div style={{ color: '#64748b', fontSize: 12, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {booking.notes}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ color: 'white', fontSize: 14 }}>
                                                {new Date(booking.start_time).toLocaleDateString('fr-FR')}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>
                                                {new Date(booking.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ color: 'white', fontSize: 14 }}>
                                                {booking.party_size} pers.
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                                borderRadius: 100, background: statusStyle.bg, color: statusStyle.color
                                            }}>
                                                {booking.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', gap: 8 }}>
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
                                                {(booking.status === 'confirmed' || booking.status === 'pending') && (
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
                )}
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
