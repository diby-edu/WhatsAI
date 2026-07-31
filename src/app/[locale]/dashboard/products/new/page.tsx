'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    Package,
    Bot,
    Layers
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import type { VariantGroup, ProductCombination } from '@/components/dashboard/ProductVariantsEditor'
import { convertToFcfa } from '@/lib/currency'
import { getManualProductsBlockedReason } from '@/lib/agents/ecommerce-mode'
import type { ProductFormData } from '../types'
import { Step0Basics } from './components/Step0Basics'
import { Step1Details } from './components/Step1Details'
import { Step2Strategy } from './components/Step2Strategy'

export default function NewProductPage() {
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const toast = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<{ id: string, name: string, mission?: string, ecommerce_mode?: string | null }[]>([])
    const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

    useEffect(() => {
        fetch('/api/features')
            .then(r => r.json())
            .then(d => { if (d.data?.flags) setFeatureFlags(d.data.flags) })
            .catch(() => {})
    }, [])
    const [currency, setCurrency] = useState('USD')
    const [analyzing, setAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<any>(null)
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
        images: [] as string[], // Une seule image (voir handleImageUpload) — array conserve pour compat avec image_url
        image_url: '',
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
        lead_fields: [] as any[]
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
            restaurant: {
                name: "Ex: Table, Menu Dégustation, Brunch...",
                desc: "Type de réservation, capacité, formule...",
                category: "Restauration",
                descFull: "Décrivez la formule : type de menu, nombre de plats, boissons incluses, ambiance...",
                content: "Ex: Terrasse, Parking, Halal, Végétarien, Live music, Climatisé...",
                features: "Ex: Halal, Végétarien, Terrasse, Live music..."
            },
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
    }, [])

    // Le type de produit se deduit entierement de la mission de l'agent choisi
    // (Physique/Numerique/Restaurant/Hotel) — un agent = un type, pas de choix
    // manuel independant. "Tous les agents" n'existe plus : agent_id est requis.
    const MISSION_PRODUCT_TYPE: Record<string, { product_type: string; service_subtype: string }> = {
        ecommerce_physical: { product_type: 'product', service_subtype: '' },
        ecommerce_digital: { product_type: 'digital', service_subtype: '' },
        restaurant: { product_type: 'service', service_subtype: 'restaurant' },
        hotel: { product_type: 'service', service_subtype: 'hotel' },
    }

    const selectAgent = (agentId: string) => {
        const agent = agents.find(a => a.id === agentId)
        const mapped = agent?.mission ? MISSION_PRODUCT_TYPE[agent.mission] : undefined
        if (agentId) localStorage.setItem('product_last_agent_id', agentId)
        setFormData(prev => ({
            ...prev,
            agent_id: agentId,
            product_type: mapped?.product_type || prev.product_type,
            service_subtype: mapped?.service_subtype || '',
            menu_section_slug: mapped?.service_subtype === 'restaurant' ? prev.menu_section_slug : '',
            menu_sort_order: mapped?.service_subtype === 'restaurant' ? prev.menu_sort_order : '',
        }))
    }

    // Restaurer le dernier agent après chargement de la liste
    useEffect(() => {
        if (agents.length === 0) return
        const lastAgentId = localStorage.getItem('product_last_agent_id')
        const lastAgent = agents.find(a => a.id === lastAgentId)
        if (lastAgentId && lastAgent && !getManualProductsBlockedReason(lastAgent)) {
            selectAgent(lastAgentId)
        }
    }, [agents])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile')
            const data = await res.json()
            if (data.data?.profile?.currency) setCurrency(data.data.profile.currency)
        } catch (e) { }
    }

    const loadAgents = async () => {
        try {
            const { data } = await supabase.from('agents').select('id, name, mission, ecommerce_mode')
            if (data) setAgents(data)
        } catch (e) { }
    }

    // Une seule image par produit — c'est la seule que le bot utilise reellement
    // (le dashboard et le handler WhatsApp lisent tous deux image_url, jamais images[1+]).
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: publicUrl } = supabase.storage
                .from('images')
                .getPublicUrl(filePath)

            setFormData(prev => ({
                ...prev,
                images: [publicUrl.publicUrl],
                image_url: publicUrl.publicUrl
            }))
        } catch (error: any) {
            toast.error(`Erreur upload: ${error.message || 'Erreur de téléchargement'}`)
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    const handleDigitalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
        if (file.size > MAX_SIZE) {
            toast.error('Fichier trop volumineux. Limite : 50 MB.')
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
            toast.error(`Erreur upload : ${err.message || 'Erreur inconnue'}`)
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
        if (!formData.agent_id) {
            toast.error('Veuillez sélectionner un agent vendeur — le type de produit en dépend.')
            setCurrentStep(0)
            return
        }
        // v2.19: Validate mandatory service_subtype for Services
        if (formData.product_type === 'service' && !formData.service_subtype) {
            toast.error('Veuillez sélectionner une catégorie de service (Hôtel, Restaurant, etc.)')
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
            toast.error('Erreur lors de la création')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveBatch = async () => {
        if (!formData.agent_id) {
            toast.error('Veuillez sélectionner un agent vendeur.')
            return
        }
        const validItems = batchItems.filter(item => item.name.trim() !== '')
        if (validItems.length === 0) {
            toast.error('Ajoutez au moins un article avec un nom.')
            return
        }
        if (!formData.menu_section_slug) {
            toast.error('Choisissez une rubrique de la carte avant de sauvegarder.')
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
                            agent_id: formData.agent_id,
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
                toast.error(`${validItems.length - failed} article(s) créés, ${failed} échec(s).`)
            } else {
                router.push('/dashboard/products')
            }
        } catch {
            toast.error('Erreur lors de la création en masse.')
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
                    <Step0Basics
                        formData={formData}
                        setFormData={setFormData}
                        labelStyle={labelStyle}
                        inputStyle={inputStyle}
                        buttonPrimaryStyle={buttonPrimaryStyle}
                        featureFlags={featureFlags}
                        selectAgent={selectAgent}
                        batchMode={batchMode}
                        setBatchMode={setBatchMode}
                        batchItems={batchItems}
                        setBatchItems={setBatchItems}
                        batchLoading={batchLoading}
                        handleSaveBatch={handleSaveBatch}
                        agents={agents}
                        currency={currency}
                        getServicePlaceholders={getServicePlaceholders}
                        fileInputRef={fileInputRef}
                        uploading={uploading}
                        handleImageUpload={handleImageUpload}
                        removeImage={removeImage}
                    />
                )

            case 1: // DETAILS
                return (
                    <Step1Details
                        formData={formData}
                        setFormData={setFormData}
                        labelStyle={labelStyle}
                        inputStyle={inputStyle}
                        buttonSecondaryStyle={buttonSecondaryStyle}
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
                        digitalFileName={digitalFileName}
                        setDigitalFileName={setDigitalFileName}
                        digitalContent={digitalContent}
                        setDigitalContent={setDigitalContent}
                        uploadingDigital={uploadingDigital}
                        handleDigitalFileUpload={handleDigitalFileUpload}
                        licenseKeysInput={licenseKeysInput}
                        setLicenseKeysInput={setLicenseKeysInput}
                    />
                )

            case 2: // STRATEGY
                return (
                    <Step2Strategy
                        formData={formData}
                        addMarketingTag={addMarketingTag}
                        labelStyle={labelStyle}
                    />
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
                        disabled={currentStep === 0 && !formData.agent_id}
                        style={{
                            ...buttonPrimaryStyle,
                            opacity: (currentStep === 0 && !formData.agent_id) ? 0.5 : 1,
                            cursor: (currentStep === 0 && !formData.agent_id) ? 'not-allowed' : 'pointer'
                        }}
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
