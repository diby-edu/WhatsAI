import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'RGPD - WazzapAI',
    description: 'Informations sur la conformité RGPD de WazzapAI.',
}

export default function GDPRPage() {
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
                    Conformité RGPD
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>
                    Règlement Général sur la Protection des Données
                </p>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        Notre engagement
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        WazzapAI s'engage à respecter le Règlement Général sur la Protection des Données (RGPD)
                        de l'Union Européenne. Nous prenons la protection de vos données personnelles très au sérieux.
                    </p>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        Vos droits
                    </h2>
                    <div style={{ display: 'grid', gap: 16 }}>
                        {[
                            { title: "Droit d'accès", desc: "Vous pouvez demander une copie de vos données personnelles" },
                            { title: "Droit de rectification", desc: "Vous pouvez corriger vos données inexactes ou incomplètes" },
                            { title: "Droit à l'effacement", desc: "Vous pouvez demander la suppression de vos données" },
                            { title: "Droit à la portabilité", desc: "Vous pouvez recevoir vos données dans un format structuré" },
                            { title: "Droit d'opposition", desc: "Vous pouvez vous opposer au traitement de vos données" },
                        ].map((right, i) => (
                            <div key={i} style={{
                                padding: 16,
                                borderRadius: 12,
                                background: 'rgba(51, 65, 85, 0.3)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#34d399', marginBottom: 4 }}>
                                    ✓ {right.title}
                                </h3>
                                <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>{right.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }}>
                        Base légale du traitement
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.8, color: '#94a3b8' }}>
                        Nous traitons vos données sur les bases suivantes :<br />
                        • <strong style={{ color: 'white' }}>Exécution du contrat</strong> : pour fournir nos services<br />
                        • <strong style={{ color: 'white' }}>Consentement</strong> : pour les communications marketing<br />
                        • <strong style={{ color: 'white' }}>Intérêts légitimes</strong> : pour améliorer nos services
                    </p>
                </section>

                <section style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#34d399' }}>
                        Exercer vos droits
                    </h2>
                    <p style={{ fontSize: 15, color: '#94a3b8' }}>
                        Pour exercer vos droits RGPD, contactez notre Délégué à la Protection des Données :<br />
                        📧 support@wazzapai.com
                    </p>
                </section>
            </div>
        </div>
    )
}
