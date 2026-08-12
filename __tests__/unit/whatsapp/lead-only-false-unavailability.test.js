/**
 * Régression réelle (conversation de production, 11/08/2026) :
 * le client ouvre par « pas de gourde pour moi, juste 9 sacs », puis se ravise et demande
 * 4 gourdes rouges. L'agent répond « Nous n'avons pas de gourde rouge » — alors que le
 * Rouge est au catalogue à 9 000 FCFA, et qu'il l'affiche comme disponible deux lignes
 * plus bas. Le client insiste, l'agent refuse, la vente est perdue.
 *
 * Le modèle transforme un refus exprimé par le CLIENT en indisponibilité de la BOUTIQUE.
 * L'affirmation est vérifiable sans jugement : la variante est au catalogue, ou elle n'y
 * est pas. Le détecteur ci-dessous le constate et fait reformuler.
 *
 * Le risque de ce garde-fou étant le FAUX POSITIF — empêcher l'agent d'annoncer une
 * vraie indisponibilité — la moitié des tests vérifie qu'il se tait quand il le doit.
 */

const { findFalseUnavailabilityClaim } = require('../../../src/lib/whatsapp/ai/generator')

const PRODUCTS = [
    { id: 'g', name: 'goube enfant', variants: [{ name: 'Couleur', options: [{ value: 'Rouge' }, { value: 'Bleu' }] }] },
    { id: 's', name: 'sac enfant', variants: [{ name: 'Couleur', options: [{ value: 'Bleu' }, { value: 'Jaune' }, { value: 'Noir' }] }] },
]

describe('findFalseUnavailabilityClaim', () => {
    describe('détecte le refus d\'une variante qui existe', () => {
        test('cas exact observé en production', () => {
            const stale = findFalseUnavailabilityClaim("Nous n'avons pas de gourde rouge.", PRODUCTS)
            expect(stale).not.toBeNull()
            expect(stale.product).toBe('goube enfant')
            expect(stale.variant).toBe('Rouge')
        })

        test('couvre les autres formulations de la même conversation', () => {
            for (const phrase of [
                'Nous ne vendons pas de gourde rouge, désolé.',
                "La couleur rouge pour la gourde n'est pas disponible.",
                "Je comprends, mais la couleur rouge pour la gourde n'est pas disponible.",
                'Le sac enfant en noir est indisponible.',
            ]) {
                expect(findFalseUnavailabilityClaim(phrase, PRODUCTS)).not.toBeNull()
            }
        })

        test('reconnaît le produit malgré la faute du catalogue (goube / gourde)', () => {
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de gourde bleue.", PRODUCTS)).not.toBeNull()
        })
    })

    describe('se tait quand l\'indisponibilité est vraie ou hors sujet', () => {
        test('une couleur réellement absente du catalogue', () => {
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de sacs enfants en rose ni en orange.", PRODUCTS)).toBeNull()
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de gourde verte.", PRODUCTS)).toBeNull()
        })

        test('un article qui n\'est pas au catalogue', () => {
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de chaises blanches.", PRODUCTS)).toBeNull()
        })

        test('une énumération des couleurs réellement proposées ne compte pas', () => {
            // Le piège : la phrase nie "rose" puis LISTE Bleu/Jaune/Noir, qui existent.
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de sac en rose, seulement Bleu, Jaune et Noir.", PRODUCTS)).toBeNull()
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de gourde en rose mais nous avons du bleu.", PRODUCTS)).toBeNull()
        })

        test('une phrase sans négation', () => {
            expect(findFalseUnavailabilityClaim('Voici nos couleurs : Rouge, Bleu.', PRODUCTS)).toBeNull()
            expect(findFalseUnavailabilityClaim('Pour la gourde rouge, ce sera 9 000 FCFA.', PRODUCTS)).toBeNull()
        })

        test('entrées vides ou catalogue absent', () => {
            expect(findFalseUnavailabilityClaim('', PRODUCTS)).toBeNull()
            expect(findFalseUnavailabilityClaim(null, PRODUCTS)).toBeNull()
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de gourde rouge.", [])).toBeNull()
            expect(findFalseUnavailabilityClaim("Nous n'avons pas de gourde rouge.", null)).toBeNull()
        })
    })
})
