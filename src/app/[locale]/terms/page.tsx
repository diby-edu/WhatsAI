import { Metadata } from 'next'

export const metadata: Metadata = {
    title: "Conditions Générales d'Utilisation - WazzapAI",
    description: "Conditions générales d'utilisation, de vente, de livraison et de remboursement du service WazzapAI.",
}

const section: React.CSSProperties = { marginBottom: 36 }
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 600, marginBottom: 12, color: '#e2e8f0' }
const p: React.CSSProperties = { fontSize: 15, lineHeight: 1.9, color: '#94a3b8' }
const li: React.CSSProperties = { fontSize: 15, lineHeight: 1.9, color: '#94a3b8', marginBottom: 4 }

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
                    fontSize: 'clamp(28px, 5vw, 44px)',
                    fontWeight: 800,
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Conditions Générales d'Utilisation
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>
                    Dernière mise à jour : Avril 2026
                </p>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 48 }}>
                    Éditeur : WazzapAI — RCCM CI-ABJ-03-2023-B13-14033 — Abidjan, Côte d'Ivoire
                </p>

                {/* 1 */}
                <section style={section}>
                    <h2 style={h2}>1. Acceptation des conditions</h2>
                    <p style={p}>
                        En créant un compte ou en utilisant WazzapAI, vous acceptez sans réserve les présentes
                        Conditions Générales d'Utilisation (CGU). Si vous n'acceptez pas ces conditions, veuillez
                        ne pas utiliser notre service. Ces CGU constituent un contrat juridiquement contraignant
                        entre vous et WazzapAI.
                    </p>
                </section>

                {/* 2 */}
                <section style={section}>
                    <h2 style={h2}>2. Description du service</h2>
                    <p style={p}>
                        WazzapAI est une plateforme SaaS (Software as a Service) qui permet de créer et gérer
                        des agents IA connectés à WhatsApp pour automatiser les conversations, la prise de commandes,
                        les réservations et le support client. Le service est accessible via abonnement mensuel
                        depuis notre site internet.
                    </p>
                </section>

                {/* 3 */}
                <section style={section}>
                    <h2 style={h2}>3. Compte utilisateur</h2>
                    <p style={p}>
                        L'inscription requiert un nom complet, une adresse email valide et un numéro de téléphone.
                        L'adresse email doit être validée avant toute activation du compte. Vous êtes responsable
                        de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte.
                        Vous devez nous informer immédiatement de toute utilisation non autorisée à l'adresse
                        support@wazzapai.com.
                    </p>
                </section>

                {/* 4 */}
                <section style={section}>
                    <h2 style={h2}>4. Utilisation acceptable</h2>
                    <p style={p}>Il est strictement interdit d'utiliser WazzapAI pour :</p>
                    <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                        {[
                            "Envoyer du spam, des messages non sollicités ou des campagnes de masse abusives",
                            "Harceler, menacer ou escroquer d'autres personnes",
                            "Violer les Conditions d'Utilisation de WhatsApp / Meta",
                            "Diffuser des contenus illégaux, trompeurs ou portant atteinte aux droits de tiers",
                            "Tenter de contourner les mécanismes de facturation ou de limitation du service",
                            "Toute activité contraire aux lois en vigueur dans l'espace UEMOA et en Côte d'Ivoire"
                        ].map((item, i) => <li key={i} style={li}>• {item}</li>)}
                    </ul>
                    <p style={{ ...p, marginTop: 12 }}>
                        Tout manquement à ces règles entraîne la suspension immédiate du compte sans remboursement.
                    </p>
                </section>

                {/* 5 */}
                <section style={section}>
                    <h2 style={h2}>5. Abonnements et tarification</h2>
                    <p style={p}>
                        WazzapAI propose plusieurs plans d'abonnement mensuel :
                    </p>
                    <div style={{
                        background: 'rgba(51, 65, 85, 0.3)',
                        borderRadius: 12,
                        padding: 20,
                        marginTop: 12,
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: '#94a3b8' }}>
                            <thead>
                                <tr style={{ color: '#e2e8f0', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Plan</th>
                                    <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600 }}>Prix/mois</th>
                                    <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600 }}>Crédits inclus</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { plan: 'Gratuit', price: 'Gratuit', credits: '10' },
                                    { plan: 'Starter', price: '6 900 FCFA', credits: '500' },
                                    { plan: 'Pro', price: '19 900 FCFA', credits: '2 500' },
                                    { plan: 'Business', price: '54 900 FCFA', credits: '8 000' },
                                    { plan: 'Scale', price: '129 900 FCFA', credits: '20 000' },
                                ].map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                        <td style={{ padding: '8px 0' }}>{row.plan}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 0' }}>{row.price}</td>
                                        <td style={{ textAlign: 'right', padding: '8px 0' }}>{row.credits}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ ...p, marginTop: 16 }}>
                        Les abonnements sont à renouvellement <strong style={{ color: '#e2e8f0' }}>manuel</strong> :
                        aucun prélèvement automatique n'est effectué. À l'expiration, le compte entre en période
                        de grâce de 30 jours avant suspension définitive. Il vous appartient de renouveler
                        votre abonnement avant la date d'expiration.
                    </p>
                </section>

                {/* 6 */}
                <section style={section}>
                    <h2 style={h2}>6. Crédits</h2>
                    <p style={p}>
                        Les crédits sont l'unité de consommation du service (traitement des conversations par l'IA).
                        Ils fonctionnent comme du carburant : ils sont consommés à chaque interaction traitée par votre agent.
                    </p>
                    <p style={{ ...p, marginTop: 12 }}>
                        <strong style={{ color: '#e2e8f0' }}>Règle fondamentale :</strong> les crédits sont
                        complémentaires à un abonnement actif. Sans abonnement payant actif, les crédits sont
                        gelés et inutilisables jusqu'au renouvellement de l'abonnement.
                    </p>
                    <p style={{ ...p, marginTop: 12 }}>
                        Des packs de crédits supplémentaires sont disponibles à l'achat (de 3 000 FCFA à 110 000 FCFA).
                        L'achat d'un pack de crédits seul ne modifie pas le statut de votre abonnement.
                    </p>
                    <p style={{ ...p, marginTop: 12 }}>
                        Les crédits non utilisés à l'expiration de la période de grâce sont définitivement perdus
                        et ne donnent pas lieu à remboursement.
                    </p>
                </section>

                {/* 7 */}
                <section style={section}>
                    <h2 style={h2}>7. Cycle de vie du compte et période de grâce</h2>
                    <p style={p}>
                        À l'expiration d'un abonnement payant, le compte passe automatiquement en <strong style={{ color: '#e2e8f0' }}>période de grâce de 30 jours</strong>.
                        Pendant cette période :
                    </p>
                    <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                        {[
                            "Les agents IA sont mis en pause (archivés)",
                            "Les crédits restants sont gelés mais conservés",
                            "Le compte reste accessible en lecture seule",
                            "Le renouvellement est possible à tout moment pour réactiver immédiatement"
                        ].map((item, i) => <li key={i} style={li}>• {item}</li>)}
                    </ul>
                    <p style={{ ...p, marginTop: 12 }}>
                        Passé ce délai de 30 jours sans renouvellement, le compte et toutes ses données
                        (agents, conversations, crédits) sont définitivement supprimés.
                    </p>
                    <p style={{ ...p, marginTop: 12 }}>
                        Les comptes en période d'essai gratuite disposent d'une période de grâce de <strong style={{ color: '#e2e8f0' }}>7 jours</strong> en
                        cas d'achat de crédits sans souscription d'abonnement.
                    </p>
                </section>

                {/* 8 */}
                <section style={section}>
                    <h2 style={h2}>8. Politique de remboursement et d'annulation</h2>
                    <p style={p}>
                        <strong style={{ color: '#e2e8f0' }}>Annulation :</strong> il n'existe pas d'abonnement à
                        renouvellement automatique sur WazzapAI. Pour "annuler", il vous suffit de ne pas renouveler
                        à l'expiration. Aucune démarche n'est requise.
                    </p>
                    <p style={{ ...p, marginTop: 12 }}>
                        <strong style={{ color: '#e2e8f0' }}>Remboursements :</strong> les paiements effectués
                        (abonnements et packs de crédits) ne sont pas remboursables, sauf en cas d'erreur
                        technique avérée imputable à WazzapAI. Toute demande de remboursement doit être
                        adressée à support@wazzapai.com dans un délai de 7 jours suivant le paiement,
                        avec justificatif de l'incident.
                    </p>
                    <p style={{ ...p, marginTop: 12 }}>
                        <strong style={{ color: '#e2e8f0' }}>Crédits non utilisés :</strong> ils ne donnent lieu
                        à aucun remboursement en cas de non-renouvellement ou de résiliation du compte.
                    </p>
                </section>

                {/* 9 */}
                <section style={section}>
                    <h2 style={h2}>9. Historique et facturation</h2>
                    <p style={p}>
                        Chaque transaction (abonnement ou pack de crédits) est enregistrée et consultable depuis
                        le tableau de bord dans la rubrique "Facturation". L'historique inclut le montant,
                        la référence unique, le canal de paiement, le statut et l'horodatage. WazzapAI
                        ne génère pas de facture fiscale formelle. Pour toute demande de justificatif,
                        contactez support@wazzapai.com.
                    </p>
                </section>

                {/* 10 */}
                <section style={section}>
                    <h2 style={h2}>10. Disponibilité et maintenance</h2>
                    <p style={p}>
                        WazzapAI s'engage à assurer la disponibilité du service au meilleur niveau possible,
                        sans garantie d'uptime contractuelle. Des interruptions planifiées (maintenance) peuvent
                        survenir et seront communiquées dans la mesure du possible. WazzapAI n'est pas responsable
                        des interruptions liées à des tiers (Meta/WhatsApp, hébergeurs, opérateurs réseau).
                    </p>
                </section>

                {/* 11 */}
                <section style={section}>
                    <h2 style={h2}>11. Propriété intellectuelle</h2>
                    <p style={p}>
                        La plateforme WazzapAI, son code, son design et ses contenus sont la propriété exclusive
                        de WazzapAI. L'abonnement vous confère un droit d'usage limité, non exclusif et
                        non transférable. Les données de vos agents IA et conversations restent votre propriété.
                    </p>
                </section>

                {/* 12 */}
                <section style={section}>
                    <h2 style={h2}>12. Limitation de responsabilité</h2>
                    <p style={p}>
                        WazzapAI est fourni "tel quel". Nous ne garantissons pas que le service sera ininterrompu,
                        exempt d'erreurs ou adapté à un usage spécifique. WazzapAI ne saurait être tenu responsable
                        des pertes indirectes, perte de chiffre d'affaires, de données ou de clients résultant de
                        l'utilisation ou de l'indisponibilité du service. Notre responsabilité totale est limitée
                        au montant payé pour le mois en cours.
                    </p>
                </section>

                {/* 13 */}
                <section style={section}>
                    <h2 style={h2}>13. Modification des conditions</h2>
                    <p style={p}>
                        WazzapAI se réserve le droit de modifier ces CGU à tout moment. Les modifications
                        significatives seront notifiées par email au moins 15 jours avant leur entrée en vigueur.
                        La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles conditions.
                    </p>
                </section>

                {/* 14 */}
                <section style={section}>
                    <h2 style={h2}>14. Droit applicable et juridiction</h2>
                    <p style={p}>
                        Les présentes CGU sont régies par le droit ivoirien et les textes de l'espace UEMOA
                        applicables au commerce électronique. En cas de litige, les parties s'engagent à
                        rechercher une solution amiable avant tout recours judiciaire. À défaut, le tribunal
                        compétent d'Abidjan (Côte d'Ivoire) sera seul compétent.
                    </p>
                </section>

                {/* Contact */}
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
                        Pour toute question relative à ces conditions ou pour exercer vos droits :<br />
                        support@wazzapai.com<br />
                        WazzapAI — RCCM CI-ABJ-03-2023-B13-14033 — Abidjan, Côte d'Ivoire
                    </p>
                </section>
            </div>
        </div>
    )
}
