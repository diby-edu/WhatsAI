import { Metadata } from 'next'

export const metadata: Metadata = {
    title: "Conditions Generales d'Utilisation - WazzapAI",
    description: "Conditions generales d'utilisation du service WazzapAI.",
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
                    Conditions Generales d'Utilisation
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>
                    Derniere mise a jour : Avril 2026
                </p>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        1. Acceptation des conditions
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        En utilisant WazzapAI, vous acceptez ces conditions generales d'utilisation.
                        Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        2. Description du service
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        WazzapAI est une plateforme d'automatisation qui permet de gerer vos conversations
                        WhatsApp a l'aide de l'intelligence artificielle. Le service inclut la creation
                        d'agents IA, la gestion des conversations et des outils d'analytics.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        3. Compte utilisateur
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Vous etes responsable de la confidentialite de vos identifiants de connexion.
                        Vous devez nous informer immediatement de toute utilisation non autorisee de votre compte.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        4. Utilisation acceptable
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Vous vous engagez a ne pas utiliser WazzapAI pour :<br />
                        • Envoyer du spam ou des messages non sollicites<br />
                        • Harceler ou menacer d'autres utilisateurs<br />
                        • Violer les conditions d'utilisation de WhatsApp<br />
                        • Toute activite illegale
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        5. Paiement et remboursement
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Les paiements en ligne sont traites via le fournisseur de paiement actif de la plateforme.
                        Les abonnements sont renouveles automatiquement sauf annulation. Les credits non utilises
                        ne sont pas remboursables mais restent disponibles jusqu'a la fin de votre periode d'abonnement.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        6. Limitation de responsabilite
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        WazzapAI est fourni "tel quel". Nous ne garantissons pas que le service sera
                        ininterrompu ou exempt d'erreurs. Nous ne sommes pas responsables des pertes
                        indirectes resultant de l'utilisation de notre service.
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
                        Pour toute question concernant ces conditions : support@wazzapai.com
                    </p>
                </section>
            </div>
        </div>
    )
}
