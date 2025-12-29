import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Contact - WhatsAI',
    description: 'Contactez l\'équipe WhatsAI pour toute question ou demande.',
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
                        href="https://wa.me/2250718287025?text=Bonjour%20!%20Je%20souhaite%20en%20savoir%20plus%20sur%20WhatsAI."
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 24,
                            borderRadius: 16,
                            background: 'rgba(37, 211, 102, 0.1)',
                            border: '1px solid rgba(37, 211, 102, 0.3)',
                            textDecoration: 'none',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #25D366, #128C7E)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'white', marginBottom: 4 }}>WhatsApp</h3>
                            <p style={{ fontSize: 14, color: '#94a3b8' }}>+225 07 18 28 70 25</p>
                        </div>
                    </a>

                    {/* Email */}
                    <a
                        href="mailto:contact@whatsai.com"
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
                            <p style={{ fontSize: 14, color: '#94a3b8' }}>contact@whatsai.com</p>
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
