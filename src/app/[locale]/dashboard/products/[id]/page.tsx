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
    Plus,
    Tag
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import ProductVariantsEditor, { VariantGroup, ProductCombination } from '@/components/dashboard/ProductVariantsEditor'
import { convertFromFcfa, convertToFcfa } from '@/lib/currency'

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
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        price: '' as string | number,
        images: [] as string[], // Multi-images support (up to 10)
        image_url: '', // Legacy support
        category: '',
        is_available: true,
        agent_id: '',

        // Details
        description: '', // Main description (cleaned by AI)
        content_included: [] as string[], // What's included in the product
        features: [] as string[],
        variants: [] as VariantGroup[],
        combinations: null as ProductCombination[] | null,
        marketing_tags: [] as string[],
        related_product_ids: [] as string[],

        // Defaults
        product_type: 'product',
        service_subtype: '' as string,
        stock_quantity: -1,
        lead_fields: []
    })

    const [featureInput, setFeatureInput] = useState('')
    const [contentInput, setContentInput] = useState('')

    const getServicePlaceholders = () => {
        const servicePlaceholders: Record<string, { name: string; category: string; descFull: string; content: string; features: string }> = {
            hotel: { name: "Ex: Chambre Standard, Nuitée, Suite...", category: "Hébergement", descFull: "Décrivez le type de chambre : équipements (TV, wifi, minibar), vue, taille du lit, capacité max...", content: "Ex: WiFi, Petit-déjeuner, Piscine, Vue mer, Climatisation, Room service...", features: "Ex: Vue mer, Climatisation, Room service..." },
            residence: { name: "Ex: Appartement 2 pièces, Studio meublé...", category: "Location", descFull: "Décrivez le logement : nombre de pièces, capacité, équipements, durée minimum de séjour...", content: "Ex: Cuisine équipée, Terrasse, Parking, Bord de mer, Calme, Wifi...", features: "Ex: Bord de mer, Calme, Famille..." },
            restaurant: { name: "Ex: Table, Menu Dégustation, Brunch...", category: "Restauration", descFull: "Décrivez la formule : type de menu, nombre de plats, boissons incluses, ambiance...", content: "Ex: Terrasse, Parking, Halal, Végétarien, Live music, Climatisé...", features: "Ex: Halal, Végétarien, Terrasse, Live music..." },
            coiffeur: { name: "Ex: Coupe Homme Tendance", category: "Beauté", descFull: "Décrivez le service : durée, technique, produits utilisés, résultat attendu...", content: "Ex: Shampoing, Coupe, Brushing, Sans RDV, Domicile, Produits bio...", features: "Ex: Sans RDV, Domicile, Produits bio..." },
            medecin: { name: "Ex: Consultation Générale", category: "Santé", descFull: "Décrivez la consultation : durée, spécialité, préparation nécessaire, documents à apporter...", content: "Ex: Examen clinique, Ordonnance, Conseil, Téléconsultation, Urgence...", features: "Ex: Téléconsultation, Urgence, Spécialiste..." },
            formation: { name: "Ex: Formation Excel Avancé", category: "Formation", descFull: "Décrivez la formation : durée, niveau requis, objectifs, certificat délivré, matériel fourni...", content: "Ex: Support PDF, Exercices, Certificat, En ligne, Présentiel...", features: "Ex: En ligne, Présentiel, Débutant, Avancé..." },
            event: { name: "Ex: Concert Live Didier Awadi", category: "Événement", descFull: "Décrivez l'événement : date, heure, lieu, programme, artistes/intervenants...", content: "Ex: Entrée, Cocktail, Concert, VIP, Parking inclus, Dress code...", features: "Ex: VIP, Parking inclus, Dress code..." },
            coaching: { name: "Ex: Session Coaching Carrière", category: "Coaching", descFull: "Décrivez la session : durée, format (visio/présentiel), objectifs, méthode...", content: "Ex: Bilan, Plan d'action, Suivi, Visio, Individuel, Groupe...", features: "Ex: Visio, Individuel, Groupe..." },
            rental: { name: "Ex: Citadine, SUV, Camion 20m³...", category: "Location", descFull: "Décrivez le véhicule/matériel : caractéristiques, conditions de location, caution, kilométrage inclus...", content: "Ex: Assurance, Kilométrage illimité, GPS, Automatique, Diesel, Clim...", features: "Ex: Automatique, Diesel, Clim, 5 places..." },
            other: { name: "Ex: Service Personnalisé", category: "Service", descFull: "Décrivez votre service : ce qu'il inclut, durée, conditions...", content: "Ex: Ce qui est inclus, caractéristiques...", features: "Ex: Caractéristiques du service..." }
        }
        const defaultPlaceholders = { name: "Ex: Bougie Vanille", category: "Ex: Maison", descFull: "Ex: Office 2021 Pro à 25000F, inclut Word, Excel, PowerPoint. Licence à vie, activation en ligne.", content: "Ex: Word, Excel, PowerPoint...", features: "Ex: Bio, Artisanal, Garantie 2 ans..." }
        if (formData.product_type === 'service' && formData.service_subtype) {
            return servicePlaceholders[formData.service_subtype] || defaultPlaceholders
        }
        if (formData.product_type === 'digital') {
            return { name: "Ex: Ebook Marketing Digital", category: "Numérique", descFull: "Ex: E-book PDF de 150 pages sur le marketing digital. Stratégies et cas pratiques.", content: "Ex: PDF, Vidéos bonus, Templates...", features: "Ex: Téléchargement instantané, Mise à jour gratuite..." }
        }
        return defaultPlaceholders
    }

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
            const userCurrency = profileData.data?.profile?.currency || 'USD'
            if (profileData.data?.profile?.currency) setCurrency(userCurrency)

            if (productData.data?.product) {
                const p = productData.data.product
                // Handle images - could be array or single image_url
                const images = Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : [])
                // Variants: convert prices from FCFA to user's currency for display
                const rawVariants = typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || [])
                const convertedVariants = rawVariants.map((v: any) => ({
                    ...v,
                    options: (v.options || []).map((o: any) => ({
                        ...o,
                        price: o.price ? convertFromFcfa(o.price, userCurrency) : 0
                    }))
                }))

                setFormData({
                    name: p.name || '',
                    price: p.price_fcfa ? convertFromFcfa(p.price_fcfa, userCurrency) : '',
                    images: images,
                    image_url: p.image_url || images[0] || '',
                    category: p.category || '',
                    is_available: p.is_available ?? true,
                    agent_id: p.agent_id || '',

                    description: p.description || p.short_pitch || '',
                    content_included: Array.isArray(p.content_included) ? p.content_included : [],
                    features: Array.isArray(p.features) ? p.features : typeof p.features === 'string' ? JSON.parse(p.features) : [],
                    variants: convertedVariants,
                    combinations: Array.isArray(p.combinations) ? p.combinations : null,
                    marketing_tags: Array.isArray(p.marketing_tags) ? p.marketing_tags : [],
                    related_product_ids: p.related_product_ids || [],

                    product_type: p.product_type || 'product',
                    service_subtype: p.service_subtype || '',
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

        const files = Array.from(e.target.files)
        const remaining = 10 - formData.images.length

        if (remaining <= 0) {
            alert('Maximum 10 images autorisées')
            return
        }

        const filesToUpload = files.slice(0, remaining)
        if (files.length > remaining) {
            alert(`Seulement ${remaining} image(s) peuvent être ajoutées (max 10)`)
        }

        setUploading(true)
        try {
            const uploadedUrls: string[] = []

            for (const file of filesToUpload) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
                const filePath = `products/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('images')
                    .upload(filePath, file)

                if (uploadError) {
                    console.error('Upload error:', uploadError)
                    continue
                }

                const { data: publicUrl } = supabase.storage
                    .from('images')
                    .getPublicUrl(filePath)

                uploadedUrls.push(publicUrl.publicUrl)
            }

            setFormData(prev => ({
                ...prev,
                images: [...prev.images, ...uploadedUrls],
                image_url: prev.image_url || uploadedUrls[0] || ''
            }))
        } catch (error: any) {
            alert(`Erreur upload: ${error.message || 'Erreur de téléchargement'}`)
        } finally {
            setUploading(false)
        }
    }

    const removeImage = (index: number) => {
        setFormData(prev => {
            const newImages = prev.images.filter((_, i) => i !== index)
            return {
                ...prev,
                images: newImages,
                image_url: newImages[0] || ''
            }
        })
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
            const variantsInFcfa = formData.variants.map((v: any) => ({
                ...v,
                options: (v.options || []).map((o: any) => ({
                    ...o,
                    price: o.price ? convertToFcfa(Number(o.price), currency) : 0
                }))
            }))
            const { price, ...restFormData } = formData as any
            const dataToSend = {
                ...restFormData,
                price_fcfa: convertToFcfa(parseFloat(String(price)) || 0, currency),
                variants: variantsInFcfa,
                combinations: formData.combinations ?? null
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                        {/* Service subtype selector */}
                        {formData.product_type === 'service' && (
                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                                <label className="block text-slate-300 font-medium mb-1">Catégorie de Service (Important pour l'IA)</label>
                                <p className="text-xs text-slate-400 mb-3">Permet à l'IA de poser les bonnes questions selon le type de service.</p>
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
                                        <button key={sub.id} type="button"
                                            onClick={() => setFormData({ ...formData, service_subtype: sub.id })}
                                            style={{
                                                padding: '10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 8, color: 'white', fontSize: 13,
                                                border: formData.service_subtype === sub.id ? '2px solid #a855f7' : '1px solid rgba(148,163,184,0.2)',
                                                background: formData.service_subtype === sub.id ? 'rgba(168,85,247,0.1)' : 'rgba(30,41,59,0.5)'
                                            }}>
                                            <span style={{ fontSize: 16 }}>{sub.icon}</span>{sub.label}
                                        </button>
                                    ))}
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
                                    {!formData.agent_id && agents.length > 1 && (
                                        <p style={{ marginTop: 6, fontSize: 12, color: '#fbbf24', background: 'rgba(251, 191, 36, 0.08)', padding: '6px 10px', borderRadius: 8 }}>
                                            ⚠️ Ce produit sera proposé par <strong>tous vos agents</strong>. Sélectionnez un agent pour le restreindre.
                                        </p>
                                    )}
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
                                            alert('Description trop courte (min 10 caractères)')
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
                                                alert(data.error || 'Erreur d\'analyse')
                                            }
                                        } catch (e) {
                                            alert('Erreur de connexion')
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

                        {/* Variants */}
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
