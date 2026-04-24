'use client'

import { useMemo } from 'react'

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
    const whatsappLink = useMemo(() => {
        const phoneDigits = OFFICIAL_WHATSAPP.replace(/\D+/g, '')
        const prefilled = encodeURIComponent(
            'Bonjour WazzapAI, jai fait un transfert manuel. Voici ma capture de paiement.'
        )
        return `https://wa.me/${phoneDigits}?text=${prefilled}`
    }, [])

    return (
        <div
            style={{
                padding: compact ? '10px 12px' : '12px 14px',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.34)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}
        >
            <div>
                <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: compact ? 13 : 14 }}>
                    Paiement alternatif (si votre moyen ne passe pas)
                </div>
                <div
                    style={{
                        color: '#cbd5e1',
                        fontSize: 12,
                        marginTop: 4,
                        lineHeight: 1.5,
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                    }}
                >
                    <span>
                        Si votre pays ou moyen de paiement ne figure pas dans l application, vous pouvez faire
                        un transfert direct puis envoyer la capture au WhatsApp officiel.
                    </span>
                    <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            height: 30,
                            borderRadius: 7,
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white',
                            padding: '0 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            textDecoration: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Ouvrir WhatsApp
                    </a>
                </div>
            </div>

            <details
                style={{
                    background: 'rgba(15, 23, 42, 0.32)',
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    borderRadius: 8,
                    padding: '6px 8px',
                }}
            >
                <summary
                    style={{
                        color: '#cbd5e1',
                        fontSize: 12,
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    Voir les numeros de transfert
                </summary>

                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    {MANUAL_PAYMENT_METHODS.map((method) => (
                        <div
                            key={`${method.label}-${method.phone}`}
                            style={{
                                color: '#e2e8f0',
                                fontSize: 12,
                                lineHeight: 1.45,
                            }}
                        >
                            <strong>{method.label}:</strong> {method.phone}
                        </div>
                    ))}
                </div>
            </details>

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
        </div>
    )
}
