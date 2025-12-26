'use client'

import { useState } from 'react'
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

// Mock data
const users = [
    { id: 1, name: 'Kouassi Jean', email: 'kouassi@email.com', phone: '+225 07 12 34 56', plan: 'Pro', status: 'active', agents: 2, messages: 1250, created: '2024-12-15' },
    { id: 2, name: 'Aminata Diallo', email: 'aminata@email.com', phone: '+225 05 98 76 54', plan: 'Starter', status: 'active', agents: 1, messages: 450, created: '2024-12-18' },
    { id: 3, name: 'Mohamed Traoré', email: 'mohamed@email.com', phone: '+225 01 23 45 67', plan: 'Business', status: 'active', agents: 4, messages: 5200, created: '2024-12-10' },
    { id: 4, name: 'Fatou Konaté', email: 'fatou@email.com', phone: '+225 07 65 43 21', plan: 'Free', status: 'pending', agents: 1, messages: 45, created: '2024-12-20' },
    { id: 5, name: 'Ibrahim Coulibaly', email: 'ibrahim@email.com', phone: '+225 05 11 22 33', plan: 'Pro', status: 'active', agents: 2, messages: 890, created: '2024-12-12' },
    { id: 6, name: 'Marie Bamba', email: 'marie@email.com', phone: '+225 07 44 55 66', plan: 'Starter', status: 'suspended', agents: 1, messages: 120, created: '2024-12-08' },
    { id: 7, name: 'Oumar Sanogo', email: 'oumar@email.com', phone: '+225 01 77 88 99', plan: 'Business', status: 'active', agents: 3, messages: 3400, created: '2024-12-05' },
    { id: 8, name: 'Aïcha Touré', email: 'aicha@email.com', phone: '+225 05 00 11 22', plan: 'Free', status: 'active', agents: 1, messages: 78, created: '2024-12-22' },
]

export default function AdminUsersPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('all')
    const [selectedStatus, setSelectedStatus] = useState('all')

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
                                            {user.name.split(' ').map(n => n[0]).join('')}
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
