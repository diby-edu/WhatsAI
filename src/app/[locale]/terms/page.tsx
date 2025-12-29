import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Conditions Générales d\'Utilisation - WhatsAI',
    description: 'Conditions générales d\'utilisation du service WhatsAI.',
}

export default function TermsPage() {
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
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Conditions Générales d'Utilisation
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>
                    Dernière mise à jour : Décembre 2025
                </p>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        1. Acceptation des conditions
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        En utilisant WhatsAI, vous acceptez ces conditions générales d'utilisation.
                        Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        2. Description du service
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        WhatsAI est une plateforme d'automatisation qui permet de gérer vos conversations
                        WhatsApp à l'aide de l'intelligence artificielle. Le service inclut la création
                        d'agents IA, la gestion des conversations et des outils d'analytics.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        3. Compte utilisateur
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Vous êtes responsable de la confidentialité de vos identifiants de connexion.
                        Vous devez nous informer immédiatement de toute utilisation non autorisée de votre compte.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        4. Utilisation acceptable
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Vous vous engagez à ne pas utiliser WhatsAI pour :<br />
                        • Envoyer du spam ou des messages non sollicités<br />
                        • Harceler ou menacer d'autres utilisateurs<br />
                        • Violer les conditions d'utilisation de WhatsApp<br />
                        • Toute activité illégale
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        5. Paiement et remboursement
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Les paiements sont traités via CinetPay. Les abonnements sont renouvelés automatiquement
                        sauf annulation. Les crédits non utilisés ne sont pas remboursables mais restent
                        disponibles jusqu'à la fin de votre période d'abonnement.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        6. Limitation de responsabilité
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        WhatsAI est fourni "tel quel". Nous ne garantissons pas que le service sera
                        ininterrompu ou exempt d'erreurs. Nous ne sommes pas responsables des pertes
                        indirectes résultant de l'utilisation de notre service.
                    </p>
                </section>

                <section style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#34d399' }}>
                        Contact
                    </h2>
                    <p style={{ fontSize: 15, color: '#94a3b8' }}>
                        Pour toute question concernant ces conditions : legal@whatsai.com
                    </p>
                </section>
            </div>
        </div>
    )
}
