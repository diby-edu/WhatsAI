import type { CSSProperties, Dispatch, SetStateAction, RefObject } from 'react'
import { DollarSign, Loader2, Plus, Trash2, X } from 'lucide-react'
import type { ProductFormData } from '../../types'

const RESTAURANT_MENU_SECTIONS = [
    { id: 'starters', label: 'Entrées' },
    { id: 'mains', label: 'Plats principaux' },
    { id: 'extras', label: 'Suppléments' },
    { id: 'desserts', label: 'Desserts' },
    { id: 'drinks', label: 'Boissons' },
    { id: 'other', label: 'Autre section' }
]

interface Agent {
    id: string
    name: string
    mission?: string
    ecommerce_mode?: string | null
}

interface Step0BasicsProps {
    formData: ProductFormData
    setFormData: Dispatch<SetStateAction<ProductFormData>>
    labelStyle: CSSProperties
    inputStyle: CSSProperties
    featureFlags: Record<string, boolean>
    selectAgent: (agentId: string) => void
    getServicePlaceholders: () => { name: string; category: string; descFull: string; content: string; features: string }
    fileInputRef: RefObject<HTMLInputElement | null>
    uploading: boolean
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    removeImage: (index: number) => void
    currency: string
    agents: Agent[]
    handleDelete: () => void
}

export function Step0Basics({
    formData,
    setFormData,
    labelStyle,
    inputStyle,
    featureFlags,
    selectAgent,
    getServicePlaceholders,
    fileInputRef,
    uploading,
    handleImageUpload,
    removeImage,
    currency,
    agents,
    handleDelete,
}: Step0BasicsProps) {
    const MISSION_TYPE_META: Record<string, { label: string; icon: string; flagKey: string }> = {
        ecommerce_physical: { label: 'Physique', icon: '📦', flagKey: 'product_physical' },
        ecommerce_digital: { label: 'Numérique', icon: '💻', flagKey: 'product_digital' },
        restaurant: { label: 'Restaurant / Bar', icon: '🍽️', flagKey: 'product_service' },
        hotel: { label: 'Hôtel / Hébergement', icon: '🏨', flagKey: 'product_service' },
    }
    const sellableAgents = agents.filter(a => a.mission && MISSION_TYPE_META[a.mission])
    const selectedAgent = agents.find(a => a.id === formData.agent_id)
    const selectedMeta = selectedAgent?.mission ? MISSION_TYPE_META[selectedAgent.mission] : null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Agent Vendeur — determine entierement le type de produit */}
            <div>
                <label style={labelStyle}>Agent Vendeur</label>
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                    Le type de produit se déduit automatiquement de la mission de l'agent choisi.
                </p>
                <select
                    value={formData.agent_id}
                    onChange={e => selectAgent(e.target.value)}
                    style={inputStyle}
                >
                    <option value="">— Choisir un agent —</option>
                    {sellableAgents.map(a => {
                        const meta = MISSION_TYPE_META[a.mission!]
                        const isSoon = Object.keys(featureFlags).length > 0 && featureFlags[meta.flagKey] === false
                        return (
                            <option key={a.id} value={a.id} disabled={isSoon}>
                                {a.name} — {meta.label}{isSoon ? ' (bientôt disponible)' : ''}
                            </option>
                        )
                    })}
                </select>
                {sellableAgents.length === 0 && (
                    <p style={{ marginTop: 6, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: 8 }}>
                        ⛔ Aucun agent Physique, Numérique, Restaurant ou Hôtel pour le moment. Créez-en un d'abord.
                    </p>
                )}
                {selectedMeta && (
                    <p style={{ marginTop: 6, fontSize: 12, color: '#6ee7b7', background: 'rgba(16,185,129,0.08)', padding: '6px 10px', borderRadius: 8 }}>
                        {selectedMeta.icon} Type de produit : <strong>{selectedMeta.label}</strong>
                    </p>
                )}
            </div>

            {!selectedMeta && (
                <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
                    Choisissez un agent ci-dessus pour continuer — les champs suivants dépendent de son type.
                </p>
            )}

            {selectedMeta && <>

            {formData.product_type === 'service' && formData.service_subtype === 'restaurant' && (
                <div style={{
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    background: 'rgba(16, 185, 129, 0.06)'
                }}>
                    <label style={labelStyle}>Menu restaurant</label>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                        Utilise une section canonique pour guider l&apos;IA et ordonner la carte.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ ...labelStyle, marginBottom: 6 }}>Section de menu</label>
                            <select
                                value={formData.menu_section_slug}
                                onChange={e => setFormData({ ...formData, menu_section_slug: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">Choisir une section</option>
                                {RESTAURANT_MENU_SECTIONS.map(section => (
                                    <option key={section.id} value={section.id}>{section.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ ...labelStyle, marginBottom: 6 }}>Ordre dans la carte</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={formData.menu_sort_order}
                                onChange={e => setFormData({ ...formData, menu_sort_order: e.target.value })}
                                placeholder="100"
                                style={inputStyle}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Image du produit (une seule — c'est la seule que le bot utilise) */}
            <div>
                <label style={labelStyle}>Image du produit</label>
                <div style={{ display: 'flex', marginTop: 8 }}>
                    {formData.images.length > 0 ? (
                        <div style={{
                            width: 100,
                            height: 100,
                            borderRadius: 12,
                            overflow: 'hidden',
                            position: 'relative',
                            border: '1px solid rgba(148, 163, 184, 0.2)'
                        }}>
                            <img src={formData.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                                type="button"
                                onClick={() => removeImage(0)}
                                style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: 'rgba(239, 68, 68, 0.9)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={12} color="white" />
                            </button>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: 100,
                                height: 100,
                                borderRadius: 12,
                                border: '2px dashed rgba(148, 163, 184, 0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                background: 'rgba(30, 41, 59, 0.5)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {uploading ? (
                                <Loader2 size={24} className="animate-spin text-emerald-500" />
                            ) : (
                                <>
                                    <Plus size={24} color="#64748b" />
                                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Ajouter</div>
                                </>
                            )}
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>
            </div>

            <div>
                <label style={labelStyle}>
                    {formData.product_type === 'service' && formData.service_subtype === 'restaurant'
                        ? (formData.menu_section_slug === 'drinks' ? 'Nom de la boisson'
                            : formData.menu_section_slug ? 'Nom du plat'
                            : 'Nom du plat ou de la boisson')
                        : formData.product_type === 'service' && formData.service_subtype === 'hotel' ? 'Nom de la chambre / formule'
                        : formData.product_type === 'digital' ? 'Nom du Produit Numérique' : 'Nom du Produit'}
                </label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={getServicePlaceholders().name}
                    style={inputStyle}
                />
            </div>

            <div className="agent-grid-2">
                <div>
                    <label style={labelStyle}>Prix ({currency === 'XOF' ? 'FCFA' : currency})</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={formData.price}
                            onChange={e => {
                                const val = e.target.value
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    setFormData({ ...formData, price: val === '' ? '' : val })
                                }
                            }}
                            placeholder="0"
                            style={inputStyle}
                        />
                        <DollarSign size={14} style={{ position: 'absolute', right: 12, top: 14, color: '#64748b' }} />
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Catégorie</label>
                    <input
                        type="text"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        placeholder={getServicePlaceholders().category}
                        style={inputStyle}
                    />
                </div>
            </div>

            <div style={{ paddingTop: 8, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <button
                    type="button"
                    onClick={handleDelete}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: 0,
                        marginTop: 8
                    }}
                >
                    <Trash2 size={16} /> Supprimer ce produit
                </button>
            </div>

            </>}
        </div>
    )
}
