'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Mail, Download,
    Phone, Calendar, Edit, Ban, X, Zap, Shield, UserX, CheckCircle,
    ChevronLeft, ChevronRight, CheckSquare, Square, Timer
} from 'lucide-react'
import { TableSkeleton } from '@/components/admin/AdminSkeletons'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')
    const [editUser, setEditUser] = useState<any>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Pagination state
    const [page, setPage] = useState(1)
    const [meta, setMeta] = useState<any>(null)
    const pageSize = 15

    // Sort state
    const [sortField, setSortField] = useState<string>('created')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const toggleSort = (field: string) => {
        setPage(1)
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('asc')
        }
    }

    // Selection state
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isBulkLoading, setIsBulkLoading] = useState(false)
    const [isCompact, setIsCompact] = useState(false)

    useEffect(() => {
        const onResize = () => setIsCompact(window.innerWidth < 640)
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    // Map frontend field names → DB column names
    const fieldToCol: Record<string, string> = {
        name: 'full_name', email: 'email', plan: 'plan',
        credits: 'credits_balance', status: 'is_active', created: 'created_at',
        expiry: 'paid_until'
    }

    // Debounce search — attend 400ms après la dernière frappe avant de requêter
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1) // reset à la page 1 à chaque nouvelle recherche
        }, 400)
        return () => clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => { fetchUsers() }, [page, sortField, sortDir, debouncedSearch])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const col = fieldToCol[sortField] || 'created_at'
            const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
            const res = await fetch(`/api/admin/users?page=${page}&pageSize=${pageSize}&sortBy=${col}&sortDir=${sortDir}${searchParam}`)
            const data = await res.json()
            if (data.data) {
                const mappedUsers = data.data.map((u: any) => ({
                    ...u,
                    name: u.full_name || u.email?.split('@')[0] || 'Utilisateur',
                    phone: u.phone || 'N/A',
                    plan: u.plan ? (u.plan.charAt(0).toUpperCase() + u.plan.slice(1)) : 'Free',
                    status: u.is_active !== false ? 'active' : 'suspended',
                    agents: u.agents_count || 0,
                    messages: u.messages_count || 0,
                    created: u.created_at,
                    credits: u.credits_balance || 0,
                    paid_until: u.paid_until || null,
                    grace_until: u.grace_until || null,
                    cleanup_deadline: u.test_account_cleanup_deadline || null,
                    lifecycle: u.account_lifecycle_status || null
                }))
                setUsers(mappedUsers)
                setMeta(data.meta)
            }
        } catch (err) {
            console.error('Error fetching users:', err)
        } finally {
            setLoading(false)
        }
    }

    const exportEmails = async () => {
        try {
            const res = await fetch('/api/admin/users?export=emails')
            const data = await res.json()
            const emails: { email: string; name: string; plan: string; date: string }[] = data.data?.emails || []
            const csv = ['Email,Nom,Plan,Inscrit le', ...emails.map(e => `${e.email},${e.name},${e.plan},${e.date}`)].join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `utilisateurs_emails_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Error exporting emails:', err)
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

    const handleBulkAction = async (action: string, data?: any) => {
        if (selectedIds.length === 0) return
        if (!confirm(`Confirmer l'action sur ${selectedIds.length} utilisateurs ?`)) return

        setIsBulkLoading(true)
        try {
            const res = await fetch('/api/admin/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ids: selectedIds, data })
            })
            const result = await res.json()
            if (result.success) {
                setSelectedIds([])
                fetchUsers()
            } else {
                alert(result.error || 'Erreur lors de l\'action groupée')
            }
        } catch (err) {
            alert('Erreur réseau')
        } finally {
            setIsBulkLoading(false)
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredUsers.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filteredUsers.map(u => u.id))
        }
    }

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const filteredUsers = users.filter(user => {
        const matchesPlan = selectedPlan === 'all' || user.plan.toLowerCase() === selectedPlan
        const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus
        return matchesPlan && matchesStatus
    }).sort((a, b) => {
        let aVal: any, bVal: any
        switch (sortField) {
            case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break
            case 'email': aVal = a.email.toLowerCase(); bVal = b.email.toLowerCase(); break
            case 'plan': aVal = a.plan.toLowerCase(); bVal = b.plan.toLowerCase(); break
            case 'credits': aVal = a.credits || 0; bVal = b.credits || 0; break
            case 'status': aVal = a.status; bVal = b.status; break
            default: aVal = a.created; bVal = b.created
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
        return 0
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', paddingBottom: selectedIds.length > 0 ? 100 : 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>Utilisateurs</h1>
                    <p style={{ color: '#94a3b8' }}>
                        {meta ? `${meta.total} utilisateurs au total` : `${users.length} utilisateurs chargés`}
                    </p>
                </div>
                <button
                    onClick={exportEmails}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', background: 'rgba(52, 211, 153, 0.1)',
                        border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: 10,
                        color: '#34d399', cursor: 'pointer', fontSize: 13, fontWeight: 500
                    }}
                >
                    <Download size={15} /> Exporter emails CSV
                </button>
            </div>

            {/* Filters */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 16, padding: 16
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: searchQuery ? '#60a5fa' : '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom, email ou téléphone…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 40px 12px 44px', borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: `1px solid ${searchQuery ? 'rgba(96,165,250,0.4)' : 'rgba(148, 163, 184, 0.1)'}`,
                                color: 'white', fontSize: 14, outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
                                    padding: 2, display: 'flex', alignItems: 'center'
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
                {debouncedSearch && meta && (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{meta.total}</span> résultat{meta.total !== 1 ? 's' : ''} pour <span style={{ color: 'white' }}>"{debouncedSearch}"</span>
                    </div>
                )}
            </div>

            {/* Users Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', borderRadius: 16, overflow: 'visible' }}>
                <div className="admin-table-wrap">
                    <table
                        className="admin-table"
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            tableLayout: 'auto'
                        }}
                    >
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <th style={{ padding: '16px 16px', width: 40 }}>
                                    <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                                        {selectedIds.length > 0 && selectedIds.length === filteredUsers.length ? <CheckSquare size={18} color="#34d399" /> : <Square size={18} />}
                                    </button>
                                </th>
                                {([
                                    { label: 'Utilisateur', field: 'name' },
                                    { label: 'Contact', field: 'email' },
                                    { label: 'Plan', field: 'plan' },
                                    { label: 'Crédits', field: 'credits' },
                                    { label: 'Statut', field: 'status' },
                                    { label: 'Échéance', field: 'expiry' },
                                    { label: 'Inscrit le', field: 'created' },
                                    { label: 'Actions', field: null }
                                ] as { label: string; field: string | null }[]).map(({ label, field }) => (
                                    <th key={label}
                                        onClick={field ? () => toggleSort(field) : undefined}
                                        style={{
                                            padding: '16px 16px', paddingRight: label === 'Actions' ? 24 : 16,
                                            textAlign: 'left', color: field && sortField === field ? '#e2e8f0' : '#64748b',
                                            fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
                                            cursor: field ? 'pointer' : 'default', userSelect: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {label}
                                        {field && sortField === field && (
                                            <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: 0 }}><TableSkeleton rows={5} /></td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Aucun utilisateur trouvé</td></tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id} style={{
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                        background: selectedIds.includes(u.id) ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                                    }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <button onClick={() => toggleSelectOne(u.id)} style={{ background: 'none', border: 'none', color: selectedIds.includes(u.id) ? '#3b82f6' : '#64748b', cursor: 'pointer', padding: 0 }}>
                                                {selectedIds.includes(u.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>
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
                                            <StatusBadge status={u.status} lifecycle={u.lifecycle} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <ExpiryCell paidUntil={u.paid_until} graceUntil={u.grace_until} cleanupDeadline={u.cleanup_deadline} lifecycle={u.lifecycle} />
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, color: '#94a3b8', fontSize: 12 }}>
                                                <Calendar style={{ width: 12, height: 12, marginTop: 2, flexShrink: 0 }} />
                                                <div>
                                                    <div>{new Date(u.created).toLocaleDateString('fr-FR')}</div>
                                                    <div style={{ fontSize: 10, color: '#64748b' }}>
                                                        {new Date(u.created).toLocaleTimeString('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} GMT
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px 12px 16px', paddingRight: 24 }}>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <ActionBtn icon={Edit} color="#f59e0b" bg="rgba(245, 158, 11, 0.1)" title="Modifier"
                                                    onClick={() => setEditUser(u)} loading={actionLoading === u.id} />
                                                <ActionBtn icon={Zap} color="#60a5fa" bg="rgba(59, 130, 246, 0.1)" title="Reset"
                                                    onClick={() => { if (confirm(`Reset crédits de ${u.name} ?`)) handleAction(u.id, 'reset_credits') }}
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

            {/* Pagination Controls */}
            {meta && meta.last_page > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12 }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        style={{
                            padding: '8px 12px', borderRadius: 8, background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)', color: page === 1 ? '#475569' : '#e2e8f0',
                            cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        <ChevronLeft size={16} /> Précédent
                    </button>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>
                        Page <span style={{ color: 'white', fontWeight: 600 }}>{page}</span> sur {meta.last_page}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                        disabled={page === meta.last_page || loading}
                        style={{
                            padding: '8px 12px', borderRadius: 8, background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)', color: page === meta.last_page ? '#475569' : '#e2e8f0',
                            cursor: page === meta.last_page ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                        }}
                    >
                        Suivant <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Bulk Actions Floating Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                        style={{
                            position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                            background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 20,
                            padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 20,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1000
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRight: '1px solid rgba(148, 163, 184, 0.2)', paddingRight: 20 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>
                                {selectedIds.length}
                            </div>
                            <span style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>Sélectionnés</span>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => handleBulkAction('bulk_ban')}
                                disabled={isBulkLoading}
                                style={{
                                    padding: '8px 14px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 600,
                                    fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                }}
                            >
                                <Ban size={14} /> Suspendre
                            </button>
                            <button
                                onClick={() => handleBulkAction('bulk_unban')}
                                disabled={isBulkLoading}
                                style={{
                                    padding: '8px 14px', borderRadius: 10, background: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 600,
                                    fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                }}
                            >
                                <CheckCircle size={14} /> Réactiver
                            </button>
                            <button
                                onClick={() => {
                                    const role = prompt('Entrez le rôle (user, admin, support) :')
                                    if (role) handleBulkAction('bulk_change_role', { role })
                                }}
                                disabled={isBulkLoading}
                                style={{
                                    padding: '8px 14px', borderRadius: 10, background: 'rgba(168, 85, 247, 0.1)',
                                    border: '1px solid rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: 600,
                                    fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                }}
                            >
                                <Shield size={14} /> Changer Rôle
                            </button>
                        </div>

                        <button
                            onClick={() => setSelectedIds([])}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: 10 }}
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit User Modal */}
            <AnimatePresence>
                {editUser && (
                    <EditUserModal
                        user={editUser}
                        onClose={() => setEditUser(null)}
                        onSave={(data) => handleAction(editUser.id, 'update', data)}
                        onSetCredits={(credits) => handleAction(editUser.id, 'set_credits', { credits })}
                        onAddCredits={(amount) => handleAction(editUser.id, 'add_credits', { amount })}
                        onSubtractCredits={(amount) => handleAction(editUser.id, 'subtract_credits', { amount })}
                        onChangeRole={(role) => handleAction(editUser.id, 'change_role', { role })}
                    />
                )}
            </AnimatePresence>
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

