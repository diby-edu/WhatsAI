import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { Plus, X, Loader2, Sparkles, Layers } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useToast } from '@/components/ui/Toast'
import { convertToFcfa, convertFromFcfa } from '@/lib/currency'
import type { ProductFormData } from '../types'

const ProductVariantsEditor = dynamic(() => import('@/components/dashboard/ProductVariantsEditor'), { ssr: false })

interface Step1DetailsProps {
    formData: ProductFormData
    setFormData: Dispatch<SetStateAction<ProductFormData>>
    labelStyle: CSSProperties
    inputStyle: CSSProperties
    buttonSecondaryStyle: CSSProperties
    getServicePlaceholders: () => { name: string, desc: string, category: string, descFull: string, content: string, features: string }
    toast: ReturnType<typeof useToast>
    analyzing: boolean
    setAnalyzing: Dispatch<SetStateAction<boolean>>
    analysisResult: any
    setAnalysisResult: Dispatch<SetStateAction<any>>
    currency: string
    contentInput: string
    setContentInput: Dispatch<SetStateAction<string>>
    featureInput: string
    setFeatureInput: Dispatch<SetStateAction<string>>
    addFeature: () => void
    digitalDeliveryType: 'fixed_content' | 'license_keys'
    setDigitalDeliveryType: Dispatch<SetStateAction<'fixed_content' | 'license_keys'>>
    digitalFileName: string
    setDigitalFileName: Dispatch<SetStateAction<string>>
    digitalContent: string
    setDigitalContent: Dispatch<SetStateAction<string>>
    uploadingDigital: boolean
    handleDigitalFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    licenseKeysInput: string
    setLicenseKeysInput: Dispatch<SetStateAction<string>>
}

export function Step1Details({
    formData,
    setFormData,
    labelStyle,
    inputStyle,
    buttonSecondaryStyle,
    getServicePlaceholders,
    toast,
    analyzing,
    setAnalyzing,
    analysisResult,
    setAnalysisResult,
    currency,
    contentInput,
    setContentInput,
    featureInput,
    setFeatureInput,
    addFeature,
    digitalDeliveryType,
    setDigitalDeliveryType,
    digitalFileName,
    setDigitalFileName,
    digitalContent,
    setDigitalContent,
    uploadingDigital,
    handleDigitalFileUpload,
    licenseKeysInput,
    setLicenseKeysInput,
}: Step1DetailsProps) {
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
                                toast.error('Description trop courte (min 10 caractères)')
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
                                    toast.error(data.error || "Erreur d'analyse")
                                }
                            } catch (e) {
                                toast.error('Erreur de connexion')
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
}
