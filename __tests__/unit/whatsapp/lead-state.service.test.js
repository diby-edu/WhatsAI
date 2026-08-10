const {
    getLeadState,
    setLeadState,
    updateLeadStateFromUserMessage,
    buildLeadStateSummary,
    findBestProduct,
} = require('../../../src/lib/whatsapp/services/lead-state.service')

const PRODUCTS = [
    {
        id: 'goube-id',
        name: 'goube enfant',
        price_fcfa: 6500,
        variants: [{
            id: 'v1', name: 'Couleur', type: 'fixed',
            options: [
                { id: 'o1', value: 'Rouge', price: 9000 },
                { id: 'o2', value: 'Bleu', price: 6500 },
            ],
        }],
    },
    {
        id: 'sac-id',
        name: 'sac enfant',
        price_fcfa: 5000,
        variants: [{
            id: 'v2', name: 'Couleur', type: 'fixed',
            options: [
                { id: 'o3', value: 'Bleu', price: 5000 },
                { id: 'o4', value: 'Jaune', price: 6000 },
                { id: 'o5', value: 'Noir', price: 7000 },
            ],
        }],
    },
]

const emptyState = { items: [], unmatched_mentions: [], fulfillment_mode: null }

describe('lead-state.service', () => {
    describe('updateLeadStateFromUserMessage', () => {
        test('regression réelle : les quantités ne se perdent pas après un aparté sur un produit inconnu', () => {
            let state = updateLeadStateFromUserMessage(
                emptyState,
                'Salut, je veux 15 sac et 27 goude , 26 ardoise',
                PRODUCTS
            )

            // "goude" (faute de frappe du client) doit matcher "goube enfant" via Levenshtein
            const sac = state.items.find(i => i.product_name === 'sac enfant')
            const goube = state.items.find(i => i.product_name === 'goube enfant')
            expect(sac.quantity).toBe(15)
            expect(goube.quantity).toBe(27)
            expect(state.unmatched_mentions.some(m => /ardoise/i.test(m))).toBe(true)

            // Tour suivant : question sur l'article inconnu, aucune nouvelle quantité —
            // les quantités déjà connues ne doivent JAMAIS disparaître.
            state = updateLeadStateFromUserMessage(state, "Vous n'avez pas d'ardoise ?", PRODUCTS)
            const sacAfter = state.items.find(i => i.product_name === 'sac enfant')
            const goubeAfter = state.items.find(i => i.product_name === 'goube enfant')
            expect(sacAfter.quantity).toBe(15)
            expect(goubeAfter.quantity).toBe(27)
        })

        test('une réponse de variante isolée ("bleu") se rattache au seul article en attente, sans dupliquer', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '15 sac', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0].variant).toBeNull()

            state = updateLeadStateFromUserMessage(state, 'Couleur bleu', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0].variant).toBe('Bleu')
            expect(state.items[0].quantity).toBe(15)
        })

        test('message composé avec 2 articles + couleurs en une seule fois', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState,
                '5 sacs noir et 10 gourde rouge',
                PRODUCTS
            )
            expect(state.items).toHaveLength(2)
            const sac = state.items.find(i => i.product_name === 'sac enfant')
            const goube = state.items.find(i => i.product_name === 'goube enfant')
            expect(sac).toMatchObject({ variant: 'Noir', quantity: 5 })
            expect(goube).toMatchObject({ variant: 'Rouge', quantity: 10 })
        })

        test('ne modifie jamais un article déjà complet sans nouvelle information', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '3 sac bleu', PRODUCTS)
            expect(state.items[0]).toMatchObject({ quantity: 3, variant: 'Bleu' })

            state = updateLeadStateFromUserMessage(state, 'Merci beaucoup', PRODUCTS)
            expect(state.items[0]).toMatchObject({ quantity: 3, variant: 'Bleu' })
            expect(state.items).toHaveLength(1)
        })

        test('retourne un état vide inchangé si aucun catalogue ou texte fourni', () => {
            expect(updateLeadStateFromUserMessage(emptyState, '', PRODUCTS).items).toEqual([])
            expect(updateLeadStateFromUserMessage(emptyState, '3 sac bleu', []).items).toEqual([])
        })

        test('un message de position GPS ne pollue jamais l\'état, même en appel direct', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState,
                "Ma position : Yopougon, Abidjan, Côte d'Ivoire (https://www.google.com/maps?q=5.3332645,-4.1047088)",
                PRODUCTS
            )
            expect(state.items).toEqual([])
            expect(state.unmatched_mentions).toEqual([])
        })

        test('une phrase normale contenant un nombre ne devient jamais un "article non reconnu"', () => {
            const state = updateLeadStateFromUserMessage(emptyState, "Je peux payer jusqu'à 5000 FCFA maximum", PRODUCTS)
            expect(state.unmatched_mentions).toEqual([])
        })

        test('"oui"/"non" ne matchent jamais une variante par erreur', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '3 sac', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'oui', PRODUCTS)
            expect(state.items[0].variant).toBeNull()
            state = updateLeadStateFromUserMessage(state, 'non', PRODUCTS)
            expect(state.items[0].variant).toBeNull()
        })

        test('ne devine pas la variante quand 2 articles sont ambigus en attente à la fois', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '3 sac', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, '2 goube', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'bleu', PRODUCTS)
            const sac = state.items.find(i => i.product_name === 'sac enfant')
            const goube = state.items.find(i => i.product_name === 'goube enfant')
            expect(sac.variant).toBeNull()
            expect(goube.variant).toBeNull()
        })
    })

    describe('findBestProduct', () => {
        test('tolère les pluriels via préfixe commun', () => {
            expect(findBestProduct(PRODUCTS, 'sacs bleus')?.name).toBe('sac enfant')
        })

        test('tolère une faute de frappe via Levenshtein', () => {
            expect(findBestProduct(PRODUCTS, 'goude')?.name).toBe('goube enfant')
        })

        test('ne matche rien pour un texte sans rapport avec le catalogue', () => {
            expect(findBestProduct(PRODUCTS, 'quelle est votre adresse')).toBeNull()
        })
    })

    describe('buildLeadStateSummary', () => {
        test('retourne null si aucun article ni mention non reconnue', () => {
            expect(buildLeadStateSummary(emptyState)).toBeNull()
        })

        test('signale explicitement une quantité manquante', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'sac bleu', PRODUCTS)
            const summary = buildLeadStateSummary(state)
            expect(summary).toMatch(/quantité MANQUANTE/)
        })
    })

    describe('getLeadState / setLeadState', () => {
        test('round-trip via conversation.metadata sans perte', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '3 sac bleu', PRODUCTS)
            const metadata = setLeadState({ some_other_key: 'preserved' }, state)
            expect(metadata.some_other_key).toBe('preserved')
            expect(metadata.lead_state.updated_at).toBeTruthy()

            const restored = getLeadState(metadata)
            expect(restored.items).toEqual(state.items)
        })
    })
})
