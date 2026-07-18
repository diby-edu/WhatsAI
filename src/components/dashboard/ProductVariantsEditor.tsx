'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { VariantCategory, VariantOption, VariantGroup, ProductCombination } from './product-variants/types'
import {
    MAX_VARIANT_GROUPS,
    CATEGORY_DEFAULT_NAMES,
    DEFAULT_CATEGORY_CONFIG,
    DIGITAL_CATEGORY_CONFIG,
    SERVICE_CATEGORY_CONFIGS,
    slugify,
    cartesian,
    getOptionLabel,
    mergeCombinations,
} from './product-variants/helpers'
import VariantGroupEditor from './product-variants/VariantGroupEditor'
import CombinationsTable from './product-variants/CombinationsTable'

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

    // ── Render ──

    return (
        <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 16 }}>
                Variantes & Options
            </h3>

            <AnimatePresence>
                {variants.map(group => (
                    <VariantGroupEditor
                        key={group.id}
                        group={group}
                        categoryConfig={CATEGORY_CONFIG}
                        currencySymbol={currencySymbol}
                        uploadingOptionKey={uploadingOptionKey}
                        updateGroup={updateGroup}
                        removeGroup={removeGroup}
                        addOption={addOption}
                        updateOption={updateOption}
                        removeOption={removeOption}
                        handleImageUpload={handleImageUpload}
                    />
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
            <CombinationsTable
                variants={variants}
                combinations={combinations}
                onCombinationsChange={onCombinationsChange}
                currencySymbol={currencySymbol}
                defaultPrice={defaultPrice}
                eligibleForCombinations={eligibleForCombinations}
                uploadingComboKey={uploadingComboKey}
                enableCombinations={enableCombinations}
                disableCombinations={disableCombinations}
                updateCombinationAt={updateCombinationAt}
                handleComboImageUpload={handleComboImageUpload}
            />
        </div>
    )
}
