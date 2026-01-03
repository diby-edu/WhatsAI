'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    Upload,
    X,
    Package,
    FileText,
    DollarSign,
    Users,
    ImageIcon,
    Plus,
    Trash2,
    Bot,
    Sparkles,
    Tag,
    List,
    Layers,
    ChevronRight,
    ChevronLeft,
    Save
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import ProductVariantsEditor, { VariantGroup } from '@/components/dashboard/ProductVariantsEditor'

const STEPS = [
    { id: 'basics', title: 'Identité & Prix', icon: Package },
    { id: 'details', title: 'Détails & Variantes', icon: Layers },
    { id: 'strategy', title: 'Stratégie IA', icon: Bot }
]

interface Agent {
    id: string
    name: string
}

export default function NewProductPage() {
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<Agent[]>([])
    const [currency, setCurrency] = useState('USD')

    // Form Data
    const [formData, setFormData] = useState({
        // Basics
        name: '',
        price_fcfa: 0,
        image_url: '',
        category: '',
        is_available: true,
        agent_id: '',

        // Details
        short_pitch: '', // Hook (max 150 chars)
        description: '', // Full description
        features: [] as string[], // Tags list
        variants: [] as VariantGroup[],

        // Strategy
        marketing_tags: [] as string[], // Selling points
        related_product_ids: [] as string[], // Cross sell

        // Legacy/Defaults
        product_type: 'product',
        stock_quantity: -1,
        lead_fields: []
    })

    // Local state for tag inputs
    const [featureInput, setFeatureInput] = useState('')
    const [marketingInput, setMarketingInput] = useState('')

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        loadAgents()
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            if (data.data?.profile?.currency) setCurrency(data.data.profile.currency)
        } catch (e) { }
    }

    const loadAgents = async () => {
        try {
            const { data } = await supabase.from('agents').select('id, name')
            if (data) setAgents(data)
        } catch (e) { }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        setUploading(true)
        try {
            const file = e.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('files')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: publicUrl } = supabase.storage
                .from('files')
                .getPublicUrl(filePath)

            setFormData({ ...formData, image_url: publicUrl.publicUrl })
        } catch (error) {
            alert('Erreur upload')
        } finally {
            setUploading(false)
        }
    }

    const addFeature = () => {
        if (featureInput.trim()) {
            setFormData(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }))
            setFeatureInput('')
        }
    }

    const addMarketingTag = (tag: string) => {
        if (!formData.marketing_tags.includes(tag)) {
            setFormData(prev => ({ ...prev, marketing_tags: [...prev.marketing_tags, tag] }))
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (!res.ok) throw new Error('Failed')

            alert('Produit créé avec succès !')
            router.push('/dashboard/products')
        } catch (error) {
            alert('Erreur lors de la création')
        } finally {
            setLoading(false)
        }
    }

    // --- RENDER STEPS ---
    const renderStep = () => {
        switch (currentStep) {
            case 0: // BASICS
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Image Upload */}
                            <div className="space-y-4">
                                <label className="block text-slate-300 font-medium">Image du Produit</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                        aspect-square rounded-2xl border-2 border-dashed border-slate-700 
                                        bg-slate-800/50 flex flex-col items-center justify-center cursor-pointer 
                                        hover:border-emerald-500 hover:bg-slate-800 transition-all group overflow-hidden relative
                                    `}
                                >
                                    {formData.image_url ? (
                                        <img src={formData.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <div className="bg-slate-900 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                                {uploading ? <Loader2 className="animate-spin text-emerald-400" /> : <ImageIcon className="text-slate-400 group-hover:text-emerald-400" size={32} />}
                                            </div>
                                            <p className="text-slate-400 text-sm group-hover:text-white">Cliquez pour ajouter une image</p>
                                        </>
                                    )}
                                    <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                                </div>
                            </div>

                            {/* Basic Fields */}
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Nom du Produit</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Ex: Bougie Vanille Royal"
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Prix ({currency})</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="number"
                                            value={formData.price_fcfa}
                                            onChange={e => setFormData({ ...formData, price_fcfa: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 pl-10 text-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Catégorie</label>
                                    <input
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Ex: Maison, Beauté..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Agent Responsable</label>
                                    <select
                                        value={formData.agent_id}
                                        onChange={e => setFormData({ ...formData, agent_id: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="">Tous les agents</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 1: // DETAILS (Pitch + Features + Variants)
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        {/* Pitch & Features */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Sparkles className="text-emerald-400" /> Présentation & Caractéristiques
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Pitch Commercial "Punchy" (Max 150 car.)</label>
                                    <input
                                        value={formData.short_pitch}
                                        onChange={e => setFormData({ ...formData, short_pitch: e.target.value })}
                                        maxLength={150}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="Ex: La touche d'élégance ultime pour votre salon."
                                    />
                                    <p className="text-right text-xs text-slate-500">{formData.short_pitch.length}/150</p>
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-medium mb-2">Caractéristiques Techniques (Tags)</label>
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
                                            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Ajouter une caractéristique (ex: 100% Coton) + Entrée"
                                        />
                                        <button onClick={addFeature} className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg"><Plus /></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Variants Editor (Reused Component) */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Layers className="text-blue-400" /> Variantes & Options
                            </h2>
                            <p className="text-slate-400 text-sm mb-4">Si vous vendez des variantes (Tailles, Couleurs, Parfums...), ajoutez-les ici. Le bot demandera OBLIGATOIREMENT au client de choisir.</p>

                            <ProductVariantsEditor
                                variants={formData.variants}
                                onChange={v => setFormData({ ...formData, variants: v })}
                                currency={currency}
                            />
                        </div>
                    </motion.div>
                )

            case 2: // STRATEGY (AI Tags + Cross Sell)
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Bot className="text-purple-400" /> Stratégie de Vente IA
                            </h2>
                            <p className="text-slate-400 text-sm mb-6">Aidez l'IA à mieux vendre ce produit en lui donnant des arguments clés.</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-3">Arguments Marketing (Tags)</label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {['Meilleure Vente', 'Nouveauté', 'Promo', 'Bio', 'Artisanal', 'Luxe', 'Garantie 2 ans', 'Livraison Rapide'].map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => addMarketingTag(tag)}
                                                className={`px-3 py-1 rounded-full text-sm border transition-all ${formData.marketing_tags.includes(tag) ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 flex-wrap bg-slate-900/30 p-4 rounded-lg min-h-[50px]">
                                        {formData.marketing_tags.length === 0 && <span className="text-slate-500 text-sm italic">Aucun argument sélectionné</span>}
                                        {formData.marketing_tags.map((tag, i) => (
                                            <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2">
                                                {tag} <X size={14} className="cursor-pointer hover:text-white" onClick={() => setFormData(p => ({ ...p, marketing_tags: p.marketing_tags.filter((_, idx) => idx !== i) }))} />
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Cross-Sell (Produits Associés)</label>
                                    <p className="text-xs text-slate-500 mb-2">L'IA proposera ces produits si le client achète celui-ci.</p>
                                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-2">
                                        <p className="text-slate-500 italic text-sm text-center">Sélection des produits (Bientôt disponible - Nécessite une recherche dynamique)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 pb-20">
            {/* Top Bar */}
            <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/products" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Ajouter un Produit</h1>
                            <p className="text-xs text-slate-400">{STEPS[currentStep].title}</p>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="max-w-4xl mx-auto px-4 mt-2 mb-0">
                    <div className="flex justify-between items-center relative">
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -z-0 rounded-full"></div>
                        <div
                            className="absolute top-1/2 left-0 h-1 bg-emerald-500/50 -z-0 rounded-full transition-all duration-300"
                            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                        ></div>

                        {STEPS.map((step, index) => {
                            const isActive = index === currentStep
                            const isCompleted = index < currentStep
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setCurrentStep(index)}
                                    className={`relative z-10 flex flex-col items-center gap-2 group focus:outline-none`}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                        ${isActive ? 'bg-slate-900 border-emerald-400 text-emerald-400 scale-110 shadow-[0_0_15px_rgba(52,211,153,0.3)]' :
                                            isCompleted ? 'bg-emerald-500 border-emerald-500 text-slate-900' :
                                                'bg-slate-800 border-slate-700 text-slate-500 group-hover:border-slate-500'}
                                    `}>
                                        <step.icon size={18} />
                                    </div>
                                    <span className={`text-xs font-medium transition-colors ${isActive ? 'text-emerald-400' : isCompleted ? 'text-emerald-500/70' : 'text-slate-600'}`}>
                                        {step.title}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-4 py-8">
                {renderStep()}
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 z-20">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button
                        onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                        disabled={currentStep === 0}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                        <ChevronLeft size={20} /> Précédent
                    </button>

                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                            className="px-6 py-3 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                        >
                            Suivant <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Check size={20} />} Créer le Produit
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
