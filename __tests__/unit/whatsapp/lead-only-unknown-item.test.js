/**
 * Régression réelle (production, 13/08/2026) — un article hors catalogue passé sous silence.
 *
 * Le client écrit : « Bonsoir, pas de gourde pour moi, juste 5 sacs enfant noir, 16 ardoise.
 * Je veux être livré a adjame. Je me nom Coulibaly fatou ».
 *
 * L'agent répond par un récapitulatif chiffré complet — articles, frais de livraison, total —
 * SANS un mot sur les 16 ardoises. Le client a dû relancer lui-même (« Et les ardoises »)
 * pour obtenir la réponse. Entre les deux, rien ne lui disait qu'elles n'étaient pas dans sa
 * commande.
 *
 * Le prompt l'interdit déjà, et l'agent l'avait respecté cinq minutes plus tôt sur une autre
 * conversation. La différence tenait au message : une négation, deux articles, un mode de
 * livraison, une commune et un nom empilés — l'agent a foncé au récap.
 */

const { findUnannouncedUnknownItem } = require('../../../src/lib/whatsapp/ai/generator')

const RECAP_MUET = 'Voici votre commande :\n*• 5 sac enfant Noir 💰 7 000 FCFA × 5 = 35 000 FCFA*\n*Frais de livraison : 2 000 FCFA*\n*TOTAL : 37 000 FCFA*\n\nPour finaliser, j\'ai besoin de votre numéro de téléphone.'
const ETAT = { items: [], unmatched_mentions: [{ text: 'ardoise', quantity: 16 }] }

describe('findUnannouncedUnknownItem', () => {
    describe('détecte l\'omission observée en production', () => {
        test('cas exact : récap chiffré sans un mot sur les ardoises', () => {
            const found = findUnannouncedUnknownItem(RECAP_MUET, ETAT)
            expect(found).not.toBeNull()
            expect(found.mention.text).toBe('ardoise')
            expect(found.mention.quantity).toBe(16)
        })

        test('déclenche aussi sur une demande de coordonnées sans récap', () => {
            const message = 'Quel est votre prénom et nom ?'
            expect(findUnannouncedUnknownItem(message, ETAT)).not.toBeNull()
        })

        // Le catalogue dit "ardoise", le client peut écrire "ardoises" : même tolérance que
        // le reste du moteur, jamais une seconde logique de comparaison.
        test('tolère le pluriel et les fautes', () => {
            const etat = { items: [], unmatched_mentions: [{ text: 'ardoises', quantity: 16 }] }
            expect(findUnannouncedUnknownItem(RECAP_MUET, etat)).not.toBeNull()
        })
    })

    describe('se tait quand l\'agent a fait son travail', () => {
        test('le message nomme l\'article', () => {
            const message = `Nous ne vendons pas d'ardoises, désolé.\n\n${RECAP_MUET}`
            expect(findUnannouncedUnknownItem(message, ETAT)).toBeNull()
        })

        // Sans ce marqueur, l'agent répéterait « nous ne vendons pas d'ardoises » à chaque
        // récapitulatif suivant. Il est posé par le moteur dès qu'un message de l'agent a
        // nommé l'article.
        test('l\'article a déjà été signalé à un tour précédent', () => {
            const etat = { items: [], unmatched_mentions: [{ text: 'ardoise', quantity: 16, announced: true }] }
            expect(findUnannouncedUnknownItem(RECAP_MUET, etat)).toBeNull()
        })
    })

    describe('ne se déclenche pas hors des messages qui concluent', () => {
        test('une question de variante en cours de collecte', () => {
            expect(findUnannouncedUnknownItem('Quelle couleur souhaitez-vous pour les sacs ?', ETAT)).toBeNull()
        })

        test('une réponse informative', () => {
            expect(findUnannouncedUnknownItem('Nos sacs existent en Bleu, Jaune et Noir.', ETAT)).toBeNull()
        })
    })

    describe('se tait hors de son périmètre', () => {
        test('aucun article inconnu enregistré', () => {
            expect(findUnannouncedUnknownItem(RECAP_MUET, { items: [], unmatched_mentions: [] })).toBeNull()
        })

        test('entrées vides ou absentes', () => {
            expect(findUnannouncedUnknownItem('', ETAT)).toBeNull()
            expect(findUnannouncedUnknownItem(null, ETAT)).toBeNull()
            expect(findUnannouncedUnknownItem(RECAP_MUET, null)).toBeNull()
            expect(findUnannouncedUnknownItem(RECAP_MUET, {})).toBeNull()
        })
    })
})
