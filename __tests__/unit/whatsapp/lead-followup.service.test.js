/**
 * Relance après clôture d'un lead (mode lead_only).
 *
 * Contexte : le récap final envoyé, le cycle est archivé — historique coupé, mémoire des
 * articles vidée. Reste à décider du sort du message suivant. Trois versions ont été
 * écartées avant celle-ci (couper le bot / laisser l'IA repartir seule / lui faire classer
 * modification vs nouveau besoin) ; voir l'en-tête de lead-followup.service.js.
 *
 * Ces tests portent sur la partie déterministe : le classement de la réponse et la machine
 * à états. Rien ici ne dépend du modèle.
 */

const {
    classifyFollowupReply,
    mentionsCatalogProduct,
    buildFollowupMessages,
    getFollowupState,
    decideFollowupAction,
} = require('../../../src/lib/whatsapp/services/lead-followup.service')

const PRODUCTS = [{ name: 'goube enfant' }, { name: 'sac enfant' }]
const PENDING = { stage: 'pending', unclassified: 0 }
const ASKED = { stage: 'asked', unclassified: 0 }

describe('classifyFollowupReply', () => {
    test('accords explicites', () => {
        for (const t of ['Oui', 'oui', 'OUI', 'ouais', 'yes', 'yeah', 'Je veux commander autre chose', 'I want to order again']) {
            expect(classifyFollowupReply(t)).toBe('accept')
        }
    })

    test('accords faibles, seuls', () => {
        for (const t of ['ok', 'Okay', "d'accord", 'bien sûr', 'sure']) {
            expect(classifyFollowupReply(t)).toBe('accept')
        }
    })

    test('refus', () => {
        for (const t of ['Non', 'non merci', 'rien', "c'est bon", 'plus tard', 'à bientôt', 'au revoir', 'no thanks', 'later']) {
            expect(classifyFollowupReply(t)).toBe('decline')
        }
    })

    // « Merci » est la façon la plus courante de décliner en français. Le traiter comme un
    // accord déclencherait un catalogue non sollicité juste après une commande.
    test('« merci » vaut refus, et l\'emporte sur un accord faible', () => {
        expect(classifyFollowupReply('Merci')).toBe('decline')
        expect(classifyFollowupReply('ok merci')).toBe('decline')
        expect(classifyFollowupReply("d'accord merci")).toBe('decline')
        expect(classifyFollowupReply('ok thanks')).toBe('decline')
    })

    // Mais un « oui » explicite reste un oui, même poli.
    test('un accord explicite l\'emporte sur « merci »', () => {
        expect(classifyFollowupReply('oui merci')).toBe('accept')
        expect(classifyFollowupReply('yes thanks')).toBe('accept')
    })

    // Sans cette règle, deux emojis d'affilée suffisaient à escalader et le marchand
    // recevait une alerte pour du bruit.
    test('emoji ou ponctuation seuls = acquiescement muet, donc refus', () => {
        for (const t of ['👍', '🙏🙏', '...', '!!', '   ']) {
            expect(classifyFollowupReply(t)).toBe('decline')
        }
    })

    /**
     * Régression trouvée à l'essai : « je veux » seul classait « Je veux juste changer mon
     * numéro » comme un accord, alors que c'est précisément le message à rediriger vers un
     * conseiller. Seule une intention d'ACHAT explicite vaut désormais accord.
     */
    test('une demande de correction n\'est pas un accord', () => {
        for (const t of [
            'Je veux juste changer mon numéro',
            "Mais c'est urgent, mon numéro est faux",
            'je voudrais modifier mon adresse',
        ]) {
            expect(classifyFollowupReply(t)).toBe('unclassified')
        }
    })

    test('« une autre fois » est un refus, pas une nouvelle commande', () => {
        expect(classifyFollowupReply('une autre fois')).toBe('decline')
        expect(classifyFollowupReply('another time')).toBe('decline')
    })

    test('question ordinaire = non classé', () => {
        expect(classifyFollowupReply("C'est quand la livraison ?")).toBe('unclassified')
    })
})

