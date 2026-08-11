/**
 * Régression réelle (conversation de production, 11/08/2026) :
 * l'agent a envoyé au client le GABARIT de l'ÉTAPE 5 sans le remplir —
 *   *• Nom : <valeur>*
 *   *• Téléphone : <valeur>*
 * — alors que le client n'avait donné ni nom ni téléphone.
 *
 * Double dégât : message incompréhensible côté client, et le bloc
 * "*Vos coordonnées :*" déclenchait le filet capture_lead de generator.js,
 * qui a enregistré le lead ~30 secondes AVANT que le client fournisse quoi que ce soit.
 */

const { stripLeadOnlyUnfilledRecap } = require('../../../src/lib/whatsapp/ai/generator')

describe('stripLeadOnlyUnfilledRecap', () => {
    const RECAP_NON_REMPLI = `Merci ! Voici le récapitulatif de votre demande :

*• 8 sacs enfant (Bleu) × 5 000 FCFA = 40 000 FCFA*
*TOTAL : 40 000 FCFA*

*Vos coordonnées :*
*• Nom : <valeur>*
*• Téléphone : <valeur>*

Pour finaliser, j'ai besoin de votre nom et numéro de téléphone.`

    test('retire le bloc de coordonnées quand il contient un champ non rempli', () => {
        const cleaned = stripLeadOnlyUnfilledRecap(RECAP_NON_REMPLI, true)
        expect(cleaned).not.toMatch(/<valeur>/)
        expect(cleaned).not.toMatch(/Vos coordonnées/)
    })

    test('conserve le récap chiffré et la question de collecte', () => {
        const cleaned = stripLeadOnlyUnfilledRecap(RECAP_NON_REMPLI, true)
        expect(cleaned).toMatch(/8 sacs enfant \(Bleu\)/)
        expect(cleaned).toMatch(/TOTAL : 40 000 FCFA/)
        expect(cleaned).toMatch(/j'ai besoin de votre nom et numéro de téléphone/)
    })

    test('neutralise le déclencheur du filet capture_lead', () => {
        // generator.js force capture_lead dès que la réponse contient ce marqueur :
        // après nettoyage il ne doit plus s'y trouver, sinon un lead vide est enregistré.
        expect(stripLeadOnlyUnfilledRecap(RECAP_NON_REMPLI, true)).not.toContain('*Vos coordonnées :*')
    })

    test('ne touche jamais à un récap de clôture correctement rempli', () => {
        const complet = `Voici le récapitulatif de votre demande :

*• 8 sacs enfant (Bleu) × 5 000 FCFA = 40 000 FCFA*
*TOTAL : 40 000 FCFA*

*Vos coordonnées :*
*• Nom : Kiné Amadou*
*• Téléphone : 6839208757*

Merci ! Notre équipe vous recontacte rapidement pour finaliser.`
        expect(stripLeadOnlyUnfilledRecap(complet, true)).toBe(complet)
    })

    test('couvre les autres formes de champ vide observées', () => {
        for (const placeholder of ['[non fourni]', '[valeur]', '[à compléter]', '[manquant]']) {
            const content = `*Vos coordonnées :*\n*• Téléphone : ${placeholder}*\n\nQuel est votre numéro ?`
            const cleaned = stripLeadOnlyUnfilledRecap(content, true)
            expect(cleaned).not.toContain(placeholder)
            expect(cleaned).toMatch(/Quel est votre numéro/)
        }
    })

    test('ne fait rien hors du mode lead_only, ni sur un contenu vide', () => {
        expect(stripLeadOnlyUnfilledRecap(RECAP_NON_REMPLI, false)).toBe(RECAP_NON_REMPLI)
        expect(stripLeadOnlyUnfilledRecap('', true)).toBe('')
        expect(stripLeadOnlyUnfilledRecap(null, true)).toBe(null)
    })
})
