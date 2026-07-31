'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    Check,
    Loader2,
    Upload,
    Package,
    Layers,
    Bot,
    ImageIcon,
    ChevronLeft,
    ChevronRight,
    Save,
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import type { VariantGroup, ProductCombination } from '@/components/dashboard/ProductVariantsEditor'
import { convertFromFcfa, convertToFcfa } from '@/lib/currency'
import { useToast } from '@/components/ui/Toast'
import { Step0Basics } from './components/Step0Basics'
import { Step1Details } from './components/Step1Details'
import { Step2Strategy } from './components/Step2Strategy'

const STEPS = [
    { id: 'basics', title: 'Identité & Prix', icon: Package },
    { id: 'details', title: 'Détails & Variantes', icon: Layers },
    { id: 'strategy', title: 'Stratégie IA', icon: Bot }
]

interface Agent {
    id: string
    name: string
    mission?: string
    ecommerce_mode?: string | null
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: productId } = use(params)
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<Agent[]>([])
    const [currency, setCurrency] = useState('USD')
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)
    const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

    useEffect(() => {
        fetch('/api/features')
            .then(r => r.json())
            .then(d => { if (d.data?.flags) setFeatureFlags(d.data.flags) })
            .catch(() => {})
    }, [])

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
        menu_section_slug: '',
        menu_sort_order: '' as string | number,
        stock_quantity: -1,
        lead_fields: [] as any[]
    })

    const [featureInput, setFeatureInput] = useState('')
    const [contentInput, setContentInput] = useState('')
    const [digitalDeliveryType, setDigitalDeliveryType] = useState<'fixed_content' | 'license_keys'>('fixed_content')
    const [digitalContent, setDigitalContent] = useState('')
    const [licenseKeysInput, setLicenseKeysInput] = useState('')
    const [existingLicenseKeys, setExistingLicenseKeys] = useState<{ key: string; used: boolean; order_id: string | null }[]>([])

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

    // "restaurant"/"hotel" sont des cartes "Type de produit" à part entière côté UI,
    // mais restent stockés comme product_type='service' + service_subtype en base
    // (le moteur de reservation/menu existant repose sur cette combinaison).
    const selectProductType = (nextType: string) => {
        if (nextType === 'restaurant' || nextType === 'hotel') {
            setFormData(prev => ({
                ...prev,
                product_type: 'service',
                service_subtype: nextType,
                menu_section_slug: nextType === 'restaurant' ? prev.menu_section_slug : '',
                menu_sort_order: nextType === 'restaurant' ? prev.menu_sort_order : '',
            }))
            return
        }

        setFormData(prev => ({
            ...prev,
            product_type: nextType,
            service_subtype: '',
            menu_section_slug: '',
            menu_sort_order: '',
        }))
    }

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
                    service_subtype: p.product_type === 'service' ? (p.service_subtype || '') : '',
                    menu_section_slug: p.product_type === 'service' && p.service_subtype === 'restaurant' ? (p.menu_section_slug || '') : '',
                    menu_sort_order: p.product_type === 'service' && p.service_subtype === 'restaurant' ? (p.menu_sort_order ?? '') : '',
                    stock_quantity: p.stock_quantity ?? -1,
                    lead_fields: p.lead_fields || []
                })

                // Load digital delivery fields
                if (p.product_type === 'digital') {
                    if (p.license_keys && Array.isArray(p.license_keys) && p.license_keys.length > 0) {
                        setDigitalDeliveryType('license_keys')
                        setExistingLicenseKeys(p.license_keys)
                    } else if (p.digital_content) {
                        setDigitalDeliveryType('fixed_content')
                        setDigitalContent(p.digital_content)
                    }
                }
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
            toast.error('Maximum 10 images autorisées')
            return
        }

        const filesToUpload = files.slice(0, remaining)
        if (files.length > remaining) {
            toast.warning(`Seulement ${remaining} image(s) peuvent être ajoutées (max 10)`)
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
            toast.error(`Erreur upload: ${error.message || 'Erreur de téléchargement'}`)
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
            const isRestaurantMenuItem =
                formData.product_type === 'service' &&
                formData.service_subtype === 'restaurant'
            const dataToSend: any = {
                ...restFormData,
                price_fcfa: convertToFcfa(parseFloat(String(price)) || 0, currency),
                variants: variantsInFcfa,
                combinations: formData.combinations ?? null,
                service_subtype: formData.product_type === 'service' ? (formData.service_subtype || null) : null,
                menu_section_slug: isRestaurantMenuItem ? (formData.menu_section_slug || null) : null,
                menu_sort_order:
                    isRestaurantMenuItem &&
                    String(formData.menu_sort_order ?? '').trim() !== '' &&
                    Number.isFinite(Number(formData.menu_sort_order))
                        ? Number(formData.menu_sort_order)
                        : null,
                digital_content: null,
                license_keys: null
            }

            if (formData.product_type === 'digital') {
                if (digitalDeliveryType === 'fixed_content') {
                    dataToSend.digital_content = digitalContent.trim() || null
                } else {
                    // Parse new keys from textarea
                    const newKeys = licenseKeysInput
                        .split('\n')
                        .map((k: string) => k.trim())
                        .filter((k: string) => k.length > 0)
                        .map((k: string) => ({ key: k, used: false, order_id: null }))
                    // Merge: keep existing (including used ones) + add new unused keys
                    const mergedKeys = [...existingLicenseKeys, ...newKeys]
                    dataToSend.license_keys = mergedKeys.length > 0 ? mergedKeys : null
                }
            }

            const res = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                console.error('Save error:', errData)
                throw new Error(errData?.error || 'Failed')
            }
            if (!silent) toast.success('Produit sauvegardé.')
        } catch (error: any) {
            if (!silent) toast.error(`Erreur sauvegarde : ${error?.message || 'inconnue'}`)
        } finally {
            if (!silent) setSaving(false)
        }
    }

    const handleDelete = async () => {
        const ok = await toast.confirm({ title: 'Supprimer ce produit ?', message: 'Cette action est irréversible.', confirmLabel: 'Supprimer', danger: true })
        if (!ok) return
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
                    <Step0Basics
                        formData={formData}
                        setFormData={setFormData}
                        featureFlags={featureFlags}
                        selectProductType={selectProductType}
                        getServicePlaceholders={getServicePlaceholders}
                        fileInputRef={fileInputRef}
                        uploading={uploading}
                        handleImageUpload={handleImageUpload}
                        removeImage={removeImage}
                        currency={currency}
                        agents={agents}
                        handleDelete={handleDelete}
                    />
                )

            case 1:
                return (
                    <Step1Details
                        formData={formData}
                        setFormData={setFormData}
                        getServicePlaceholders={getServicePlaceholders}
                        toast={toast}
                        analyzing={analyzing}
                        setAnalyzing={setAnalyzing}
                        analysisResult={analysisResult}
                        setAnalysisResult={setAnalysisResult}
                        currency={currency}
                        contentInput={contentInput}
                        setContentInput={setContentInput}
                        featureInput={featureInput}
                        setFeatureInput={setFeatureInput}
                        addFeature={addFeature}
                        digitalDeliveryType={digitalDeliveryType}
                        setDigitalDeliveryType={setDigitalDeliveryType}
                        digitalContent={digitalContent}
                        setDigitalContent={setDigitalContent}
                        existingLicenseKeys={existingLicenseKeys}
                        licenseKeysInput={licenseKeysInput}
                        setLicenseKeysInput={setLicenseKeysInput}
                    />
                )

            case 2:
                return (
                    <Step2Strategy
                        formData={formData}
                        setFormData={setFormData}
                        addMarketingTag={addMarketingTag}
                    />
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
