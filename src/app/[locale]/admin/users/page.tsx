'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Mail, Phone, Calendar, Edit, Ban, CheckCircle,
    Download, Loader2, X, Zap, Shield, UserX
} from 'lucide-react'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')
    const [editUser, setEditUser] = useState<any>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => { fetchUsers() }, [])

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users')
            const data = await res.json()
            if (data.data?.users) {
                const mappedUsers = data.data.users.map((u: any) => ({
                    ...u,
                    name: u.full_name || u.email?.split('@')[0] || 'Utilisateur',
                    phone: u.phone || 'N/A',
                    plan: u.subscription_plan || 'Free',
                    status: u.is_active !== false ? 'active' : 'suspended',
                    agents: u.agents_count || 0,
                    messages: u.messages_count || 0,
                    created: u.created_at
                }))
                setUsers(mappedUsers)
            }
        } catch (err) {
            console.error('Error fetching users:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (userId: string, action: string, extraData?: any) => {
        setActionLoading(userId)
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extraData })
            })
            const data = await res.json()
            if (data.success) {
                await fetchUsers()
                setEditUser(null)
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
        const header = 'Nom,Email,Téléphone,Plan,Statut,Crédits,Date inscription\n'
        const rows = filteredUsers.map(u =>
            `"${u.name}","${u.email}","${u.phone}","${u.plan}","${u.status}",${u.credits || 0},${new Date(u.created).toLocaleDateString('fr-FR')}`
        ).join('\n')
        const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'utilisateurs.csv'; a.click()
        URL.revokeObjectURL(url)
    }

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesPlan = selectedPlan === 'all' || user.plan.toLowerCase() === selectedPlan
        const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus
        return matchesSearch && matchesPlan && matchesStatus
    })

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Utilisateurs</h1>
                    <p style={{ color: '#94a3b8' }}>{users.length} utilisateurs enregistrés</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={exportCSV}
                    style={{
                        padding: '12px 20px', borderRadius: 12,
                        background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                        color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500
                    }}
                >
                    <Download style={{ width: 16, height: 16 }} /> Exporter CSV
                </motion.button>
            </div>

            {/* Filters */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 16, padding: 16
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#64748b' }} />
                        <input
                            type="text" placeholder="Rechercher un utilisateur..."
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 12px 12px 44px', borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white', fontSize: 14, outline: 'none'
                            }}
                        />
                    </div>
                    <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}
                        style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', minWidth: 140 }}>
                        <option value="all">Tous les plans</option>
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                    </select>
                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                        style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', color: 'white', minWidth: 140 }}>
                        <option value="all">Tous les statuts</option>
                        <option value="active">Actif</option>
                        <option value="suspended">Suspendu</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                {['Utilisateur', 'Contact', 'Plan', 'Crédits', 'Statut', 'Inscrit le', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '16px 16px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Aucun utilisateur trouvé</td></tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 10,
                                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 600, fontSize: 13
                                                }}>
                                                    {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'white', fontSize: 13 }}>{u.name}</div>
                                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                                        {u.role === 'admin' && <span style={{ color: '#f59e0b', marginRight: 4 }}>★</span>}
                                                        ID: {u.id.substring(0, 8)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#e2e8f0' }}>
                                                    <Mail style={{ width: 12, height: 12, color: '#64748b' }} /> {u.email}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                                    <Phone style={{ width: 12, height: 12, color: '#64748b' }} /> {u.phone}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <PlanBadge plan={u.plan} />
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                                            {(u.credits || 0).toLocaleString('fr-FR')}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <StatusBadge status={u.status} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 12 }}>
                                                <Calendar style={{ width: 12, height: 12 }} />
                                                {new Date(u.created).toLocaleDateString('fr-FR')}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <ActionBtn icon={Edit} color="#f59e0b" bg="rgba(245, 158, 11, 0.1)" title="Modifier"
                                                    onClick={() => setEditUser(u)} loading={actionLoading === u.id} />
                                                {u.status === 'active' ? (
                                                    <ActionBtn icon={Ban} color="#f87171" bg="rgba(239, 68, 68, 0.1)" title="Suspendre"
                                                        onClick={() => { if (confirm(`Suspendre ${u.name} ?`)) handleAction(u.id, 'ban') }}
                                                        loading={actionLoading === u.id} />
                                                ) : (
                                                    <ActionBtn icon={CheckCircle} color="#4ade80" bg="rgba(34, 197, 94, 0.1)" title="Réactiver"
                                                        onClick={() => handleAction(u.id, 'unban')}
                                                        loading={actionLoading === u.id} />
                                                )}
                                                <ActionBtn icon={Zap} color="#60a5fa" bg="rgba(59, 130, 246, 0.1)" title="Reset crédits"
                                                    onClick={() => { if (confirm(`Réinitialiser les crédits de ${u.name} ?`)) handleAction(u.id, 'reset_credits') }}
                                                    loading={actionLoading === u.id} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            <p style={{ fontSize: 13, color: '#64748b' }}>Affichage de {filteredUsers.length} sur {users.length} utilisateurs</p>

            {/* Edit User Modal */}
            <AnimatePresence>
                {editUser && (
                    <EditUserModal
                        user={editUser}
                        onClose={() => setEditUser(null)}
                        onSave={(data) => handleAction(editUser.id, 'update', data)}
                        onSetCredits={(credits) => handleAction(editUser.id, 'set_credits', { credits })}
                        onChangeRole={(role) => handleAction(editUser.id, 'change_role', { role })}
                    />
                )}
            </AnimatePresence>

            <style jsx global>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function ActionBtn({ icon: Icon, color, bg, title, onClick, loading }: any) {
    return (
        <button onClick={onClick} disabled={loading} title={title}
            style={{ padding: 7, borderRadius: 8, background: bg, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.5 : 1 }}>
            <Icon style={{ width: 15, height: 15, color }} />
        </button>
    )
}

