'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    ImageIcon,
    Package,
    Bot,
    Layers,
    Plus,
    X,
    Sparkles,
    DollarSign,
    Tag
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import ProductVariantsEditor, { VariantGroup, ProductCombination } from '@/components/dashboard/ProductVariantsEditor'
import { convertToFcfa, convertFromFcfa } from '@/lib/currency'

const RESTAURANT_MENU_SECTIONS = [
    { id: 'starters', label: 'Entrées' },
    { id: 'mains', label: 'Plats principaux' },
    { id: 'extras', label: 'Suppléments' },
    { id: 'desserts', label: 'Desserts' },
    { id: 'drinks', label: 'Boissons' },
]

export default function NewProductPage() {
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<{ id: string, name: string, mission?: string }[]>([])
    const [currency, setCurrency] = useState('USD')
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)
    const [existingProductTypes, setExistingProductTypes] = useState<string[]>([])
    const [batchMode, setBatchMode] = useState(false)
    const [batchItems, setBatchItems] = useState<{ name: string; price: string }[]>([
        { name: '', price: '' },
        { name: '', price: '' },
        { name: '', price: '' },
    ])
    const [batchLoading, setBatchLoading] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        // Basics
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
        features: [] as string[], // Tags list
        variants: [] as VariantGroup[],
        combinations: null as ProductCombination[] | null,

        // Strategy
        marketing_tags: [] as string[],
        related_product_ids: [] as string[],

        // Defaults
        product_type: 'product',
        service_subtype: '', // v2.19 Intent Mapping (hotel, restaurant, etc.)
        menu_section_slug: '',
        menu_sort_order: '' as string | number,
        stock_quantity: -1,
        lead_fields: []
    })

    // v2.19: Dynamic placeholders based on service_subtype
    const getServicePlaceholders = () => {
        const servicePlaceholders: Record<string, {
            name: string, desc: string, category: string,
            descFull: string, content: string, features: string
        }> = {
            hotel: {
                name: "Ex: Chambre Standard, Nuitée, Suite...",
                desc: "Type de chambre, équipements inclus, capacité...",
                category: "Hébergement",
                descFull: "Décrivez le type de chambre : équipements (TV, wifi, minibar), vue, taille du lit, capacité max...",
                content: "Ex: WiFi, Petit-déjeuner, Piscine, Vue mer, Climatisation, Room service...",
                features: "Ex: Vue mer, Climatisation, Room service..."
            },
            residence: {
                name: "Ex: Appartement 2 pièces, Studio meublé...",
                desc: "Capacité, équipements, durée minimum...",
                category: "Location",
                descFull: "Décrivez le logement : nombre de pièces, capacité, équipements, durée minimum de séjour...",
                content: "Ex: Cuisine équipée, Terrasse, Parking, Bord de mer, Calme, Wifi...",
                features: "Ex: Bord de mer, Calme, Famille..."
            },
            restaurant: {
                name: "Ex: Table, Menu Dégustation, Brunch...",
                desc: "Type de réservation, capacité, formule...",
                category: "Restauration",
                descFull: "Décrivez la formule : type de menu, nombre de plats, boissons incluses, ambiance...",
                content: "Ex: Terrasse, Parking, Halal, Végétarien, Live music, Climatisé...",
                features: "Ex: Halal, Végétarien, Terrasse, Live music..."
            },
            coiffeur: {
                name: "Ex: Coupe Homme Tendance",
                desc: "Durée, technique utilisée...",
                category: "Beauté",
                descFull: "Décrivez le service : durée, technique, produits utilisés, résultat attendu...",
                content: "Ex: Shampoing, Coupe, Brushing, Sans RDV, Domicile, Produits bio...",
                features: "Ex: Sans RDV, Domicile, Produits bio..."
            },
            medecin: {
                name: "Ex: Consultation Générale",
                desc: "Durée, préparation nécessaire...",
                category: "Santé",
                descFull: "Décrivez la consultation : durée, spécialité, préparation nécessaire, documents à apporter...",
                content: "Ex: Examen clinique, Ordonnance, Conseil, Téléconsultation, Urgence...",
                features: "Ex: Téléconsultation, Urgence, Spécialiste..."
            },
            formation: {
                name: "Ex: Formation Excel Avancé",
                desc: "Durée, niveau requis, certificat...",
                category: "Formation",
                descFull: "Décrivez la formation : durée, niveau requis, objectifs, certificat délivré, matériel fourni...",
                content: "Ex: Support PDF, Exercices, Certificat, En ligne, Présentiel...",
                features: "Ex: En ligne, Présentiel, Débutant, Avancé..."
            },
            event: {
                name: "Ex: Concert Live Didier Awadi",
                desc: "Date, lieu, programme...",
                category: "Événement",
                descFull: "Décrivez l'événement : date, heure, lieu, programme, artistes/intervenants...",
                content: "Ex: Entrée, Cocktail, Concert, VIP, Parking inclus, Dress code...",
                features: "Ex: VIP, Parking inclus, Dress code..."
            },
            coaching: {
                name: "Ex: Session Coaching Carrière",
                desc: "Durée, objectifs, format...",
                category: "Coaching",
                descFull: "Décrivez la session : durée, format (visio/présentiel), objectifs, méthode...",
                content: "Ex: Bilan, Plan d'action, Suivi, Visio, Individuel, Groupe...",
                features: "Ex: Visio, Individuel, Groupe..."
            },
            rental: {
                name: "Ex: Citadine, SUV, Camion 20m³...",
                desc: "Type de véhicule/matériel, caractéristiques...",
                category: "Location",
                descFull: "Décrivez le véhicule/matériel : caractéristiques, conditions de location, caution, kilométrage inclus...",
                content: "Ex: Assurance, Kilométrage illimité, GPS, Automatique, Diesel, Clim...",
                features: "Ex: Automatique, Diesel, Clim, 5 places..."
            },
            other: {
                name: "Ex: Service Personnalisé",
                desc: "Décrivez votre prestation...",
                category: "Service",
                descFull: "Décrivez votre service : ce qu'il inclut, durée, conditions...",
                content: "Ex: Ce qui est inclus, caractéristiques...",
                features: "Ex: Caractéristiques du service..."
            }
        }
        const defaultPlaceholders = {
            name: "Ex: Bougie Vanille",
            desc: "Description du produit...",
            category: "Ex: Maison",
            descFull: "Ex: Office 2021 Pro à 25000F, inclut Word, Excel, PowerPoint. Licence à vie, activation en ligne.",
            content: "Ex: Word, Excel, PowerPoint...",
            features: "Ex: Bio, Artisanal, Garantie 2 ans..."
        }

        if (formData.product_type === 'service' && formData.service_subtype === 'restaurant') {
            const restaurantNameBySection: Record<string, string> = {
                starters: 'Ex: Salade Turque, Avocat, Soupe du jour...',
                mains: 'Ex: Attiéké poisson, Queue de bœuf, Agouti...',
                extras: 'Ex: Frites, Sauce pimentée, Riz...',
                desserts: 'Ex: Fondant chocolat, Crème caramel...',
                drinks: 'Ex: Bière Flag, Jus de goyave, Vin rouge...',
            }
            return {
                ...servicePlaceholders.restaurant,
                name: restaurantNameBySection[formData.menu_section_slug] || 'Ex: Agouti, Salade Turque, Bière...',
            }
        }
        if (formData.product_type === 'service' && formData.service_subtype) {
            return servicePlaceholders[formData.service_subtype] || defaultPlaceholders
        }
        if (formData.product_type === 'digital') {
            return {
                name: "Ex: Ebook Marketing Digital",
                desc: "Contenu, format, pages...",
                category: "Numérique",
                descFull: "Ex: E-book PDF de 150 pages sur le marketing digital. Stratégies et cas pratiques.",
                content: "Ex: PDF, Vidéos bonus, Templates...",
                features: "Ex: Téléchargement instantané, Mise à jour gratuite..."
            }
        }
        return defaultPlaceholders
    }

    const [featureInput, setFeatureInput] = useState('')
    const [contentInput, setContentInput] = useState('')
    const [digitalDeliveryType, setDigitalDeliveryType] = useState<'fixed_content' | 'license_keys'>('fixed_content')
    const [digitalContent, setDigitalContent] = useState('')
    const [licenseKeysInput, setLicenseKeysInput] = useState('')
    const [uploadingDigital, setUploadingDigital] = useState(false)
    const [digitalFileName, setDigitalFileName] = useState('')

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    useEffect(() => {
        loadAgents()
        fetchProfile()
        checkExistingProductTypes()
        // Restaurer le dernier sous-service sélectionné
        const lastSubtype = localStorage.getItem('product_last_service_subtype')
        if (lastSubtype) {
            setFormData(prev => ({ ...prev, service_subtype: lastSubtype, product_type: 'service' }))
        }
    }, [])

    // Restaurer le dernier agent après chargement de la liste
    useEffect(() => {
        if (agents.length === 0) return
        const lastAgentId = localStorage.getItem('product_last_agent_id')
        if (lastAgentId && agents.some(a => a.id === lastAgentId)) {
            setFormData(prev => ({ ...prev, agent_id: lastAgentId }))
        }
    }, [agents])

    const selectProductType = (nextType: string) => {
        setFormData(prev => {
            const nextState = { ...prev, product_type: nextType }

            if (nextType !== 'service') {
                nextState.service_subtype = ''
                nextState.menu_section_slug = ''
                nextState.menu_sort_order = ''
                return nextState
            }

            if (!nextState.service_subtype) {
                nextState.service_subtype = localStorage.getItem('product_last_service_subtype') || ''
            }

            return nextState
        })
    }

    const selectServiceSubtype = (subtype: string) => {
        localStorage.setItem('product_last_service_subtype', subtype)
        setFormData(prev => ({
            ...prev,
            service_subtype: subtype,
            menu_section_slug: subtype === 'restaurant' ? prev.menu_section_slug : '',
            menu_sort_order: subtype === 'restaurant' ? prev.menu_sort_order : '',
        }))
    }

    // v2.30: Check if user already has services or products to enforce isolation
    const checkExistingProductTypes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: products } = await supabase
                .from('products')
                .select('product_type')
                .eq('user_id', user.id)
                .limit(50)

            if (products && products.length > 0) {
                const types = [...new Set(products.map((p: { product_type: string }) => p.product_type))]
                setExistingProductTypes(types)

                // Auto-switch selection if current default is invalid
                const hasService = types.includes('service')
                if (hasService) {
                    setFormData(prev => ({ ...prev, product_type: 'service' }))
                }
            }
        } catch (e) {
            console.error('Error checking existing products:', e)
        }
    }

    // v2.30: Check if a product type should be disabled based on isolation rules
    const isProductTypeDisabled = (typeId: string) => {
        if (existingProductTypes.length === 0) return false

        const hasService = existingProductTypes.includes('service')
        const hasNonService = existingProductTypes.some(t => t === 'product' || t === 'digital')

        // If services exist, disable physical and digital
        if (hasService && (typeId === 'product' || typeId === 'digital')) {
            return true
        }
        // If physical/digital exist, disable service
        if (hasNonService && typeId === 'service') {
            return true
        }
        return false
    }

    const getDisabledReason = () => {
        if (existingProductTypes.includes('service')) {
            return '⚠️ Vous avez déjà des Services. Les produits physiques/numériques ne peuvent pas être mélangés avec les services.'
        }
        if (existingProductTypes.some(t => t === 'product' || t === 'digital')) {
            return '⚠️ Vous avez déjà des Produits. Les services doivent être créés sur un compte séparé.'
        }
        return null
    }

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            if (data.data?.profile?.currency) setCurrency(data.data.profile.currency)
        } catch (e) { }
    }

    const loadAgents = async () => {
        try {
            const { data } = await supabase.from('agents').select('id, name, mission')
            if (data) setAgents(data)
        } catch (e) { }
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
                    continue // Skip failed uploads
                }

                const { data: publicUrl } = supabase.storage
                    .from('images')
                    .getPublicUrl(filePath)

                uploadedUrls.push(publicUrl.publicUrl)
            }

            // Add all uploaded images to array
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

    const handleDigitalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
        if (file.size > MAX_SIZE) {
            alert('Fichier trop volumineux. Limite : 50 MB.')
            e.target.value = ''
            return
        }

        setUploadingDigital(true)
        try {
            const ext = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('digital-content')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: publicUrlData } = supabase.storage
                .from('digital-content')
                .getPublicUrl(filePath)

            setDigitalContent(publicUrlData.publicUrl)
            setDigitalFileName(file.name)
        } catch (err: any) {
            alert(`Erreur upload : ${err.message || 'Erreur inconnue'}`)
        } finally {
            setUploadingDigital(false)
            e.target.value = ''
        }
    }

    const removeImage = (index: number) => {
        setFormData(prev => {
            const newImages = prev.images.filter((_, i) => i !== index)
            return {
                ...prev,
                images: newImages,
                image_url: newImages[0] || '' // First image or empty
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
        } else {
            setFormData(prev => ({ ...prev, marketing_tags: prev.marketing_tags.filter(t => t !== tag) }))
        }
    }

    const handleSave = async () => {
        // v2.19: Validate mandatory service_subtype for Services
        if (formData.product_type === 'service' && !formData.service_subtype) {
            alert('Veuillez sélectionner une catégorie de service (Hôtel, Restaurant, etc.)')
            setCurrentStep(0) // Go back to step with selector
            return
        }

        setLoading(true)
        try {
            // Convertir les prix de la devise utilisateur vers FCFA avant d'envoyer
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
                    const keys = licenseKeysInput
                        .split('\n')
                        .map((k: string) => k.trim())
                        .filter((k: string) => k.length > 0)
                        .map((k: string) => ({ key: k, used: false, order_id: null }))
                    dataToSend.license_keys = keys.length > 0 ? keys : null
                }
            }

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            })

            if (!res.ok) throw new Error('Failed')

            router.push('/dashboard/products')
        } catch (error) {
            alert('Erreur lors de la création')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveBatch = async () => {
        const validItems = batchItems.filter(item => item.name.trim() !== '')
        if (validItems.length === 0) {
            alert('Ajoutez au moins un article avec un nom.')
            return
        }
        if (!formData.menu_section_slug) {
            alert('Choisissez une rubrique de la carte avant de sauvegarder.')
            return
        }
        setBatchLoading(true)
        try {
            const results = await Promise.all(
                validItems.map(item =>
                    fetch('/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: item.name.trim(),
                            price_fcfa: convertToFcfa(parseFloat(item.price) || 0, currency),
                            product_type: 'service',
                            service_subtype: 'restaurant',
                            menu_section_slug: formData.menu_section_slug,
                            menu_sort_order: null,
                            agent_id: formData.agent_id || null,
                            is_available: true,
                            category: 'Restauration',
                            images: [],
                            image_url: '',
                            description: '',
                            features: [],
                            marketing_tags: [],
                            variants: [],
                            combinations: null,
                            digital_content: null,
                            license_keys: null,
                        })
                    })
                )
            )
            const failed = results.filter(r => !r.ok).length
            if (failed > 0) {
                alert(`${validItems.length - failed} article(s) créés, ${failed} échec(s).`)
            } else {
                router.push('/dashboard/products')
            }
        } catch {
            alert('Erreur lors de la création en masse.')
        } finally {
            setBatchLoading(false)
        }
    }

    const steps = [
        { id: 'basics', title: 'Identité', icon: Package },
        { id: 'details', title: 'Détails', icon: Layers },
        { id: 'strategy', title: 'IA Strategy', icon: Bot }
    ]

    // --- STYLES (Copied from Agent Wizard) ---
    const cardStyle = {
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 16,
        padding: 24
    }

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        fontSize: 15,
        color: 'white',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 12,
        outline: 'none'
    }

    const buttonPrimaryStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        fontSize: 15,
        fontWeight: 600,
        color: 'white',
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer'
    }

    const buttonSecondaryStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        fontSize: 15,
        fontWeight: 500,
        color: '#94a3b8',
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 12,
        cursor: 'pointer'
    }

    const labelStyle = {
        display: 'block',
        fontSize: 14,
        fontWeight: 500,
        color: '#e2e8f0',
        marginBottom: 8
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // BASICS
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
                                                opacity: isDisabled ? 0.4 : 1
                                            }}
                                        >
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
                                    if (e.target.value) localStorage.setItem('product_last_agent_id', e.target.value)
                                    setFormData({ ...formData, agent_id: e.target.value })
                                }}
                                style={inputStyle}
                            >
                                <option value="">Tous les agents</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id} disabled={a.mission === 'support_client'}>
                                        {a.name}{a.mission === 'support_client' ? ' (Support — KB uniquement)' : ''}
                                    </option>
                                ))}
                            </select>
                            {formData.agent_id && agents.find(a => a.id === formData.agent_id)?.mission === 'support_client' && (
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

            case 1: // DETAILS
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Description with AI Analysis */}
                        <div>
                            <label style={labelStyle}>
                                {formData.product_type === 'service' ? 'Description du service' : 'Description du produit'}
                            </label>
                            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                {formData.product_type === 'service'
                                    ? "Décrivez votre service en détail. L'IA adaptera les questions au type de service."
                                    : "Décrivez librement votre produit. L'IA extraira automatiquement les informations structurées."
                                }
                            </p>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder={getServicePlaceholders().descFull}
                                style={{ ...inputStyle, minHeight: 120, fontFamily: 'inherit' }}
                                maxLength={2000}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
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
                                                // Auto-apply extracted data
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
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: 8,
                                        border: '1px solid rgba(168, 85, 247, 0.3)',
                                        background: analyzing ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.2)',
                                        color: '#d8b4fe',
                                        cursor: analyzing ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        fontSize: 13
                                    }}
                                >
                                    {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {analyzing ? 'Analyse...' : '🔍 Analyser & Corriger'}
                                </button>
                                <span style={{ fontSize: 11, color: '#64748b' }}>{formData.description.length}/2000</span>
                            </div>

                            {/* Show analysis result */}
                            {analysisResult && (
                                <div style={{ marginTop: 12, padding: 12, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <div style={{ fontSize: 12, color: '#34d399', marginBottom: 8 }}>✅ Données extraites et appliquées</div>
                                    {analysisResult.warnings?.length > 0 && (
                                        <div style={{ fontSize: 11, color: '#fbbf24' }}>⚠️ {analysisResult.warnings.join(', ')}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Content Included (+ Features fusionnés pour les services) */}
                        <div>
                            <label style={labelStyle}>
                                {formData.product_type === 'service' ? 'Inclus & Caractéristiques' : 'Contenu inclus'}
                            </label>
                            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                {formData.product_type === 'service'
                                    ? "Listez ce qui est inclus et les caractéristiques de votre service"
                                    : "Listez ce qui est inclus dans le produit (pour logiciels, packs, etc.)"}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                {formData.content_included.map((c, i) => (
                                    <span key={i} style={{
                                        padding: '4px 12px',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        borderRadius: 20,
                                        fontSize: 12,
                                        color: '#60a5fa',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}>
                                        {c}
                                        <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFormData(p => ({ ...p, content_included: p.content_included.filter((_, idx) => idx !== i) }))} />
                                    </span>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    type="text"
                                    value={contentInput}
                                    onChange={e => setContentInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && contentInput.trim()) {
                                            setFormData(p => ({ ...p, content_included: [...p.content_included, contentInput.trim()] }))
                                            setContentInput('')
                                        }
                                    }}
                                    placeholder={getServicePlaceholders().content}
                                    style={inputStyle}
                                />
                                <button
                                    onClick={() => {
                                        if (contentInput.trim()) {
                                            setFormData(p => ({ ...p, content_included: [...p.content_included, contentInput.trim()] }))
                                            setContentInput('')
                                        }
                                    }}
                                    style={{ ...buttonSecondaryStyle, padding: '0 16px' }}
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Tags/Features - Masqué pour les services (fusionné avec content_included) */}
                        {formData.product_type !== 'service' && (
                            <div>
                                <label style={labelStyle}>
                                    Caractéristiques (Tags)
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                    {formData.features.map((f, i) => (
                                        <span key={i} style={{
                                            padding: '4px 12px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            color: '#34d399',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6
                                        }}>
                                            {f}
                                            <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFormData(p => ({ ...p, features: p.features.filter((_, idx) => idx !== i) }))} />
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text"
                                        value={featureInput}
                                        onChange={e => setFeatureInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addFeature()}
                                        placeholder={getServicePlaceholders().features}
                                        style={inputStyle}
                                    />
                                    <button onClick={addFeature} style={{ ...buttonSecondaryStyle, padding: '0 16px' }}>
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Variants — masqué pour les produits numériques */}
                        {formData.product_type !== 'digital' && (
                        <div style={{
                            padding: 20,
                            background: 'rgba(30, 41, 59, 0.3)',
                            borderRadius: 12,
                            border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Layers size={16} className="text-blue-400" /> Variantes (Optionnel)
                            </h3>
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

                        {/* Digital Delivery Section — only for digital products */}
                        {formData.product_type === 'digital' && (
                            <div style={{
                                padding: 20,
                                background: 'rgba(16, 185, 129, 0.05)',
                                borderRadius: 12,
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    💻 Livraison numérique automatique
                                </h3>
                                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                                    Le contenu sera envoyé automatiquement au client par WhatsApp après le paiement.
                                </p>

                                {/* Mode selector */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                    {[
                                        { id: 'fixed_content', label: '📄 Contenu fixe', desc: 'Même lien/texte pour tous' },
                                        { id: 'license_keys', label: '🔑 Clés de licence', desc: 'Clé unique par acheteur' }
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setDigitalDeliveryType(mode.id as 'fixed_content' | 'license_keys')}
                                            style={{
                                                flex: 1,
                                                padding: '10px 12px',
                                                borderRadius: 10,
                                                border: digitalDeliveryType === mode.id ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                                                background: digitalDeliveryType === mode.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                textAlign: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ fontSize: 13, color: 'white', fontWeight: 500 }}>{mode.label}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{mode.desc}</div>
                                        </button>
                                    ))}
                                </div>

                                {digitalDeliveryType === 'fixed_content' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <label style={{ ...labelStyle, marginBottom: 0 }}>Lien de téléchargement ou contenu à envoyer</label>

                                        {/* Si fichier uploadé : masquer le textarea, afficher la carte fichier */}
                                        {digitalFileName ? (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px 16px',
                                                borderRadius: 10,
                                                border: '1px solid rgba(16,185,129,0.3)',
                                                background: 'rgba(16,185,129,0.07)',
                                            }}>
                                                <span style={{ fontSize: 14, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    📄 {digitalFileName}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setDigitalContent(''); setDigitalFileName('') }}
                                                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }}
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <textarea
                                                value={digitalContent}
                                                onChange={e => setDigitalContent(e.target.value)}
                                                placeholder="Ex: https://drive.google.com/file/d/... ou code d'activation XXXX-YYYY-ZZZZ"
                                                style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }}
                                            />
                                        )}

                                        {!digitalFileName && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ fontSize: 12, color: '#64748b' }}>— ou —</span>
                                                <label style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: '8px 14px',
                                                    borderRadius: 8,
                                                    border: '1px solid rgba(16,185,129,0.3)',
                                                    background: 'rgba(16,185,129,0.08)',
                                                    color: '#34d399',
                                                    cursor: uploadingDigital ? 'not-allowed' : 'pointer',
                                                    fontSize: 13,
                                                    fontWeight: 500,
                                                    opacity: uploadingDigital ? 0.6 : 1,
                                                }}>
                                                    {uploadingDigital
                                                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                        : '📎'
                                                    }
                                                    {uploadingDigital ? 'Envoi...' : 'Uploader un fichier'}
                                                    <input
                                                        type="file"
                                                        style={{ display: 'none' }}
                                                        disabled={uploadingDigital}
                                                        onChange={handleDigitalFileUpload}
                                                    />
                                                </label>
                                            </div>
                                        )}
                                        <p style={{ fontSize: 11, color: '#64748b' }}>
                                            {digitalFileName
                                                ? 'Le fichier sera envoyé directement dans WhatsApp après le paiement.'
                                                : 'Sera envoyé tel quel à chaque acheteur. Limite fichier : 50 MB.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: 6 }}>Clés de licence (une par ligne)</label>
                                        <textarea
                                            value={licenseKeysInput}
                                            onChange={e => setLicenseKeysInput(e.target.value)}
                                            placeholder={"XXXX-YYYY-ZZZZ-1\nXXXX-YYYY-ZZZZ-2\nXXXX-YYYY-ZZZZ-3"}
                                            style={{ ...inputStyle, minHeight: 100, fontFamily: 'monospace', fontSize: 13 }}
                                        />
                                        <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                            {licenseKeysInput.split('\n').filter(k => k.trim()).length} clé(s) prêtes à être attribuées.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )

            case 2: // STRATEGY
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={labelStyle}>Arguments Marketing</label>
                            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                                Sélectionnez les tags pour aider l'IA à vendre.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {['Best Seller', 'Nouveauté', 'Promo', 'Bio', 'Luxe', 'Garanti', 'Livraison Rapide', 'Populaire'].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => addMarketingTag(tag)}
                                        style={{
                                            padding: '6px 16px',
                                            borderRadius: 20,
                                            fontSize: 13,
                                            border: formData.marketing_tags.includes(tag) ? '1px solid #a855f7' : '1px solid rgba(148, 163, 184, 0.2)',
                                            background: formData.marketing_tags.includes(tag) ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                                            color: formData.marketing_tags.includes(tag) ? '#d8b4fe' : '#94a3b8',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{
                            padding: 20,
                            border: '1px dashed rgba(148, 163, 184, 0.2)',
                            borderRadius: 12,
                            textAlign: 'center'
                        }}>
                            <Bot size={24} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                            <p style={{ fontSize: 13, color: '#64748b' }}>
                                L'IA utilisera ces informations pour recommander ce produit au bon moment dans la conversation.
                            </p>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 40 }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <Link
                    href="/dashboard/products"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: '#94a3b8',
                        textDecoration: 'none',
                        marginBottom: 16
                    }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Retour aux produits
                </Link>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                    Ajouter un Produit
                </h1>
                <p style={{ color: '#94a3b8' }}>
                    Créez un produit que vos agents pourront vendre.
                </p>
            </div>

            {/* Progress steps */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 8 }}>
                {steps.map((step, index) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: index < currentStep
                                ? '#10b981'
                                : index === currentStep
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : 'rgba(51, 65, 85, 0.5)',
                            color: index <= currentStep ? '#34d399' : '#64748b'
                        }}>
                            {index < currentStep ? (
                                <Check style={{ width: 20, height: 20, color: 'white' }} />
                            ) : (
                                <step.icon style={{ width: 20, height: 20 }} />
                            )}
                        </div>
                        {index < steps.length - 1 && (
                            <div style={{
                                width: 40,
                                height: 4,
                                background: index < currentStep ? '#10b981' : 'rgba(51, 65, 85, 0.5)',
                                borderRadius: 2
                            }} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step title */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                    {steps[currentStep].title}
                </h2>
            </div>

            {/* Content */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                style={cardStyle}
            >
                {renderStepContent()}
            </motion.div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button
                    onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                    disabled={currentStep === 0}
                    style={{
                        ...buttonSecondaryStyle,
                        opacity: currentStep === 0 ? 0 : 1,
                        pointerEvents: currentStep === 0 ? 'none' : 'auto'
                    }}
                >
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Précédent
                </button>

                {currentStep < steps.length - 1 ? (
                    <button
                        onClick={() => setCurrentStep(prev => Math.min(steps.length - 1, prev + 1))}
                        style={buttonPrimaryStyle}
                    >
                        Suivant
                        <ArrowRight style={{ width: 16, height: 16 }} />
                    </button>
                ) : (
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                            ...buttonPrimaryStyle,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                        Créer le Produit
                    </button>
                )}
            </div>
        </div>
    )
}