function ExpiryCell({ paidUntil, graceUntil, cleanupDeadline, lifecycle }: { paidUntil: string | null, graceUntil: string | null, cleanupDeadline: string | null, lifecycle: string | null }) {
    const renderDate = (iso: string, color: string, label: string) => {
        const date = new Date(iso)
        const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        const isExpired = daysLeft <= 0
        const isUrgent = !isExpired && daysLeft <= 7
        const c = isExpired ? '#f87171' : isUrgent ? '#fbbf24' : color
        return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, fontSize: 12 }}>
                <Timer style={{ width: 12, height: 12, marginTop: 2, flexShrink: 0, color: c }} />
                <div>
                    <div style={{ color: c, fontWeight: isUrgent || isExpired ? 700 : 400 }}>
                        {date.toLocaleDateString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                        {label} · {isExpired ? <span style={{ color: '#f87171' }}>Expiré</span> : `J-${daysLeft}`}
                    </div>
                </div>
            </div>
        )
    }

    if (paidUntil) return renderDate(paidUntil, '#4ade80', 'Abonnement')
    if (graceUntil) return renderDate(graceUntil, '#60a5fa', 'Grâce')
    if (cleanupDeadline) return renderDate(cleanupDeadline, '#fbbf24', lifecycle === 'inactive' ? 'Test expiré' : 'Test')
    return <span style={{ fontSize: 11, color: '#475569' }}>—</span>
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

