/**
 * Tests d'ASSEMBLAGE du prompt (prompt-builder.js) pour le mode lead_only.
 *
 * Pourquoi ce fichier existe :
 * workflow-lead-only.test.js vérifie le workflow lead_only ISOLÉ — il passait au vert
 * alors que le prompt réellement envoyé au modèle contenait 13 mentions de create_order,
 * 8 "On continue ?" et 5 mentions de lien de paiement, injectées par les blocs génériques
 * (variantsRules / antiLoopRules / toolsDefinition / paymentSection) assemblés autour de lui.
 * Le modèle recopiait alors le gabarit "Pour [produit], quelle quantité souhaitez-vous ?"
 * pour un article dont la quantité était déjà connue.
 *
 * Ces tests portent donc sur le PROMPT ASSEMBLÉ, pas sur un fragment.
 * Le second describe est le garde-fou symétrique : il prouve que le flux de commande
 * normal (create_order), utilisé par tous les autres agents, n'a pas été touché.
 */

const { buildAdaptiveSystemPrompt } = require('../../../src/lib/whatsapp/ai/prompt-builder')

const PRODUCTS = [
    {
        id: 'p1',
        name: 'sac enfant',
        product_type: 'product',
        price_fcfa: 5000,
        variants: [{
            name: 'Couleur',
            type: 'fixed',
            options: [
                { value: 'Bleu', price: 5000 },
                { value: 'Jaune', price: 6000 },
                { value: 'Noir', price: 7000 },
            ],
        }],
    },
    {
        id: 'p2',
        name: 'goube enfant',
        product_type: 'product',
        price_fcfa: 6500,
        variants: [{
            name: 'Couleur',
            type: 'fixed',
            options: [
                { value: 'Rouge', price: 9000 },
                { value: 'Bleu', price: 6500 },
            ],
        }],
    },
]

const BASE_AGENT = {
    name: 'Agent Test Produit Physique',
    language: 'fr',
    use_emojis: true,
    lead_collect_fields: ['name', 'phone'],
    payment_mode: 'cinetpay',
}

const LEAD_ONLY_AGENT = { ...BASE_AGENT, conversation_mode: 'lead_only' }
const STANDARD_AGENT = { ...BASE_AGENT }

const buildPrompt = (agent, userMessage = 'Bonjour, je veux 10 sac enfant noir et 2 chaises blanches') =>
    buildAdaptiveSystemPrompt(agent, PRODUCTS, [], [], 'XOF', '', 'Non spécifiés', false, userMessage, false, null)

/**
 * Le workflow lead_only cite volontairement create_order, "On continue ?" et le lien de
 * paiement — mais toujours pour les INTERDIRE ("Ne JAMAIS appeler create_order") ou comme
 * contre-exemple ❌. Ces mentions-là sont voulues et doivent rester.
 * Ce qui doit disparaître, c'est toute mention PRESCRIPTIVE : celle qui demande à l'IA de
 * faire la chose. On isole donc les lignes qui ne portent aucune marque d'interdiction.
 */