describe('mentionsCatalogProduct', () => {
    test('reconnaît un article, avec la tolérance du moteur d\'état', () => {
        expect(mentionsCatalogProduct('Je veux ajouter 3 sacs enfant noir', PRODUCTS)).toBe(true)
        // Le catalogue dit « goube », les clients écrivent « gourde ».
        expect(mentionsCatalogProduct('je veux 5 gourdes rouges', PRODUCTS)).toBe(true)
    })

    test('ne se déclenche pas sur une réponse ordinaire', () => {
        for (const t of ['Merci', 'ok', "mon numéro c'est 0748229901", 'Oui']) {
            expect(mentionsCatalogProduct(t, PRODUCTS)).toBe(false)
        }
    })

    test('catalogue vide ou absent', () => {
        expect(mentionsCatalogProduct('3 sacs', [])).toBe(false)
        expect(mentionsCatalogProduct('3 sacs', undefined)).toBe(false)
    })
})

describe('decideFollowupAction', () => {
    test('aucune relance en cours : l\'IA garde la main', () => {
        expect(decideFollowupAction(null, 'Bonjour', PRODUCTS).action).toBe('handover')
    })

    test('premier message après la clôture, quel qu\'il soit → la question', () => {
        for (const t of ['Merci', 'bonjour', 'vous êtes là ?', 'ok']) {
            const d = decideFollowupAction(PENDING, t, PRODUCTS)
            expect(d.action).toBe('ask')
            expect(d.nextState).toEqual({ stage: 'asked', unclassified: 0 })
        }
    })

    /**
     * Le client qui énonce déjà sa commande ne doit pas avoir à répondre « oui » puis à la
     * retaper — l'ardoise ayant été effacée à la clôture, il perdrait deux messages sur le
     * cas le plus rentable.
     */
    test('un article nommé court-circuite la relance, à tout stade', () => {
        expect(decideFollowupAction(PENDING, 'Je veux 3 sacs enfant noir', PRODUCTS).action).toBe('handover')
        expect(decideFollowupAction(ASKED, 'finalement 5 gourdes rouges', PRODUCTS).action).toBe('handover')
    })

    test('accord → l\'IA reprend sur un cycle vierge', () => {
        const d = decideFollowupAction(ASKED, 'Oui', PRODUCTS)
        expect(d.action).toBe('handover')
        expect(d.nextState).toBeNull()
    })

    // Retour en attente et non état terminal : s'il réécrit dans deux jours, il retrouve la
    // question au lieu d'un catalogue surgi de nulle part.
    test('refus → accusé de réception, puis retour en attente', () => {
        const d = decideFollowupAction(ASKED, 'Non merci', PRODUCTS)
        expect(d.action).toBe('decline')
        expect(d.nextState).toEqual({ stage: 'pending', unclassified: 0 })
    })

    test('premier message non classé → redirection vers le conseiller', () => {
        const d = decideFollowupAction(ASKED, 'Je veux juste changer mon numéro', PRODUCTS)
        expect(d.action).toBe('redirect')
        expect(d.nextState).toEqual({ stage: 'asked', unclassified: 1 })
    })

    test('deuxième message non classé consécutif → escalade', () => {
        const d = decideFollowupAction({ stage: 'asked', unclassified: 1 }, "Mais c'est urgent", PRODUCTS)
        expect(d.action).toBe('escalate')
        expect(d.nextState).toBeNull()
    })

    test('le compteur repart de zéro après un refus', () => {
        const afterDecline = decideFollowupAction({ stage: 'asked', unclassified: 1 }, 'Non merci', PRODUCTS)
        expect(afterDecline.nextState.unclassified).toBe(0)
    })
})

/**
 * Les parcours complets, tels qu'ils ont été spécifiés avec le marchand.
 */
