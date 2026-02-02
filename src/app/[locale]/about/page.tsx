import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'À propos - WazzapAI',
    description: 'Découvrez WazzapAI, la solution d\'automatisation WhatsApp propulsée par l\'intelligence artificielle.',
}

export default function AboutPage() {
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
                    À propos de WazzapAI
                </h1>

                <section style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>
                        Notre Mission
                    </h2>
                    <p style={{ fontSize: 16, lineHeight: 1.8, color: '#94a3b8', marginBottom: 16 }}>
                        WazzapAI est né d'une vision simple : permettre aux entreprises africaines de répondre
                        à leurs clients 24h/24, 7j/7, sans sacrifier la qualité du service ni mobiliser
                        des ressources humaines considérables.
                    </p>
                    <p style={{ fontSize: 16, lineHeight: 1.8, color: '#94a3b8' }}>
                        Grâce à l'intelligence artificielle, nous transformons WhatsApp en un puissant
                        outil de vente et de support client automatisé.
                    </p>
                </section>

                <section style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>
                        Pourquoi WazzapAI ?
                    </h2>
                    <ul style={{ fontSize: 16, lineHeight: 2, color: '#94a3b8', paddingLeft: 24 }}>
                        <li>✅ <strong style={{ color: 'white' }}>Réponses instantanées</strong> - Vos clients n'attendent plus</li>
                        <li>✅ <strong style={{ color: 'white' }}>Personnalisation</strong> - L'IA s'adapte à votre ton et vos produits</li>
                        <li>✅ <strong style={{ color: 'white' }}>Économies</strong> - Réduisez vos coûts de support client</li>
                        <li>✅ <strong style={{ color: 'white' }}>Évolutif</strong> - Gérez des milliers de conversations simultanément</li>
                    </ul>
                </section>

                <section style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16, color: '#e2e8f0' }}>
                        Notre Équipe
                    </h2>
                    <p style={{ fontSize: 16, lineHeight: 1.8, color: '#94a3b8' }}>
                        Basée en Côte d'Ivoire, notre équipe combine expertise en intelligence artificielle,
                        développement logiciel et connaissance approfondie des besoins des entreprises africaines.
                    </p>
                </section>

                <section style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#34d399' }}>
                        Contactez-nous
                    </h2>
                    <p style={{ fontSize: 16, color: '#94a3b8' }}>
                        📍 Abidjan, Côte d'Ivoire<br />
                        📧 support@wazzapai.com<br />
                        📱 +225 05 54 58 59 27
                    </p>
                </section>
            </div>
        </div>
    )
}
