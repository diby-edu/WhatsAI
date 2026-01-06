'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    Check,
    Loader2,
    Upload,
    X,
    Package,
    Layers,
    Bot,
    Sparkles,
    ImageIcon,
    DollarSign,
    ChevronLeft,
    ChevronRight,
    Save,
    Trash2,
    Plus
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

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: productId } = use(params)
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<Agent[]>([])
    const [currency, setCurrency] = useState('USD')

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        price_fcfa: '' as string | number, // Allow empty string for input
        image_url: '',
        category: '',
        is_available: true,
        agent_id: '',

        // Structured Fields
        short_pitch: '',
        description: '',
        features: [] as string[],
        variants: [] as VariantGroup[],
        marketing_tags: [] as string[],
        related_product_ids: [] as string[],

        // Defaults
        product_type: 'product',
        stock_quantity: -1,
        lead_fields: []
    })

    const [featureInput, setFeatureInput] = useState('')

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        loadData()
    }, [productId])

    const loadData = async () => {
        try {
            const [productRes, agentsRes, profileRes] = await Promise.all([
                fetch(`/api/products/${productId}`),
                fetch('/api/agents'),
                fetch('/api/profile')
            ])

            const productData = await productRes.json()
            const agentsData = await agentsRes.json()
            const profileData = await profileRes.json()

            if (agentsData.data?.agents) setAgents(agentsData.data.agents)
            if (profileData.data?.profile?.currency) setCurrency(profileData.data.profile.currency)

            if (productData.data?.product) {
                const p = productData.data.product
                setFormData({
                    name: p.name || '',
                    price_fcfa: p.price_fcfa || 0,
                    image_url: p.image_url || '',
                    category: p.category || '',
                    is_available: p.is_available ?? true,
                    agent_id: p.agent_id || '',

                    short_pitch: p.short_pitch || '',
                    description: p.description || '',
                    features: Array.isArray(p.features) ? p.features : typeof p.features === 'string' ? JSON.parse(p.features) : [],
                    variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []),
                    marketing_tags: Array.isArray(p.marketing_tags) ? p.marketing_tags : [],
                    related_product_ids: p.related_product_ids || [],

                    product_type: p.product_type || 'product',
                    stock_quantity: p.stock_quantity ?? -1,
                    lead_fields: p.lead_fields || []
                })
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
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
                .from('images')
                .upload(filePath, file)

            if (uploadError) {
                console.error('Upload error:', uploadError)
                throw new Error(uploadError.message || 'Erreur de téléchargement')
            }

            const { data: publicUrl } = supabase.storage
                .from('images')
                .getPublicUrl(filePath)

            setFormData({ ...formData, image_url: publicUrl.publicUrl })
        } catch (error: any) {
            alert(`Erreur upload: ${error.message || 'Vérifiez que le bucket "files" existe dans Supabase Storage'}`)
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

    const handleSave = async (silent = false) => {
        if (!silent) setSaving(true)
        try {
            const dataToSend = {
                ...formData,
                price_fcfa: parseFloat(String(formData.price_fcfa)) || 0
            }
            const res = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            })
            if (!res.ok) throw new Error('Failed')
            if (!silent) alert('Produit sauvegardé !')
        } catch (error) {
            if (!silent) alert('Erreur sauvegarde')
        } finally {
            if (!silent) setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Supprimer ce produit ?')) return
        try {
            const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
            if (res.ok) router.push('/dashboard/products')
        } catch (e) { }
    }

    if (loading) return <div className="flex justify-center items-center min-h-screen bg-slate-900"><Loader2 className="animate-spin text-emerald-400" /></div>

    // Render Steps (Identical to NewProductPage for basics, but populated)
    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        {/* Product Type Selection */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <label className="block text-slate-300 font-medium mb-3">Type de produit</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'product', label: '📦 Physique', desc: 'Produit livrable' },
                                    { id: 'digital', label: '💻 Numérique', desc: 'Téléchargement' },
                                    { id: 'service', label: '🛠️ Service', desc: 'Prestation' }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, product_type: type.id })}
                                        className={`p-4 rounded-lg border text-center transition-all ${formData.product_type === type.id ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-900/30 border-slate-700 hover:border-slate-500'}`}
                                    >
                                        <div className="text-lg">{type.label}</div>
                                        <div className="text-xs text-slate-400 mt-1">{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Image */}
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
                                        <div className="flex flex-col items-center">
                                            <ImageIcon className="text-slate-400 mb-2" size={32} />
                                            <span className="text-slate-500 text-sm">Modifier l'image</span>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                                </div>
                            </div>
                            {/* Fields */}
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Nom</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Prix ({currency})</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formData.price_fcfa}
                                            onChange={e => {
                                                const val = e.target.value
                                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                    setFormData({ ...formData, price_fcfa: val === '' ? '' : val })
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
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                                <div className="pt-4 flex justify-between items-center">
                                    <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2">
                                        <Trash2 size={16} /> Supprimer ce produit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )

            case 1:
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Sparkles className="text-emerald-400" /> Présentation
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Pitch Commercial</label>
                                    <input
                                        value={formData.short_pitch}
                                        onChange={e => setFormData({ ...formData, short_pitch: e.target.value })}
                                        maxLength={150}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white outline-none"
                                    />
                                    <p className="text-right text-xs text-slate-500">{formData.short_pitch.length}/150</p>
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-2">Caractéristiques (Tags)</label>
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
                                            placeholder="Ex: Bio, Fait main, Taille L, Couleur Rouge..."
                                        />
                                        <button onClick={addFeature} className="bg-slate-700 p-3 rounded-lg text-white"><Plus /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Layers className="text-blue-400" /> Variantes
                            </h2>
                            <ProductVariantsEditor
                                variants={formData.variants}
                                onChange={v => setFormData({ ...formData, variants: v })}
                                currencySymbol={currency}
                            />
                        </div>
                    </motion.div>
                )

            case 2:
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Bot className="text-purple-400" /> Stratégie IA</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-3">Arguments Marketing</label>
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
                                        {formData.marketing_tags.map((tag, i) => (
                                            <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2">
                                                {tag} <X size={14} className="cursor-pointer hover:text-white" onClick={() => setFormData(p => ({ ...p, marketing_tags: p.marketing_tags.filter((_, idx) => idx !== i) }))} />
                                            </span>
                                        ))}
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
            {/* Top Bar (Same layout) */}
            <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/products" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Modifier Produit</h1>
                            <p className="text-xs text-slate-400">{STEPS[currentStep].title}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Sauver
                    </button>
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

            <div className="max-w-3xl mx-auto px-4 py-8">
                {renderStep()}
            </div>

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
                            onClick={() => router.push('/dashboard/products')}
                            className="px-6 py-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                        >
                            <Check size={20} /> Terminer
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
