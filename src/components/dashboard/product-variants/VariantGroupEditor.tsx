'use client'

import { useState } from 'react'
import { Plus, X, Trash2, ImageIcon, Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import type { VariantCategory, VariantGroup, VariantOption } from './types'
import { CATEGORY_DEFAULT_NAMES } from './helpers'

interface VariantGroupEditorProps {
    group: VariantGroup
    categoryConfig: Record<string, { label: string; icon: any; needsImage: boolean; color: string }>
    currencySymbol: string
    uploadingOptionKey: string | null
    updateGroup: (id: string, updates: Partial<VariantGroup>) => void
    removeGroup: (id: string) => void
    addOption: (groupId: string) => void
    updateOption: (groupId: string, index: number, updates: Partial<VariantOption>) => void
    removeOption: (groupId: string, index: number) => void
    handleImageUpload: (groupId: string, optionIndex: number, file: File) => Promise<void>
    // Masque le sélecteur de catégorie — utilisé quand la catégorie est déjà fixée par un onglet parent (PhysicalVariantsEditor)
    hideCategorySelector?: boolean
    // Puces de valeurs suggérées + ligne "prix pour toutes les valeurs" — opt-in pour ne pas changer l'UI service/digital
    suggestedValues?: string[]
    onAddSuggestedValue?: (groupId: string, value: string) => void
}

export default function VariantGroupEditor({
    group,
    categoryConfig,
    currencySymbol,
    uploadingOptionKey,
    updateGroup,
    removeGroup,
    addOption,
    updateOption,
    removeOption,
    handleImageUpload,
    hideCategorySelector,
    suggestedValues,
    onAddSuggestedValue,
}: VariantGroupEditorProps) {
    const [basePrice, setBasePrice] = useState('')
    const [addingCustomValue, setAddingCustomValue] = useState(false)
    const [customValueName, setCustomValueName] = useState('')
    const showBulkTools = !!onAddSuggestedValue

    const confirmCustomValue = () => {
        const trimmed = customValueName.trim()
        if (trimmed) onAddSuggestedValue?.(group.id, trimmed)
        setCustomValueName('')
        setAddingCustomValue(false)
    }
    return (
        <motion.div
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
                    {/* Produits physiques : pas de notion de supplément, toutes les variantes sont
                        obligatoires — le badge fixe/additif n'a de sens que pour service/digital. */}
                    {!hideCategorySelector && (
                        <button
                            type="button"
                            onClick={() => updateGroup(group.id, { type: group.type === 'fixed' ? 'additive' : 'fixed' })}
                            title="Cliquer pour changer"
                            style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                background: group.type === 'fixed' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                                color: group.type === 'fixed' ? '#60a5fa' : '#c084fc',
                                border: `1px solid ${group.type === 'fixed' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                                cursor: 'pointer'
                            }}
                        >
                            {group.type === 'fixed' ? 'PRIX FIXE' : 'SUPPLÉMENT'}
                        </button>
                    )}
                    {hideCategorySelector ? (
                        // Nom verrouillé : pour les cartes physiques (Couleur/Taille/Poids/Pointure),
                        // le nom doit rester cohérent avec la catégorie. Un type ajouté se renomme
                        // via le champ "Nom personnalisé" ci-dessous.
                        <span style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>
                            {group.category === 'custom' ? (group.customName || group.name) : group.name}
                        </span>
                    ) : (
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
                    )}
                </div>
                <button
                    onClick={() => removeGroup(group.id)}
                    style={{ padding: 6, borderRadius: 6, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer' }}
                >
                    <Trash2 size={16} />
                </button>
            </div>
            {hideCategorySelector && (
                <p style={{ margin: '-6px 0 12px', fontSize: 11, color: '#64748b' }}>
                    Le client doit choisir une valeur avant de commander.
                </p>
            )}

            {/* Category Selector */}
            <div style={{ marginBottom: 16 }}>
                {!hideCategorySelector && (
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
                        {Object.entries(categoryConfig).map(([key, config]) => (
                            <option key={key} value={key} style={{ background: '#1e293b' }}>
                                {config.label}
                            </option>
                        ))}
                    </select>
                )}
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
                {categoryConfig[group.category || 'custom']?.needsImage && group.category !== 'custom' && (
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

            {/* Prix par défaut — ne remplit que les valeurs dont le prix est encore vide,
                ne touche jamais à un prix déjà renseigné manuellement. */}
            {showBulkTools && group.options.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        Prix par défaut :
                    </label>
                    <input
                        type="number"
                        className="no-spinner"
                        value={basePrice}
                        onChange={(e) => setBasePrice(e.target.value)}
                        placeholder="5000"
                        style={{
                            flex: 1, maxWidth: 120,
                            background: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 8, padding: '6px 10px',
                            color: 'white', fontSize: 13, outline: 'none'
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (!basePrice) return
                            const price = parseFloat(basePrice) || 0
                            group.options.forEach((opt, idx) => {
                                if (!opt.price) updateOption(group.id, idx, { price })
                            })
                        }}
                        style={{
                            padding: '6px 12px', borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                        }}
                    >
                        Remplir les valeurs vides
                    </button>
                </div>
            )}
            {showBulkTools && group.options.length > 0 && (
                <p style={{ margin: '0 0 12px', fontSize: 11, color: '#64748b' }}>
                    Ne remplit que les valeurs sans prix — celles déjà renseignées ne sont pas modifiées.
                </p>
            )}

            {/* Valeurs suggérées + puce "+ Autre" pour un nom libre — meme mecanisme pour tous
                les types, avec ou sans suggestions (ex: un type ajoute n'en a aucune). */}
            {showBulkTools && (() => {
                const remaining = (suggestedValues || []).filter(s => !group.options.some(o => o.value === s))
                return (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Valeurs suggérées
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {remaining.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => onAddSuggestedValue?.(group.id, s)}
                                    style={{
                                        padding: '5px 10px', borderRadius: 8,
                                        background: 'rgba(148, 163, 184, 0.08)',
                                        border: '1px dashed rgba(148, 163, 184, 0.3)',
                                        color: '#cbd5e1', fontSize: 12, cursor: 'pointer'
                                    }}
                                >
                                    + {s}
                                </button>
                            ))}
                            {addingCustomValue ? (
                                <span style={{ display: 'inline-flex', gap: 4 }}>
                                    <input
                                        autoFocus
                                        value={customValueName}
                                        onChange={(e) => setCustomValueName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmCustomValue()
                                            if (e.key === 'Escape') { setAddingCustomValue(false); setCustomValueName('') }
                                        }}
                                        placeholder="Nom"
                                        style={{
                                            width: 100, padding: '5px 8px', borderRadius: 8,
                                            background: 'rgba(30, 41, 59, 0.5)',
                                            border: '1px solid rgba(148, 163, 184, 0.3)',
                                            color: 'white', fontSize: 12, outline: 'none'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={confirmCustomValue}
                                        disabled={!customValueName.trim()}
                                        style={{
                                            padding: '5px 10px', borderRadius: 8,
                                            background: customValueName.trim() ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.1)',
                                            border: `1px solid ${customValueName.trim() ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.2)'}`,
                                            color: customValueName.trim() ? '#10b981' : '#64748b',
                                            fontSize: 12, cursor: customValueName.trim() ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        OK
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAddingCustomValue(true)}
                                    style={{
                                        padding: '5px 10px', borderRadius: 8,
                                        background: 'transparent',
                                        border: '1px dashed rgba(148, 163, 184, 0.4)',
                                        color: '#94a3b8', fontSize: 12, cursor: 'pointer'
                                    }}
                                >
                                    + Autre
                                </button>
                            )}
                        </div>
                    </div>
                )
            })()}

            {/* Options List */}
            <div style={{ display: 'grid', gap: 12 }}>
                {group.options.map((option, idx) => {
                    const needsImage = categoryConfig[group.category || 'custom']?.needsImage
                    const isUploading = uploadingOptionKey === `${group.id}-${idx}`

                    return (
                        <div key={idx} style={{
                            background: 'rgba(15, 23, 42, 0.3)',
                            borderRadius: 10,
                            padding: 12
                        }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {hideCategorySelector ? (
                                    // Nom verrouillé : choisi via suggestion ou "+ Autre", jamais retapable
                                    // pour éviter tout risque de désync avec ce qui a été proposé/validé.
                                    <span style={{
                                        flex: 1,
                                        padding: '10px 14px',
                                        color: 'white',
                                        fontSize: 14,
                                    }}>
                                        {option.value}
                                    </span>
                                ) : (
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
                                )}
                                <div style={{ position: 'relative', width: 120 }}>
                                    <input
                                        type="number"
                                        className="no-spinner"
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
                {/* Produits physiques : l'ajout se fait via les puces "Valeurs suggérées" / "+ Autre"
                    ci-dessus, pas ici — évite un deuxième mécanisme d'ajout redondant. */}
                {!hideCategorySelector && (
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
                )}
            </div>
        </motion.div>
    )
}