function StatusBadge({ status, lifecycle }: { status: string, lifecycle: string | null }) {
    // lifecycle prime sur is_active pour refléter la réalité abonnement
    if (lifecycle === 'frozen_grace') {
        return <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>En grâce</span>
    }
    if (lifecycle === 'inactive') {
        return <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Inactif</span>
    }
    if (status !== 'active') {
        return <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Suspendu</span>
    }
    if (lifecycle === 'test' || !lifecycle) {
        return <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>Test</span>
    }
    return <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Actif</span>
}

function EditUserModal({ user, onClose, onSave, onSetCredits, onAddCredits, onSubtractCredits, onChangeRole }: {
    user: any,
    onClose: () => void,
    onSave: (data: any) => void,
    onSetCredits: (credits: number) => void,
    onAddCredits: (amount: number) => void,
    onSubtractCredits: (amount: number) => void,
    onChangeRole: (role: string) => void
}) {
    const [name, setName] = useState(user.full_name || user.name || '')
    const [phone, setPhone] = useState(user.phone || '')
    const [plan, setPlan] = useState(user.plan || 'Free')
    const [credits, setCredits] = useState<number>(0)

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
                    position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 101, width: 'min(460px, 92vw)', background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                }}
            >
                <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', zIndex: 1 }}>
                    <X size={18} />
                </button>
                <div style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
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
                            <option value="free">Free</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="business">Business</option>
                            <option value="scale">Scale</option>
                        </select>
                    </div>

                    <button onClick={() => onSave({ full_name: name, phone, plan: plan.toLowerCase() })}
                        style={{
                            width: '100%', padding: 12, borderRadius: 10,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                        }}>
                        Sauvegarder les modifications
                    </button>

                    <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: 14, marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ color: '#94a3b8', fontSize: 12 }}>Crédits</label>
                            <span style={{ fontSize: 11, color: '#64748b' }}>Solde actuel : <strong style={{ color: '#e2e8f0' }}>{(user.credits || 0).toLocaleString('fr-FR')}</strong></span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input
                                type="number" min={0} value={credits || ''}
                                placeholder="Montant"
                                onChange={e => setCredits(Number(e.target.value))}
                                style={{ ...inputStyle, flex: 1 }}
                            />
                            <button onClick={() => { if (credits > 0) onAddCredits(credits) }} title="Ajouter au solde actuel" style={{
                                padding: '10px 12px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)',
                                border: 'none', color: '#34d399', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}>+ Ajouter</button>
                            <button onClick={() => { if (credits > 0) onSubtractCredits(credits) }} title="Retirer du solde actuel" style={{
                                padding: '10px 12px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)',
                                border: 'none', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}>− Retirer</button>
                            <button onClick={() => { if (confirm(`Définir le solde à ${credits} crédits ?`)) onSetCredits(credits) }} title="Remplacer le solde par cette valeur exacte" style={{
                                padding: '10px 12px', borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)',
                                border: 'none', color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                            }}><Zap size={13} style={{ display: 'inline', marginRight: 3 }} />Définir</button>
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
                </div>
            </motion.div>
        </>
    )
}
