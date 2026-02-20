'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CreditCard, Users, TrendingUp, FileText, Loader2, RefreshCw,
    DollarSign, Edit, XCircle, Zap, X, Download
} from 'lucide-react'

interface Subscription {
    id: string
    user: string
    email: string
    plan: string
    credits: number
    status: string
    startDate: string
}

interface Stats {
    activeSubscriptions: number
    monthlyRevenue: number
    totalRevenue: number
    newThisMonth: number
    totalUsers: number
}

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [stats, setStats] = useState<Stats>({ activeSubscriptions: 0, monthlyRevenue: 0, totalRevenue: 0, newThisMonth: 0, totalUsers: 0 })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [editSub, setEditSub] = useState<Subscription | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/subscriptions')
            if (res.ok) {
                const data = await res.json()
                setSubscriptions(data.data?.subscriptions || [])
                setStats(data.data?.stats || stats)
            }
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false); setRefreshing(false)
        }
    }

    const handleAction = async (userId: string, action: string, extraData?: any) => {
        setActionLoading(userId)
        try {
            const res = await fetch(`/api/admin/subscriptions/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extraData })
            })
            const data = await res.json()
            if (data.success) {
                await fetchData()
                setEditSub(null)
            } else {
                alert(data.error || 'Erreur')
            }
        } catch {
            alert('Erreur réseau')
        } finally {
            setActionLoading(null)
        }
    }

    const exportCSV = () => {
        const header = 'Utilisateur,Email,Plan,Crédits,Statut,Date\n'
        const rows = subscriptions.map(s => `"${s.user}","${s.email}","${s.plan}",${s.credits},"${s.status}","${s.startDate}"`).join('\n')
        const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'abonnements.csv'; a.click()
        URL.revokeObjectURL(url)
    }

    const fmt = (n: number) => n.toLocaleString('fr-FR')

    const statCards = [
        { label: 'Total inscrits', value: stats.totalUsers.toString(), icon: Users, color: '#3b82f6' },
        { label: 'Abonnés payants', value: stats.activeSubscriptions.toString(), icon: CreditCard, color: '#10b981' },
        { label: 'Revenus ce mois', value: `${fmt(stats.monthlyRevenue)} F`, icon: TrendingUp, color: '#a855f7' },
        { label: 'Revenus totaux', value: `${fmt(stats.totalRevenue)} F`, icon: DollarSign, color: '#f59e0b' },
        { label: 'Nouveaux ce mois', value: stats.newThisMonth.toString(), icon: CreditCard, color: '#ef4444' },
    ]

    const getPlanColors = (plan: string) => {
        switch (plan.toLowerCase()) {
            case 'business': return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }
            case 'pro': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }
            case 'starter': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }
            default: return { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Abonnements</h1>
                    <p style={{ color: '#94a3b8' }}>Gestion des abonnements utilisateurs</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={exportCSV} style={{
                        padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.1)',
                        background: 'rgba(30, 41, 59, 0.5)', color: '#94a3b8', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13
                    }}>
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={() => { setRefreshing(true); fetchData() }} disabled={refreshing}
                        style={{
                            padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.1)',
                            background: 'rgba(30, 41, 59, 0.5)', color: '#94a3b8', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                        <RefreshCw style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {statCards.map((stat, i) => (
                    <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 12
                        }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12, background: `${stat.color}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <stat.icon style={{ width: 20, height: 20, color: stat.color }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{stat.label}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Table */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 16, overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Utilisateur', 'Email', 'Plan', 'Crédits', 'Statut', 'Inscrit le', 'Actions'].map(h => (
                                <th key={h} style={{
                                    padding: '14px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600,
                                    textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptions.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                                    <FileText style={{ width: 32, height: 32, color: '#64748b', margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                                    <h3 style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>Aucun abonnement payant</h3>
                                    <p style={{ color: '#64748b', fontSize: 13 }}>Les abonnements apparaîtront ici après les paiements.</p>
                                </td>
                            </tr>
                        ) : (
                            subscriptions.map((sub) => {
                                const pc = getPlanColors(sub.plan)
                                return (
                                    <tr key={sub.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500, fontSize: 13 }}>{sub.user}</td>
                                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{sub.email}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color, textTransform: 'capitalize' }}>
                                                {sub.plan}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 600, fontSize: 13 }}>
                                            {sub.credits.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
                                                Actif
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{sub.startDate}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => setEditSub(sub)} title="Modifier plan"
                                                    style={{ padding: 7, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', border: 'none', cursor: 'pointer' }}>
                                                    <Edit style={{ width: 14, height: 14, color: '#60a5fa' }} />
                                                </button>
                                                <button onClick={() => { if (confirm(`Annuler l'abonnement de ${sub.user} ?`)) handleAction(sub.id, 'cancel') }}
                                                    title="Annuler abonnement" disabled={actionLoading === sub.id}
                                                    style={{ padding: 7, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', opacity: actionLoading === sub.id ? 0.5 : 1 }}>
                                                    <XCircle style={{ width: 14, height: 14, color: '#f87171' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Subscription Modal */}
            <AnimatePresence>
                {editSub && (
                    <EditSubModal
                        sub={editSub}
                        onClose={() => setEditSub(null)}
                        onChangePlan={(plan) => handleAction(editSub.id, 'change_plan', { plan })}
                        onSetCredits={(credits) => handleAction(editSub.id, 'set_credits', { credits })}
                    />
                )}
            </AnimatePresence>

            <style jsx global>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function EditSubModal({ sub, onClose, onChangePlan, onSetCredits }: {
    sub: Subscription; onClose: () => void
    onChangePlan: (plan: string) => void; onSetCredits: (credits: number) => void
}) {
    const [plan, setPlan] = useState(sub.plan)
    const [credits, setCredits] = useState(sub.credits)

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: 10,
        background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.15)',
        color: 'white', fontSize: 14, outline: 'none'
    }

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
                style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    zIndex: 101, width: 420, background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>Modifier l'abonnement</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{sub.user} — {sub.email}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Changer le plan</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                                <option value="free">Free</option>
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="business">Business</option>
                            </select>
                            <button onClick={() => onChangePlan(plan)} style={{
                                padding: '10px 16px', borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}>
                                Appliquer
                            </button>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 14 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Définir les crédits</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={() => onSetCredits(credits)} style={{
                                padding: '10px 16px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)',
                                border: 'none', color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                            }}>
                                <Zap size={14} /> Définir
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    )
}