describe('parcours de bout en bout', () => {
    const run = (messages) => {
        let state = PENDING
        const actions = []
        for (const m of messages) {
            const d = decideFollowupAction(state, m, PRODUCTS)
            actions.push(d.action)
            state = d.nextState
            if (d.action === 'handover') break
        }
        return actions
    }

    test('« Merci » puis « Oui » → question, puis nouvelle commande', () => {
        expect(run(['Merci', 'Oui'])).toEqual(['ask', 'handover'])
    })

    test('« Merci » puis « Non merci » → question, puis accusé de réception', () => {
        expect(run(['Merci', 'Non merci'])).toEqual(['ask', 'decline'])
    })

    test('commande directe → aucune relance', () => {
        expect(run(['Je veux ajouter 3 sacs enfant noir'])).toEqual(['handover'])
    })

    test('correction insistante → question, redirection, escalade', () => {
        expect(run([
            "Je me suis trompée, mon numéro c'est 0748229901",
            'Non je veux juste changer mon numéro',
            "Mais c'est urgent, mon numéro est faux",
        ])).toEqual(['ask', 'redirect', 'escalate'])
    })

    // Le pire enchaînement : alterne, ne se répète jamais deux fois à l'identique, ne boucle pas.
    test('acquiescements successifs : alternance bornée, jamais de boucle', () => {
        expect(run(['Merci', '👍', 'ok merci'])).toEqual(['ask', 'decline', 'ask'])
    })
})

describe('buildFollowupMessages', () => {
    const AGENT_FR = { language: 'fr', escalation_phone: '+2250700000000' }
    const AGENT_EN = { language: 'en', escalation_phone: '+2250700000000' }

    test('les quatre messages français portent le numéro configuré', () => {
        const m = buildFollowupMessages(AGENT_FR)
        expect(m.question).toMatch(/nouvelle commande/)
        expect(m.question).toMatch(/\*Oui\*/)
        for (const text of Object.values(m)) expect(text).toMatch(/\+2250700000000/)
    })

    test('la question rappelle d\'abord que la demande est enregistrée', () => {
        // L'ordre compte : la préoccupation réelle du client à cet instant est de savoir que
        // sa commande n'est pas perdue. La question vient après.
        const { question } = buildFollowupMessages(AGENT_FR)
        expect(question.indexOf('enregistrée')).toBeLessThan(question.indexOf('nouvelle commande'))
    })

    test('version anglaise', () => {
        const m = buildFollowupMessages(AGENT_EN)
        expect(m.question).toMatch(/new order/)
        expect(m.question).toMatch(/\*Yes\*/)
        expect(m.declined).toMatch(/our team/i)
        expect(m.question).not.toMatch(/Souhaitez-vous/)
    })

    // Sans numéro configuré, aucune ligne 📞 vide ni crochet resté en place.
    test('sans numéro d\'escalade, aucune mention de téléphone', () => {
        const m = buildFollowupMessages({ language: 'fr' })
        for (const text of Object.values(m)) {
            expect(text).not.toMatch(/📞/)
            expect(text).not.toMatch(/\[/)
        }
        expect(m.redirect).toMatch(/nouvelle commande/)
    })
})

describe('getFollowupState', () => {
    test('lit un état valide', () => {
        expect(getFollowupState({ lead_followup: { stage: 'asked', unclassified: 2 } }))
            .toEqual({ stage: 'asked', unclassified: 2 })
    })

    test('ignore un état absent, nul ou corrompu', () => {
        expect(getFollowupState({})).toBeNull()
        expect(getFollowupState({ lead_followup: null })).toBeNull()
        expect(getFollowupState({ lead_followup: 'oui' })).toBeNull()
        expect(getFollowupState({ lead_followup: { stage: 'inconnu' } })).toBeNull()
        expect(getFollowupState(undefined)).toBeNull()
    })
})
