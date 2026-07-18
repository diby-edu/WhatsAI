import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Package, Plus, Sparkles, Tag, Layers, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { convertToFcfa, convertFromFcfa } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import type { ProductFormData } from '../types'

const ProductVariantsEditor = dynamic(() => import('@/components/dashboard/ProductVariantsEditor'), { ssr: false })

interface Step1DetailsProps {
    formData: ProductFormData
    setFormData: Dispatch<SetStateAction<ProductFormData>>
    getServicePlaceholders: () => { name: string; category: string; descFull: string; content: string; features: string }
    toast: ReturnType<typeof useToast>
    analyzing: boolean
    setAnalyzing: Dispatch<SetStateAction<boolean>>
    analysisResult: any
    setAnalysisResult: Dispatch<SetStateAction<any>>
    currency: string
    contentInput: string
    setContentInput: Dispatch<SetStateAction<string>>
    featureInput: string
    setFeatureInput: Dispatch<SetStateAction<string>>
    addFeature: () => void
    digitalDeliveryType: 'fixed_content' | 'license_keys'
    setDigitalDeliveryType: Dispatch<SetStateAction<'fixed_content' | 'license_keys'>>
    digitalContent: string
    setDigitalContent: Dispatch<SetStateAction<string>>
    existingLicenseKeys: { key: string; used: boolean; order_id: string | null }[]
    licenseKeysInput: string
    setLicenseKeysInput: Dispatch<SetStateAction<string>>
}

