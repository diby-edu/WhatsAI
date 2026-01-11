'use client'

import { useState, useRef } from 'react'
import { Plus, X, Trash2, Edit2, Check, DollarSign, ImageIcon, Upload, Palette, Ruler, Scale, Clock, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

// Category types for variants
export type VariantCategory = 'visual' | 'size' | 'weight' | 'duration' | 'custom'

export interface VariantOption {
    value: string
    price: number
    image?: string  // Optional image URL for this option
}

export interface VariantGroup {
    id: string
    name: string
    type: 'fixed' | 'additive'
    category?: VariantCategory  // Category to determine if images are needed
    options: VariantOption[]
}

// Category configuration
const CATEGORY_CONFIG: Record<VariantCategory, { label: string; icon: any; needsImage: boolean; color: string }> = {
    visual: { label: '🎨 Couleur / Style', icon: Palette, needsImage: true, color: '#f59e0b' },
    size: { label: '📏 Taille', icon: Ruler, needsImage: false, color: '#3b82f6' },
    weight: { label: '⚖️ Poids / Volume', icon: Scale, needsImage: false, color: '#8b5cf6' },
    duration: { label: '⏱️ Durée', icon: Clock, needsImage: false, color: '#10b981' },
    custom: { label: '⚙️ Autre', icon: Settings, needsImage: true, color: '#64748b' }
}

interface ProductVariantsEditorProps {
    variants: VariantGroup[]
    onChange: (variants: VariantGroup[]) => void
    currencySymbol: string
}

export default function ProductVariantsEditor({ variants, onChange, currencySymbol }: ProductVariantsEditorProps) {
    const [editingGroup, setEditingGroup] = useState<string | null>(null)
    const [uploadingOptionKey, setUploadingOptionKey] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // Handle image upload for a variant option
    const handleImageUpload = async (groupId: string, optionIndex: number, file: File) => {
        const key = `${groupId}-${optionIndex}`
        setUploadingOptionKey(key)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `variant_${groupId}_${optionIndex}_${Date.now()}.${fileExt}`
            const filePath = `products/variants/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath)

            updateOption(groupId, optionIndex, { image: publicUrl })
        } catch (err) {
            console.error('Error uploading variant image:', err)
        } finally {
            setUploadingOptionKey(null)
        }
    }

    const addGroup = (type: 'fixed' | 'additive') => {
        const newGroup: VariantGroup = {
            id: Date.now().toString(),
            name: type === 'fixed' ? 'Couleur' : 'Supplément',
            type: type,
            category: type === 'fixed' ? 'visual' : 'custom',  // Default category based on type
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
                            background: 'rgba(30, 41, 59, 0.3)', // Lighter bg to blend with card
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 16
                        }}
                    >
                        {/* Group Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
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
                                    placeholder="Nom (ex: Couleur)"
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

                        {/* Category Selector */}
                        <div style={{ marginBottom: 16 }}>
                            <select
                                value={group.category || 'custom'}
                                onChange={(e) => updateGroup(group.id, { category: e.target.value as VariantCategory })}
                                style={{
                                    width: '100%',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 10,
                                    padding: '10px 14px',
                                    color: 'white',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            >
                                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key} style={{ background: '#1e293b' }}>
                                        {config.label}
                                    </option>
                                ))}
                            </select>
                            {CATEGORY_CONFIG[group.category || 'custom']?.needsImage && (
                                <div style={{
                                    marginTop: 8,
                                    padding: '8px 12px',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: '#fbbf24',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <ImageIcon size={14} />
                                    💡 Les images sont recommandées pour cette variante visuelle
                                </div>
                            )}
                        </div>

                        {/* Options List */}
                        <div style={{ display: 'grid', gap: 12 }}>
                            {group.options.map((option, idx) => {
                                const needsImage = CATEGORY_CONFIG[group.category || 'custom']?.needsImage
                                const isUploading = uploadingOptionKey === `${group.id}-${idx}`

                                return (
                                    <div key={idx} style={{
                                        background: 'rgba(15, 23, 42, 0.3)',
                                        borderRadius: 10,
                                        padding: 12
                                    }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <input
                                                value={option.value}
                                                onChange={(e) => updateOption(group.id, idx, { value: e.target.value })}
                                                placeholder={needsImage ? "Option (ex: Rouge)" : "Option (ex: L)"}
                                                style={{
                                                    flex: 1,
                                                    background: 'rgba(30, 41, 59, 0.5)',
                                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                                    borderRadius: 10,
                                                    padding: '10px 14px',
                                                    color: 'white',
                                                    fontSize: 14,
                                                    outline: 'none'
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
                                                        background: 'rgba(30, 41, 59, 0.5)',
                                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                                        borderRadius: 10,
                                                        padding: '10px 14px',
                                                        paddingLeft: 36,
                                                        textAlign: 'right',
                                                        color: group.type === 'fixed' ? '#34d399' : '#d8b4fe',
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        outline: 'none'
                                                    }}
                                                />
                                                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 12, pointerEvents: 'none' }}>
                                                    {group.type === 'additive' ? '+' : ''}{currencySymbol}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeOption(group.id, idx)}
                                                style={{
                                                    padding: 10,
                                                    borderRadius: 10,
                                                    color: '#64748b',
                                                    background: 'rgba(30, 41, 59, 0.5)',
                                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Image Upload (only for visual variants) */}
                                        {needsImage && (
                                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {option.image ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <img
                                                            src={option.image}
                                                            alt={option.value}
                                                            style={{
                                                                width: 48,
                                                                height: 48,
                                                                borderRadius: 8,
                                                                objectFit: 'cover',
                                                                border: '2px solid rgba(16, 185, 129, 0.5)'
                                                            }}
                                                        />
                                                        <span style={{ color: '#10b981', fontSize: 12, fontWeight: 500 }}>
                                                            ✅ Image ajoutée
                                                        </span>
                                                        <button
                                                            onClick={() => updateOption(group.id, idx, { image: undefined })}
                                                            style={{
                                                                padding: '4px 8px',
                                                                borderRadius: 6,
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: 'none',
                                                                color: '#f87171',
                                                                fontSize: 11,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Retirer
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        padding: '8px 12px',
                                                        borderRadius: 8,
                                                        background: 'rgba(245, 158, 11, 0.1)',
                                                        border: '1px dashed rgba(245, 158, 11, 0.4)',
                                                        color: '#fbbf24',
                                                        fontSize: 12,
                                                        cursor: 'pointer',
                                                        opacity: isUploading ? 0.6 : 1
                                                    }}>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
                                                            disabled={isUploading}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0]
                                                                if (file) handleImageUpload(group.id, idx, file)
                                                            }}
                                                        />
                                                        {isUploading ? (
                                                            <>
                                                                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                                                                Upload...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload size={14} />
                                                                📸 Ajouter image
                                                            </>
                                                        )}
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            <button
                                onClick={() => addOption(group.id)}
                                style={{
                                    marginTop: 8,
                                    fontSize: 13,
                                    color: '#94a3b8',
                                    background: 'transparent',
                                    border: '1px dashed rgba(148, 163, 184, 0.3)',
                                    borderRadius: 12,
                                    padding: 10,
                                    cursor: 'pointer',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                <Plus size={14} /> Ajouter un choix
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Add Group Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                <button
                    type="button"
                    onClick={() => addGroup('fixed')}
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
                    type="button"
                    onClick={() => addGroup('additive')}
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
