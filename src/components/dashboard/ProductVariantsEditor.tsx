'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { Plus, X, Trash2, ImageIcon, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { VariantCategory, VariantOption, VariantGroup, ProductCombination } from './product-variants/types'
import {
    MAX_VARIANT_GROUPS,
    MAX_COMBINATIONS,
    CATEGORY_DEFAULT_NAMES,
    DEFAULT_CATEGORY_CONFIG,
    DIGITAL_CATEGORY_CONFIG,
    SERVICE_CATEGORY_CONFIGS,
    slugify,
    cartesian,
    getOptionLabel,
    getComboFallbackImage,
    getCombinationLabel,
    mergeCombinations,
} from './product-variants/helpers'

// Re-exports de compatibilité — sites d'import externes inchangés
// (src/app/[locale]/dashboard/products/new/page.tsx, products/[id]/page.tsx)
export type { VariantCategory, VariantOption, VariantGroup, ProductCombination }

interface ProductVariantsEditorProps {
    variants: VariantGroup[]
    onChange: (variants: VariantGroup[]) => void
    currencySymbol: string
    serviceSubtype?: string  // v2.19: Service subtype to determine available categories
    productType?: string     // 'product' | 'digital' | 'service' — determines available variant categories
    // Combinations (optional — null/undefined = not configured, uses legacy per-option prices)
    combinations?: ProductCombination[] | null
    onCombinationsChange?: (combinations: ProductCombination[] | null) => void
    defaultPrice?: number  // product base price, used as placeholder in combination price inputs
}

