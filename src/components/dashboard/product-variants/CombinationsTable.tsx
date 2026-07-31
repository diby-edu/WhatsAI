'use client'

import { motion } from 'framer-motion'
import type { ProductCombination, VariantGroup } from './types'
import { MAX_COMBINATIONS, getCombinationLabel, getComboFallbackImage } from './helpers'

interface CombinationsTableProps {
    variants: VariantGroup[]
    combinations?: ProductCombination[] | null
    onCombinationsChange?: (combinations: ProductCombination[] | null) => void
    currencySymbol: string
    defaultPrice?: number
    eligibleForCombinations: boolean
    uploadingComboKey: string | null
    enableCombinations: () => void
    disableCombinations: () => void
    updateCombinationAt: (index: number, updates: Partial<ProductCombination>) => void
    handleComboImageUpload: (index: number, file: File) => Promise<void>
}

export default function CombinationsTable({
    variants,
    combinations,
    onCombinationsChange,
    currencySymbol,
    defaultPrice,
    eligibleForCombinations,
    uploadingComboKey,
    enableCombinations,
    disableCombinations,
    updateCombinationAt,
    handleComboImageUpload,
}: CombinationsTableProps) {
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

    return (
        <>
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
                                                    className="no-spinner"
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
                                                    className="no-spinner"
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
        </>
    )
}