export function Step1Details({
    formData,
    setFormData,
    getServicePlaceholders,
    toast,
    analyzing,
    setAnalyzing,
    analysisResult,
    setAnalysisResult,
    currency,
    contentInput,
    setContentInput,
    featureInput,
    setFeatureInput,
    addFeature,
    digitalDeliveryType,
    setDigitalDeliveryType,
    digitalContent,
    setDigitalContent,
    existingLicenseKeys,
    licenseKeysInput,
    setLicenseKeysInput,
}: Step1DetailsProps) {
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            {/* Description with AI Analysis */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="text-emerald-400" /> Description
                </h2>
                <p className="text-sm text-slate-400 mb-3">
                    Décrivez librement votre produit. L'IA extraira automatiquement les informations structurées.
                </p>
                <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder={getServicePlaceholders().descFull}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none min-h-[120px]"
                    maxLength={2000}
                />
                <div className="flex justify-between mt-2">
                    <button
                        type="button"
                        onClick={async () => {
                            if (!formData.description || formData.description.length < 10) {
                                toast.error('Description trop courte (min 10 caractères)')
                                return
                            }
                            setAnalyzing(true)
                            try {
                                const res = await fetch('/api/ai/extract-product-data', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        description: formData.description,
                                        existingData: {
                                            price: convertToFcfa(Number(formData.price) || 0, currency),
                                            features: formData.features,
                                            content_included: formData.content_included,
                                            variants: formData.variants.map((v: any) => ({
                                                ...v,
                                                options: (v.options || []).map((o: any) => ({
                                                    ...o,
                                                    price: o.price ? convertToFcfa(Number(o.price), currency) : 0
                                                }))
                                            }))
                                        }
                                    })
                                })
                                const data = await res.json()
                                if (data.success) {
                                    setAnalysisResult(data.data)
                                    const extracted = data.data.extracted

                                    const receivedVariants = extracted.variants?.length ? extracted.variants : formData.variants;
                                    const variantsInLocal = receivedVariants.map((v: any) => ({
                                        ...v,
                                        options: (v.options || []).map((o: any) => ({
                                            ...o,
                                            price: o.price ? convertFromFcfa(Number(o.price), currency) : 0
                                        }))
                                    }))

                                    setFormData(prev => ({
                                        ...prev,
                                        description: data.data.cleaned_description || prev.description,
                                        price: extracted.price ? convertFromFcfa(extracted.price, currency) : prev.price,
                                        content_included: [...new Set([...prev.content_included, ...(extracted.content_included || [])])],
                                        features: [...new Set([...prev.features, ...(extracted.tags || [])])],
                                        variants: variantsInLocal
                                    }))
                                } else {
                                    toast.error(data.error || "Erreur d'analyse")
                                }
                            } catch (e) {
                                toast.error('Erreur de connexion')
                            } finally {
                                setAnalyzing(false)
                            }
                        }}
                        disabled={analyzing}
                        className="px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/20 text-purple-300 flex items-center gap-2 text-sm"
                    >
                        {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {analyzing ? 'Analyse...' : '🔍 Analyser & Corriger'}
                    </button>
                    <span className="text-xs text-slate-500">{formData.description.length}/500</span>
                </div>
                {analysisResult && (
                    <div className="mt-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <div className="text-sm text-emerald-400">✅ Données extraites et appliquées</div>
                        {analysisResult.warnings?.length > 0 && (
                            <div className="text-xs text-yellow-400 mt-1">⚠️ {analysisResult.warnings.join(', ')}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Content Included */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Package className="text-blue-400" /> Contenu inclus
                </h2>
                <p className="text-sm text-slate-400 mb-3">Listez ce qui est inclus (pour logiciels, packs, etc.)</p>
                <div className="flex gap-2 mb-3 flex-wrap">
                    {formData.content_included.map((c, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm flex items-center gap-2">
                            {c} <X size={14} className="cursor-pointer hover:text-white" onClick={() => setFormData(p => ({ ...p, content_included: p.content_included.filter((_, idx) => idx !== i) }))} />
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        value={contentInput}
                        onChange={e => setContentInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && contentInput.trim()) {
                                setFormData(p => ({ ...p, content_included: [...p.content_included, contentInput.trim()] }))
                                setContentInput('')
                            }
                        }}
                        className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                        placeholder={getServicePlaceholders().content}
                    />
                    <button
                        onClick={() => {
                            if (contentInput.trim()) {
                                setFormData(p => ({ ...p, content_included: [...p.content_included, contentInput.trim()] }))
                                setContentInput('')
                            }
                        }}
                        className="bg-slate-700 p-3 rounded-lg text-white"
                    ><Plus /></button>
                </div>
            </div>

            {/* Features/Tags */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Tag className="text-emerald-400" /> Caractéristiques (Tags)
                </h2>
                <div className="flex gap-2 mb-3 flex-wrap">
                    {formData.features.map((f, i) => (
                        <span key={i} className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm flex items-center gap-2">
                            {f} <X size={14} className="cursor-pointer hover:text-white" onClick={() => setFormData(p => ({ ...p, features: p.features.filter((_, idx) => idx !== i) }))} />
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        value={featureInput}
                        onChange={e => setFeatureInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addFeature()}
                        className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                        placeholder={getServicePlaceholders().features}
                    />
                    <button onClick={addFeature} className="bg-slate-700 p-3 rounded-lg text-white"><Plus /></button>
                </div>
            </div>

            {/* Variants — masqué pour les produits numériques */}
            {formData.product_type !== 'digital' && (
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Layers className="text-blue-400" /> Variantes (Optionnel)
                </h2>
                <ProductVariantsEditor
                    variants={formData.variants}
                    onChange={v => setFormData({ ...formData, variants: v })}
                    currencySymbol={currency}
                    productType={formData.product_type}
                    serviceSubtype={formData.service_subtype}
                    combinations={formData.combinations}
                    onCombinationsChange={c => setFormData({ ...formData, combinations: c })}
                    defaultPrice={formData.price ? parseFloat(String(formData.price)) : undefined}
                />
            </div>
            )}

            {/* Digital Delivery Section */}
            {formData.product_type === 'digital' && (
                <div className="bg-emerald-500/5 p-6 rounded-xl border border-emerald-500/20">
                    <h2 className="text-lg font-bold text-emerald-400 mb-1 flex items-center gap-2">
                        💻 Livraison numérique automatique
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Contenu envoyé automatiquement au client par WhatsApp après le paiement.
                    </p>

                    {/* Mode toggle */}
                    <div className="flex gap-2 mb-4">
                        {[
                            { id: 'fixed_content', label: '📄 Contenu fixe', desc: 'Même lien/texte pour tous' },
                            { id: 'license_keys', label: '🔑 Clés de licence', desc: 'Clé unique par acheteur' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => setDigitalDeliveryType(mode.id as 'fixed_content' | 'license_keys')}
                                className={`flex-1 p-3 rounded-lg text-left transition-all border ${digitalDeliveryType === mode.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-transparent'}`}
                            >
                                <div className="text-sm text-white font-medium">{mode.label}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{mode.desc}</div>
                            </button>
                        ))}
                    </div>

                    {digitalDeliveryType === 'fixed_content' ? (
                        <div>
                            <label className="block text-slate-300 text-sm font-medium mb-2">Lien ou contenu à envoyer</label>
                            <textarea
                                value={digitalContent}
                                onChange={e => setDigitalContent(e.target.value)}
                                placeholder="Ex: https://drive.google.com/file/d/... ou code d'activation XXXX-YYYY-ZZZZ"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none min-h-[80px]"
                            />
                            <p className="text-xs text-slate-500 mt-1">Sera envoyé tel quel à chaque acheteur.</p>
                        </div>
                    ) : (
                        <div>
                            {/* Show existing keys */}
                            {existingLicenseKeys.length > 0 && (
                                <div className="mb-4">
                                    <label className="block text-slate-300 text-sm font-medium mb-2">
                                        Clés existantes ({existingLicenseKeys.filter(k => !k.used).length} disponibles / {existingLicenseKeys.length} total)
                                    </label>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {existingLicenseKeys.map((k, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${k.used ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                <span className={k.used ? 'text-slate-500 line-through' : 'text-slate-300'}>{k.key}</span>
                                                {k.used && <span className="text-slate-600">utilisée</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <label className="block text-slate-300 text-sm font-medium mb-2">Ajouter de nouvelles clés (une par ligne)</label>
                            <textarea
                                value={licenseKeysInput}
                                onChange={e => setLicenseKeysInput(e.target.value)}
                                placeholder={"XXXX-YYYY-ZZZZ-4\nXXXX-YYYY-ZZZZ-5"}
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none min-h-[80px] font-mono text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                {licenseKeysInput.split('\n').filter(k => k.trim()).length} nouvelle(s) clé(s) à ajouter au pool.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    )
}
