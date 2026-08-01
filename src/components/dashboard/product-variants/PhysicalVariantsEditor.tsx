'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { VariantCategory, VariantGroup, VariantOption } from './types'
import { CATEGORY_VALUE_SUGGESTIONS } from './helpers'
import VariantGroupEditor from './VariantGroupEditor'

// Couleur/Taille/Poids sont obligatoires par défaut (le bot les demande au client
// avant de valider la commande) ; Autre reste un supplément optionnel par défaut.
// Le badge PRIX FIXE / SUPPLÉMENT dans le panneau permet de changer ce réglage.
const PHYSICAL_TABS: { category: VariantCategory; icon: string; label: string; defaultType: 'fixed' | 'additive' }[] = [
    { category: 'visual', icon: '🎨', label: 'Couleur', defaultType: 'fixed' },
    { category: 'size', icon: '📏', label: 'Taille', defaultType: 'fixed' },
    { category: 'weight', icon: '⚖️', label: 'Poids', defaultType: 'fixed' },
    { category: 'custom', icon: '✨', label: 'Autre', defaultType: 'additive' },
]

interface PhysicalVariantsEditorProps {
    variants: VariantGroup[]
    categoryConfig: Record<string, { label: string; icon: any; needsImage: boolean; color: string }>
    currencySymbol: string
    uploadingOptionKey: string | null
    addGroup: (type: 'fixed' | 'additive', category?: VariantCategory) => void
    updateGroup: (id: string, updates: Partial<VariantGroup>) => void
    removeGroup: (id: string) => void
    addOption: (groupId: string) => void
    addOptionWithValue: (groupId: string, value: string) => void
    updateOption: (groupId: string, index: number, updates: Partial<VariantOption>) => void
    removeOption: (groupId: string, index: number) => void
    handleImageUpload: (groupId: string, optionIndex: number, file: File) => Promise<void>
}

// Les 4 cartes restent toujours visibles. Cliquer sur l'une affiche son
// remplissage juste en dessous — un seul panneau à la fois, rien n'est perdu
// en changeant d'onglet (chaque groupe reste dans `variants`).
export default function PhysicalVariantsEditor({
    variants,
    categoryConfig,
    currencySymbol,
    uploadingOptionKey,
    addGroup,
    updateGroup,
    removeGroup,
    addOption,
    addOptionWithValue,
    updateOption,
    removeOption,
    handleImageUpload,
}: PhysicalVariantsEditorProps) {
    const [activeTab, setActiveTab] = useState<VariantCategory | null>(null)

    const groupFor = (category: VariantCategory) => variants.find(g => g.category === category)

    const selectTab = (category: VariantCategory) => {
        setActiveTab(category)
        if (!groupFor(category)) {
            const defaultType = PHYSICAL_TABS.find(t => t.category === category)?.defaultType || 'additive'
            addGroup(defaultType, category)
        }
    }

    const activeGroup = activeTab ? groupFor(activeTab) : undefined

    return (
        <div>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 10 }}>
                Type de variante
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PHYSICAL_TABS.map(tab => {
                    const group = groupFor(tab.category)
                    const filled = !!group && group.options.length > 0
                    const isActive = activeTab === tab.category
                    return (
                        <button
                            type="button"
                            key={tab.category}
                            onClick={() => selectTab(tab.category)}
                            style={{
                                position: 'relative',
                                background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.4)',
                                border: `1.5px solid ${isActive ? '#10b981' : 'rgba(148, 163, 184, 0.15)'}`,
                                borderRadius: 12,
                                padding: '16px 10px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{ fontSize: 22, lineHeight: 1, margin: '0 auto 6px' }}>{tab.icon}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#e2e8f0' : '#cbd5e1' }}>
                                {tab.label}
                            </div>
                            {filled && (
                                <span style={{
                                    position: 'absolute', top: 8, right: 8,
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: '#34d399', boxShadow: '0 0 0 3px rgba(52, 211, 153, 0.18)'
                                }} />
                            )}
                        </button>
                    )
                })}
            </div>

            <AnimatePresence mode="wait">
                {activeGroup && (
                    <motion.div
                        key={activeGroup.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ marginTop: 14 }}
                    >
                        <VariantGroupEditor
                            group={activeGroup}
                            categoryConfig={categoryConfig}
                            currencySymbol={currencySymbol}
                            uploadingOptionKey={uploadingOptionKey}
                            updateGroup={updateGroup}
                            removeGroup={(id) => { removeGroup(id); setActiveTab(null) }}
                            addOption={addOption}
                            updateOption={updateOption}
                            removeOption={removeOption}
                            handleImageUpload={handleImageUpload}
                            hideCategorySelector
                            suggestedValues={CATEGORY_VALUE_SUGGESTIONS[activeTab as string] || []}
                            onAddSuggestedValue={addOptionWithValue}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