function PlanBadge({ plan }: { plan: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        Business: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
        Pro: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
        Starter: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
    }
    const c = colors[plan] || { bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8' }
    return <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text }}>{plan}</span>
}

function StatusBadge({ status }: { status: string }) {
    const active = status === 'active'
    return (
        <span style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            background: active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: active ? '#4ade80' : '#f87171'
        }}>
            {active ? 'Actif' : 'Suspendu'}
        </span>
    )
}

function EditUserModal({ user, onClose, onSave, onSetCredits, onChangeRole }: any) {
    const [name, setName] = useState(user.full_name || user.name || '')
    const [phone, setPhone] = useState(user.phone || '')
    const [plan, setPlan] = useState(user.subscription_plan || user.plan || 'Free')
    const [credits, setCredits] = useState(user.credits || 0)

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
                    zIndex: 101, width: 460, background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto'
                }}
            >
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4 }}>Modifier l'utilisateur</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{user.email}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Nom complet</label>
                        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Téléphone</label>
                        <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Plan d'abonnement</label>
                        <select value={plan} onChange={e => setPlan(e.target.value)} style={inputStyle}>
                            <option value="Free">Free</option>
                            <option value="Starter">Starter</option>
                            <option value="Pro">Pro</option>
                            <option value="Business">Business</option>
                        </select>
                    </div>

                    <button onClick={() => onSave({ full_name: name, phone, subscription_plan: plan })}
                        style={{
                            width: '100%', padding: 12, borderRadius: 10,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                        }}>
                        Sauvegarder les modifications
                    </button>

                    <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 14, marginTop: 4 }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Crédits</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }} />
                            <button onClick={() => onSetCredits(credits)} style={{
                                padding: '10px 16px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)',
                                border: 'none', color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}>
                                <Zap size={14} style={{ display: 'inline', marginRight: 4 }} /> Définir
                            </button>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 14, display: 'flex', gap: 8 }}>
                        <button onClick={() => { if (confirm('Donner les droits admin ?')) onChangeRole('admin') }}
                            style={{
                                flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)',
                                border: 'none', color: '#fbbf24', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                            }}>
                            <Shield size={14} /> Promouvoir Admin
                        </button>
                        <button onClick={() => { if (confirm('Retirer les droits admin ?')) onChangeRole('user') }}
                            style={{
                                flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(100, 116, 139, 0.1)',
                                border: 'none', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                            }}>
                            <UserX size={14} /> Rétrograder User
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    )
}
