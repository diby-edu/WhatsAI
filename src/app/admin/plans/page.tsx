'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    CreditCard, Plus, Edit2, Trash2, Loader2, Save, X,
    Check, Zap
} from 'lucide-react'

interface Plan {
    id: string
    name: string
    price_fcfa: number
    credits_included: number
    features: string[]
    is_active: boolean
    billing_cycle: 'monthly' | 'yearly'
    created_at: string
}

const defaultFeatures = [
    'Support par email',
    'Accès au dashboard',
    'Statistiques de base'
]

export default function AdminPlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        price_fcfa: 0,
        credits_included: 100,
        features: [''],
        is_active: true,
        billing_cycle: 'monthly' as 'monthly' | 'yearly'
    })

    useEffect(() => {
        fetchPlans()
    }, [])

    const fetchPlans = async () => {
        try {
            const res = await fetch('/api/admin/plans')
            const data = await res.json()
            if (data.data?.plans) {
                setPlans(data.data.plans)
            }
        } catch (err) {
            console.error('Error fetching plans:', err)
        } finally {
            setLoading(false)
        }
    }

    const openCreateForm = () => {
        setFormData({
            name: '',
            price_fcfa: 0,
            credits_included: 100,
            features: ['Support par email', 'Accès au dashboard'],
            is_active: true,
            billing_cycle: 'monthly'
        })
        setIsCreating(true)
        setEditingPlan(null)
    }

    const openEditForm = (plan: Plan) => {
        setFormData({
            name: plan.name,
            price_fcfa: plan.price_fcfa,
            credits_included: plan.credits_included,
            features: plan.features || defaultFeatures,
            is_active: plan.is_active,
            billing_cycle: plan.billing_cycle
        })
        setEditingPlan(plan)
        setIsCreating(false)
    }

    const closeForm = () => {
        setEditingPlan(null)
        setIsCreating(false)
    }

    const addFeature = () => {
        setFormData({ ...formData, features: [...formData.features, ''] })
    }

    const updateFeature = (index: number, value: string) => {
        const newFeatures = [...formData.features]
        newFeatures[index] = value
        setFormData({ ...formData, features: newFeatures })
    }

    const removeFeature = (index: number) => {
        setFormData({ ...formData, features: formData.features.filter((_, i) => i !== index) })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : '/api/admin/plans'
            const method = editingPlan ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    features: formData.features.filter(f => f.trim() !== '')
                })
            })

            if (res.ok) {
                fetchPlans()
                closeForm()
            }
        } catch (err) {
            console.error('Error saving plan:', err)
        } finally {
            setSaving(false)
        }
    }

    const deletePlan = async (id: string) => {
        if (!confirm('Supprimer ce plan ?')) return

        try {
            await fetch(`/api/admin/plans/${id}`, { method: 'DELETE' })
            fetchPlans()
        } catch (err) {
            console.error('Error deleting plan:', err)
        }
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA'
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                        Gestion des Plans
                    </h1>
                    <p style={{ color: '#94a3b8' }}>{plans.length} plans de souscription</p>
                </div>
                <button
                    onClick={openCreateForm}
                    style={{
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    <Plus size={20} />
                    Nouveau Plan
                </button>
            </div>

            {/* Plans Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
                {plans.map((plan, i) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        style={{
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            padding: 24,
                            position: 'relative'
                        }}
                    >
                        {!plan.is_active && (
                            <div style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                padding: '4px 10px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600
                            }}>
                                Inactif
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Zap style={{ width: 24, height: 24, color: 'white' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{plan.name}</h3>
                                <span style={{ fontSize: 12, color: '#64748b' }}>
                                    {plan.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel'}
                                </span>
                            </div>
                        </div>

                        <div style={{ fontSize: 28, fontWeight: 700, color: '#34d399', marginBottom: 8 }}>
                            {formatPrice(plan.price_fcfa)}
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            borderRadius: 8,
                            marginBottom: 16,
                            width: 'fit-content'
                        }}>
                            <CreditCard size={16} style={{ color: '#a78bfa' }} />
                            <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{plan.credits_included} crédits</span>
                        </div>

                        {plan.features && plan.features.length > 0 && (
                            <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                                {plan.features.slice(0, 4).map((feature, idx) => (
                                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 14, marginBottom: 6 }}>
                                        <Check size={14} style={{ color: '#34d399' }} />
                                        {feature}
                                    </li>
                                ))}
                                {plan.features.length > 4 && (
                                    <li style={{ color: '#64748b', fontSize: 13 }}>+{plan.features.length - 4} autres</li>
                                )}
                            </ul>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => openEditForm(plan)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#3b82f6',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6
                                }}
                            >
                                <Edit2 size={16} />
                                Modifier
                            </button>
                            <button
                                onClick={() => deletePlan(plan.id)}
                                style={{
                                    padding: '10px 14px',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#f87171',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Edit/Create Modal */}
            {(editingPlan || isCreating) && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    padding: 20
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            background: '#1e293b',
                            borderRadius: 20,
                            padding: 32,
                            width: '100%',
                            maxWidth: 500,
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'white' }}>
                                {isCreating ? 'Nouveau plan' : 'Modifier le plan'}
                            </h2>
                            <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X style={{ color: '#94a3b8' }} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Nom du plan</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: Starter, Pro, Business"
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white',
                                        fontSize: 16
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                <div>
                                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Prix (FCFA)</label>
                                    <input
                                        type="number"
                                        required
                                        min={0}
                                        value={formData.price_fcfa}
                                        onChange={e => setFormData({ ...formData, price_fcfa: parseInt(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: 14,
                                            borderRadius: 10,
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            border: '1px solid rgba(148, 163, 184, 0.1)',
                                            color: 'white'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Crédits inclus</label>
                                    <input
                                        type="number"
                                        required
                                        min={0}
                                        value={formData.credits_included}
                                        onChange={e => setFormData({ ...formData, credits_included: parseInt(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: 14,
                                            borderRadius: 10,
                                            background: 'rgba(15, 23, 42, 0.5)',
                                            border: '1px solid rgba(148, 163, 184, 0.1)',
                                            color: 'white'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Cycle de facturation</label>
                                <select
                                    value={formData.billing_cycle}
                                    onChange={e => setFormData({ ...formData, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        borderRadius: 10,
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                        color: 'white'
                                    }}
                                >
                                    <option value="monthly">Mensuel</option>
                                    <option value="yearly">Annuel</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Fonctionnalités</label>
                                {formData.features.map((feature, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <input
                                            value={feature}
                                            onChange={e => updateFeature(idx, e.target.value)}
                                            placeholder="Ex: Support prioritaire"
                                            style={{
                                                flex: 1,
                                                padding: 12,
                                                borderRadius: 8,
                                                background: 'rgba(15, 23, 42, 0.5)',
                                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                                color: 'white'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeFeature(idx)}
                                            style={{
                                                padding: '0 12px',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: '#f87171',
                                                border: 'none',
                                                borderRadius: 8,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addFeature}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#3b82f6',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 14
                                    }}
                                >
                                    + Ajouter une fonctionnalité
                                </button>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 16,
                                background: 'rgba(15, 23, 42, 0.5)',
                                borderRadius: 10,
                                marginBottom: 24
                            }}>
                                <span style={{ color: 'white', fontWeight: 500 }}>Plan actif</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    style={{
                                        width: 52,
                                        height: 28,
                                        borderRadius: 14,
                                        background: formData.is_active ? '#10b981' : '#475569',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: 3,
                                        left: formData.is_active ? 27 : 3,
                                        transition: 'left 0.2s'
                                    }} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    style={{
                                        flex: 1,
                                        padding: 14,
                                        background: 'rgba(51, 65, 85, 0.5)',
                                        color: '#94a3b8',
                                        border: 'none',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{
                                        flex: 1,
                                        padding: 14,
                                        background: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    {saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                                    {isCreating ? 'Créer' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
