const {
    getLeadState,
    setLeadState,
    updateLeadStateFromUserMessage,
    buildLeadStateSummary,
    findBestProduct,
    extractRecapTotals,
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
            expect(state.unmatched_mentions.some(m => /ardoise/i.test(m.text))).toBe(true)

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

        test('régression réelle : "Gourde 5 rouge 13 bleu" (2 paires quantité+variante sans virgule ni "et") capture les DEUX', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'Gourde 5 rouge 13 bleu', PRODUCTS)
            const rouge = state.items.find(i => i.variant === 'Rouge')
            const bleu = state.items.find(i => i.variant === 'Bleu')
            expect(state.items).toHaveLength(2)
            expect(rouge).toMatchObject({ product_name: 'goube enfant', quantity: 5 })
            expect(bleu).toMatchObject({ product_name: 'goube enfant', quantity: 13 })
        })

        test('énumération compacte sur plusieurs lignes : le produit nommé une fois s\'applique à chaque paire suivante de la même ligne', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState, 'Pour les sacs, couleur bleu\nGourde 5 rouge 13 bleu', PRODUCTS
            )
            expect(state.items).toHaveLength(3)
            expect(state.items.find(i => i.product_name === 'sac enfant')).toMatchObject({ variant: 'Bleu', quantity: null })
            expect(state.items.filter(i => i.product_name === 'goube enfant')).toHaveLength(2)
        })

        test('énumération compacte avec une 2e couleur invalide : distincte de la 1re, pas fusionnée', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'Gourde 5 rouge 13 vert', PRODUCTS)
            const rouge = state.items.find(i => i.variant === 'Rouge')
            const invalide = state.items.find(i => i.variant_status === 'invalid')
            expect(rouge).toMatchObject({ quantity: 5 })
            expect(invalide).toMatchObject({ quantity: 13, requested_variant: 'vert' })
        })

        test('énumération compacte sur un seul produit, sans virgule : "sac 5 bleu 3 jaune"', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'sac 5 bleu 3 jaune', PRODUCTS)
            expect(state.items).toHaveLength(2)
            expect(state.items.find(i => i.variant === 'Bleu')).toMatchObject({ quantity: 5 })
            expect(state.items.find(i => i.variant === 'Jaune')).toMatchObject({ quantity: 3 })
        })

        test('un seul nombre par segment continue de fonctionner normalement (pas de sous-découpage inutile)', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '15 sac', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ quantity: 15, variant: null, variant_status: 'missing' })
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

        test('régression réelle (conv 1, Koffi) : "15 gourdes noire, 4 gourdes verte, 2 gourde rouge, 5 sac" produit 4 articles distincts avec leurs vraies quantités', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState,
                'Salut je suis monsieur koffi je veux 15 gourdes noire, 4 gourdes verte, 2 gourde rouge, 5 sac.',
                PRODUCTS
            )
            // Ancien modèle : ces 3 mentions de "goube" fusionnaient en 1 seul article,
            // la quantité 15 étant écrasée par 4 (dernière valeur traitée). Nouveau
            // modèle : chaque statut+valeur distinct reste sa propre ligne, avec sa
            // vraie quantité.
            const goubeNoire = state.items.find(i => i.requested_variant === 'noire')
            const goubeVerte = state.items.find(i => i.requested_variant === 'verte')
            const goubeRouge = state.items.find(i => i.variant === 'Rouge')
            const sac = state.items.find(i => i.product_name === 'sac enfant')

            expect(state.items).toHaveLength(4)
            expect(goubeNoire).toMatchObject({ product_name: 'goube enfant', variant_status: 'invalid', quantity: 15 })
            expect(goubeVerte).toMatchObject({ product_name: 'goube enfant', variant_status: 'invalid', quantity: 4 })
            expect(goubeRouge).toMatchObject({ quantity: 2 })
            expect(sac).toMatchObject({ variant: null, variant_status: 'missing', quantity: 5 })
        })

        test('régression réelle (conv 2, Coulibaly) : "15 gourdes... 10 ardoise noir, 10 gourde noire. Je suis mon Coulibaly..." préserve tout', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState,
                "Je veux 15 gourdes et 4 sac vert, 10 ardoise noir, 10 gourde noire. Je suis mon Coulibaly, j'habite a Yopougon et je veux être livré a Cocody",
                PRODUCTS
            )
            // Ancien modèle : "15 gourdes" (manquante) et "10 gourdes noires" (invalide,
            // mais l'invalidité elle-même était perdue à cause du point non traité comme
            // séparateur) fusionnaient — 15 écrasé par 10, "noire" jamais signalée.
            const goubeManquante = state.items.find(i => i.product_name === 'goube enfant' && i.variant_status === 'missing')
            const goubeNoire = state.items.find(i => i.requested_variant === 'noire')
            const sacVert = state.items.find(i => i.requested_variant === 'vert')

            expect(goubeManquante).toMatchObject({ quantity: 15 })
            expect(goubeNoire).toMatchObject({ product_name: 'goube enfant', quantity: 10 })
            expect(sacVert).toMatchObject({ product_name: 'sac enfant', quantity: 4 })
            expect(state.unmatched_mentions).toContainEqual({ text: 'ardoise noir', quantity: 10 })
        })

        test('un point ("noire. Je suis Coulibaly") sépare bien deux idées, comme une virgule', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '10 sac noir. Bonjour', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ variant: 'Noir', quantity: 10 })
        })

        test('deux mentions du même produit sans jamais de couleur, avec des quantités réelles différentes, restent deux lignes distinctes (pas de fusion devinée)', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '15 gourdes, 10 gourdes', PRODUCTS)
            const quantities = state.items.filter(i => i.product_name === 'goube enfant').map(i => i.quantity).sort()
            expect(quantities).toEqual([10, 15])
        })

        test('régression (revue de code) : répéter une quantité déjà connue via un article devenu "orphelin" ne crée jamais un 3e doublon', () => {
            // "15 gourdes" -> "10 gourdes" (conflit, crée un 2e article ; le 1er reste dans
            // state.items mais existingByKey ne référence plus que le 2e) -> "15 gourdes" à
            // nouveau : doit retrouver et réactiver le 1er article plutôt que d'en créer un 3e.
            let state = updateLeadStateFromUserMessage(emptyState, '15 gourdes', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, '10 gourdes', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, '15 gourdes', PRODUCTS)

            const goubeItems = state.items.filter(i => i.product_name === 'goube enfant')
            expect(goubeItems).toHaveLength(2)
            expect(goubeItems.map(i => i.quantity).sort()).toEqual([10, 15])
        })

        test('une tentative de variante invalide n\'empêche pas une variante valide donnée ensuite de s\'appliquer', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS)
            expect(state.items[0]).toMatchObject({ variant_status: 'invalid', requested_variant: 'vert' })

            state = updateLeadStateFromUserMessage(state, '10 sac bleu', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ variant: 'Bleu', quantity: 10, variant_status: 'valid' })
        })

        test('régression réelle (Traoré) : une couleur invalide déjà connue n\'est jamais écrasée par un segment sans rapport plus loin dans le même message, et le produit inconnu est capturé avec sa quantité', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState,
                "Je veux 8 sacs roses. Je suis madame Traoré, j'habite à abobo et je veux aussi 5 chapex rouges",
                PRODUCTS
            )
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ variant_status: 'invalid', requested_variant: 'roses', quantity: 8 })
            // "je veux aussi" (préambule) ne doit plus empêcher la capture de "chapex rouges"
            expect(state.unmatched_mentions).toContainEqual({ text: 'chapex rouges', quantity: 5 })
        })

        test('régression réelle (Traoré) : "Je n\'ai pas choisi de gourde" (négation) ne crée jamais d\'article fantôme, même si le mot "gourde" y apparaît', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sacs bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, "Je n'ai pas choisi de gourde", PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items.find(i => i.product_name === 'goube enfant')).toBeUndefined()
        })

        test('"sans gourde" / "aucune gourde" (autres formes de négation) ne créent pas non plus d\'article', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sacs bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'sans gourde pour moi', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'aucune gourde merci', PRODUCTS)
            expect(state.items.find(i => i.product_name === 'goube enfant')).toBeUndefined()
        })

        test('"pas cher" (qualificatif de prix) n\'est jamais pris pour une négation', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '5 sac pas cher', PRODUCTS)
            expect(state.items.find(i => i.product_name === 'sac enfant')).toBeDefined()
        })

        test('régression réelle (Ibrahim) : "Enlève 5 sacs" ne crée jamais un faux article "+5, couleur inconnue"', () => {
            let state = updateLeadStateFromUserMessage(emptyState, 'Sac 6 bleu 4 jaune', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Enlève 5 sacs', PRODUCTS)
            expect(state.items).toHaveLength(2)
            expect(state.items.find(i => i.variant_status === 'missing')).toBeUndefined()
        })

        test('régression réelle (Traoré) : un nombre seul en réponse ("7") ne devient jamais un faux "produit non reconnu"', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sacs bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, '7', PRODUCTS)
            expect(state.unmatched_mentions).toEqual([])
        })

        test('régression réelle (Traoré) : "En boutique" (réponse logistique) n\'est jamais prise pour une tentative de couleur', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'En boutique', PRODUCTS)
            expect(state.items[0]).toMatchObject({ variant_status: 'invalid', requested_variant: 'vert' })
        })

        test('une réponse courte à une question en attente ne devine une couleur invalide QUE si aucune n\'est encore connue', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS)
            expect(state.items[0]).toMatchObject({ variant_status: 'invalid', requested_variant: 'vert' })

            // "en fait" (3 mots courts, aucun produit nommé) ne doit PAS remplacer "vert"
            // par un texte sans rapport, puisqu'une tentative invalide est déjà connue.
            state = updateLeadStateFromUserMessage(state, 'ah pardon voila', PRODUCTS)
            expect(state.items[0]).toMatchObject({ variant_status: 'invalid', requested_variant: 'vert' })
        })

        test('un préambule ("je veux", "je suis monsieur X") n\'est jamais pris pour une tentative de variante', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'Bonjour, je veux 15 sac', PRODUCTS)
            expect(state.items[0]).toMatchObject({ variant: null, quantity: 15, variant_status: 'missing' })
        })

        test('un prix mentionné dans le même message ("à 5000 FCFA") n\'écrase jamais la quantité réelle ni ne devient une fausse variante invalide', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'je veux 2 sacs a 5000 FCFA', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ quantity: 2, variant_status: 'missing' })
            expect(state.unmatched_mentions).toEqual([])
        })

        test('un produit dont le seul groupe de variantes a des options vides n\'est jamais traité comme ayant de vraies variantes', () => {
            const noRealVariantProduct = [{
                id: 'y', name: 'porte cle', price_fcfa: 500,
                variants: [{ id: 'v', name: 'Couleur', type: 'fixed', options: [] }],
            }]
            const state = updateLeadStateFromUserMessage(emptyState, '5 porte cle rouge', noRealVariantProduct)
            expect(state.items[0].variant_status).toBe('missing')
        })

        test('cloneState ne partage jamais d\'état mutable entre deux appels successifs', () => {
            const prev = updateLeadStateFromUserMessage(emptyState, '10 goube noire', PRODUCTS)
            const prevSnapshot = JSON.stringify(prev)
            const next = updateLeadStateFromUserMessage(prev, '10 goube verte', PRODUCTS)

            // prev ne doit JAMAIS être modifié par un appel ultérieur — sinon la
            // détection de changement par JSON.stringify(prev) !== JSON.stringify(next)
            // dans message.js échoue silencieusement et le nouvel article n'est jamais
            // persisté en base.
            expect(JSON.stringify(prev)).toBe(prevSnapshot)
            expect(prev.items).toHaveLength(1)
            expect(next.items).toHaveLength(2)
            expect(JSON.stringify(prev)).not.toBe(JSON.stringify(next))
        })

        test('une mention nue sans aucune info suivie d\'une mention complète dans le MÊME message fusionne en un seul article', () => {
            const state = updateLeadStateFromUserMessage(emptyState, 'Gourde enfant\n15 gourde enfant rouge', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ variant: 'Rouge', quantity: 15 })
        })

        test('un produit inconnu mentionné deux fois avec la même quantité ne duplique pas', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 ardoise noir', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, '10 ardoise noir', PRODUCTS)
            expect(state.unmatched_mentions).toEqual([{ text: 'ardoise noir', quantity: 10 }])
        })

        test('un produit inconnu mentionné deux fois avec des quantités différentes garde les deux (pas d\'écrasement silencieux)', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 ardoise noir', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, '5 ardoise noir', PRODUCTS)
            expect(state.unmatched_mentions).toEqual(expect.arrayContaining([
                { text: 'ardoise noir', quantity: 10 },
                { text: 'ardoise noir', quantity: 5 },
            ]))
        })

        test('singulariser un terme ne doit jamais faire échouer une correspondance qui passait déjà sur sa forme brute', () => {
            const typoProducts = [{ id: 'x', name: 'fleru', variants: [] }]
            // "fleurs" (6) -> singularisé "fleur" (5) vs "fleru" (5) : distance 2, seuil
            // resserré à 1 après singularisation si on ne compare QUE la forme courte —
            // doit quand même matcher grâce à la forme brute (maxLen 6, seuil 2).
            expect(findBestProduct(typoProducts, 'fleurs')?.name).toBe('fleru')
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

        test('signale explicitement une variante invalide comme rejetée, pas comme manquante', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS)
            const summary = buildLeadStateSummary(state)
            expect(summary).toMatch(/⛔/)
            expect(summary).toMatch(/"vert"/)
            expect(summary).toMatch(/N'EXISTE PAS/)
            expect(summary).not.toMatch(/variante manquante si applicable/)
        })

        test('affiche la quantité pour un article non reconnu dans le catalogue', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '10 ardoise noir', PRODUCTS)
            const summary = buildLeadStateSummary(state)
            expect(summary).toMatch(/"ardoise noir"/)
            expect(summary).toMatch(/quantité 10/)
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

    describe('extractRecapTotals', () => {
        test('lit TOTAL et Frais de livraison au format exact de preview_cart (toLocaleString fr-FR)', () => {
            const text = `Voici votre commande :\n*Frais de livraison : ${(2000).toLocaleString('fr-FR')} FCFA*\n*TOTAL : ${(206500).toLocaleString('fr-FR')} FCFA*`
            expect(extractRecapTotals(text)).toEqual({ total: 206500, deliveryFee: 2000 })
        })

        test('deliveryFee reste null quand seul TOTAL est présent (retrait en boutique)', () => {
            expect(extractRecapTotals(`*TOTAL : ${(75000).toLocaleString('fr-FR')} FCFA*`)).toEqual({ total: 75000, deliveryFee: null })
        })

        test('retourne null si aucun TOTAL dans le texte', () => {
            expect(extractRecapTotals('Bonjour, que puis-je pour vous ?')).toBeNull()
            expect(extractRecapTotals('')).toBeNull()
            expect(extractRecapTotals(null)).toBeNull()
        })

        test('régression : prend le DERNIER total mentionné, pas le premier', () => {
            const text = '*TOTAL : 100 FCFA*\n... correction ...\n*TOTAL : 50 000 FCFA*'
            expect(extractRecapTotals(text)).toEqual({ total: 50000, deliveryFee: null })
        })

        test('accepte un total sans séparateur de milliers (montant court)', () => {
            expect(extractRecapTotals('*TOTAL : 9500 FCFA*')).toEqual({ total: 9500, deliveryFee: null })
        })

        test('frais de livraison à 0 FCFA (livraison gratuite) est distingué de "pas de livraison"', () => {
            expect(extractRecapTotals('*Frais de livraison : 0 FCFA*\n*TOTAL : 5000 FCFA*')).toEqual({ total: 5000, deliveryFee: 0 })
        })
    })
})
