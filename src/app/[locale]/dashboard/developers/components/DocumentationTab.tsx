import { BookOpen, Shield } from 'lucide-react'
import { sectionStyle } from '../styles'

export function DocumentationTab() {
    return (
        <div style={{ display: 'grid', gap: 20 }}>
            <div style={sectionStyle}>
                <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} />
                    Ce que chaque endpoint fait
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    {[
                        { method: 'POST', path: '/api/public/v1/send', desc: 'Envoi bas niveau: tu fournis deja le texte exact a envoyer.' },
                        { method: 'POST', path: '/api/public/v1/trigger', desc: 'Envoi metier: tu fournis un evenement structure, WazzapAI construit le bon message.' },
                        { method: 'POST', path: '/api/public/v1/platform-webhook', desc: 'Ingestion webhook plateforme: payload Shopify/Woo/Chariow/Maketou mappe vers un trigger.' },
                        { method: 'POST', path: '/api/public/v1/incoming/{webhook_token}', desc: 'Ingestion webhook directe (sans n8n): auth par token URL + signature HMAC fournisseur.' },
                        { method: 'POST/DELETE', path: '/api/public/v1/sync', desc: 'Memoire metier: tu pousses ou retires des donnees externes pour un agent.' },
                        { method: 'GET', path: '/api/public/v1/status', desc: 'Lecture de l etat de l agent et de sa connexion WhatsApp.' },
                        { method: 'GET', path: '/api/public/v1/conversations', desc: 'Liste les conversations accessibles a la cle.' },
                        { method: 'GET', path: '/api/public/v1/conversation', desc: 'Detaille une conversation et ses messages.' },
                    ].map(item => (
                        <div
                            key={item.path}
                            style={{
                                padding: 14,
                                borderRadius: 12,
                                border: '1px solid var(--border, #2a2a3e)',
                                background: 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#25d366', marginBottom: 6 }}>
                                {item.method}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary, #fff)', marginBottom: 8 }}>
                                {item.path}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                                {item.desc}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={sectionStyle}>
                <h2 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--text-primary, #fff)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} />
                    Regles utiles
                </h2>

                <div style={{ display: 'grid', gap: 10, color: 'var(--text-secondary, #9ca3af)', fontSize: 13, lineHeight: 1.6 }}>
                    <div>1. Une cle sans scope agent peut appeler tous tes agents autorises sur le compte.</div>
                    <div>2. Une cle avec scope agent limite strictement les endpoints publics a ces agents la.</div>
                    <div>3. Utilise toujours un <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>idempotency_key</code> pour les evenements retry-cotes plateforme.</div>
                    <div>4. Les webhooks servent pour la sortie d'événements WazzapAI vers ta plateforme ; les connexions API (clés sk_live_*) servent pour les appels entrants de ta plateforme vers WazzapAI.</div>
                    <div>5. En mode direct <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>/incoming/{'{'}webhook_token{'}'}</code>, protege toujours le flux avec la signature HMAC de la plateforme.</div>
                </div>
            </div>
        </div>
    )
}
