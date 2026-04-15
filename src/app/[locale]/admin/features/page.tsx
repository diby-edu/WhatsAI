'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Settings, ToggleLeft, ToggleRight, Mic, Eye, Zap, Shield,
    Loader2, Save, AlertTriangle, CheckCircle, ArrowLeft, Globe,
    ShoppingCart, UtensilsCrossed, Hotel, Scissors, Wrench, PenLine,
    Laptop, Package, Briefcase, Users, Search, X, ChevronDown
} from 'lucide-react'
import Link from 'next/link'

interface FeatureFlag {
    id: string
    name: string
    key: string
    enabled: boolean
    description: string
    icon: any
    category: string
}

interface UserProfile {
    id: string
    full_name: string
    email: string
    plan: string
}

interface UserFlag {
    feature_key: string
    enabled: boolean
}

const ALL_FEATURES: Omit<FeatureFlag, 'enabled'>[] = [
    { id: '1', name: 'Réponses Vocales', key: 'voice_responses', description: 'Permet aux agents de répondre avec des messages vocaux (coût: +4 crédits)', icon: Mic, category: 'IA' },
    { id: '2', name: 'Vision (Images)', key: 'vision_enabled', description: "Permet aux agents d'analyser les images envoyées par les clients", icon: Eye, category: 'IA' },
    { id: '3', name: 'Outils IA (Réservations)', key: 'ai_tools_booking', description: "Active l'outil create_booking pour enregistrer les réservations automatiquement", icon: Zap, category: 'IA' },
    { id: '4', name: 'Outils IA (Commandes)', key: 'ai_tools_orders', description: "Active l'outil create_order pour enregistrer les commandes automatiquement", icon: Zap, category: 'IA' },
    { id: '5', name: 'Mode Maintenance', key: 'maintenance_mode', description: 'Désactive temporairement tous les bots et affiche un message de maintenance', icon: AlertTriangle, category: 'Système' },
    { id: '6', name: 'Inscriptions Ouvertes', key: 'registrations_open', description: "Permet aux nouveaux utilisateurs de s'inscrire sur la plateforme", icon: Globe, category: 'Système' },
    { id: '7', name: 'Paiements', key: 'payments_enabled', description: 'Active les paiements pour les crédits et abonnements', icon: Shield, category: 'Système' },
    { id: '8',  name: 'E-commerce / Boutique',  key: 'agent_ecommerce',  description: 'Mission E-commerce disponible à la création d\'agent', icon: ShoppingCart,    category: 'Missions' },
    { id: '9',  name: 'Restaurant / Fast-food', key: 'agent_restaurant', description: 'Mission Restaurant disponible à la création d\'agent',   icon: UtensilsCrossed, category: 'Missions' },
    { id: '10', name: 'Hôtel / Hébergement',    key: 'agent_hotel',     description: 'Mission Hôtel disponible à la création d\'agent',         icon: Hotel,           category: 'Missions' },
    { id: '11', name: 'Salon / Beauté',          key: 'agent_salon',     description: 'Mission Salon disponible à la création d\'agent',         icon: Scissors,        category: 'Missions' },
    { id: '12', name: 'Services / Artisan',      key: 'agent_services',  description: 'Mission Services disponible à la création d\'agent',      icon: Wrench,          category: 'Missions' },
    { id: '13', name: 'Personnalisé',            key: 'agent_custom',    description: 'Mission Personnalisé disponible à la création d\'agent',  icon: PenLine,         category: 'Missions' },
    { id: '14', name: 'Produit Numérique',  key: 'product_digital',   description: 'Type Numérique disponible à la création de produit',  icon: Laptop,    category: 'Produits' },
    { id: '15', name: 'Produit Physique',   key: 'product_physical',  description: 'Type Physique disponible à la création de produit',   icon: Package,   category: 'Produits' },
    { id: '16', name: 'Produit Service',    key: 'product_service',   description: 'Type Service disponible à la création de produit',    icon: Briefcase, category: 'Produits' },
]

const PLAN_COLORS: Record<string, string> = {
    free: '#64748b', starter: '#3b82f6', pro: '#8b5cf6', business: '#f59e0b', scale: '#10b981'
}

