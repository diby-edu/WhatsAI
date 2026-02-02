import { Metadata } from 'next'
import { Mail, MapPin, MessageCircle } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Contact - WazzapAI',
    description: 'Contactez l\'équipe WazzapAI pour toute question ou demande.',
}

export default function ContactPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
            color: 'white',
            padding: '120px 24px 60px'
        }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <h1 style={{
                    fontSize: 'clamp(32px, 6vw, 48px)',
                    fontWeight: 800,
                    marginBottom: 32,
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Contactez-nous
                </h1>

                <p style={{ fontSize: 18, lineHeight: 1.8, color: '#94a3b8', marginBottom: 40 }}>
                    Notre équipe est là pour répondre à toutes vos questions.
                    N'hésitez pas à nous contacter via l'un des canaux ci-dessous.
                </p>

                <div style={{ display: 'grid', gap: 24 }}>
                    {/* WhatsApp */}
                    <a
                        href="https://wa.me/2250554585927?text=Bonjour%20!%20Je%20souhaite%20en%20savoir%20plus%20sur%20WazzapAI."
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 16,
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(30, 41, 59, 0.3) 100%)',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            textDecoration: 'none',
                            color: 'white',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: 'rgba(34, 197, 94, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MessageCircle style={{ width: 24, height: 24, color: '#4ade80' }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600 }}>WhatsApp</div>
                            <p style={{ fontSize: 14, color: '#94a3b8' }}>+225 05 54 58 59 27</p>
                        </div>
                    </a>

                    {/* Email */}
                    <a
                        href="mailto:support@wazzapai.com"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 24,
                            borderRadius: 16,
                            background: 'rgba(99, 102, 241, 0.1)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            textDecoration: 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24
                        }}>
                            📧
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 4 }}>Email</h3>
                            <p style={{ fontSize: 14, color: '#94a3b8' }}>support@wazzapai.com</p>
                        </div>
                    </a>

                    {/* Location */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: 24,
                        borderRadius: 16,
                        background: 'rgba(51, 65, 85, 0.3)',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            background: 'rgba(51, 65, 85, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24
                        }}>
                            📍
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 4 }}>Adresse</h3>
                            <p style={{ fontSize: 14, color: '#94a3b8' }}>Abidjan, Côte d'Ivoire</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
