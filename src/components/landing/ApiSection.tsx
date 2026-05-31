'use client'

import { motion } from 'framer-motion'
import { Code2, Zap, Link2, Webhook } from 'lucide-react'

const CODE_SNIPPET = `POST /api/public/v1/incoming/{token}

{
  "event": "successful.sale",
  "customer": {
    "name": "Marie Dupont",
    "phone": "2250700000000"
  },
  "product": {
    "name": "Pack Premium",
    "url": "https://ma-boutique.com/pack"
  },
  "sale": {
    "id": "SALE_ABC123",
    "amount": { "formatted": "25 000 FCFA" }
  }
}`

const INTEGRATIONS = [
    { label: 'Chariow', color: '#f59e0b', verified: true },
    { label: 'Shopify', color: '#96bf48', verified: false },
    { label: 'WooCommerce', color: '#7f54b3', verified: false },
    { label: 'Webhook', color: '#3b82f6', verified: true },
    { label: 'Code custom', color: '#25d366', verified: true },
]

const CAPABILITIES = [
    { icon: Zap, text: 'Envoi automatique de messages à chaque événement e-commerce' },
    { icon: Webhook, text: 'Réception de webhooks depuis n\'importe quelle plateforme' },
    { icon: Link2, text: 'Connexion directe à votre boutique en quelques minutes' },
    { icon: Code2, text: 'Intégration dans votre propre code avec une clé API' },
]

export default function ApiSection() {
    return (
        <section id="api" style={{
            padding: '80px 24px',
            background: 'linear-gradient(180deg, #0a0f1e 0%, #060b17 100%)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow background */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 600, height: 400,
                background: 'radial-gradient(ellipse, rgba(37,211,102,0.04) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '6px 14px', borderRadius: 20,
                            background: 'rgba(37,211,102,0.08)',
                            border: '1px solid rgba(37,211,102,0.2)',
                            marginBottom: 20,
                        }}>
                            <Code2 size={13} color="#25d366" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#25d366', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                Mode Développeur — dès le plan Pro
                            </span>
                        </div>
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9', margin: '0 0 14px', lineHeight: 1.2 }}>
                            Connectez votre boutique<br />
                            <span style={{ color: '#25d366' }}>directement à WhatsApp</span>
                        </h2>
                        <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                            Vente réussie, panier abandonné, paiement échoué — WazzapAI envoie automatiquement
                            le bon message WhatsApp au bon moment, sans action manuelle.
                        </p>
                    </motion.div>
                </div>

                {/* Content grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 40,
                    alignItems: 'start',
                }}>
                    {/* Left — capabilities + integrations */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
                            {CAPABILITIES.map((cap, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                        background: 'rgba(37,211,102,0.08)',
                                        border: '1px solid rgba(37,211,102,0.15)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <cap.icon size={15} color="#25d366" />
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, margin: 0, paddingTop: 7 }}>
                                        {cap.text}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Integrations */}
                        <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                                Plateformes compatibles
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {INTEGRATIONS.map((p) => (
                                    <div key={p.label} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '5px 10px', borderRadius: 7,
                                        background: 'rgba(15,23,42,0.6)',
                                        border: `1px solid ${p.verified ? 'rgba(37,211,102,0.2)' : 'rgba(100,116,139,0.2)'}`,
                                    }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
                                        <span style={{ fontSize: 12, color: p.verified ? '#cbd5e1' : '#64748b', fontWeight: 500 }}>{p.label}</span>
                                        {!p.verified && (
                                            <span style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>Bientôt</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Right — code snippet */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        <div style={{
                            borderRadius: 14,
                            overflow: 'hidden',
                            border: '1px solid rgba(37,211,102,0.15)',
                            background: 'rgba(6,11,23,0.9)',
                            boxShadow: '0 0 40px rgba(37,211,102,0.05)',
                        }}>
                            {/* Terminal bar */}
                            <div style={{
                                padding: '10px 16px',
                                background: 'rgba(15,23,42,0.8)',
                                borderBottom: '1px solid rgba(37,211,102,0.1)',
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                                <span style={{ marginLeft: 10, fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                                    webhook • vente réussie → WhatsApp envoyé
                                </span>
                            </div>
                            <pre style={{
                                margin: 0, padding: '20px 20px',
                                fontSize: 12, lineHeight: 1.7,
                                color: '#94a3b8',
                                fontFamily: '"Fira Code", "Cascadia Code", monospace',
                                overflowX: 'auto',
                                whiteSpace: 'pre',
                            }}>
                                {CODE_SNIPPET.split('\n').map((line, i) => {
                                    let color = '#94a3b8'
                                    if (line.startsWith('POST')) color = '#25d366'
                                    else if (line.includes('"event"')) color = '#60a5fa'
                                    else if (line.includes('"name"') || line.includes('"phone"') || line.includes('"url"') || line.includes('"id"') || line.includes('"formatted"')) color = '#f59e0b'
                                    else if (line.includes('"customer"') || line.includes('"product"') || line.includes('"sale"') || line.includes('"amount"')) color = '#c084fc'
                                    return <span key={i} style={{ display: 'block', color }}>{line}</span>
                                })}
                            </pre>
                        </div>
                    </motion.div>
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    style={{ textAlign: 'center', marginTop: 48 }}
                >
                    <a href="/register" style={{
                        display: 'inline-block', padding: '13px 32px', borderRadius: 12,
                        background: 'linear-gradient(135deg, #25d366, #1aab55)',
                        color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
                        boxShadow: '0 0 24px rgba(37,211,102,0.25)',
                    }}>
                        Commencer gratuitement
                    </a>
                    <p style={{ color: '#475569', fontSize: 12, marginTop: 10 }}>
                        Mode développeur inclus dès le plan Pro · Aucune configuration complexe
                    </p>
                </motion.div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    section > div > div:nth-child(2) {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </section>
    )
}
