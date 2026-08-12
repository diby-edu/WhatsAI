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

        // ── Quatre régressions relevées sur des conversations WhatsApp réelles (11/08/2026).
        // Dans les trois premières, le moteur écrivait un état FAUX et c'est seulement le
        // refus de l'IA de le suivre qui a sauvé la commande.

        test('une quantité écrite en toutes lettres est lue comme une quantité', () => {
            // "4 gourde rouge, une goude bleu" enregistrait la gourde bleue avec quantity=null.
            const state = updateLeadStateFromUserMessage(emptyState, '4 gourde rouge, une goude bleu', PRODUCTS)
            const bleu = state.items.find(i => i.variant === 'Bleu')
            expect(bleu).toMatchObject({ product_name: 'goube enfant', quantity: 1 })
            expect(state.items.find(i => i.variant === 'Rouge')).toMatchObject({ quantity: 4 })
        })

        test('un mot-quantité isolé ne crée jamais d\'article quand aucun produit n\'est nommé', () => {
            // Garde-fou du correctif ci-dessus : "une" est d'abord un déterminant.
            const state = updateLeadStateFromUserMessage(emptyState, 'une autre couleur svp', PRODUCTS)
            expect(state.items).toHaveLength(0)
            expect(state.unmatched_mentions).toHaveLength(0)
        })

        test('énumération elliptique séparée par des virgules et "et" : le produit reste porté', () => {
            // "Sac 5 bleu, 3 jaune et 2 noir" : splitSegments coupe sur "," et " et ", donc
            // "3 jaune" et "2 noir" étaient enregistrés comme ARTICLES INCONNUS du catalogue.
            const state = updateLeadStateFromUserMessage(emptyState, 'Sac 5 bleu, 3 jaune et 2 noir', PRODUCTS)
            expect(state.unmatched_mentions).toHaveLength(0)
            const sacs = state.items.filter(i => i.product_name === 'sac enfant')
            expect(sacs).toHaveLength(3)
            expect(sacs.find(i => i.variant === 'Bleu')).toMatchObject({ quantity: 5 })
            expect(sacs.find(i => i.variant === 'Jaune')).toMatchObject({ quantity: 3 })
            expect(sacs.find(i => i.variant === 'Noir')).toMatchObject({ quantity: 2 })
        })

        test('une phrase de confirmation ne devient jamais un article fantôme', () => {
            // "J'ai dis 10" produisait un article inconnu « J'ai dis » de quantité 10 : le
            // pronom élidé "j'ai" formait un seul token qu'aucun mot courant ne couvrait.
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac noir', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, "J'ai dis 10", PRODUCTS)
            expect(state.unmatched_mentions).toHaveLength(0)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ product_name: 'sac enfant', variant: 'Noir', quantity: 10 })
        })

        test('un article inconnu contenant un mot de couleur n\'écrase pas l\'article en attente', () => {
            // "4 sac vert, 10 ardoise noir" ne laissait qu'un "sac Noir ×10" : calculateItemPrice
            // matche par inclusion, donc "ardoise noir" passait pour la couleur du sac en attente.
            const state = updateLeadStateFromUserMessage(emptyState, 'Je veux 4 sac vert, 10 ardoise noir', PRODUCTS)
            expect(state.items.find(i => i.requested_variant === 'vert')).toMatchObject({ quantity: 4 })
            expect(state.unmatched_mentions).toContainEqual({ text: 'ardoise noir', quantity: 10 })
        })

        // ── Corpus de messages difficiles (11/08/2026). Mesurer 20 fois le MÊME message
        // ne dit rien de la robustesse : ces cas viennent d'un corpus volontairement varié,
        // où 7 messages sur 17 produisaient un état faux.

        test('une variante accordée en genre et en nombre est reconnue dans une énumération', () => {
            // "2 bleues" (féminin pluriel) devenait un ARTICLE INCONNU au lieu de la couleur Bleu.
            const state = updateLeadStateFromUserMessage(emptyState, 'je veux 3 gourdes rouges, 2 bleues', PRODUCTS)
            expect(state.unmatched_mentions).toHaveLength(0)
            expect(state.items.find(i => i.variant === 'Bleu')).toMatchObject({ product_name: 'goube enfant', quantity: 2 })
            expect(state.items.find(i => i.variant === 'Rouge')).toMatchObject({ quantity: 3 })
        })

        test('une quantité approximative ("une dizaine") ne devient jamais un nombre précis', () => {
            // Régression introduite puis corrigée : "une dizaine" était lu comme quantité 1.
            // Une valeur fausse est pire qu'une absence — sans quantité, l'IA la demande.
            const state = updateLeadStateFromUserMessage(emptyState, 'il me faut une dizaine de sacs bleus', PRODUCTS)
            expect(state.items[0]).toMatchObject({ variant: 'Bleu', quantity: null })
        })

        test('une confirmation qui répète une ligne connue ne la duplique pas', () => {
            // "les 10 sacs c'est bien noté" créait une 2e ligne de 10 sacs sans variante.
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac noir', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, "les 10 sacs c'est bien noté, rajoute 3 gourdes rouges", PRODUCTS)
            expect(state.items.filter(i => i.product_name === 'sac enfant')).toHaveLength(1)
            expect(state.items.find(i => i.product_name === 'sac enfant')).toMatchObject({ variant: 'Noir', quantity: 10 })
            expect(state.items.find(i => i.product_name === 'goube enfant')).toMatchObject({ variant: 'Rouge', quantity: 3 })
        })

        test('un destinataire ne devient jamais un article commandé', () => {
            // "4 autres pour mon fils" enregistrait un article inconnu "fils" de quantité 4.
            const state = updateLeadStateFromUserMessage(
                emptyState, 'il me faut 4 gourde rouge pour ma fille et 4 autres pour mon fils', PRODUCTS
            )
            expect(state.unmatched_mentions).toHaveLength(0)
        })

        test('une négation orale sans "ne" est reconnue', () => {
            // "pas de gourde pour moi" créait une ligne gourde pour le produit refusé :
            // isNegationSegment exigeait "ne" ET "pas", or le "ne" saute presque toujours.
            const state = updateLeadStateFromUserMessage(
                emptyState, 'bonsoir, pas de gourde pour moi, juste 9 sacs enfant noir', PRODUCTS
            )
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ product_name: 'sac enfant', variant: 'Noir', quantity: 9 })
        })

        test('un numéro de téléphone dans la phrase n\'est jamais pris pour une quantité', () => {
            const state = updateLeadStateFromUserMessage(
                emptyState, "bonjour je m'appelle Koffi Alain, mon numero est 0707123456, je veux 6 sacs noir", PRODUCTS
            )
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ variant: 'Noir', quantity: 6 })
            expect(state.unmatched_mentions).toHaveLength(0)
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

        test('régression réelle : une reformulation de PURE remplissage ("svp pour vous 12") met à jour la quantité sans jamais toucher une couleur invalide déjà connue', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'svp pour vous 12', PRODUCTS)
            expect(state.items).toHaveLength(1)
            expect(state.items[0]).toMatchObject({ variant_status: 'invalid', requested_variant: 'vert', quantity: 12 })
        })

        test('limite connue et acceptée : une reformulation avec des mots NON filtrés ("Finalement remet 15") n\'est pas rattachée par le moteur — laissée à l\'IA, comme la négation', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '15 goube', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'En faite plutôt 10', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Finalement remet 15', PRODUCTS)
            // Documente le comportement actuel (quantité reste 10, pas 15) plutôt que de
            // le cacher — décision explicite : ne pas rouvrir de liste de mots-clés pour
            // couvrir ce cas, voir le test précédent pour le sous-cas qui, lui, est couvert.
            expect(state.items).toHaveLength(1)
            expect(state.items[0].quantity).toBe(10)
        })

        test('régression réelle (conv 3) : une quantité redonnée seule désambiguïse quel article en attente une couleur valide qui suit (dans un segment séparé par une virgule) doit compléter', () => {
            let state = updateLeadStateFromUserMessage(
                emptyState,
                'Je veux 15 goube enfants noire et 4 goube enfants verte',
                PRODUCTS
            )
            expect(state.items).toHaveLength(2)

            // "Finalement les 15" et "je les veux rouge" sont deux segments séparés par
            // une virgule — sans le rattachement par quantité nue, "rouge" ne pouvait
            // jamais résoudre l'ambiguïté (2 candidats invalides du même produit) et
            // créait un 3e article séparé au lieu de compléter la ligne des 15.
            state = updateLeadStateFromUserMessage(state, 'Finalement les 15, je les veux rouge', PRODUCTS)
            expect(state.items).toHaveLength(2)
            const resolved = state.items.find(i => i.variant_status === 'valid')
            const stillInvalid = state.items.find(i => i.variant_status === 'invalid')
            expect(resolved).toMatchObject({ variant: 'Rouge', quantity: 15 })
            expect(stillInvalid).toMatchObject({ requested_variant: 'verte', quantity: 4 })
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

        test('régression réelle : un article complet (variante valide + quantité connue) porte un marqueur ✅ COMPLET collé à la donnée', () => {
            // Une règle générale dans le prompt ("ne redemande jamais une quantité déjà
            // connue") a échoué au 1er test réel après déploiement, précisément quand un
            // autre article du même message posait problème (produit non reconnu) — l'IA
            // a quand même redemandé la quantité déjà donnée. Le marqueur est collé à la
            // ligne elle-même plutôt que dans une règle à retenir séparément.
            const state = updateLeadStateFromUserMessage(emptyState, '6 sac bleu', PRODUCTS)
            const summary = buildLeadStateSummary(state)
            expect(summary).toMatch(/✅ COMPLET/)
        })

        test('le marqueur ✅ COMPLET n\'apparaît jamais pour une quantité manquante ou une variante invalide', () => {
            const missing = buildLeadStateSummary(updateLeadStateFromUserMessage(emptyState, 'sac bleu', PRODUCTS))
            expect(missing).not.toMatch(/✅ COMPLET/)

            const invalid = buildLeadStateSummary(updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS))
            expect(invalid).not.toMatch(/✅ COMPLET/)
        })

        // ── Régression réelle : l'IA reposait une question déjà répondue ──────────
        // Le résumé est ré-injecté à CHAQUE tour. Tout impératif qu'il contient est
        // donc ré-exécuté, y compris quand le client y a déjà répondu au tour d'avant.
        // Mesuré sur la conversation réelle : 8 échecs sur 8 avec l'impératif,
        // 8 réussites sur 8 sans lui.
        test('la ligne d\'une variante invalide énonce un fait, jamais un ordre de redemander', () => {
            const summary = buildLeadStateSummary(updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS))
            expect(summary).toMatch(/N'EXISTE PAS/)
            expect(summary).not.toMatch(/redemande une variante/i)
            expect(summary).not.toMatch(/ne l'accepte jamais/i)
        })

        test('une quantité connue reste protégée même quand la variante est invalide', () => {
            // Sans cette protection, la seule donnée acquise de la ligne arrive nue —
            // et c'est elle que l'IA redemandait.
            const summary = buildLeadStateSummary(updateLeadStateFromUserMessage(emptyState, '10 sac vert', PRODUCTS))
            expect(summary).toMatch(/✅ QUANTITÉ ACQUISE/)
            expect(summary).toMatch(/quantité 10/)
        })

        test('aucun marqueur de quantité acquise quand la quantité est réellement manquante', () => {
            const summary = buildLeadStateSummary(updateLeadStateFromUserMessage(emptyState, 'sac vert', PRODUCTS))
            expect(summary).not.toMatch(/✅ QUANTITÉ ACQUISE/)
            expect(summary).toMatch(/quantité MANQUANTE/)
        })

        test('signale une variante valide reçue que le système n\'a pas pu affecter entre plusieurs lignes', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sac rose et 6 sac orange', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'bleu', PRODUCTS)
            const summary = buildLeadStateSummary(state, { lastUserMessage: 'bleu', products: PRODUCTS })
            expect(summary).toMatch(/n'a PAS pu déterminer/i)
            expect(summary).toMatch(/aucune question de quantité n'a de sens/i)
        })

        test('ne signale aucune affectation en attente quand il n\'y a pas d\'ambiguïté', () => {
            // Une seule ligne en attente : le moteur applique la couleur lui-même,
            // il n'y a rien à signaler.
            let state = updateLeadStateFromUserMessage(emptyState, '5 sac rose', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'bleu', PRODUCTS)
            const summary = buildLeadStateSummary(state, { lastUserMessage: 'bleu', products: PRODUCTS })
            expect(summary).not.toMatch(/n'a PAS pu déterminer/i)
        })

        // ── Mode de récupération ──────────────────────────────────────────────────
        // Le champ existait dans l'état mais restait null en permanence. Conséquence
        // mesurée : l'agent reposait « boutique ou livraison ? » 6 fois sur 8 sur une
        // commune donnée, et n'ajoutait alors aucun frais de livraison au récap.

        test('capte le choix de la livraison', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Je veux être livré', PRODUCTS)
            expect(state.fulfillment_mode).toBe('delivery')
            expect(buildLeadStateSummary(state)).toMatch(/LIVRAISON ✅ déjà choisi/)
        })

        test('capte le choix du retrait en boutique', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Je passe en boutique', PRODUCTS)
            expect(state.fulfillment_mode).toBe('pickup')
            expect(buildLeadStateSummary(state)).toMatch(/RETRAIT EN BOUTIQUE ✅ déjà choisi/)
        })

        test('ne tranche pas quand les deux modes sont cités (question de l\'agent recopiée)', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'vous passez en boutique ou vous souhaitez être livré ?', PRODUCTS)
            expect(state.fulfillment_mode).toBeNull()
        })

        test('un changement d\'avis explicite remplace le mode précédent', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Je veux être livré', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'finalement je passe en boutique', PRODUCTS)
            expect(state.fulfillment_mode).toBe('pickup')
        })

        test('un message sans rapport ne change pas le mode déjà choisi', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Je veux être livré', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Port bouet', PRODUCTS)
            expect(state.fulfillment_mode).toBe('delivery')
        })

        test('les accents ne bloquent pas la détection (piège du \\b en JavaScript)', () => {
            // /livré\b/ ne matche jamais "livré " : "é" n'est pas un caractère de mot.
            let state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'Je veux être livré à Cocody Angré', PRODUCTS)
            expect(state.fulfillment_mode).toBe('delivery')
        })

        test('aucune mention du mode dans le résumé tant qu\'il n\'est pas choisi', () => {
            const state = updateLeadStateFromUserMessage(emptyState, '10 sac bleu', PRODUCTS)
            expect(buildLeadStateSummary(state)).not.toMatch(/Mode de récupération/)
        })

        test('reste correct sans le second argument (appel historique à un seul paramètre)', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sac rose et 6 sac orange', PRODUCTS)
            state = updateLeadStateFromUserMessage(state, 'bleu', PRODUCTS)
            expect(() => buildLeadStateSummary(state)).not.toThrow()
            expect(buildLeadStateSummary(state)).toMatch(/✅ QUANTITÉ ACQUISE/)
        })

        // ── Lire la question/confirmation de l'agent pour désambiguïser ────────────
        // Régression réelle (12/08/2026) : 2 lignes invalides du même produit restaient
        // bloquées pour toujours, faute de savoir à quelle ligne une réponse nue du client
        // se rapportait — alors que l'agent avait posé la question ligne par ligne.

        test('une réponse nue se rattache à la ligne visée par la question ciblée de l\'agent', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sac rose et 6 sac orange', PRODUCTS)
            state = updateLeadStateFromUserMessage(
                state, 'Bleu', PRODUCTS,
                { lastAssistantMessage: 'Nous n\'avons pas ces couleurs. Pour les 8 sacs enfants, quelle couleur souhaitez-vous ?' }
            )
            const huit = state.items.find(i => i.quantity === 8)
            const six = state.items.find(i => i.quantity === 6)
            expect(huit).toMatchObject({ variant_status: 'valid', variant: 'Bleu' })
            expect(six).toMatchObject({ variant_status: 'invalid', requested_variant: 'orange' })
        })

        test('sans question ciblée (ambiguïté réelle), ne devine toujours pas', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sac rose et 6 sac orange', PRODUCTS)
            state = updateLeadStateFromUserMessage(
                state, 'Bleu', PRODUCTS,
                { lastAssistantMessage: 'Nous n\'avons pas ces couleurs. Pour les 8 sacs et les 6 sacs, quelle couleur souhaitez-vous ?' }
            )
            expect(state.items.every(i => i.variant_status === 'invalid')).toBe(true)
        })

        test('une confirmation de l\'agent au tour précédent résout la ligne qu\'elle désigne', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sac rose et 6 sac orange', PRODUCTS)
            // Le "Bleu" du tour précédent n'a jamais pu être appliqué par le moteur lui-même
            // (2 lignes en attente à ce moment) — mais l'IA l'a acté dans sa réponse, qui
            // redemande aussi la couleur des 6 restants.
            state = updateLeadStateFromUserMessage(
                state, 'Jaune', PRODUCTS,
                { lastAssistantMessage: 'Pour les 8 sacs enfants, vous avez choisi la couleur Bleu. Et pour les 6 sacs enfants, quelle couleur souhaitez-vous ?' }
            )
            const huit = state.items.find(i => i.quantity === 8)
            const six = state.items.find(i => i.quantity === 6)
            expect(huit).toMatchObject({ variant_status: 'valid', variant: 'Bleu' })
            expect(six).toMatchObject({ variant_status: 'valid', variant: 'Jaune' })
        })

        test('une confirmation portant sur une couleur qui n\'existe pas au catalogue est ignorée', () => {
            let state = updateLeadStateFromUserMessage(emptyState, '8 sac rose et 6 sac orange', PRODUCTS)
            state = updateLeadStateFromUserMessage(
                state, '6', PRODUCTS,
                { lastAssistantMessage: 'Pour les 8 sacs enfants, vous avez choisi la couleur Violet. Et pour les 6, combien ?' }
            )
            const huit = state.items.find(i => i.quantity === 8)
            expect(huit).toMatchObject({ variant_status: 'invalid', requested_variant: 'rose' })
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
