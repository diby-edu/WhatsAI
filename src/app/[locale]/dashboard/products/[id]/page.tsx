'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    Package,
    Layers,
    Bot,
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
        images: [] as string[], // Une seule image (voir handleImageUpload) — array conserve pour compat avec image_url
        image_url: '',
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
            restaurant: { name: "Ex: Table, Menu Dégustation, Brunch...", category: "Restauration", descFull: "Décrivez la formule : type de menu, nombre de plats, boissons incluses, ambiance...", content: "Ex: Terrasse, Parking, Halal, Végétarien, Live music, Climatisé...", features: "Ex: Halal, Végétarien, Terrasse, Live music..." },
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
        setFormData(prev => ({
            ...prev,
            agent_id: agentId,
            product_type: mapped?.product_type || prev.product_type,
            service_subtype: mapped?.service_subtype || '',
            menu_section_slug: mapped?.service_subtype === 'restaurant' ? prev.menu_section_slug : '',
            menu_sort_order: mapped?.service_subtype === 'restaurant' ? prev.menu_sort_order : '',
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
        } else {
            setFormData(prev => ({ ...prev, marketing_tags: prev.marketing_tags.filter(t => t !== tag) }))
        }
    }

    const handleSave = async (silent = false): Promise<boolean> => {
        if (!formData.agent_id) {
            toast.error('Veuillez sélectionner un agent vendeur — le type de produit en dépend.')
            return false
        }
        if (!formData.name?.trim()) {
            toast.error('Le nom du produit est requis.')
            setCurrentStep(0)
            return false
        }
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
            return true
        } catch (error: any) {
            if (!silent) toast.error(`Erreur sauvegarde : ${error?.message || 'inconnue'}`)
            return false
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

    // --- STYLES (identiques au wizard de création) ---
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

    if (loading) {
        return (
            <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40, display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
                <Loader2 className="animate-spin" style={{ color: '#34d399' }} />
            </div>
        )
    }

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <Step0Basics
                        formData={formData}
                        setFormData={setFormData}
                        labelStyle={labelStyle}
                        inputStyle={inputStyle}
                        featureFlags={featureFlags}
                        selectAgent={selectAgent}
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
                        labelStyle={labelStyle}
                    />
                )
        }
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
            {/* Header */}
            <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
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
                        Modifier le Produit
                    </h1>
                    <p style={{ color: '#94a3b8' }}>
                        {STEPS[currentStep].title}
                    </p>
                </div>
                <button
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    style={{ ...buttonSecondaryStyle, opacity: saving ? 0.7 : 1 }}
                >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Sauver
                </button>
            </div>

            {/* Progress steps */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 8 }}>
                {STEPS.map((step, index) => (
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
                        {index < STEPS.length - 1 && (
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
                    {STEPS[currentStep].title}
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
                {renderStep()}
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

                {currentStep < STEPS.length - 1 ? (
                    <button
                        onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                        disabled={currentStep === 0 && (!formData.agent_id || !formData.name?.trim())}
                        style={{
                            ...buttonPrimaryStyle,
                            opacity: (currentStep === 0 && (!formData.agent_id || !formData.name?.trim())) ? 0.5 : 1,
                            cursor: (currentStep === 0 && (!formData.agent_id || !formData.name?.trim())) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Suivant
                        <ArrowRight style={{ width: 16, height: 16 }} />
                    </button>
                ) : (
                    <button
                        onClick={async () => {
                            const ok = await handleSave(false)
                            if (ok) router.push('/dashboard/products')
                        }}
                        disabled={saving}
                        style={{
                            ...buttonPrimaryStyle,
                            opacity: saving ? 0.7 : 1
                        }}
                    >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                        Enregistrer les modifications
                    </button>
                )}
            </div>
        </div>
    )
}
