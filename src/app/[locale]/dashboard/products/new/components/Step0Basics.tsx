import type { CSSProperties, Dispatch, SetStateAction, RefObject } from 'react'
import { Plus, X, Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'
import type { ProductFormData } from '../../types'

const RESTAURANT_MENU_SECTIONS = [
    { id: 'starters', label: 'Entrées' },
    { id: 'mains', label: 'Plats principaux' },
    { id: 'extras', label: 'Suppléments' },
    { id: 'desserts', label: 'Desserts' },
    { id: 'drinks', label: 'Boissons' },
]

interface Agent {
    id: string
    name: string
    mission?: string
    ecommerce_mode?: string | null
}

interface BatchItem {
    name: string
    price: string
}

interface Step0BasicsProps {
    formData: ProductFormData
    setFormData: Dispatch<SetStateAction<ProductFormData>>
    labelStyle: CSSProperties
    inputStyle: CSSProperties
    buttonPrimaryStyle: CSSProperties
    featureFlags: Record<string, boolean>
    selectAgent: (agentId: string) => void
    batchMode: boolean
    setBatchMode: Dispatch<SetStateAction<boolean>>
    batchItems: BatchItem[]
    setBatchItems: Dispatch<SetStateAction<BatchItem[]>>
    batchLoading: boolean
    handleSaveBatch: () => void
    agents: Agent[]
    currency: string
    getServicePlaceholders: () => { name: string, desc: string, category: string, descFull: string, content: string, features: string }
    fileInputRef: RefObject<HTMLInputElement | null>
    uploading: boolean
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    removeImage: (index: number) => void
}

export function Step0Basics({
    formData,
    setFormData,
    labelStyle,
    inputStyle,
    buttonPrimaryStyle,
    featureFlags,
    selectAgent,
    batchMode,
    setBatchMode,
    batchItems,
    setBatchItems,
    batchLoading,
    handleSaveBatch,
    agents,
    currency,
    getServicePlaceholders,
    fileInputRef,
    uploading,
    handleImageUpload,
    removeImage,
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
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        background: 'rgba(16, 185, 129, 0.06)'
                    }}
                >
                    <label style={labelStyle}>Menu restaurant</label>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                        Classe cet article dans la bonne rubrique pour que l&apos;IA présente la carte dans l&apos;ordre.
                    </p>
                    <div>
                        <label style={{ ...labelStyle, marginBottom: 6 }}>Rubrique de la carte</label>
                        <select
                            value={formData.menu_section_slug}
                            onChange={e => setFormData({ ...formData, menu_section_slug: e.target.value })}
                            style={inputStyle}
                        >
                            <option value="">Choisir une rubrique</option>
                            {RESTAURANT_MENU_SECTIONS.map(section => (
                                <option key={section.id} value={section.id}>{section.label}</option>
                            ))}
                        </select>
                    </div>
                </motion.div>
            )}

            {/* Mode création en masse (restaurant uniquement) */}
            {formData.product_type === 'service' && formData.service_subtype === 'restaurant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: -8 }}>
                    <button
                        type="button"
                        onClick={() => setBatchMode(v => !v)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            border: batchMode ? '1px solid #10b981' : '1px solid rgba(148,163,184,0.3)',
                            background: batchMode ? 'rgba(16,185,129,0.1)' : 'transparent',
                            color: batchMode ? '#34d399' : '#94a3b8',
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Plus size={13} />
                        {batchMode ? 'Mode ajout multiple activé' : 'Ajouter plusieurs articles en même temps'}
                    </button>
                    {batchMode && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                            Choisissez une rubrique ci-dessus puis remplissez le tableau
                        </span>
                    )}
                </div>
            )}

            {batchMode && formData.product_type === 'service' && formData.service_subtype === 'restaurant' && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(16,185,129,0.25)',
                        background: 'rgba(16,185,129,0.05)',
                    }}
                >
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                        Rubrique : <strong style={{ color: '#34d399' }}>
                            {RESTAURANT_MENU_SECTIONS.find(s => s.id === formData.menu_section_slug)?.label || '— sélectionnez une rubrique —'}
                        </strong>
                        &nbsp;·&nbsp;Agent : <strong style={{ color: '#34d399' }}>
                            {agents.find(a => a.id === formData.agent_id)?.name || 'Tous les agents'}
                        </strong>
                    </div>

                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 40px', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#64748b', paddingLeft: 4 }}>Nom</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Prix ({currency === 'XOF' ? 'FCFA' : currency})</span>
                        <span />
                    </div>

                    {/* Rows */}
                    {batchItems.map((item, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 40px', gap: 8, marginBottom: 8 }}>
                            <input
                                type="text"
                                value={item.name}
                                onChange={e => {
                                    const updated = [...batchItems]
                                    updated[i] = { ...updated[i], name: e.target.value }
                                    setBatchItems(updated)
                                }}
                                placeholder={getServicePlaceholders().name}
                                style={{ ...inputStyle, padding: '9px 12px', fontSize: 13 }}
                            />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={item.price}
                                onChange={e => {
                                    const val = e.target.value
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        const updated = [...batchItems]
                                        updated[i] = { ...updated[i], price: val }
                                        setBatchItems(updated)
                                    }
                                }}
                                placeholder="0"
                                style={{ ...inputStyle, padding: '9px 12px', fontSize: 13 }}
                            />
                            <button
                                type="button"
                                onClick={() => setBatchItems(prev => prev.filter((_, idx) => idx !== i))}
                                style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X size={14} color="#f87171" />
                            </button>
                        </div>
                    ))}

                    {/* Add row */}
                    <button
                        type="button"
                        onClick={() => setBatchItems(prev => [...prev, { name: '', price: '' }])}
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: 8,
                            border: '1px dashed rgba(148,163,184,0.3)',
                            background: 'transparent',
                            color: '#64748b',
                            fontSize: 12,
                            cursor: 'pointer',
                            marginTop: 4,
                            marginBottom: 12,
                        }}
                    >
                        + Ajouter une ligne
                    </button>

                    {/* Save batch */}
                    <button
                        type="button"
                        onClick={handleSaveBatch}
                        disabled={batchLoading}
                        style={{
                            ...buttonPrimaryStyle,
                            width: '100%',
                            justifyContent: 'center',
                            opacity: batchLoading ? 0.7 : 1,
                        }}
                    >
                        {batchLoading
                            ? <><Loader2 size={16} className="animate-spin" /> Enregistrement...</>
                            : <><Check size={16} /> Enregistrer {batchItems.filter(i => i.name.trim()).length} article(s)</>
                        }
                    </button>
                </motion.div>
            )}

            {/* Multi-Image Upload Gallery */}
            <div>
                <label style={labelStyle}>Images du produit ({formData.images.length}/10)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                    {/* Existing images */}
                    {formData.images.map((img, index) => (
                        <div key={index} style={{
                            width: 100,
                            height: 100,
                            borderRadius: 12,
                            overflow: 'hidden',
                            position: 'relative',
                            border: index === 0 ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)'
                        }}>
                            <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {index === 0 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'rgba(16, 185, 129, 0.9)',
                                    fontSize: 9,
                                    textAlign: 'center',
                                    padding: 2,
                                    color: 'white'
                                }}>Principal</div>
                            )}
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
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
                    ))}

                    {/* Add image button */}
                    {formData.images.length < 10 && (
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
                    <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
                </div>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                    La première image sera l'image principale affichée
                </p>
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
                                // Allow empty or numeric values
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

            </>}
        </div >
    )
}
