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
    Bot
} from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'

interface LeadField {
    id: string
    name: string
    label: string
    type: 'text' | 'tel' | 'email' | 'number' | 'textarea'
    required: boolean
}

interface Agent {
    id: string
    name: string
    description: string
}

const defaultLeadFields: LeadField[] = [
    { id: '1', name: 'full_name', label: 'Nom complet', type: 'text', required: true },
    { id: '2', name: 'phone', label: 'Téléphone', type: 'tel', required: true },
]

export default function NewProductPage() {
    const t = useTranslations('Products.Wizard')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [agents, setAgents] = useState<Agent[]>([])
    const [loadingAgents, setLoadingAgents] = useState(true)

    const [formData, setFormData] = useState({
        agent_id: '',
        product_type: 'product' as 'product' | 'service',
        name: '',
        description: '',
        ai_instructions: '',
        price_fcfa: 0,
        category: '',
        stock_quantity: -1,
        is_available: true,
        lead_fields: defaultLeadFields,
        image_url: '',
        images: [] as string[]
    })

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Load agents on mount
    useEffect(() => {
        loadAgents()
    }, [])

    const loadAgents = async () => {
        try {
            const res = await fetch('/api/agents')
            const data = await res.json()
            if (data.success) {
                setAgents(data.data || [])
            }
        } catch (err) {
            console.error('Error loading agents:', err)
        } finally {
            setLoadingAgents(false)
        }
    }

    const steps = [
        { id: 'type', title: t('steps.type'), icon: Package },
        { id: 'details', title: t('steps.details'), icon: FileText },
        { id: 'price', title: t('steps.price'), icon: DollarSign },
        { id: 'lead', title: t('steps.lead'), icon: Users },
        { id: 'images', title: t('steps.images'), icon: ImageIcon },
    ]

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath)

            setFormData({
                ...formData,
                image_url: formData.image_url || publicUrl,
                images: [...formData.images, publicUrl]
            })
        } catch (err) {
            console.error('Upload error:', err)
        } finally {
            setUploading(false)
        }
    }

    const removeImage = (index: number) => {
        const newImages = formData.images.filter((_, i) => i !== index)
        setFormData({
            ...formData,
            images: newImages,
            image_url: newImages[0] || ''
        })
    }

    const addLeadField = () => {
        const newField: LeadField = {
            id: Date.now().toString(),
            name: '',
            label: '',
            type: 'text',
            required: false
        }
        setFormData({
            ...formData,
            lead_fields: [...formData.lead_fields, newField]
        })
    }

    const updateLeadField = (id: string, updates: Partial<LeadField>) => {
        setFormData({
            ...formData,
            lead_fields: formData.lead_fields.map(f =>
                f.id === id ? { ...f, ...updates } : f
            )
        })
    }

    const removeLeadField = (id: string) => {
        setFormData({
            ...formData,
            lead_fields: formData.lead_fields.filter(f => f.id !== id)
        })
    }

    const canProceed = () => {
        switch (currentStep) {
            case 0: return formData.agent_id !== ''
            case 1: return formData.name.trim() !== ''
            case 2: return true
            case 3: return true
            case 4: return true
            default: return false
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (!res.ok) throw new Error('Failed to create product')

            router.push('/dashboard/products')
        } catch (err) {
            console.error('Error creating product:', err)
        } finally {
            setLoading(false)
        }
    }

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            handleSubmit()
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    // Styles
    const cardStyle = {
        background: 'rgba(30, 41, 59, 0.5)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: 20,
        padding: 32
    }

    const inputStyle = {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        color: 'white',
        fontSize: 15,
        outline: 'none'
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
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
                    {t('back')}
                </Link>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{t('title')}</h1>
            </div>

            {/* Progress Steps */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
                {steps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = index === currentStep
                    const isCompleted = index < currentStep

                    return (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <div style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isCompleted
                                        ? 'linear-gradient(135deg, #10b981, #059669)'
                                        : isActive
                                            ? 'rgba(16, 185, 129, 0.2)'
                                            : 'rgba(51, 65, 85, 0.5)',
                                    border: isActive ? '2px solid #10b981' : '2px solid transparent',
                                    transition: 'all 0.3s'
                                }}>
                                    {isCompleted ? (
                                        <Check style={{ width: 20, height: 20, color: 'white' }} />
                                    ) : (
                                        <Icon style={{ width: 20, height: 20, color: isActive ? '#10b981' : '#64748b' }} />
                                    )}
                                </div>
                                <span style={{
                                    marginTop: 8,
                                    fontSize: 12,
                                    color: isActive ? 'white' : '#64748b',
                                    textAlign: 'center'
                                }}>
                                    {step.title}
                                </span>
                            </div>
                            {index < steps.length - 1 && (
                                <div style={{
                                    height: 2,
                                    flex: 1,
                                    background: index < currentStep ? '#10b981' : 'rgba(51, 65, 85, 0.5)',
                                    marginTop: -20
                                }} />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Step Content */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={cardStyle}
            >
                {/* Step 1: Type */}
                {currentStep === 0 && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                            {t('type.title')}
                        </h2>

                        {/* Agent Selection */}
                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 12, fontWeight: 500 }}>
                                {t('type.selectAgent')}
                            </label>
                            {loadingAgents ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b' }}>
                                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                    {t('type.loadingAgents')}
                                </div>
                            ) : agents.length === 0 ? (
                                <div style={{ padding: 20, background: 'rgba(251, 191, 36, 0.1)', borderRadius: 12, color: '#fbbf24' }}>
                                    {t('type.noAgents')}
                                    <Link href="/dashboard/agents/new" style={{ color: '#10b981', marginLeft: 8 }}>
                                        {t('type.createAgent')}
                                    </Link>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {agents.map(agent => (
                                        <button
                                            key={agent.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, agent_id: agent.id })}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 16,
                                                padding: 16,
                                                borderRadius: 12,
                                                background: formData.agent_id === agent.id
                                                    ? 'rgba(16, 185, 129, 0.15)'
                                                    : 'rgba(15, 23, 42, 0.6)',
                                                border: formData.agent_id === agent.id
                                                    ? '2px solid #10b981'
                                                    : '1px solid rgba(148, 163, 184, 0.2)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Bot style={{ width: 24, height: 24, color: 'white' }} />
                                            </div>
                                            <div>
                                                <div style={{ color: 'white', fontWeight: 600 }}>{agent.name}</div>
                                                <div style={{ color: '#64748b', fontSize: 13 }}>
                                                    {agent.description?.substring(0, 50) || t('type.noDescription')}
                                                </div>
                                            </div>
                                            {formData.agent_id === agent.id && (
                                                <Check style={{ marginLeft: 'auto', color: '#10b981' }} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Product Type */}
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 12, fontWeight: 500 }}>
                                {t('type.productOrService')}
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {['product', 'service'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, product_type: type as any })}
                                        style={{
                                            padding: 16,
                                            borderRadius: 12,
                                            background: formData.product_type === type
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : 'rgba(15, 23, 42, 0.6)',
                                            border: formData.product_type === type
                                                ? '2px solid #10b981'
                                                : '1px solid rgba(148, 163, 184, 0.2)',
                                            color: 'white',
                                            fontWeight: 500,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t(`type.${type}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Details */}
                {currentStep === 1 && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                            {t('details.title')}
                        </h2>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('details.name')}
                            </label>
                            <input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={t('details.namePlaceholder')}
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('details.description')}
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder={t('details.descriptionPlaceholder')}
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('details.aiInstructions')}
                            </label>
                            <textarea
                                value={formData.ai_instructions}
                                onChange={e => setFormData({ ...formData, ai_instructions: e.target.value })}
                                placeholder={t('details.aiInstructionsPlaceholder')}
                                rows={4}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                            <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
                                {t('details.aiInstructionsHelp')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 3: Price */}
                {currentStep === 2 && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                            {t('price.title')}
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('price.amount')}
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.price_fcfa}
                                    onChange={e => setFormData({ ...formData, price_fcfa: parseInt(e.target.value) || 0 })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                    {t('price.category')}
                                </label>
                                <input
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    placeholder={t('price.categoryPlaceholder')}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('price.stock')}
                            </label>
                            <input
                                type="number"
                                value={formData.stock_quantity}
                                onChange={e => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                                style={inputStyle}
                            />
                            <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
                                {t('price.stockHelp')}
                            </p>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 16,
                            background: 'rgba(15, 23, 42, 0.6)',
                            borderRadius: 12
                        }}>
                            <div>
                                <div style={{ color: 'white', fontWeight: 500 }}>{t('price.availability')}</div>
                                <div style={{ color: '#64748b', fontSize: 14 }}>{t('price.availabilityHelp')}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, is_available: !formData.is_available })}
                                style={{
                                    width: 52,
                                    height: 28,
                                    borderRadius: 14,
                                    background: formData.is_available ? '#10b981' : '#475569',
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                            >
                                <div style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: 3,
                                    left: formData.is_available ? 27 : 3,
                                    transition: 'left 0.2s'
                                }} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Lead */}
                {currentStep === 3 && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 8 }}>
                            {t('lead.title')}
                        </h2>
                        <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                            {t('lead.subtitle')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {formData.lead_fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr auto auto',
                                        gap: 12,
                                        alignItems: 'center',
                                        padding: 16,
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        borderRadius: 12
                                    }}
                                >
                                    <input
                                        value={field.label}
                                        onChange={e => updateLeadField(field.id, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                                        placeholder={t('lead.fieldLabel')}
                                        style={{ ...inputStyle, padding: 10 }}
                                    />
                                    <select
                                        value={field.type}
                                        onChange={e => updateLeadField(field.id, { type: e.target.value as any })}
                                        style={{ ...inputStyle, padding: 10 }}
                                    >
                                        <option value="text">{t('lead.types.text')}</option>
                                        <option value="tel">{t('lead.types.tel')}</option>
                                        <option value="email">{t('lead.types.email')}</option>
                                        <option value="number">{t('lead.types.number')}</option>
                                        <option value="textarea">{t('lead.types.textarea')}</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => updateLeadField(field.id, { required: !field.required })}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            background: field.required ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                                            border: 'none',
                                            color: field.required ? '#10b981' : '#64748b',
                                            cursor: 'pointer',
                                            fontSize: 13
                                        }}
                                    >
                                        {field.required ? t('lead.required') : t('lead.optional')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeLeadField(field.id)}
                                        style={{
                                            padding: 8,
                                            borderRadius: 8,
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 style={{ width: 16, height: 16, color: '#ef4444' }} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addLeadField}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginTop: 16,
                                padding: '12px 20px',
                                borderRadius: 10,
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px dashed #10b981',
                                color: '#10b981',
                                cursor: 'pointer',
                                width: '100%',
                                justifyContent: 'center'
                            }}
                        >
                            <Plus style={{ width: 18, height: 18 }} />
                            {t('lead.addField')}
                        </button>
                    </div>
                )}

                {/* Step 5: Images */}
                {currentStep === 4 && (
                    <div>
                        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 24 }}>
                            {t('images.title')}
                        </h2>

                        {/* Upload Zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed rgba(148, 163, 184, 0.3)',
                                borderRadius: 16,
                                padding: 40,
                                textAlign: 'center',
                                cursor: 'pointer',
                                marginBottom: 20
                            }}
                        >
                            {uploading ? (
                                <Loader2 style={{ width: 40, height: 40, color: '#10b981', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <>
                                    <Upload style={{ width: 40, height: 40, color: '#64748b', margin: '0 auto 12px' }} />
                                    <p style={{ color: '#94a3b8' }}>{t('images.upload')}</p>
                                    <p style={{ color: '#64748b', fontSize: 13 }}>{t('images.formats')}</p>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />

                        {/* Image Gallery */}
                        {formData.images.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {formData.images.map((img, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            position: 'relative',
                                            aspectRatio: '1',
                                            borderRadius: 12,
                                            overflow: 'hidden',
                                            border: index === 0 ? '2px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)'
                                        }}
                                    >
                                        <img
                                            src={img}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        {index === 0 && (
                                            <span style={{
                                                position: 'absolute',
                                                bottom: 8,
                                                left: 8,
                                                padding: '4px 8px',
                                                background: '#10b981',
                                                borderRadius: 6,
                                                fontSize: 11,
                                                color: 'white'
                                            }}>
                                                {t('images.main')}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            style={{
                                                position: 'absolute',
                                                top: 8,
                                                right: 8,
                                                width: 28,
                                                height: 28,
                                                borderRadius: 8,
                                                background: 'rgba(239, 68, 68, 0.9)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <X style={{ width: 16, height: 16, color: 'white' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <button
                        type="button"
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 24px',
                            borderRadius: 12,
                            background: 'rgba(51, 65, 85, 0.5)',
                            border: 'none',
                            color: currentStep === 0 ? '#475569' : 'white',
                            cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 500
                        }}
                    >
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        {t('nav.prev')}
                    </button>

                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={!canProceed() || loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 24px',
                            borderRadius: 12,
                            background: canProceed()
                                ? 'linear-gradient(135deg, #10b981, #059669)'
                                : 'rgba(51, 65, 85, 0.5)',
                            border: 'none',
                            color: 'white',
                            cursor: canProceed() && !loading ? 'pointer' : 'not-allowed',
                            fontWeight: 600
                        }}
                    >
                        {loading ? (
                            <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        ) : currentStep === steps.length - 1 ? (
                            <>
                                <Check style={{ width: 16, height: 16 }} />
                                {t('nav.create')}
                            </>
                        ) : (
                            <>
                                {t('nav.next')}
                                <ArrowRight style={{ width: 16, height: 16 }} />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