// ── Helper functions déplacées vers ./product-variants/{types,helpers}.ts ──────

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductVariantsEditor({
    variants,
    onChange,
    currencySymbol,
    serviceSubtype,
    productType,
    combinations,
    onCombinationsChange,
    defaultPrice,
}: ProductVariantsEditorProps) {
    const [uploadingOptionKey, setUploadingOptionKey] = useState<string | null>(null)
    const [uploadingComboKey, setUploadingComboKey] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // v2.19: Get category config based on service subtype or product type
    const CATEGORY_CONFIG = useMemo(() => {
        if (productType === 'digital') return DIGITAL_CATEGORY_CONFIG
        if (serviceSubtype && SERVICE_CATEGORY_CONFIGS[serviceSubtype]) {
            return SERVICE_CATEGORY_CONFIGS[serviceSubtype]
        }
        return DEFAULT_CATEGORY_CONFIG
    }, [serviceSubtype, productType])

    // Auto-sync combinations when variant options change (add/remove options)
    useEffect(() => {
        if (!onCombinationsChange) return
        const fixedGroupsWithOptions = variants.filter(g => g.type === 'fixed' && g.options.length > 0)

        // Auto-activer les combinaisons si ≥2 groupes PRIX FIXE ont des options
        // (obligatoire pour que le bot calcule les prix correctement)
        if (fixedGroupsWithOptions.length >= 2 && !combinations) {
            onCombinationsChange(mergeCombinations(variants, []))
            return
        }

        if (!combinations) return
        const eligibleGroups = variants.filter(g => g.options.length > 0)
        if (eligibleGroups.length < 2) return
        const merged = mergeCombinations(variants, combinations)
        if (JSON.stringify(merged) !== JSON.stringify(combinations)) {
            onCombinationsChange(merged)
        }
    }, [variants]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Combination actions ──

    const enableCombinations = () => {
        onCombinationsChange?.(mergeCombinations(variants, []))
    }

    const disableCombinations = () => {
        const fixedGroupsWithOptions = variants.filter(g => g.type === 'fixed' && g.options.length > 0)
        if (fixedGroupsWithOptions.length >= 2) return // Obligatoire avec 2+ groupes PRIX FIXE
        if (confirm('Désactiver les combinaisons ? Les prix configurés seront perdus.')) {
            onCombinationsChange?.(null)
        }
    }

    const updateCombinationAt = (index: number, updates: Partial<ProductCombination>) => {
        if (!combinations || !onCombinationsChange) return
        const next = [...combinations]
        next[index] = { ...next[index], ...updates }
        onCombinationsChange(next)
    }

    const handleComboImageUpload = async (index: number, file: File) => {
        const combo = combinations?.[index]
        if (!combo) return
        setUploadingComboKey(String(index))
        try {
            const fileExt = file.name.split('.').pop()
            const safeSku = combo.sku.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
            const filePath = `products/combinations/combo_${safeSku}_${Date.now()}.${fileExt}`
            const { error } = await supabase.storage.from('images').upload(filePath, file)
            if (error) throw error
            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath)
            updateCombinationAt(index, { image: publicUrl })
        } catch (err) {
            console.error('Error uploading combination image:', err)
        } finally {
            setUploadingComboKey(null)
        }
    }

    // ── Variant group / option actions ──

    const handleImageUpload = async (groupId: string, optionIndex: number, file: File) => {
        const key = `${groupId}-${optionIndex}`
        setUploadingOptionKey(key)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `variant_${groupId}_${optionIndex}_${Date.now()}.${fileExt}`
            const filePath = `products/variants/${fileName}`
            const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file)
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath)
            updateOption(groupId, optionIndex, { image: publicUrl })
        } catch (err) {
            console.error('Error uploading variant image:', err)
        } finally {
            setUploadingOptionKey(null)
        }
    }

    const addGroup = (type: 'fixed' | 'additive') => {
        if (variants.length >= MAX_VARIANT_GROUPS) return
        // Determine the best default category for this product type
        let defaultCategory: VariantCategory
        if (type !== 'fixed') {
            defaultCategory = 'custom'
        } else if (productType === 'digital') {
            defaultCategory = 'format'
        } else if (productType === 'service') {
            // Use the first non-custom key from the active service config
            defaultCategory = (Object.keys(CATEGORY_CONFIG).find(k => k !== 'custom') || 'custom') as VariantCategory
        } else {
            defaultCategory = 'visual'
        }
        const newGroup: VariantGroup = {
            id: Date.now().toString(),
            name: type === 'fixed'
                ? (CATEGORY_DEFAULT_NAMES[defaultCategory] || defaultCategory)
                : 'Supplément',
            type: type,
            category: defaultCategory,
            options: []
        }
        onChange([...variants, newGroup])
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
            id: Date.now().toString(36),  // stable unique ID — never changes after creation
            value: '',
            price: 0,
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
        updateGroup(groupId, { options: group.options.filter((_, i) => i !== index) })
    }

    const eligibleForCombinations = useMemo(
        () => variants.filter(g => g.options.length > 0).length >= 2,
        [variants]
    )

    // ── Shared input styles ──

    const inputStyle: React.CSSProperties = {
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 10,
        padding: '8px 10px',
        color: 'white',
        fontSize: 13,
        outline: 'none',
        width: '100%',
    }

    const inputDisabledStyle: React.CSSProperties = {
        ...inputStyle,
        opacity: 0.35,
        cursor: 'not-allowed',
    }

    // ── Render ──

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
                            background: 'rgba(30, 41, 59, 0.3)',
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
                                onChange={(e) => {
                                    const newCat = e.target.value as VariantCategory
                                    const updates: Partial<VariantGroup> = { category: newCat }
                                    if (newCat === 'custom') {
                                        // Catégorie "Autre" → vider le nom pour forcer la saisie manuelle
                                        const genericNames = ['Couleur', 'Supplément', 'Taille', 'Poids', 'Durée',
                                            'Version', 'Format', 'Langue', 'Licence', 'Type de chambre', 'Vue',
                                            'Pension', 'Menu', 'Formule', 'Service', 'Véhicule', 'Option', 'Participants']
                                        if (genericNames.includes(group.name)) {
                                            updates.name = ''
                                        }
                                    } else {
                                        // Catégorie standard → auto-remplir le nom pour éviter {name:"Couleur", category:"size"}
                                        updates.name = CATEGORY_DEFAULT_NAMES[newCat] || group.name
                                    }
                                    updateGroup(group.id, updates)
                                }}
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
                            {group.category === 'custom' && (
                                <div style={{ marginTop: 8 }}>
                                    <input
                                        value={group.customName || ''}
                                        onChange={(e) => updateGroup(group.id, { customName: e.target.value, name: e.target.value || group.name })}
                                        placeholder="Nom personnalisé (ex: Modèle, Fragrance, Matière...)"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(30, 41, 59, 0.5)',
                                            border: `1px solid ${!group.customName?.trim() ? 'rgba(239, 68, 68, 0.5)' : 'rgba(148, 163, 184, 0.2)'}`,
                                            borderRadius: 8,
                                            padding: '8px 12px',
                                            color: 'white',
                                            fontSize: 13,
                                            outline: 'none'
                                        }}
                                    />
                                    <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
                                        ⚙️ Ce nom sera utilisé par l'agent WhatsApp (obligatoire)
                                    </div>
                                </div>
                            )}
                            {CATEGORY_CONFIG[group.category || 'custom']?.needsImage && group.category !== 'custom' && (
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
            {variants.length < MAX_VARIANT_GROUPS ? (
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
            ) : (
                <div style={{
                    marginTop: 16, padding: '10px 14px',
                    background: 'rgba(100, 116, 139, 0.1)',
                    border: '1px solid rgba(100, 116, 139, 0.2)',
                    borderRadius: 10, fontSize: 12, color: '#94a3b8', textAlign: 'center'
                }}>
                    Limite atteinte : {MAX_VARIANT_GROUPS} groupes de variantes maximum
                </div>
            )}
            <p style={{ marginTop: 12, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                Fixe : Remplace le prix global (ex: Taille). <br />
                Supplément : S'ajoute au prix global (ex: Fromage).
            </p>

            {/* ── Combinations section ── */}

            {/* Button to enable combinations (shown when ≥ 2 groups with options, combinations not yet configured) */}
            {eligibleForCombinations && !combinations && onCombinationsChange && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        marginTop: 20,
                        padding: '14px 16px',
                        background: 'rgba(16, 185, 129, 0.07)',
                        border: '1px dashed rgba(16, 185, 129, 0.35)',
                        borderRadius: 12
                    }}
                >
                    <p style={{ color: '#6ee7b7', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
                        💡 Vous avez plusieurs groupes de variantes. Vous pouvez configurer un <strong>prix, un stock et une disponibilité spécifiques</strong> pour chaque combinaison (ex: Noir taille L = 16 000, Vert taille L = indisponible).
                    </p>
                    <button
                        type="button"
                        onClick={enableCombinations}
                        style={{
                            padding: '10px 16px', borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981', fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                        }}
                    >
                        🔗 Configurer les prix par combinaison
                    </button>
                </motion.div>
            )}

            {/* Combinations table (shown when combinations is defined) */}
            {eligibleForCombinations && combinations && onCombinationsChange && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        marginTop: 24,
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: 12,
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(16, 185, 129, 0.15)',
                        background: 'rgba(16, 185, 129, 0.08)'
                    }}>
                        <span style={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}>
                            🔗 Prix par combinaison ({combinations.length}{combinations.length >= MAX_COMBINATIONS ? ' — max' : ''})
                        </span>
                        <button
                            type="button"
                            onClick={disableCombinations}
                            style={{
                                padding: '4px 10px', borderRadius: 6,
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171', fontSize: 11, cursor: 'pointer'
                            }}
                        >
                            Désactiver
                        </button>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto', padding: '0 4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                            <thead>
                                <tr>
                                    {['Actif', 'Combinaison', 'SKU', `Prix (${currencySymbol})`, 'Stock', 'Image'].map(col => (
                                        <th key={col} style={{
                                            padding: '10px 12px', textAlign: 'left',
                                            fontSize: 11, fontWeight: 600,
                                            color: '#64748b', letterSpacing: '0.05em',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {col.toUpperCase()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {combinations.map((combo, index) => {
                                    const isUploading = uploadingComboKey === String(index)
                                    const label = getCombinationLabel(combo, variants)
                                    const cellStyle: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'middle' }

                                    return (
                                        <tr
                                            key={`combo-${index}`}
                                            style={{
                                                borderBottom: '1px solid rgba(148, 163, 184, 0.07)',
                                                opacity: combo.available ? 1 : 0.45,
                                                transition: 'opacity 0.2s',
                                                background: combo.available ? 'transparent' : 'rgba(100,116,139,0.04)'
                                            }}
                                        >
                                            {/* Toggle disponible */}
                                            <td style={cellStyle}>
                                                <button
                                                    type="button"
                                                    onClick={() => updateCombinationAt(index, { available: !combo.available })}
                                                    title={combo.available ? 'Disponible — cliquer pour désactiver' : 'Indisponible — cliquer pour activer'}
                                                    style={{
                                                        width: 34, height: 20, borderRadius: 10, border: 'none',
                                                        cursor: 'pointer', transition: 'background 0.2s',
                                                        background: combo.available ? '#10b981' : 'rgba(100, 116, 139, 0.4)',
                                                        position: 'relative', display: 'inline-block', flexShrink: 0
                                                    }}
                                                >
                                                    <span style={{
                                                        position: 'absolute', top: 2,
                                                        left: combo.available ? 16 : 2,
                                                        width: 16, height: 16, borderRadius: '50%',
                                                        background: 'white', transition: 'left 0.2s',
                                                        display: 'block'
                                                    }} />
                                                </button>
                                            </td>

                                            {/* Label lisible */}
                                            <td style={{ ...cellStyle, color: '#e2e8f0', fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap' }}>
                                                {label}
                                            </td>

                                            {/* SKU */}
                                            <td style={cellStyle}>
                                                <input
                                                    value={combo.sku}
                                                    onChange={(e) => updateCombinationAt(index, { sku: e.target.value })}
                                                    disabled={!combo.available}
                                                    placeholder="Ex: TSHIRT-BLACK-M"
                                                    style={combo.available
                                                        ? { ...inputStyle, width: 130, fontSize: 12 }
                                                        : { ...inputDisabledStyle, width: 130, fontSize: 12 }
                                                    }
                                                />
                                            </td>

                                            {/* Prix */}
                                            <td style={cellStyle}>
                                                <input
                                                    type="number"
                                                    value={combo.price ?? ''}
                                                    onChange={(e) => updateCombinationAt(index, {
                                                        price: e.target.value ? parseFloat(e.target.value) : null
                                                    })}
                                                    disabled={!combo.available}
                                                    placeholder={defaultPrice ? String(defaultPrice) : 'Défaut'}
                                                    style={combo.available
                                                        ? { ...inputStyle, width: 100, textAlign: 'right' }
                                                        : { ...inputDisabledStyle, width: 100, textAlign: 'right' }
                                                    }
                                                />
                                            </td>

                                            {/* Stock */}
                                            <td style={cellStyle}>
                                                <input
                                                    type="number"
                                                    value={combo.stock ?? ''}
                                                    onChange={(e) => updateCombinationAt(index, {
                                                        stock: e.target.value ? parseInt(e.target.value) : null
                                                    })}
                                                    disabled={!combo.available}
                                                    placeholder="∞"
                                                    style={combo.available
                                                        ? { ...inputStyle, width: 70, textAlign: 'center' }
                                                        : { ...inputDisabledStyle, width: 70, textAlign: 'center' }
                                                    }
                                                />
                                            </td>

                                            {/* Image */}
                                            <td style={cellStyle}>
                                                {combo.image ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <img
                                                            src={combo.image}
                                                            alt={label}
                                                            style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid rgba(16,185,129,0.4)' }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCombinationAt(index, { image: null })}
                                                            style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer' }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (() => {
                                                    const fallback = getComboFallbackImage(combo, variants)
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            {fallback && (
                                                                <img
                                                                    src={fallback}
                                                                    alt={label}
                                                                    title="Image de la variante couleur (fallback)"
                                                                    style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover', opacity: 0.6, border: '1px dashed rgba(245,158,11,0.5)' }}
                                                                />
                                                            )}
                                                            <label
                                                                title="Ajouter une image spécifique pour cette combinaison"
                                                                style={{
                                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                    width: 32, height: 32, borderRadius: 6,
                                                                    background: 'rgba(30, 41, 59, 0.5)',
                                                                    border: '1px dashed rgba(148, 163, 184, 0.3)',
                                                                    color: '#64748b', cursor: 'pointer', fontSize: 16,
                                                                    opacity: isUploading ? 0.6 : 1
                                                                }}
                                                            >
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    style={{ display: 'none' }}
                                                                    disabled={isUploading}
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0]
                                                                        if (file) handleComboImageUpload(index, file)
                                                                    }}
                                                                />
                                                                {isUploading ? '⏳' : '+'}
                                                            </label>
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <p style={{ padding: '10px 16px', fontSize: 12, color: '#475569', borderTop: '1px solid rgba(148,163,184,0.07)' }}>
                        Prix vide = prix par défaut du produit{defaultPrice ? ` (${defaultPrice.toLocaleString('fr-FR')} ${currencySymbol})` : ''} • Stock vide = illimité • Image vide = image variante couleur (si dispo), sinon image principale
                    </p>
                </motion.div>
            )}
        </div>
    )
}
