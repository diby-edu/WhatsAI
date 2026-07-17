import type { Dispatch, SetStateAction } from 'react'
import { motion } from 'framer-motion'
import type { useToast } from '@/components/ui/Toast'
import type { AgentFormData } from '../types'

interface StepMissionProps {
    formData: AgentFormData
    setFormData: Dispatch<SetStateAction<AgentFormData>>
    toast: ReturnType<typeof useToast>
    setSelectedMission: Dispatch<SetStateAction<string>>
    isSupportClient: boolean
}

export function StepMission({ formData, setFormData, toast, setSelectedMission, isSupportClient }: StepMissionProps) {
    const missionTemplates = [
        { id: 'ecommerce', emoji: '🛍️', title: 'E-commerce / Boutique', description: 'Vendre des produits, gérer les commandes et livraisons' },
        { id: 'restaurant', emoji: '🍽️', title: 'Restaurant / Fast-food', description: 'Prendre commandes, gérer réservations et menus' },
        { id: 'hotel', emoji: '🏨', title: 'Hôtel / Hébergement', description: 'Réservations de chambres, services et concierge' },
        { id: 'salon', emoji: '💇', title: 'Salon / Beauté', description: 'Rendez-vous, prestations et conseils beauté' },
        { id: 'services', emoji: '🔧', title: 'Services / Artisan', description: 'Devis, interventions et rendez-vous techniques' },
        { id: 'support_client', emoji: '📚', title: 'Support Client', description: 'Répondre aux questions via une base de connaissance' },
        { id: 'custom', emoji: '✏️', title: 'Personnalisé', description: 'Configurer librement la mission de votre agent' },
    ]
    const missionPrompts: Record<string, string> = {
        ecommerce: `Tu es l'assistant commercial de notre boutique en ligne.\n\nTon rôle:\n- Accueillir les clients et répondre à leurs questions\n- Présenter les produits disponibles (voir liste des produits)\n- Aider à choisir les bons produits selon leurs besoins\n- Finaliser les commandes en respectant le type de produit vendu\n\nPour commander, tu dois toujours collecter:\n1. Le(s) produit(s) souhaité(s) et quantités\n2. Nom complet du client\n3. Numéro de téléphone\n\nCompléments selon le type de produit:\n- Produit numérique : demander l'adresse email, jamais d'adresse de livraison physique\n- Produit physique : demander l'adresse de livraison\n- Paiement : suivre le mode prévu par le système et ne jamais promettre cash à la livraison pour un produit numérique\n\nRègles:\n- Sois courtois et serviable\n- Propose toujours des produits complémentaires\n- Confirme le total avant de valider la commande\n- N'invente jamais un mode de livraison ou de paiement contraire au catalogue`,
        restaurant: `Tu es l'assistant de notre restaurant.\n\nTon rôle:\n- Présenter le menu et les plats du jour\n- Prendre les commandes (sur place ou livraison)\n- Gérer les réservations de tables\n- Informer sur les allergènes et ingrédients\n\nPour une commande livraison, collecte:\n1. Les plats et quantités\n2. Adresse de livraison\n3. Heure souhaitée\n4. Numéro de téléphone\n\nRègles:\n- Propose toujours des accompagnements et boissons\n- Précise les temps de préparation\n- Confirme le total de la commande`,
        hotel: `Tu es le concierge virtuel de notre hôtel.\n\nTon rôle:\n- Renseigner sur les types de chambres et tarifs\n- Effectuer des réservations\n- Informer sur les services (restaurant, spa, piscine)\n- Répondre aux questions des clients\n\nPour une réservation, collecte:\n1. Dates d'arrivée et de départ\n2. Type de chambre souhaité\n3. Nombre d'adultes et d'enfants\n4. Nom complet et téléphone\n\nRègles:\n- Propose des surclassements si disponibles\n- Mentionne les services inclus\n- Confirme le tarif total et les conditions d'annulation`,
        salon: `Tu es l'assistant de notre salon de beauté/coiffure.\n\nTon rôle:\n- Présenter nos services et tarifs\n- Prendre les rendez-vous\n- Conseiller sur les soins adaptés\n\nPour un rendez-vous, collecte:\n1. Le(s) service(s) souhaité(s)\n2. Date et heure préférées\n3. Nom et numéro de téléphone\n\nRègles:\n- Indique la durée estimée des prestations\n- Propose des services complémentaires\n- Confirme le rendez-vous et le tarif estimé`,
        services: `Tu es l'assistant de notre entreprise de services.\n\nTon rôle:\n- Comprendre les besoins du client\n- Expliquer nos services et tarifs\n- Prendre les demandes d'intervention ou de devis\n\nPour une intervention, collecte:\n1. Nature du problème ou service demandé\n2. Adresse complète\n3. Disponibilités du client\n4. Nom et téléphone\n\nRègles:\n- Pose des questions pour bien comprendre le besoin\n- Donne une fourchette de prix si possible\n- Confirme tous les détails avant de valider`,
        support_client: `Tu es l'assistant de ${formData.name || '[Nom de l\'entreprise]'}.\nTon rôle est de répondre aux questions des clients en te basant uniquement sur les informations que tu connais.\nNe jamais inventer d'information. Si tu ne sais pas, renvoie vers le contact direct.`,
        custom: `Tu es un assistant virtuel professionnel et polyvalent. Ton rôle est d'accueillir les visiteurs, de répondre à leurs questions sur l'entreprise et de noter leurs coordonnées si nécessaire. Sois toujours courtois, bref et précis.`,
    }
    const applyTemplate = async (templateId: string) => {
        const currentPrompt = formData.system_prompt
        if (currentPrompt && currentPrompt.trim().length > 30) {
            const ok = await toast.confirm({ title: 'Remplacer le prompt ?', message: 'Le prompt actuel sera remplacé par ce template.', confirmLabel: 'Remplacer', danger: true })
            if (!ok) return
        }
        setSelectedMission(templateId)
        setFormData({ ...formData, system_prompt: missionPrompts[templateId] || '' })
    }
    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
                <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 14 }}>
                    Choisissez un template pour pré-remplir la mission, puis personnalisez librement.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {missionTemplates.map(tpl => (
                        <button
                            key={tpl.id}
                            onClick={() => applyTemplate(tpl.id)}
                            style={{
                                padding: '14px 16px',
                                border: '1px solid rgba(148, 163, 184, 0.15)',
                                borderRadius: 12,
                                background: 'rgba(30, 41, 59, 0.5)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'border-color 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.4)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)')}
                        >
                            <div style={{ fontSize: 20, marginBottom: 6 }}>{tpl.emoji}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>{tpl.title}</div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{tpl.description}</div>
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                    Prompt système (modifiable)
                </label>
                <textarea
                    value={formData.system_prompt}
                    onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                    placeholder={isSupportClient ? "Tu es l'assistant de [Nom de l'entreprise]. Ton rôle est de répondre aux questions des clients en te basant uniquement sur les informations que tu connais..." : "Tu es l'assistant commercial de [Nom de l'entreprise]..."}
                    style={{
                        width: '100%',
                        padding: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        background: 'rgba(30, 41, 59, 0.5)',
                        color: 'white',
                        outline: 'none',
                        height: 220,
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        lineHeight: 1.6,
                    }}
                />
            </div>
            {isSupportClient && (
                <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                        Contexte supplémentaire (Support Client)
                    </label>
                    <textarea
                        value={formData.agent_context}
                        onChange={e => setFormData({ ...formData, agent_context: e.target.value })}
                        placeholder="Informations complémentaires sur votre activité, produits ou politiques que l'IA doit connaître..."
                        style={{
                            width: '100%',
                            padding: 16,
                            borderRadius: 12,
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            background: 'rgba(99, 102, 241, 0.05)',
                            color: 'white',
                            outline: 'none',
                            height: 120,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            lineHeight: 1.6,
                        }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Ce contexte est injecté dans chaque réponse du mode Support Client.
                    </p>
                </div>
            )}
            {isSupportClient && (
                <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                        Message d'accueil (optionnel)
                    </label>
                    <textarea
                        value={formData.welcome_message}
                        onChange={e => setFormData({ ...formData, welcome_message: e.target.value })}
                        placeholder="Ex: Je peux vous renseigner sur nos formations, les tarifs et le processus d'inscription."
                        style={{
                            width: '100%',
                            padding: 16,
                            borderRadius: 12,
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            background: 'rgba(16, 185, 129, 0.05)',
                            color: 'white',
                            outline: 'none',
                            height: 100,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            lineHeight: 1.6,
                        }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Affiché après le nom de l'agent lors du premier message. Ex: "Bonjour ! Je suis l'assistant de X. <i>votre texte ici</i>"
                    </p>
                </div>
            )}
            {isSupportClient && (
                <div>
                    <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                        Message de redirection (optionnel)
                    </label>
                    <input
                        type="text"
                        value={formData.fallback_contact_message}
                        onChange={e => setFormData({ ...formData, fallback_contact_message: e.target.value })}
                        placeholder="Ex: Pour plus de détails, appelez le +225 07 00 00 00 ou visitez notre site."
                        style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', padding: 12, borderRadius: 12, color: 'white', outline: 'none', fontSize: 13 }}
                    />
                    <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                        Ajoutée automatiquement quand l'agent n'a pas l'information. Laissez vide pour un comportement par défaut.
                    </p>
                </div>
            )}
        </motion.div>
    )
}
