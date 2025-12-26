'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Search,
    Filter,
    Plus,
    MoreVertical,
    Mail,
    Phone,
    Calendar,
    Edit,
    Trash2,
    Eye,
    Ban,
    CheckCircle,
    Download
} from 'lucide-react'

// Mock data removed

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
                // Map DB fields to UI fields if necessary
                const mappedUsers = data.data.users.map((u: any) => ({
                    ...u,
                    name: u.full_name || u.email?.split('@')[0] || 'Utilisateur',
                    phone: u.phone || 'N/A',
                    plan: 'Free', // Default for now
                    status: 'active', // Default for now
                    agents: 0, // Pending real count
                    messages: 0, // Pending real count
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Utilisateurs</h1>
                    <p className="text-dark-400">{users.length} utilisateurs enregistrés</p>
                </div>
                <div className="flex items-center gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn btn-secondary"
                    >
                        <Download className="w-4 h-4" />
                        Exporter
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn btn-primary"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter
                    </motion.button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card rounded-2xl p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                        <input
                            type="text"
                            placeholder="Rechercher un utilisateur..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-12 w-full"
                        />
                    </div>
                    <select
                        value={selectedPlan}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="input w-full md:w-40"
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
                        className="input w-full md:w-40"
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
                className="table-container"
            >
                <table className="table">
                    <thead>
                        <tr>
                            <th>Utilisateur</th>
                            <th>Contact</th>
                            <th>Plan</th>
                            <th>Agents</th>
                            <th>Messages</th>
                            <th>Statut</th>
                            <th>Inscrit le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="avatar">
                                            {user.name.split(' ').map((n: string) => n[0]).join('')}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{user.name}</div>
                                            <div className="text-sm text-dark-500">ID: {user.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm text-dark-300">
                                            <Mail className="w-4 h-4 text-dark-500" />
                                            {user.email}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-dark-400">
                                            <Phone className="w-4 h-4 text-dark-500" />
                                            {user.phone}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge ${user.plan === 'Business' ? 'badge-accent' :
                                        user.plan === 'Pro' ? 'badge-primary' :
                                            user.plan === 'Starter' ? 'badge-warning' :
                                                'bg-dark-700 text-dark-300 border-dark-600'
                                        }`}>
                                        {user.plan}
                                    </span>
                                </td>
                                <td className="text-white font-medium">{user.agents}</td>
                                <td className="text-white">{user.messages.toLocaleString()}</td>
                                <td>
                                    <span className={`badge ${user.status === 'active' ? 'badge-success' :
                                        user.status === 'pending' ? 'badge-warning' :
                                            'badge-error'
                                        }`}>
                                        {user.status === 'active' ? 'Actif' :
                                            user.status === 'pending' ? 'En attente' : 'Suspendu'}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2 text-dark-400">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(user.created).toLocaleDateString('fr-FR')}
                                    </div>
                                </td>
                                <td>
                                    <div className="flex items-center gap-1">
                                        <button className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors" title="Voir">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors" title="Modifier">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        {user.status === 'active' ? (
                                            <button className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors" title="Suspendre">
                                                <Ban className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button className="p-2 rounded-lg hover:bg-green-500/10 text-dark-400 hover:text-green-400 transition-colors" title="Activer">
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors" title="Supprimer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-dark-400">
                    Affichage de {filteredUsers.length} sur {users.length} utilisateurs
                </p>
                <div className="flex items-center gap-2">
                    <button className="px-4 py-2 rounded-lg bg-dark-800 text-dark-400 hover:text-white transition-colors">
                        Précédent
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-primary-500 text-white">
                        1
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-dark-800 text-dark-400 hover:text-white transition-colors">
                        2
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-dark-800 text-dark-400 hover:text-white transition-colors">
                        3
                    </button>
                    <button className="px-4 py-2 rounded-lg bg-dark-800 text-dark-400 hover:text-white transition-colors">
                        Suivant
                    </button>
                </div>
            </div>
        </div>
    )
}
