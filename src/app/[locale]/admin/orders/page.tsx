'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ShoppingCart, Search, Filter, Eye, CheckCircle, XCircle, Clock,
    Loader2, RefreshCw, Package, Truck, CreditCard, ArrowLeft, Download, X
} from 'lucide-react'
import Link from 'next/link'

interface Order {
    id: string
    customer_phone: string
    customer_name: string | null
    total_fcfa: number
    status: string
    created_at: string
    delivery_address: string | null
    agent_name?: string
    user_email?: string
    items_count?: number
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [viewOrder, setViewOrder] = useState<any>(null)
    const [viewLoading, setViewLoading] = useState(false)

    const viewOrderDetail = async (orderId: string) => {
        setViewLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}`)
            const data = await res.json()
            if (data.data?.order) setViewOrder(data.data.order)
        } catch { } finally { setViewLoading(false) }
    }

    const exportCSV = () => {
        const header = 'ID,Client,Téléphone,Total,Statut,Date\n'
        const rows = filteredOrders.map(o =>
            `"${o.id}","${o.customer_name || ''}","${o.customer_phone}",${o.total_fcfa},"${o.status}","${new Date(o.created_at).toLocaleDateString('fr-FR')}"`
        ).join('\n')
        const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'commandes.csv'; a.click()
        URL.revokeObjectURL(url)
    }

    useEffect(() => {
        fetchOrders()
    }, [statusFilter])

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const url = statusFilter === 'all'
                ? '/api/admin/orders'
                : `/api/admin/orders?status=${statusFilter}`
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
            await fetch(`/api/admin/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            fetchOrders()
        } catch (err) {
            console.error('Error updating order:', err)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }
            case 'pending': return { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }
            case 'cancelled': return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
            case 'shipped': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            case 'delivered': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
        }
    }

    const filteredOrders = orders.filter(order => {
        if (!searchTerm) return true
        const search = searchTerm.toLowerCase()
        return (
            order.customer_phone?.toLowerCase().includes(search) ||
            order.customer_name?.toLowerCase().includes(search) ||
            order.id.toLowerCase().includes(search)
        )
    })

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        paid: orders.filter(o => o.status === 'paid').length,
        shipped: orders.filter(o => o.status === 'shipped').length
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
                            Gestion des Commandes
                        </h1>
                        <p style={{ color: '#64748b', fontSize: 13 }}>
                            {stats.total} commandes • {stats.pending} en attente
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 10, color: '#94a3b8', cursor: 'pointer', fontSize: 13
                    }}>
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={fetchOrders} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                        background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)',
                        borderRadius: 10, color: '#34d399', cursor: 'pointer', fontSize: 13, fontWeight: 500
                    }}>
                        <RefreshCw size={16} /> Rafraîchir
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                    { label: 'Total', value: stats.total, icon: ShoppingCart, color: '#3b82f6' },
                    { label: 'En attente', value: stats.pending, icon: Clock, color: '#fbbf24' },
                    { label: 'Payées', value: stats.paid, icon: CreditCard, color: '#4ade80' },
                    { label: 'Expédiées', value: stats.shipped, icon: Truck, color: '#60a5fa' }
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
                        placeholder="Rechercher par téléphone, nom ou ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'white', fontSize: 14
                        }}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                        padding: '10px 14px', background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 10,
                        color: 'white', fontSize: 14, cursor: 'pointer'
                    }}
                >
                    <option value="all">Tous les statuts</option>
                    <option value="pending">En attente</option>
                    <option value="paid">Payées</option>
                    <option value="shipped">Expédiées</option>
                    <option value="delivered">Livrées</option>
                    <option value="cancelled">Annulées</option>
                </select>
            </div>

            {/* Orders Table */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 14, overflow: 'hidden'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <Loader2 size={24} style={{ color: '#34d399', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <Package size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <p>Aucune commande trouvée</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                {['ID', 'Client', 'Total', 'Statut', 'Date', 'Actions'].map(h => (
                                    <th key={h} style={{
                                        padding: '14px 16px', textAlign: 'left', fontSize: 11,
                                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                                        color: '#64748b'
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order) => {
                                const statusStyle = getStatusColor(order.status)
                                return (
                                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 12 }}>
                                                #{order.id.substring(0, 8)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>
                                                {order.customer_name || 'Client'}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>
                                                {order.customer_phone}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ color: '#4ade80', fontWeight: 600, fontSize: 14 }}>
                                                {order.total_fcfa?.toLocaleString('fr-FR')} FCFA
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                                borderRadius: 100, background: statusStyle.bg, color: statusStyle.color
                                            }}>
                                                {order.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>
                                            {new Date(order.created_at).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => viewOrderDetail(order.id)} title="Voir détails"
                                                    style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(168, 85, 247, 0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Eye size={14} style={{ color: '#a855f7' }} />
                                                </button>
                                                {order.status === 'pending' && (
                                                    <button onClick={() => updateOrderStatus(order.id, 'cancelled')} title="Annuler"
                                                        style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <XCircle size={14} style={{ color: '#f87171' }} />
                                                    </button>
                                                )}
                                                {order.status === 'paid' && (
                                                    <button onClick={() => updateOrderStatus(order.id, 'shipped')} title="Marquer expédiée"
                                                        style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Truck size={14} style={{ color: '#60a5fa' }} />
                                                    </button>
                                                )}
                                                {order.status === 'shipped' && (
                                                    <button onClick={() => updateOrderStatus(order.id, 'delivered')} title="Marquer livrée"
                                                        style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <CheckCircle size={14} style={{ color: '#34d399' }} />
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

            {/* Order Detail Modal */}
            <AnimatePresence>
                {viewOrder && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setViewOrder(null)}
                            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            style={{
                                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                zIndex: 101, width: 520, maxHeight: '85vh', overflowY: 'auto',
                                background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                            }}>
                            <button onClick={() => setViewOrder(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>Commande #{viewOrder.id?.substring(0, 8)}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                <Row label="Client" value={viewOrder.customer_name || 'N/A'} />
                                <Row label="Téléphone" value={viewOrder.customer_phone} />
                                <Row label="Total" value={`${viewOrder.total_fcfa?.toLocaleString('fr-FR')} FCFA`} />
                                <Row label="Statut" value={viewOrder.status?.toUpperCase()} />
                                <Row label="Adresse" value={viewOrder.delivery_address || 'N/A'} />
                                <Row label="Date" value={new Date(viewOrder.created_at).toLocaleString('fr-FR')} />
                            </div>
                            {viewOrder.items && viewOrder.items.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 10 }}>Articles ({viewOrder.items.length})</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {viewOrder.items.map((item: any, i: number) => (
                                            <div key={i} style={{
                                                padding: 12, borderRadius: 10,
                                                background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.08)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{item.product_name || `Produit #${item.product_id?.substring(0, 8)}`}</div>
                                                    <div style={{ color: '#64748b', fontSize: 11 }}>Qté: {item.quantity}</div>
                                                </div>
                                                <span style={{ color: '#4ade80', fontWeight: 600, fontSize: 13 }}>
                                                    {((item.unit_price || 0) * (item.quantity || 1)).toLocaleString('fr-FR')} F
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{value}</span>
        </div>
    )
}
