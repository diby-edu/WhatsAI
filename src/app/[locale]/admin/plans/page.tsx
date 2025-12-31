'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    CreditCard, Plus, Edit2, Trash2, Loader2, Save, X,
    Check, Zap, Crown, Building2, Star, Users, Smartphone
} from 'lucide-react'

interface Plan {
    id: string
    name: string
    price_fcfa: number
    credits_included: number
    features: string[]
    is_active: boolean
    billing_cycle: 'monthly' | 'yearly'
    max_agents: number
    max_whatsapp_numbers: number
    is_popular: boolean
    description: string
    created_at: string
}

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
        billing_cycle: 'monthly' as 'monthly' | 'yearly',
        max_agents: 1,
        max_whatsapp_numbers: 1,
        is_popular: false,
        description: ''
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
            billing_cycle: 'monthly',
            max_agents: 1,
            max_whatsapp_numbers: 1,
            is_popular: false,
            description: ''
        })
        setIsCreating(true)
        setEditingPlan(null)
    }

    const openEditForm = (plan: Plan) => {
        setFormData({
            name: plan.name,
            price_fcfa: plan.price_fcfa,
            credits_included: plan.credits_included,
            features: plan.features || [],
            is_active: plan.is_active,
            billing_cycle: plan.billing_cycle,
            max_agents: plan.max_agents || 1,
            max_whatsapp_numbers: plan.max_whatsapp_numbers || 1,
            is_popular: plan.is_popular || false,
            description: plan.description || ''
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
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
    }

    const getPlanIcon = (name: string) => {
        const lower = name.toLowerCase()
        if (lower.includes('business') || lower.includes('enterprise')) return Building2
        if (lower.includes('pro')) return Crown
        return Zap
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div>
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

            {/* Info Banner */}
            <div style={{
                padding: 16,
                marginBottom: 24,
                borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
                <p style={{ color: '#60a5fa', fontSize: 14 }}>
                    💡 Les modifications des plans sont automatiquement reflétées sur la page d'accueil et dans le dashboard utilisateur.
                </p>
            </div>

            {/* Plans Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
                {plans.map((plan, i) => {
                    const Icon = getPlanIcon(plan.name)
                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: plan.is_popular ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: 16,
                                padding: 24,
                                position: 'relative'
                            }}
                        >
                            {/* Popular Badge */}
                            {plan.is_popular && (
                                <div style={{
                                    position: 'absolute',
                                    top: -10,
                                    right: 16,
                                    padding: '4px 12px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    borderRadius: 20,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Star size={12} />
                                    Populaire
                                </div>
                            )}

                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: plan.price_fcfa === 0 ? 'linear-gradient(135deg, #64748b, #475569)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Icon size={24} style={{ color: 'white' }} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{plan.name}</h3>
                                    <p style={{ fontSize: 12, color: '#64748b' }}>{plan.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel'}</p>
                                </div>
                                <div style={{
                                    marginLeft: 'auto',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    background: plan.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: plan.is_active ? '#4ade80' : '#f87171',
                                    fontSize: 11,
                                    fontWeight: 600
                                }}>
                                    {plan.is_active ? 'Actif' : 'Inactif'}
                                </div>
                            </div>

                            {/* Price */}
                            <div style={{ marginBottom: 16 }}>
                                <span style={{ fontSize: 32, fontWeight: 700, color: '#34d399' }}>
                                    {formatPrice(plan.price_fcfa)}
                                </span>
                            </div>

                            {/* Credits Badge */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                background: 'rgba(139, 92, 246, 0.15)',
                                borderRadius: 8,
                                marginBottom: 16
                            }}>
                                <CreditCard size={14} style={{ color: '#a78bfa' }} />
                                <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>
                                    {plan.credits_included.toLocaleString()} crédits
                                </span>
                            </div>

                            {/* Limits */}
                            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Users size={14} style={{ color: '#64748b' }} />
                                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                                        {plan.max_agents === -1 ? 'Illimité' : plan.max_agents} agents
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Smartphone size={14} style={{ color: '#64748b' }} />
                                    <span style={{ color: '#94a3b8', fontSize: 13 }}>
                                        {plan.max_whatsapp_numbers} numéro(s)
                                    </span>
                                </div>
                            </div>

                            {/* Features */}
                            <ul style={{ marginBottom: 20 }}>
                                {(plan.features || []).slice(0, 4).map((feature, idx) => (
                                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <Check size={14} style={{ color: '#34d399' }} />
                                        <span style={{ color: '#94a3b8', fontSize: 13 }}>{feature}</span>
                                    </li>
                                ))}
                                {(plan.features || []).length > 4 && (
                                    <li style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                                        +{plan.features.length - 4} autres
                                    </li>
                                )}
                            </ul>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => openEditForm(plan)}
                                    style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: '#3b82f6',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        fontWeight: 500
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
                    )
                })}
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
                            maxWidth: 550,
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
                            {/* Name */}
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

                            {/* Description */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Description</label>
                                <input
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ex: Le plus populaire"
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

                            {/* Price & Credits */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                <div>
                                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Prix (USD)</label>
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

                            {/* Max Agents & WhatsApp Numbers */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                <div>
                                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                        Max agents (-1 = illimité)
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min={-1}
                                        value={formData.max_agents}
                                        onChange={e => setFormData({ ...formData, max_agents: parseInt(e.target.value) || 1 })}
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
                                    <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Max numéros WhatsApp</label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        value={formData.max_whatsapp_numbers}
                                        onChange={e => setFormData({ ...formData, max_whatsapp_numbers: parseInt(e.target.value) || 1 })}
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

                            {/* Billing Cycle */}
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

                            {/* Features */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>Fonctionnalités</label>
                                {formData.features.map((feature, index) => (
                                    <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <input
                                            value={feature}
                                            onChange={e => updateFeature(index, e.target.value)}
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
                                            onClick={() => removeFeature(index)}
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
                                        background: 'rgba(148, 163, 184, 0.1)',
                                        color: '#94a3b8',
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        marginTop: 8
                                    }}
                                >
                                    + Ajouter une fonctionnalité
                                </button>
                            </div>

                            {/* Toggles */}
                            <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_popular}
                                        onChange={e => setFormData({ ...formData, is_popular: e.target.checked })}
                                        style={{ width: 20, height: 20, accentColor: '#10b981' }}
                                    />
                                    <span style={{ color: '#e2e8f0' }}>Plan populaire</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        style={{ width: 20, height: 20, accentColor: '#10b981' }}
                                    />
                                    <span style={{ color: '#e2e8f0' }}>Plan actif</span>
                                </label>
                            </div>

                            {/* Submit */}
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    style={{
                                        flex: 1,
                                        padding: 16,
                                        background: 'rgba(148, 163, 184, 0.1)',
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
                                        padding: 16,
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 12,
                                        fontWeight: 600,
                                        cursor: saving ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8
                                    }}
                                >
                                    {saving ? (
                                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    Enregistrer
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
