import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Politique de Confidentialité - WazzapAI',
    description: 'Découvrez comment WazzapAI protège vos données personnelles.',
}

export default function PrivacyPage() {
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
                    Politique de Confidentialité
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>
                    Dernière mise à jour : Avril 2026
                </p>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        1. Collecte des données
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Nous collectons les informations que vous nous fournissez directement : nom, email,
                        numéro de téléphone WhatsApp. Ces données sont nécessaires pour fournir nos services
                        d'automatisation WhatsApp.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        2. Utilisation des données
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Vos données sont utilisées pour :<br />
                        • Fournir et améliorer nos services<br />
                        • Vous contacter concernant votre compte<br />
                        • Traiter vos paiements<br />
                        • Vous envoyer des communications marketing (avec votre consentement)
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        3. Protection des données
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Nous utilisons des mesures de sécurité robustes : chiffrement SSL/TLS,
                        stockage sécurisé des données, accès restreint aux informations personnelles.
                        Nous ne lisons jamais le contenu de vos conversations WhatsApp.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        4. Vos droits
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Conformément au RGPD, vous avez le droit d'accéder, de modifier ou de supprimer
                        vos données personnelles. Contactez-nous à support@wazzapai.com pour exercer ces droits.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        5. Paiements et données financières
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Les paiements sont traités par PayDunya (opérateur de paiement certifié dans l'espace
                        UEMOA). WazzapAI ne stocke jamais vos données bancaires ou de carte. Nous conservons
                        uniquement : le montant, la référence de transaction, le statut et l'horodatage,
                        dans le but de constituer l'historique de facturation accessible depuis votre compte.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        6. Cookies
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Nous utilisons des cookies essentiels pour le fonctionnement du site (session,
                        authentification) et des cookies analytiques (avec votre consentement) pour améliorer
                        nos services. Aucune donnée n'est vendue à des tiers.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        7. Conservation et suppression des données
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Vos données sont conservées pendant la durée de vie de votre compte et pendant
                        30 jours après sa désactivation. Passé ce délai, toutes vos données (agents,
                        conversations, crédits) sont définitivement supprimées. Vous pouvez demander
                        la suppression anticipée de votre compte à tout moment via support@wazzapai.com.
                    </p>
                </section>

                <section style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#34d399' }}>
                        Questions ?
                    </h2>
                    <p style={{ fontSize: 15, color: '#94a3b8' }}>
                        Pour toute question concernant cette politique, contactez-nous à : support@wazzapai.com
                    </p>
                </section>
            </div>
        </div>
    )
}
