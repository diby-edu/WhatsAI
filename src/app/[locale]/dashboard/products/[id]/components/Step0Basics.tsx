import type { Dispatch, SetStateAction, RefObject } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Loader2, Plus, Trash2, X } from 'lucide-react'
import type { ProductFormData } from '../../types'

const RESTAURANT_MENU_SECTIONS = [
    { id: 'starters', label: 'Entrees' },
    { id: 'mains', label: 'Plats principaux' },
    { id: 'extras', label: 'Supplements' },
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
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            {/* Agent Vendeur — determine entierement le type de produit */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <label className="block text-slate-300 font-medium mb-1">Agent Vendeur</label>
                <p className="text-xs text-slate-400 mb-3">Le type de produit se déduit automatiquement de la mission de l'agent choisi.</p>
                <select
                    value={formData.agent_id}
                    onChange={e => selectAgent(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                <p className="text-sm text-slate-500 text-center py-6">
                    Choisissez un agent ci-dessus pour continuer — les champs suivants dépendent de son type.
                </p>
            )}

            {selectedMeta && <>

            {formData.product_type === 'service' && formData.service_subtype === 'restaurant' && (
                <div className="bg-emerald-500/5 p-6 rounded-xl border border-emerald-500/20">
                    <label className="block text-slate-300 font-medium mb-1">Menu restaurant</label>
                    <p className="text-xs text-slate-400 mb-3">
                        Utilise une section canonique pour guider l&apos;IA et ordonner la carte.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-slate-300 font-medium mb-1">Section de menu</label>
                            <select
                                value={formData.menu_section_slug}
                                onChange={e => setFormData({ ...formData, menu_section_slug: e.target.value })}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value="">Choisir une section</option>
                                {RESTAURANT_MENU_SECTIONS.map(section => (
                                    <option key={section.id} value={section.id}>{section.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-300 font-medium mb-1">Ordre dans la carte</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={formData.menu_sort_order}
                                onChange={e => setFormData({ ...formData, menu_sort_order: e.target.value })}
                                placeholder="100"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Multi-Image Gallery */}
                <div className="space-y-4">
                    <label className="block text-slate-300 font-medium">Images du produit ({formData.images.length}/10)</label>
                    <div className="flex flex-wrap gap-3">
                        {/* Existing images */}
                        {formData.images.map((img, index) => (
                            <div key={index} className={`relative w-24 h-24 rounded-xl overflow-hidden ${index === 0 ? 'ring-2 ring-emerald-500' : 'border border-slate-700'}`}>
                                <img src={img} className="w-full h-full object-cover" />
                                {index === 0 && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/90 text-white text-[10px] text-center py-0.5">Principal</div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center"
                                >
                                    <X size={10} color="white" />
                                </button>
                            </div>
                        ))}

                        {/* Add image button */}
                        {formData.images.length < 10 && (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-all"
                            >
                                {uploading ? (
                                    <Loader2 size={20} className="animate-spin text-emerald-400" />
                                ) : (
                                    <>
                                        <Plus size={20} className="text-slate-500" />
                                        <span className="text-[10px] text-slate-500 mt-1">Ajouter</span>
                                    </>
                                )}
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
                    </div>
                    <p className="text-xs text-slate-500">La première image sera l'image principale</p>
                </div>
                {/* Fields */}
                <div className="space-y-5">
                    <div>
                        <label className="block text-slate-300 font-medium mb-1">Nom</label>
                        <input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder={getServicePlaceholders().name}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-300 font-medium mb-1">
                            Prix ({currency === 'XOF' ? 'FCFA' : currency})
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
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
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 pl-10 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-slate-300 font-medium mb-1">Catégorie</label>
                        <input
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            placeholder={getServicePlaceholders().category}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="pt-4 flex justify-between items-center">
                        <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2">
                            <Trash2 size={16} /> Supprimer ce produit
                        </button>
                    </div>
                </div>
            </div>

            </>}
        </motion.div>
    )
}
