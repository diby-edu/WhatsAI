'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Loader2, Upload, X, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { useTranslations } from 'next-intl'

export default function NewProductPage() {
    const t = useTranslations('Products.Form')
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price_fcfa: 0,
        category: '',
        sku: '',
        image_url: '',
        is_available: true,
        stock_quantity: -1
    })

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Preview
        const reader = new FileReader()
        reader.onload = (e) => setImagePreview(e.target?.result as string)
        reader.readAsDataURL(file)

        // Upload to Supabase Storage
        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `products/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath)

            setFormData({ ...formData, image_url: publicUrl })
        } catch (err) {
            console.error('Upload error:', err)
            alert(t('errors.upload'))
        } finally {
            setUploading(false)
        }
    }

    const removeImage = () => {
        setImagePreview(null)
        setFormData({ ...formData, image_url: '' })
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
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
            alert(t('errors.create'))
        } finally {
            setLoading(false)
        }
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
                    {t('return')}
                </Link>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{t('title_new')}</h1>
            </div>

            <form onSubmit={handleSubmit}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        padding: 24
                    }}
                >
                    {/* Image Upload */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                            {t('image.label')}
                        </label>
                        <div style={{
                            border: '2px dashed rgba(148, 163, 184, 0.2)',
                            borderRadius: 12,
                            padding: 24,
                            textAlign: 'center',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            minHeight: 200,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: imagePreview ? `url(${imagePreview}) center/cover` : 'transparent'
                        }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {!imagePreview && !uploading && (
                                <div>
                                    <Upload style={{ width: 40, height: 40, color: '#64748b', margin: '0 auto 12px' }} />
                                    <p style={{ color: '#94a3b8', marginBottom: 8 }}>{t('image.placeholder')}</p>
                                    <p style={{ color: '#64748b', fontSize: 12 }}>{t('image.help')}</p>
                                </div>
                            )}
                            {uploading && (
                                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
                            )}
                            {imagePreview && !uploading && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeImage(); }}
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 12,
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        background: 'rgba(239, 68, 68, 0.9)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <X style={{ width: 18, height: 18, color: 'white' }} />
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {/* Name */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                            {t('fields.name')}
                        </label>
                        <input
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Consultation 30 minutes"
                            style={{
                                width: '100%',
                                padding: 14,
                                borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                fontSize: 16
                            }}
                        />
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                            {t('fields.description')}
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Décrivez votre produit ou service..."
                            rows={4}
                            style={{
                                width: '100%',
                                padding: 14,
                                borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.5)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: 'white',
                                fontSize: 16,
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* Price & Category */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('fields.price')}
                            </label>
                            <input
                                type="number"
                                required
                                min={0}
                                value={formData.price_fcfa}
                                onChange={e => setFormData({ ...formData, price_fcfa: parseInt(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 16
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('fields.category')}
                            </label>
                            <input
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                placeholder="Ex: Services, Produits..."
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 16
                                }}
                            />
                        </div>
                    </div>

                    {/* SKU & Stock */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('fields.sku')}
                            </label>
                            <input
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="Ex: PROD-001"
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 16
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#e2e8f0', marginBottom: 8, fontWeight: 500 }}>
                                {t('fields.stock')}
                            </label>
                            <input
                                type="number"
                                value={formData.stock_quantity}
                                onChange={e => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: 14,
                                    borderRadius: 10,
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    color: 'white',
                                    fontSize: 16
                                }}
                            />
                        </div>
                    </div>

                    {/* Availability Toggle */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                        background: 'rgba(15, 23, 42, 0.5)',
                        borderRadius: 10,
                        marginBottom: 24
                    }}>
                        <div>
                            <div style={{ color: 'white', fontWeight: 500 }}>{t('availability.label')}</div>
                            <div style={{ color: '#64748b', fontSize: 14 }}>{t('availability.description')}</div>
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
                                position: 'relative',
                                transition: 'background 0.2s'
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

                    {/* Submit */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Link
                            href="/dashboard/products"
                            style={{
                                padding: '14px 24px',
                                background: 'rgba(51, 65, 85, 0.5)',
                                color: '#94a3b8',
                                borderRadius: 12,
                                textDecoration: 'none',
                                fontWeight: 600
                            }}
                        >
                            {t('actions.cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || uploading}
                            style={{
                                padding: '14px 24px',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 12,
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={18} /> : <Save size={18} />}
                            {t('actions.create')}
                        </button>
                    </div>
                </motion.div>
            </form>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
