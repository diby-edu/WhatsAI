'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { VariantCategory, VariantGroup, VariantOption } from './types'
import { CATEGORY_VALUE_SUGGESTIONS, MAX_PHYSICAL_VARIANT_TYPES } from './helpers'
import VariantGroupEditor from './VariantGroupEditor'

// Couleur/Taille/Poids/Pointure sont obligatoires par défaut (le bot les demande au
// client avant de valider la commande). Le badge PRIX FIXE / SUPPLÉMENT dans le
// panneau permet de changer ce réglage au cas par cas.
const PHYSICAL_TABS: { category: VariantCategory; icon: string; label: string; defaultType: 'fixed' | 'additive' }[] = [
    { category: 'visual', icon: '🎨', label: 'Couleur', defaultType: 'fixed' },
    { category: 'size', icon: '📏', label: 'Taille', defaultType: 'fixed' },
    { category: 'weight', icon: '⚖️', label: 'Poids', defaultType: 'fixed' },
    { category: 'shoe_size', icon: '👞', label: 'Pointure', defaultType: 'fixed' },
]

const NEW_TYPE_TAB = '__new_type__'

interface PhysicalVariantsEditorProps {
    variants: VariantGroup[]
    categoryConfig: Record<string, { label: string; icon: any; needsImage: boolean; color: string }>
    currencySymbol: string
    uploadingOptionKey: string | null
    addGroup: (type: 'fixed' | 'additive', category?: VariantCategory) => void
    addCustomVariantType: (name: string, id: string) => void
    updateGroup: (id: string, updates: Partial<VariantGroup>) => void
    removeGroup: (id: string) => void
    addOption: (groupId: string) => void
    addOptionWithValue: (groupId: string, value: string) => void
    updateOption: (groupId: string, index: number, updates: Partial<VariantOption>) => void
    removeOption: (groupId: string, index: number) => void
    handleImageUpload: (groupId: string, optionIndex: number, file: File) => Promise<void>
}

// Les cartes Couleur/Taille/Poids/Pointure restent toujours visibles, plus une carte
// par type ajouté librement, plus la tuile "+ Ajouter un type". Cliquer sur une carte
// affiche son remplissage juste en dessous — un seul panneau à la fois, rien n'est
// perdu en changeant d'onglet (chaque groupe reste dans `variants`).
export default function PhysicalVariantsEditor({
    variants,
    categoryConfig,
    currencySymbol,
    uploadingOptionKey,
    addGroup,
    addCustomVariantType,
    updateGroup,
    removeGroup,
    addOption,
    addOptionWithValue,
    updateOption,
    removeOption,
    handleImageUpload,
}: PhysicalVariantsEditorProps) {
    // Clé d'onglet actif : soit une catégorie fixe ('visual', 'size'...), soit l'id
    // stable du groupe pour un type ajouté (pas son nom, qui peut être modifié ensuite),
    // soit NEW_TYPE_TAB pour le formulaire de création.
    const [activeTab, setActiveTab] = useState<string | null>(null)
    const [newTypeName, setNewTypeName] = useState('')

    const customGroups = variants.filter(g => g.category === 'custom')
    const atCap = variants.length >= MAX_PHYSICAL_VARIANT_TYPES
    const isPresetCategory = (key: string) => PHYSICAL_TABS.some(t => t.category === key)

    const presetGroupFor = (category: VariantCategory) => variants.find(g => g.category === category)

    const selectPreset = (category: VariantCategory) => {
        const existing = presetGroupFor(category)
        if (!existing && atCap) return
        setActiveTab(category)
        if (!existing) {
            const defaultType = PHYSICAL_TABS.find(t => t.category === category)?.defaultType || 'fixed'
            addGroup(defaultType, category)
        }
    }

    const submitNewType = () => {
        const trimmed = newTypeName.trim()
        if (!trimmed || atCap) return
        const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        addCustomVariantType(trimmed, newId)
        setActiveTab(newId)
        setNewTypeName('')
    }

    const activeGroup = (() => {
        if (!activeTab || activeTab === NEW_TYPE_TAB) return undefined
        if (isPresetCategory(activeTab)) return presetGroupFor(activeTab as VariantCategory)
        return variants.find(g => g.id === activeTab)
    })()

    return (
        <div>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 10 }}>
                Type de variante
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PHYSICAL_TABS.map(tab => {
                    const group = presetGroupFor(tab.category)
                    const filled = !!group && group.options.length > 0
                    const isActive = activeTab === tab.category
                    return (
                        <button
                            type="button"
                            key={tab.category}
                            onClick={() => selectPreset(tab.category)}
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

                {customGroups.map(group => {
                    const filled = group.options.length > 0
                    const isActive = activeTab === group.id
                    return (
                        <button
                            type="button"
                            key={group.id}
                            onClick={() => setActiveTab(group.id)}
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
                            <div style={{ fontSize: 22, lineHeight: 1, margin: '0 auto 6px' }}>🏷️</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#e2e8f0' : '#cbd5e1' }}>
                                {group.customName}
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

                {!atCap && (
                    <button
                        type="button"
                        onClick={() => setActiveTab(NEW_TYPE_TAB)}
                        style={{
                            position: 'relative',
                            background: activeTab === NEW_TYPE_TAB ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            border: `1.5px dashed ${activeTab === NEW_TYPE_TAB ? '#10b981' : 'rgba(148, 163, 184, 0.3)'}`,
                            borderRadius: 12,
                            padding: '16px 10px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Plus size={22} style={{ marginBottom: 6, color: '#94a3b8' }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                            Ajouter un type
                        </div>
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === NEW_TYPE_TAB && (
                    <motion.div
                        key="new-type-form"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                            marginTop: 14,
                            background: 'rgba(30, 41, 59, 0.3)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 12,
                            padding: 16,
                        }}
                    >
                        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                            Nom du nouveau type de variante (ex: Matière, Modèle...)
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                autoFocus
                                value={newTypeName}
                                onChange={e => setNewTypeName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitNewType() }}
                                placeholder="Matière"
                                style={{
                                    flex: 1,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.2)',
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    color: 'white',
                                    fontSize: 14,
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={submitNewType}
                                disabled={!newTypeName.trim()}
                                style={{
                                    padding: '10px 16px', borderRadius: 8,
                                    background: newTypeName.trim() ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.1)',
                                    border: `1px solid ${newTypeName.trim() ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.2)'}`,
                                    color: newTypeName.trim() ? '#10b981' : '#64748b',
                                    fontSize: 13, fontWeight: 600,
                                    cursor: newTypeName.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Créer
                            </button>
                        </div>
                    </motion.div>
                )}

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
