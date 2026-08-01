import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { Bot } from 'lucide-react'
import type { ProductFormData } from '../../types'

interface Step2StrategyProps {
    formData: ProductFormData
    setFormData: Dispatch<SetStateAction<ProductFormData>>
    addMarketingTag: (tag: string) => void
    labelStyle: CSSProperties
}

export function Step2Strategy({ formData, addMarketingTag, labelStyle }: Step2StrategyProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <label style={labelStyle}>Arguments Marketing</label>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                    Sélectionnez les tags pour aider l'IA à vendre.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['Meilleure Vente', 'Nouveauté', 'Promo', 'Bio', 'Artisanal', 'Luxe', 'Garantie 2 ans', 'Livraison Rapide'].map(tag => (
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
