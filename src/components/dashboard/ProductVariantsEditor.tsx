'use client'

import { useState } from 'react'
import { Plus, X, Trash2, Edit2, Check, DollarSign } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface VariantOption {
    value: string
    price: number
}

export interface VariantGroup {
    id: string
    name: string
    type: 'fixed' | 'additive'
    options: VariantOption[]
}

interface ProductVariantsEditorProps {
    variants: VariantGroup[]
    onChange: (variants: VariantGroup[]) => void
    currencySymbol: string
}

export default function ProductVariantsEditor({ variants, onChange, currencySymbol }: ProductVariantsEditorProps) {
    const [editingGroup, setEditingGroup] = useState<string | null>(null)
    const [newGroupType, setNewGroupType] = useState<'fixed' | 'additive'>('fixed')

    const addGroup = () => {
        const newGroup: VariantGroup = {
            id: Date.now().toString(),
            name: newGroupType === 'fixed' ? 'Taille' : 'Supplément',
            type: newGroupType,
            options: [] // Empty options initially
        }
        onChange([...variants, newGroup])
        setEditingGroup(newGroup.id)
    }

    const updateGroup = (id: string, updates: Partial<VariantGroup>) => {
        onChange(variants.map(v => v.id === id ? { ...v, ...updates } : v))
    }

    const removeGroup = (id: string) => {
        onChange(variants.filter(v => v.id !== id))
    }

    const addOption = (groupId: string) => {
        const group = variants.find(v => v.id === groupId)
        if (!group) return

        const newOption: VariantOption = {
            value: '',
            price: group.type === 'fixed' ? 0 : 0
        }

        updateGroup(groupId, { options: [...group.options, newOption] })
    }

    const updateOption = (groupId: string, index: number, updates: Partial<VariantOption>) => {
        const group = variants.find(v => v.id === groupId)
        if (!group) return

        const newOptions = [...group.options]
        newOptions[index] = { ...newOptions[index], ...updates }
        updateGroup(groupId, { options: newOptions })
    }

    const removeOption = (groupId: string, index: number) => {
        const group = variants.find(v => v.id === groupId)
        if (!group) return

        const newOptions = group.options.filter((_, i) => i !== index)
        updateGroup(groupId, { options: newOptions })
    }

    return (
        <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 16 }}>
                Variantes & Options
            </h3>

            <AnimatePresence>
                {variants.map(group => (
                    <motion.div
                        key={group.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            background: 'rgba(15, 23, 42, 0.4)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 16
                        }}
                    >
                        {/* Group Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                <div style={{
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: group.type === 'fixed' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                                    color: group.type === 'fixed' ? '#60a5fa' : '#c084fc',
                                    border: `1px solid ${group.type === 'fixed' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                                }}>
                                    {group.type === 'fixed' ? 'PRIX FIXE' : 'SUPPLÉMENT'}
                                </div>
                                <input
                                    value={group.name}
                                    onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                                    placeholder="Nom (ex: Taille)"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'white',
                                        fontSize: 16,
                                        fontWeight: 600,
                                        width: '100%',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => removeGroup(group.id)}
                                style={{ padding: 6, borderRadius: 6, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer' }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        {/* Options List */}
                        <div style={{ display: 'grid', gap: 8 }}>
                            {group.options.map((option, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                        value={option.value}
                                        onChange={(e) => updateOption(group.id, idx, { value: e.target.value })}
                                        placeholder="Option (ex: L)"
                                        style={{
                                            flex: 1,
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            borderRadius: 8,
                                            padding: '8px 12px',
                                            color: 'white',
                                            fontSize: 14
                                        }}
                                    />
                                    <div style={{ position: 'relative', width: 120 }}>
                                        <input
                                            type="number"
                                            value={option.price || ''}
                                            onChange={(e) => updateOption(group.id, idx, { price: parseFloat(e.target.value) || 0 })}
                                            placeholder="Prix"
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                                borderRadius: 8,
                                                padding: '8px 12px 8px 32px',
                                                color: group.type === 'fixed' ? '#34d399' : '#c084fc',
                                                fontSize: 14,
                                                fontWeight: 600
                                            }}
                                        />
                                        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12 }}>
                                            {group.type === 'additive' ? '+' : ''}{currencySymbol}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeOption(group.id, idx)}
                                        style={{
                                            padding: 8,
                                            borderRadius: 8,
                                            color: '#64748b',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => addOption(group.id)}
                                style={{
                                    marginTop: 4,
                                    fontSize: 13,
                                    color: '#94a3b8',
                                    background: 'transparent',
                                    border: '1px dashed rgba(148, 163, 184, 0.3)',
                                    borderRadius: 8,
                                    padding: 8,
                                    cursor: 'pointer',
                                    width: '100%'
                                }}
                            >
                                + Ajouter un choix
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Add Group Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                <button
                    onClick={() => { setNewGroupType('fixed'); addGroup(); }}
                    style={{
                        padding: 12,
                        borderRadius: 10,
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px dashed #3b82f6',
                        color: '#60a5fa',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 500
                    }}
                >
                    <Plus size={16} />
                    Variante (Prix Fixe)
                </button>
                <button
                    onClick={() => { setNewGroupType('additive'); addGroup(); }}
                    style={{
                        padding: 12,
                        borderRadius: 10,
                        background: 'rgba(168, 85, 247, 0.1)',
                        border: '1px dashed #a855f7',
                        color: '#c084fc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 500
                    }}
                >
                    <Plus size={16} />
                    Option (Supplément)
                </button>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                Fixe : Remplace le prix global (ex: Taille). <br />
                Supplément : S'ajoute au prix global (ex: Fromage).
            </p>
        </div>
    )
}
