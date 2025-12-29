'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Search,
    Plus,
    Mail,
    Phone,
    Calendar,
    Edit,
    Trash2,
    Eye,
    Ban,
    CheckCircle,
    Download,
    Loader2,
    MoreHorizontal
} from 'lucide-react'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')

    useEffect(() => {
        fetchUsers()
    }, [])

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
                <div style={{ display: 'flex', gap: 12 }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '12px 20px',
                            borderRadius: 12,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: 500
                        }}
                    >
                        <Download style={{ width: 16, height: 16 }} />
                        Exporter
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '12px 20px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: 600
                        }}
                    >
                        <Plus style={{ width: 16, height: 16 }} />
                        Ajouter
                    </motion.button>
                </div>
            </div>

            {/* Filters */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.1)',
                borderRadius: 16,
                padding: 16
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <Search style={{
                            position: 'absolute',
                            left: 14,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 18,
                            height: 18,
                            color: '#64748b'
                        }} />
                        <input
                            type="text"
                            placeholder="Rechercher un utilisateur..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 12px 12px 44px',
                                borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                fontSize: 14,
                                outline: 'none'
                            }}
                        />
                    </div>
                    <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        style={{
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: 'white',
                            minWidth: 140
                        }}
                    >
                        <option value="all">Tous les plans</option>
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                    </select>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        style={{
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: 'rgba(15, 23, 42, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            color: 'white',
                            minWidth: 140
                        }}
                    >
                        <option value="all">Tous les statuts</option>
                        <option value="active">Actif</option>
                        <option value="pending">En attente</option>
                        <option value="suspended">Suspendu</option>
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 16,
                    overflow: 'hidden'
                }}
            >
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Utilisateur</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Contact</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Plan</th>
                                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Agents</th>
                                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Messages</th>
                                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Statut</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Inscrit le</th>
                                <th style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontWeight: 500, fontSize: 13, textTransform: 'uppercase' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                        Aucun utilisateur trouvé
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 10,
                                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    fontSize: 14
                                                }}>
                                                    {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500, color: 'white' }}>{user.name}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>ID: {user.id.substring(0, 8)}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e2e8f0' }}>
                                                    <Mail style={{ width: 14, height: 14, color: '#64748b' }} />
                                                    {user.email}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
                                                    <Phone style={{ width: 14, height: 14, color: '#64748b' }} />
                                                    {user.phone}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: user.plan === 'Business' ? 'rgba(168, 85, 247, 0.15)' :
                                                    user.plan === 'Pro' ? 'rgba(16, 185, 129, 0.15)' :
                                                        user.plan === 'Starter' ? 'rgba(245, 158, 11, 0.15)' :
                                                            'rgba(100, 116, 139, 0.15)',
                                                color: user.plan === 'Business' ? '#c084fc' :
                                                    user.plan === 'Pro' ? '#34d399' :
                                                        user.plan === 'Starter' ? '#fbbf24' :
                                                            '#94a3b8'
                                            }}>
                                                {user.plan}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center', color: 'white', fontWeight: 500 }}>
                                            {user.agents}
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center', color: 'white' }}>
                                            {user.messages.toLocaleString()}
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: user.status === 'active' ? 'rgba(34, 197, 94, 0.15)' :
                                                    user.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' :
                                                        'rgba(239, 68, 68, 0.15)',
                                                color: user.status === 'active' ? '#4ade80' :
                                                    user.status === 'pending' ? '#fbbf24' : '#f87171'
                                            }}>
                                                {user.status === 'active' ? 'Actif' :
                                                    user.status === 'pending' ? 'En attente' : 'Suspendu'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13 }}>
                                                <Calendar style={{ width: 14, height: 14 }} />
                                                {new Date(user.created).toLocaleDateString('fr-FR')}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                                                <button style={{
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }} title="Voir">
                                                    <Eye style={{ width: 16, height: 16, color: '#3b82f6' }} />
                                                </button>
                                                <button style={{
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    background: 'rgba(245, 158, 11, 0.1)',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }} title="Modifier">
                                                    <Edit style={{ width: 16, height: 16, color: '#f59e0b' }} />
                                                </button>
                                                {user.status === 'active' ? (
                                                    <button style={{
                                                        padding: 8,
                                                        borderRadius: 8,
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }} title="Suspendre">
                                                        <Ban style={{ width: 16, height: 16, color: '#f87171' }} />
                                                    </button>
                                                ) : (
                                                    <button style={{
                                                        padding: 8,
                                                        borderRadius: 8,
                                                        background: 'rgba(34, 197, 94, 0.1)',
                                                        border: 'none',
                                                        cursor: 'pointer'
                                                    }} title="Activer">
                                                        <CheckCircle style={{ width: 16, height: 16, color: '#4ade80' }} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 14, color: '#64748b' }}>
                    Affichage de {filteredUsers.length} sur {users.length} utilisateurs
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer'
                    }}>
                        Précédent
                    </button>
                    <button style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        background: '#10b981',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}>
                        1
                    </button>
                    <button style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer'
                    }}>
                        Suivant
                    </button>
                </div>
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
