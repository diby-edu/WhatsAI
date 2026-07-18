import type { CSSProperties, Dispatch, SetStateAction, RefObject } from 'react'
import { Plus, X, Loader2, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'
import { getManualProductsBlockedReason } from '@/lib/agents/ecommerce-mode'
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
    getDisabledReason: () => string | null
    isProductTypeDisabled: (typeId: string) => boolean
    isProductTypeSoon: (typeId: string) => boolean | undefined | ''
    selectProductType: (nextType: string) => void
    selectServiceSubtype: (subtype: string) => void
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
    getDisabledReason,
    isProductTypeDisabled,
    isProductTypeSoon,
    selectProductType,
    selectServiceSubtype,
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
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Product Type Selection */}
            <div>
                <label style={labelStyle}>Type de produit</label>
                {getDisabledReason() && (
                    <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 8, padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8 }}>
                        {getDisabledReason()}
                    </p>
                )}
                <div className="agent-grid-3">
                    {[
                        { id: 'product', label: '📦 Physique', desc: 'Produit livrable' },
                        { id: 'digital', label: '💻 Numérique', desc: 'Téléchargement' },
                        { id: 'service', label: '🛠️ Service', desc: 'Prestation' }
                    ].map(type => {
                        const isDisabled = isProductTypeDisabled(type.id)
                        const isSoon = isProductTypeSoon(type.id)
                        return (
                            <button
                                key={type.id}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => !isDisabled && selectProductType(type.id)}
                                style={{
                                    padding: 16,
                                    borderRadius: 12,
                                    border: formData.product_type === type.id ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                                    background: formData.product_type === type.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                    textAlign: 'center',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    opacity: isDisabled ? 0.45 : 1,
                                    position: 'relative' as const
                                }}
                            >
                                {isSoon && (
                                    <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700, color: '#64748b', background: 'rgba(100,116,139,0.15)', padding: '2px 6px', borderRadius: 20, letterSpacing: '0.05em' }}>
                                        BIENTÔT
                                    </span>
                                )}
                                <div style={{ fontSize: 18 }}>{type.label}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{type.desc}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* SERVICE SUBTYPE SELECTOR (v2.19) */}
            {
                formData.product_type === 'service' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                    >
                        <label style={labelStyle}>Catégorie de Service (Important pour l'IA)</label>
                        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                            Permet à l'IA de poser les bonnes questions (ex: Restaurat = nb couverts, Hotel = Check-in/out).
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {[
                                { id: 'restaurant', icon: '🍽️', label: 'Restaurant / Bar' },
                                { id: 'hotel', icon: '🏨', label: 'Hôtel / Hébergement' },
                                { id: 'coiffeur', icon: '💇', label: 'Coiffure / Beauté' },
                                { id: 'medecin', icon: '🩺', label: 'Santé / Clinique' },
                                { id: 'formation', icon: '🎓', label: 'Formation / Atelier' },
                                { id: 'event', icon: '🎟️', label: 'Événement' },
                                { id: 'coaching', icon: '🧠', label: 'Coaching / Conseil' },
                                { id: 'rental', icon: '🚗', label: 'Location (Voiture/Mat.)' },
                                { id: 'other', icon: '🧩', label: 'Autre Service' }
                            ].map(sub => (
                                <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => selectServiceSubtype(sub.id)}
                                    style={{
                                        padding: '10px',
                                        borderRadius: 8,
                                        border: formData.service_subtype === sub.id ? '2px solid #a855f7' : '1px solid rgba(148, 163, 184, 0.2)',
                                        background: formData.service_subtype === sub.id ? 'rgba(168, 85, 247, 0.1)' : 'rgba(30, 41, 59, 0.5)',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        color: 'white',
                                        fontSize: 13
                                    }}
                                >
                                    <span style={{ fontSize: 16 }}>{sub.icon}</span>
                                    {sub.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )
            }

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
                        : formData.product_type === 'service' ? 'Nom du Service'
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

            <div>
                <label style={labelStyle}>Agent Vendeur</label>
                <select
                    value={formData.agent_id}
                    onChange={e => {
                        const selectedAgent = agents.find(a => a.id === e.target.value)
                        if (e.target.value) localStorage.setItem('product_last_agent_id', e.target.value)
                        const missionTypeMap: Record<string, string> = {
                            ecommerce_digital: 'digital',
                            ecommerce_physical: 'product',
                        }
                        const autoType = selectedAgent?.mission ? missionTypeMap[selectedAgent.mission] : undefined
                        setFormData({ ...formData, agent_id: e.target.value, ...(autoType ? { product_type: autoType } : {}) })
                    }}
                    style={inputStyle}
                >
                    <option value="">Tous les agents</option>
                    {agents.map(a => (
                        <option key={a.id} value={a.id} disabled={!!getManualProductsBlockedReason(a)}>
                            {a.name}
                            {a.mission === 'support_client' ? ' (Support — KB uniquement)' : ''}
                            {a.mission === 'ecommerce_digital' ? ' (Numérique)' : ''}
                            {a.mission === 'ecommerce_physical' ? ' (Physique)' : ''}
                            {a.mission === 'ecommerce' && a.ecommerce_mode === 'external_sync' ? ' (API externe uniquement)' : ''}
                        </option>
                    ))}
                </select>
                {(() => {
                    const selectedAgent = agents.find(a => a.id === formData.agent_id)
                    const blockedReason = getManualProductsBlockedReason(selectedAgent)
                    if (!blockedReason) return null
                    return (
                        <p style={{ marginTop: 6, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: 8 }}>
                            â›” {blockedReason}
                        </p>
                    )
                })()}
                {formData.agent_id && !getManualProductsBlockedReason(agents.find(a => a.id === formData.agent_id)) && agents.find(a => a.id === formData.agent_id)?.mission === 'support_client' && (
                    <p style={{ marginTop: 6, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: 8 }}>
                        ⛔ Les agents Support Client n'acceptent pas de produits. Utilisez la Base de Connaissances pour cet agent.
                    </p>
                )}
                {!formData.agent_id && agents.length > 1 && (
                    <p style={{ marginTop: 6, fontSize: 12, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.08)', padding: '6px 10px', borderRadius: 8 }}>
                        ⚠️ Ce produit sera proposé par <strong>tous vos agents</strong>. Sélectionnez un agent pour le restreindre.
                    </p>
                )}
            </div>
        </div >
    )
}