export default function AdminFeaturesPage() {
    const [activeTab, setActiveTab] = useState<'global' | 'users'>('global')
    const [features, setFeatures] = useState<FeatureFlag[]>(
        ALL_FEATURES.map(f => ({ ...f, enabled: true }))
    )
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Onglet utilisateurs
    const [users, setUsers] = useState<UserProfile[]>([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
    const [userFlags, setUserFlags] = useState<Record<string, boolean>>({})
    const [userFlagsSaving, setUserFlagsSaving] = useState(false)
    const [userFlagsSaved, setUserFlagsSaved] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => { fetchFeatures() }, [])
    useEffect(() => { if (activeTab === 'users') fetchUsers() }, [activeTab])

    const fetchFeatures = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/features')
            const data = await res.json()
            if (data.data?.features) {
                setFeatures(ALL_FEATURES.map(f => {
                    const sf = data.data.features.find((s: any) => s.key === f.key)
                    return { ...f, enabled: sf ? sf.enabled : f.key.startsWith('agent_ecommerce') || f.key === 'product_digital' || !f.key.startsWith('agent_') && !f.key.startsWith('product_') }
                }))
            }
        } catch { } finally { setLoading(false) }
    }

    const fetchUsers = async () => {
        setUsersLoading(true)
        try {
            const res = await fetch('/api/admin/users?limit=200')
            const data = await res.json()
            setUsers(data.data?.users || [])
        } catch { } finally { setUsersLoading(false) }
    }

    const openUserModal = async (user: UserProfile) => {
        setSelectedUser(user)
        setUserFlags({})
        setModalOpen(true)
        try {
            const res = await fetch(`/api/admin/user-features?user_id=${user.id}`)
            const data = await res.json()
            const map: Record<string, boolean> = {}
            for (const f of data.data?.flags || []) map[f.feature_key] = f.enabled
            setUserFlags(map)
        } catch { }
    }

    const saveUserFlags = async () => {
        if (!selectedUser) return
        setUserFlagsSaving(true)
        try {
            const missionProductKeys = ALL_FEATURES
                .filter(f => f.category === 'Missions' || f.category === 'Produits')
                .map(f => f.key)
            const features = missionProductKeys.map(key => ({ key, enabled: userFlags[key] ?? false }))
            await fetch('/api/admin/user-features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: selectedUser.id, features })
            })
            setUserFlagsSaved(true)
            setTimeout(() => setUserFlagsSaved(false), 2000)
        } catch { } finally { setUserFlagsSaving(false) }
    }

    const toggleFeature = (key: string) => {
        setFeatures(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f))
        setSaved(false)
    }

    const saveFeatures = async () => {
        setSaving(true)
        try {
            await fetch('/api/admin/features', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ features: features.map(f => ({ key: f.key, enabled: f.enabled })) })
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch { } finally { setSaving(false) }
    }

    const categories = [...new Set(ALL_FEATURES.map(f => f.category))]
    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    )
    const missionProductFeatures = ALL_FEATURES.filter(f => f.category === 'Missions' || f.category === 'Produits')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href="/admin" style={{ color: '#64748b' }}><ArrowLeft size={20} /></Link>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Feature Flags</h1>
                        <p style={{ color: '#64748b', fontSize: 13 }}>Activer / Désactiver les fonctionnalités de la plateforme</p>
                    </div>
                </div>
                {activeTab === 'global' && (
                    <button onClick={saveFeatures} disabled={saving} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                        background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg,#10b981,#059669)',
                        border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        opacity: saving ? 0.7 : 1
                    }}>
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                            : saved ? <CheckCircle size={16} /> : <Save size={16} />}
                        {saved ? 'Enregistré !' : 'Enregistrer'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                {(['global', 'users'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        background: activeTab === tab ? 'rgba(16,185,129,0.15)' : 'transparent',
                        color: activeTab === tab ? '#34d399' : '#64748b',
                        transition: 'all 0.2s'
                    }}>
                        {tab === 'global' ? 'Fonctionnalités globales' : 'Accès utilisateurs'}
                    </button>
                ))}
            </div>

            {/* TAB GLOBAL */}
            {activeTab === 'global' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {loading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>}
                    {!loading && categories.map(category => (
                        <div key={category} style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,0.1)', background: 'rgba(15,23,42,0.3)' }}>
                                <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{category}</h2>
                            </div>
                            <div style={{ padding: 8 }}>
                                {features.filter(f => f.category === category).map(feature => (
                                    <div key={feature.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px', borderRadius: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: feature.enabled ? 'rgba(52,211,153,0.15)' : 'rgba(100,116,139,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                                                <feature.icon size={18} style={{ color: feature.enabled ? '#34d399' : '#64748b', transition: 'color 0.3s' }} />
                                            </div>
                                            <div>
                                                <div style={{ color: 'white', fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{feature.name}</div>
                                                <div style={{ color: '#64748b', fontSize: 12, maxWidth: 420 }}>{feature.description}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => toggleFeature(feature.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                            {feature.enabled
                                                ? <ToggleRight size={34} style={{ color: '#34d399' }} />
                                                : <ToggleLeft size={34} style={{ color: '#475569' }} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB UTILISATEURS */}
            {activeTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ color: '#64748b', fontSize: 13 }}>
                        Activez des missions ou types de produits pour un utilisateur spécifique, même si le flag global est désactivé.
                    </p>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Rechercher par nom ou email..."
                            style={{ width: '100%', padding: '10px 14px 10px 40px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    {usersLoading && <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>}

                    <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                    {['Utilisateur', 'Email', 'Plan', 'Action'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.slice(0, 50).map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                                        <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500, fontSize: 14 }}>{u.full_name || '—'}</td>
                                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{u.email}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${PLAN_COLORS[u.plan] || '#64748b'}22`, color: PLAN_COLORS[u.plan] || '#64748b', textTransform: 'uppercase' }}>
                                                {u.plan || 'free'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <button onClick={() => openUserModal(u)} style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: '#34d399', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                                                Gérer
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal par utilisateur */}
            <AnimatePresence>
                {modalOpen && selectedUser && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                        onClick={() => setModalOpen(false)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div>
                                    <h3 style={{ color: 'white', fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{selectedUser.full_name}</h3>
                                    <p style={{ color: '#64748b', fontSize: 13 }}>{selectedUser.email}</p>
                                </div>
                                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
                            </div>

                            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                                Activez des fonctionnalités pour cet utilisateur même si le flag global est OFF.
                            </p>

                            {missionProductFeatures.map(f => {
                                const globalEnabled = features.find(gf => gf.key === f.key)?.enabled ?? false
                                const userEnabled = userFlags[f.key] ?? false
                                const effective = globalEnabled || userEnabled
                                return (
                                    <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(148,163,184,0.07)' }}>
                                        <div>
                                            <div style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{f.name}</div>
                                            {globalEnabled && <div style={{ color: '#34d399', fontSize: 11, marginTop: 2 }}>Actif globalement</div>}
                                        </div>
                                        <button
                                            onClick={() => setUserFlags(prev => ({ ...prev, [f.key]: !userEnabled }))}
                                            disabled={globalEnabled}
                                            style={{ background: 'none', border: 'none', cursor: globalEnabled ? 'default' : 'pointer', padding: 4, opacity: globalEnabled ? 0.4 : 1 }}>
                                            {effective
                                                ? <ToggleRight size={32} style={{ color: '#34d399' }} />
                                                : <ToggleLeft size={32} style={{ color: '#475569' }} />}
                                        </button>
                                    </div>
                                )
                            })}

                            <button onClick={saveUserFlags} disabled={userFlagsSaving} style={{
                                width: '100%', marginTop: 20, padding: '12px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14,
                                background: userFlagsSaved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg,#10b981,#059669)',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                            }}>
                                {userFlagsSaving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : userFlagsSaved ? <CheckCircle size={16} /> : <Save size={16} />}
                                {userFlagsSaved ? 'Enregistré !' : 'Enregistrer'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
