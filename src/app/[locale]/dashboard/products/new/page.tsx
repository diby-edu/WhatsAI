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
import ProductVariantsEditor, { VariantGroup } from '@/components/dashboard/ProductVariantsEditor'

export default function NewProductPage() {
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<{ id: string, name: string }[]>([])
    const [currency, setCurrency] = useState('USD')

    // Form Data
    const [formData, setFormData] = useState({
        // Basics
        name: '',
        price_fcfa: '' as string | number, // Allow empty string for input
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
        } else {
            setFormData(prev => ({ ...prev, marketing_tags: prev.marketing_tags.filter(t => t !== tag) }))
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            // Prepare data with proper types
            const dataToSend = {
                ...formData,
                price_fcfa: parseFloat(String(formData.price_fcfa)) || 0 // Convert to number
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {[
                                    { id: 'product', label: '📦 Physique', desc: 'Produit livrable' },
                                    { id: 'digital', label: '💻 Numérique', desc: 'Téléchargement' },
                                    { id: 'service', label: '🛠️ Service', desc: 'Prestation' }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, product_type: type.id })}
                                        style={{
                                            padding: 16,
                                            borderRadius: 12,
                                            border: formData.product_type === type.id ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
                                            background: formData.product_type === type.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                            textAlign: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ fontSize: 18 }}>{type.label}</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Image Upload */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: 120,
                                    height: 120,
                                    borderRadius: 20,
                                    border: '2px dashed rgba(148, 163, 184, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    position: 'relative'
                                }}
                            >
                                {formData.image_url ? (
                                    <img src={formData.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        {uploading ? <Loader2 size={24} className="animate-spin text-emerald-500" /> : <ImageIcon size={24} color="#64748b" />}
                                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>PHOTO</div>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Nom du Produit</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Bougie Vanille"
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={labelStyle}>Prix ({currency})</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={formData.price_fcfa}
                                        onChange={e => {
                                            const val = e.target.value
                                            // Allow empty or numeric values
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                setFormData({ ...formData, price_fcfa: val === '' ? '' : val })
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
                                    placeholder="Ex: Maison"
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Agent Vendeur</label>
                            <select
                                value={formData.agent_id}
                                onChange={e => setFormData({ ...formData, agent_id: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">Tous les agents</option>
                                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                    </div>
                )

            case 1: // DETAILS
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={labelStyle}>Pitch Commercial (Court)</label>
                            <input
                                type="text"
                                value={formData.short_pitch}
                                onChange={e => setFormData({ ...formData, short_pitch: e.target.value })}
                                maxLength={150}
                                placeholder="Ex: L'élégance ultime pour votre salon."
                                style={inputStyle}
                            />
                            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                {formData.short_pitch.length}/150
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Caractéristiques (Tags)</label>
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
                                    placeholder="Ex: Bio, Fait main, Taille L, Couleur Rouge..."
                                    style={inputStyle}
                                />
                                <button onClick={addFeature} style={{ ...buttonSecondaryStyle, padding: '0 16px' }}>
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <div style={{
                            padding: 20,
                            background: 'rgba(30, 41, 59, 0.3)',
                            borderRadius: 12,
                            border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Layers size={16} className="text-blue-400" /> Variantes
                            </h3>
                            {/* Integrating existing component but wrapped gently */}
                            <ProductVariantsEditor
                                variants={formData.variants}
                                onChange={v => setFormData({ ...formData, variants: v })}
                                currency={currency}
                            />
                        </div>
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