const prescriptiveLines = (prompt, needle) => prompt
    .split('\n')
    .filter(line => line.toLowerCase().includes(needle.toLowerCase()))
    .filter(line => !/❌|⛔|JAMAIS|INTERDIT|n'existe pas/i.test(line))

describe('Prompt assemblé — mode lead_only', () => {
    const prompt = buildPrompt(LEAD_ONLY_AGENT)

    test('ne prescrit jamais create_order (outil désactivé dans ce mode)', () => {
        // Avant le correctif : 13 occurrences, dont le payload complet et "→ create_order"
        // à la fin de 5 exemples de flux. Ne doit subsister que l'interdiction explicite.
        expect(prescriptiveLines(prompt, 'create_order')).toEqual([])
        expect(prompt).toMatch(/Ne JAMAIS appeler create_order/)
    })

    test('ne mentionne jamais les autres outils désactivés', () => {
        expect(prompt).not.toMatch(/create_booking/i)
        expect(prompt).not.toMatch(/check_payment_status/i)
        expect(prompt).not.toMatch(/find_order/i)
        expect(prompt).not.toMatch(/create_restaurant_checkout/i)
    })

    test('ne prescrit jamais la question de confirmation "On continue ?"', () => {
        // Avant le correctif : 8 occurrences, dont le gabarit du RÉCAP 1 à recopier.
        expect(prescriptiveLines(prompt, 'On continue ?')).toEqual([])
    })

    test('ne prescrit jamais de lien de paiement ni de choix du mode de paiement', () => {
        expect(prescriptiveLines(prompt, 'lien de paiement')).toEqual([])
        expect(prescriptiveLines(prompt, 'payer en ligne ou à la livraison')).toEqual([])
        expect(prompt).not.toMatch(/LIEN DE PAIEMENT AUTOMATIQUE/)
    })

    test('ne contient plus le gabarit de question de quantité qui causait la régression', () => {
        // Cause racine observée en prod : l'IA recopiait ce gabarit pour un article dont
        // la quantité était pourtant déjà connue et affichée dans ARTICLES DÉJÀ IDENTIFIÉS.
        expect(prompt).not.toMatch(/quantité souhaitez-vous/i)
        expect(prompt).not.toMatch(/PHASE QUANTITÉ OBLIGATOIRE/i)
        expect(prescriptiveLines(prompt, 'Combien souhaitez-vous')).toEqual([])
    })

    test('ne contient plus l\'interdiction de faire préciser une réponse ambiguë', () => {
        // Contredisait la règle "AMBIGUÏTÉ ENTRE PLUSIEURS LIGNES DU MÊME PRODUIT" :
        // l'IA choisissait seule une ligne au lieu de demander laquelle était visée.
        expect(prompt).not.toMatch(/pourriez-vous préciser/i)
    })

    test('ne contient plus la validation de l\'indicatif téléphonique', () => {
        // Contredisait la règle 📞 de l'ÉTAPE 4 (accepter le numéro tel quel, sans le juger).
        expect(prompt).not.toMatch(/Ajoutez votre indicatif pays/i)
        expect(prompt).not.toMatch(/Indicatif pays OBLIGATOIRE/i)
    })

    test('annonce les seuls outils réellement actifs dans ce mode', () => {
        expect(prompt).toMatch(/capture_lead/)
        expect(prompt).toMatch(/preview_cart/)
        expect(prompt).toMatch(/send_image/)
    })

    test('conserve le workflow lead_only et les garde-fous indépendants du mode', () => {
        expect(prompt).toMatch(/FLUX DE COLLECTE \(MODE LEAD/)
        expect(prompt).toMatch(/STATE KEEPER/)
        expect(prompt).toMatch(/MÉMOIRE & RÉSILIENCE/)
        expect(prompt).toMatch(/ANTI-HALLUCINATION IMAGE_URL/)
        expect(prompt).toMatch(/INTERDICTION DE DEVINER/)
    })

    test('reste propre quel que soit le message client déclencheur', () => {
        const messages = [
            'Bonjour',
            'je veux 8 sac enfant rose et 6 sac enfant orange',
            'Bleu',
            'Je veux reserver une table demain a 20h',
        ]
        for (const message of messages) {
            const p = buildPrompt(LEAD_ONLY_AGENT, message)
            expect(prescriptiveLines(p, 'create_order')).toEqual([])
            expect(prescriptiveLines(p, 'On continue ?')).toEqual([])
            expect(prescriptiveLines(p, 'lien de paiement')).toEqual([])
            expect(p).not.toMatch(/quantité souhaitez-vous/i)
        }
    })
})

describe('Prompt assemblé — flux normal (NON lead_only) inchangé', () => {
    const prompt = buildPrompt(STANDARD_AGENT)

    test('contient toujours create_order', () => {
        expect(prompt).toMatch(/create_order/)
    })

    test('contient toujours la confirmation "On continue ?"', () => {
        expect(prompt).toMatch(/On continue \?/)
    })

    test('contient toujours la section lien de paiement', () => {
        expect(prompt).toMatch(/lien de paiement/i)
    })

    test('contient toujours le gabarit de question de quantité', () => {
        expect(prompt).toMatch(/quantité souhaitez-vous/i)
        expect(prompt).toMatch(/PHASE QUANTITÉ OBLIGATOIRE/)
    })

    test('contient toujours la validation de l\'indicatif téléphonique', () => {
        expect(prompt).toMatch(/Indicatif pays OBLIGATOIRE/)
    })

    test('n\'annonce jamais les outils réservés au mode lead_only', () => {
        expect(prompt).not.toMatch(/capture_lead/)
        expect(prompt).not.toMatch(/preview_cart/)
    })

    test('un agent sans conversation_mode est traité comme le flux normal', () => {
        const legacyAgent = { ...BASE_AGENT, conversation_mode: null }
        expect(buildPrompt(legacyAgent)).toMatch(/create_order/)
        const undefinedModeAgent = { ...BASE_AGENT }
        delete undefinedModeAgent.conversation_mode
        expect(buildPrompt(undefinedModeAgent)).toMatch(/create_order/)
    })
})
