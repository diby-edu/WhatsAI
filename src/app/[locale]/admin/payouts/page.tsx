'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Wallet, Users, DollarSign, ArrowUpRight, Check, Clock, X,
    Loader2, RefreshCw, ChevronDown, FileText, Download
} from 'lucide-react'

interface MerchantBalance {
    user_id: string
    full_name: string
    email: string
    phone: string
    total_collected: number
    total_paid_out: number
    total_commission: number
    balance_due: number
    orders_count: number
}

interface Payout {
    id: string
    user_id: string
    gross_amount: number
    commission_rate: number
    commission_amount: number
    net_amount: number
    period_start: string
    period_end: string
    status: string
    payment_method: string | null
    payment_reference: string | null
    notes: string | null
    merchant_name: string
    merchant_email: string
    processed_by_name: string | null
    created_at: string
    paid_at: string | null
}

export default function PayoutsPage() {
    const [view, setView] = useState<'balances' | 'history'>('balances')
    const [balances, setBalances] = useState<MerchantBalance[]>([])
    const [payouts, setPayouts] = useState<Payout[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showMarkPaidModal, setShowMarkPaidModal] = useState<string | null>(null)
    const [selectedMerchant, setSelectedMerchant] = useState<MerchantBalance | null>(null)
    const [commissionRate, setCommissionRate] = useState(10)

    useEffect(() => {
        fetchData()
    }, [view])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/payouts?view=${view}`)
            const data = await res.json()
            if (view === 'balances') {
                setBalances(data.data?.balances || [])
            } else {
                setPayouts(data.data?.payouts || [])
            }
        } catch (err) {
            console.error('Error fetching payouts:', err)
        } finally {
            setLoading(false)
        }
    }

    const createPayout = async (merchantId: string, grossAmount: number) => {
        try {
            const today = new Date()
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

            const res = await fetch('/api/admin/payouts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: merchantId,
                    gross_amount: grossAmount,
                    commission_rate: commissionRate,
                    period_start: monthStart.toISOString().split('T')[0],
                    period_end: today.toISOString().split('T')[0],
                })
            })
            const data = await res.json()
            if (data.success) {
                setShowCreateModal(false)
                setSelectedMerchant(null)
                fetchData()
            }
        } catch (err) {
            console.error('Create payout error:', err)
        }
    }

    const markAsPaid = async (payoutId: string, reference: string, method: string) => {
        try {
            const res = await fetch(`/api/admin/payouts/${payoutId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'completed',
                    payment_reference: reference,
                    payment_method: method
                })
            })
            const data = await res.json()
            if (data.success) {
                setShowMarkPaidModal(null)
                fetchData()
            }
        } catch (err) {
            console.error('Mark paid error:', err)
        }
    }

    const totalDue = balances.reduce((sum, b) => sum + b.balance_due, 0)
    const totalCollected = balances.reduce((sum, b) => sum + b.total_collected, 0)
    const totalPaid = balances.reduce((sum, b) => sum + b.total_paid_out, 0)

    const exportCSV = () => {
        if (view === 'balances') {
            const header = 'Marchand,Email,Téléphone,Collecté,Reversé,Commission,Solde dû,Commandes\n'
            const rows = balances.map(b =>
                `"${b.full_name}","${b.email}","${b.phone}",${b.total_collected},${b.total_paid_out},${b.total_commission},${b.balance_due},${b.orders_count}`
            ).join('\n')
            downloadCSV(header + rows, 'soldes_marchands.csv')
        } else {
            const header = 'Marchand,Montant brut,Commission,Net,Statut,Méthode,Référence,Date\n'
            const rows = payouts.map(p =>
                `"${p.merchant_name}",${p.gross_amount},${p.commission_amount},${p.net_amount},${p.status},"${p.payment_method || ''}","${p.payment_reference || ''}",${new Date(p.created_at).toLocaleDateString('fr-FR')}`
            ).join('\n')
            downloadCSV(header + rows, 'historique_reversements.csv')
        }
    }

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    const fmt = (n: number) => n.toLocaleString('fr-FR')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Reversements Marchands</h1>
                    <p style={{ color: '#64748b', fontSize: 13 }}>Suivi de l'argent collecté et des reversements</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8', fontSize: 13, cursor: 'pointer'
                    }}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button onClick={fetchData} style={{
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8', cursor: 'pointer'
                    }}>
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* KPI Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <KPIBox icon={DollarSign} label="Total collecté" value={`${fmt(totalCollected)} FCFA`} color="#3b82f6" />
                <KPIBox icon={Check} label="Déjà reversé" value={`${fmt(totalPaid)} FCFA`} color="#10b981" />
                <KPIBox icon={Wallet} label="À reverser" value={`${fmt(totalDue)} FCFA`} color="#ef4444" />
            </div>

            {/* Tab Toggle */}
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, width: 'fit-content' }}>
                {(['balances', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setView(tab)}
                        style={{
                            padding: '8px 20px', borderRadius: 10, border: 'none',
                            background: view === tab ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                            color: view === tab ? '#34d399' : '#64748b',
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'balances' ? 'Soldes marchands' : 'Historique'}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <Loader2 style={{ width: 24, height: 24, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                </div>
            ) : view === 'balances' ? (
                // Balances Table
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 14, overflow: 'hidden'
                }}>
                    {balances.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                            <Wallet style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                            <p>Aucun paiement marchand trouvé</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Marchand', 'Commandes', 'Collecté', 'Reversé', 'Commission', 'Solde dû', 'Actions'].map(h => (
                                        <th key={h} style={{
                                            padding: '12px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {balances.map((b, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 10,
                                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 700, fontSize: 13
                                                }}>
                                                    {(b.full_name || 'M')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>{b.full_name}</div>
                                                    <div style={{ fontSize: 11, color: '#64748b' }}>{b.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 13 }}>{b.orders_count}</td>
                                        <td style={{ padding: '12px 14px', color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{fmt(b.total_collected)}</td>
                                        <td style={{ padding: '12px 14px', color: '#4ade80', fontSize: 13 }}>{fmt(b.total_paid_out)}</td>
                                        <td style={{ padding: '12px 14px', color: '#fbbf24', fontSize: 13 }}>{fmt(b.total_commission)}</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                                                background: b.balance_due > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                                color: b.balance_due > 0 ? '#f87171' : '#4ade80'
                                            }}>
                                                {fmt(b.balance_due)} FCFA
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {b.balance_due > 0 && (
                                                <button
                                                    onClick={() => { setSelectedMerchant(b); setShowCreateModal(true) }}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 8,
                                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                                        border: 'none', color: 'white', fontSize: 12,
                                                        fontWeight: 600, cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: 4
                                                    }}
                                                >
                                                    <ArrowUpRight size={12} /> Reverser
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            ) : (
                // History Table
                <div style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 14, overflow: 'hidden'
                }}>
                    {payouts.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                            <FileText style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.3 }} />
                            <p>Aucun reversement effectué</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Marchand', 'Brut', 'Commission', 'Net', 'Statut', 'Méthode', 'Référence', 'Date', ''].map(h => (
                                        <th key={h} style={{
                                            padding: '12px 14px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                            textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ fontWeight: 500, color: 'white', fontSize: 13 }}>{p.merchant_name}</div>
                                            <div style={{ fontSize: 11, color: '#64748b' }}>{p.merchant_email}</div>
                                        </td>
                                        <td style={{ padding: '12px 14px', color: '#e2e8f0', fontSize: 13 }}>{fmt(p.gross_amount)}</td>
                                        <td style={{ padding: '12px 14px', color: '#fbbf24', fontSize: 13 }}>{fmt(p.commission_amount)} ({p.commission_rate}%)</td>
                                        <td style={{ padding: '12px 14px', color: '#4ade80', fontSize: 13, fontWeight: 600 }}>{fmt(p.net_amount)}</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <StatusBadge status={p.status} />
                                        </td>
                                        <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12 }}>{p.payment_method || '—'}</td>
                                        <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12 }}>{p.payment_reference || '—'}</td>
                                        <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: 12 }}>
                                            {new Date(p.created_at).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {p.status === 'pending' && (
                                                <button
                                                    onClick={() => setShowMarkPaidModal(p.id)}
                                                    style={{
                                                        padding: '5px 10px', borderRadius: 6,
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        border: 'none', color: '#34d399', fontSize: 11,
                                                        fontWeight: 600, cursor: 'pointer'
                                                    }}
                                                >
                                                    Marquer payé
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Create Payout Modal */}
            <AnimatePresence>
                {showCreateModal && selectedMerchant && (
                    <ModalOverlay onClose={() => { setShowCreateModal(false); setSelectedMerchant(null) }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>Créer un reversement</h2>
                        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                            Pour {selectedMerchant.full_name} — Solde dû : {fmt(selectedMerchant.balance_due)} FCFA
                        </p>
                        <CreatePayoutForm
                            merchant={selectedMerchant}
                            commissionRate={commissionRate}
                            onCommissionChange={setCommissionRate}
                            onSubmit={(amount) => createPayout(selectedMerchant.user_id, amount)}
                        />
                    </ModalOverlay>
                )}
            </AnimatePresence>

            {/* Mark Paid Modal */}
            <AnimatePresence>
                {showMarkPaidModal && (
                    <ModalOverlay onClose={() => setShowMarkPaidModal(null)}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 20 }}>Confirmer le paiement</h2>
                        <MarkPaidForm
                            onSubmit={(reference, method) => markAsPaid(showMarkPaidModal, reference, method)}
                        />
                    </ModalOverlay>
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

// ── Sub Components ──

function KPIBox({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
    return (
        <div style={{
            padding: 16, background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 12
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 8, background: `${color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Icon size={14} style={{ color }} />
                </div>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{value}</div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
        processing: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
        completed: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
        cancelled: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' }
    }
    const c = colors[status] || colors.pending
    const labels: Record<string, string> = {
        pending: 'En attente', processing: 'En cours', completed: 'Payé', cancelled: 'Annulé'
    }
    return (
        <span style={{
            padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
            background: c.bg, color: c.text
        }}>
            {labels[status] || status}
        </span>
    )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
                }}
            />
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                style={{
                    position: 'fixed', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 101, width: 440,
                    background: '#1e293b',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 16, padding: 24,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}
            >
                <button onClick={onClose} style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'none', border: 'none', color: '#64748b', cursor: 'pointer'
                }}>
                    <X size={18} />
                </button>
                {children}
            </motion.div>
        </>
    )
}

function CreatePayoutForm({ merchant, commissionRate, onCommissionChange, onSubmit }: {
    merchant: MerchantBalance
    commissionRate: number
    onCommissionChange: (rate: number) => void
    onSubmit: (amount: number) => void
}) {
    const [amount, setAmount] = useState(merchant.balance_due)
    const commission = Math.round(amount * (commissionRate / 100))
    const net = amount - commission

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Montant brut (FCFA)</label>
                <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    max={merchant.balance_due}
                    style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.15)',
                        color: 'white', fontSize: 14, outline: 'none'
                    }}
                />
            </div>
            <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Commission (%)</label>
                <input
                    type="number"
                    value={commissionRate}
                    onChange={e => onCommissionChange(Number(e.target.value))}
                    min={0} max={100}
                    style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.15)',
                        color: 'white', fontSize: 14, outline: 'none'
                    }}
                />
            </div>
            <div style={{
                padding: 14, borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.15)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Brut</span>
                    <span style={{ color: 'white', fontWeight: 600 }}>{amount.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>Commission ({commissionRate}%)</span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>-{commission.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#34d399', fontSize: 14, fontWeight: 700 }}>Net à reverser</span>
                    <span style={{ color: '#34d399', fontSize: 14, fontWeight: 700 }}>{net.toLocaleString('fr-FR')} FCFA</span>
                </div>
            </div>
            <button
                onClick={() => onSubmit(amount)}
                disabled={amount <= 0 || amount > merchant.balance_due}
                style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: amount > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : '#374151',
                    border: 'none', color: 'white', fontSize: 14, fontWeight: 600,
                    cursor: amount > 0 ? 'pointer' : 'not-allowed'
                }}
            >
                Créer le reversement
            </button>
        </div>
    )
}

function MarkPaidForm({ onSubmit }: { onSubmit: (reference: string, method: string) => void }) {
    const [reference, setReference] = useState('')
    const [method, setMethod] = useState('Mobile Money')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Méthode de paiement</label>
                <select
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.15)',
                        color: 'white', fontSize: 14, outline: 'none'
                    }}
                >
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Autre">Autre</option>
                </select>
            </div>
            <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Référence du transfert</label>
                <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="N° de transaction, reçu, etc."
                    style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.15)',
                        color: 'white', fontSize: 14, outline: 'none'
                    }}
                />
            </div>
            <button
                onClick={() => onSubmit(reference, method)}
                disabled={!reference.trim()}
                style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: reference.trim() ? 'linear-gradient(135deg, #10b981, #059669)' : '#374151',
                    border: 'none', color: 'white', fontSize: 14, fontWeight: 600,
                    cursor: reference.trim() ? 'pointer' : 'not-allowed'
                }}
            >
                <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
                Confirmer le paiement
            </button>
        </div>
    )
}
