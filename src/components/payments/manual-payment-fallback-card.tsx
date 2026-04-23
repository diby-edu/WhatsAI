'use client'

import { useMemo, useState } from 'react'

type ManualPaymentFallbackCardProps = {
    compact?: boolean
}

const MANUAL_PAYMENT_METHODS = [
    { label: 'Orange Money', phone: '+2250747094746' },
    { label: 'MTN Money', phone: '+2250554585927' },
    { label: 'Moov Money', phone: '+2250141859625' },
    { label: 'Wave', phone: '+2250747094746' },
    { label: 'Djamo', phone: '+2250747094746' },
]

const OFFICIAL_WHATSAPP = '+2250554585927'

export default function ManualPaymentFallbackCard({ compact = false }: ManualPaymentFallbackCardProps) {
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

    const whatsappLink = useMemo(() => {
        const phoneDigits = OFFICIAL_WHATSAPP.replace(/\D+/g, '')
        const prefilled = encodeURIComponent(
            'Bonjour WazzapAI, jai fait un transfert manuel. Voici ma capture de paiement.'
        )
        return `https://wa.me/${phoneDigits}?text=${prefilled}`
    }, [])

    const copyText = async (text: string, label: string) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
                setCopyFeedback(`${label} copie`)
                setTimeout(() => setCopyFeedback(null), 2500)
                return
            }
        } catch {
            // silent fallback below
        }

        if (typeof window !== 'undefined') {
            window.prompt(`Copiez ${label}:`, text)
        }
    }

    return (
        <div
            style={{
                padding: compact ? 14 : 16,
                borderRadius: 12,
                background: 'rgba(30, 41, 59, 0.38)',
                border: '1px solid rgba(245, 158, 11, 0.32)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}
        >
            <div>
                <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: compact ? 14 : 15 }}>
                    Paiement alternatif (si votre moyen ne passe pas)
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    Si votre pays ou moyen de paiement ne figure pas dans l application, vous pouvez faire
                    un transfert direct puis envoyer la capture au WhatsApp officiel.
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                {MANUAL_PAYMENT_METHODS.map((method) => (
                    <div
                        key={`${method.label}-${method.phone}`}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'rgba(15, 23, 42, 0.45)',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                        }}
                    >
                        <div style={{ color: '#e2e8f0', fontSize: 13 }}>
                            <strong>{method.label}:</strong> {method.phone}
                        </div>
                        <button
                            type="button"
                            onClick={() => copyText(method.phone, method.label)}
                            style={{
                                height: 30,
                                borderRadius: 7,
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                background: 'rgba(30, 41, 59, 0.7)',
                                color: '#e2e8f0',
                                padding: '0 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                            }}
                        >
                            Copier
                        </button>
                    </div>
                ))}
            </div>

            <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.55 }}>
                Apres le transfert, envoyez la capture d ecran au WhatsApp officiel:
                {' '}
                <strong>{OFFICIAL_WHATSAPP}</strong>.
                {' '}
                En cas de desagrement, vous beneficiez de
                {' '}
                <strong style={{ color: '#4ade80' }}>10% de bonus</strong>
                {' '}
                apres validation.
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => copyText(OFFICIAL_WHATSAPP, 'WhatsApp officiel')}
                    style={{
                        height: 34,
                        borderRadius: 8,
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        background: 'rgba(15, 23, 42, 0.6)',
                        color: '#e2e8f0',
                        padding: '0 12px',
                        cursor: 'pointer',
                        fontSize: 12,
                    }}
                >
                    Copier WhatsApp officiel
                </button>
                <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                        height: 34,
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    Ouvrir WhatsApp
                </a>
            </div>

            {copyFeedback && (
                <div style={{ color: '#86efac', fontSize: 12 }}>
                    {copyFeedback}
                </div>
            )}
        </div>
    )
}
