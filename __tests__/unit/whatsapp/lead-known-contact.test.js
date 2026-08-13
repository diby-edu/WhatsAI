/**
 * Coordonnées d'une demande précédente : proposées au client, jamais reprises en silence.
 *
 * Comportement corrigé (production, 13/08/2026) : après la clôture d'un premier cycle,
 * l'agent voyait encore le récapitulatif final dans son historique et réutilisait le nom, le
 * téléphone et l'adresse de lui-même. Le client les découvrait dans le récap final de sa
 * NOUVELLE demande, sans avoir jamais eu l'occasion de dire qu'ils avaient changé. Le même
 * mécanisme a fini par afficher une adresse de livraison sur une commande à retirer en
 * boutique.
 *
 * Désormais l'historique est coupé net et seules les coordonnées survivent, dans un champ
 * dédié, pour être PROPOSÉES. Le système fournit une donnée ; l'agent formule la question et
 * interprète la réponse — même principe que le bloc "CLIENT CONNU" du flux de commande normal.
 */

const { buildKnownContactSection } = require('../../../src/lib/whatsapp/ai/generator')

const CONTACT = {
    name: 'Koffi Kadis',
    phone: '0987543257',
    email: null,
    address: 'Adjame bracoddi non loin du black',
}

describe('buildKnownContactSection', () => {
    describe('propose les coordonnées connues', () => {
        test('les trois champs apparaissent', () => {
            const section = buildKnownContactSection(CONTACT)
            expect(section).toMatch(/• Nom : Koffi Kadis/)
            expect(section).toMatch(/• Téléphone : 0987543257/)
            expect(section).toMatch(/• Adresse de livraison : Adjame bracoddi non loin du black/)
        })

        test('la formulation laisse le client trancher', () => {
            const section = buildKnownContactSection(CONTACT)
            expect(section).toMatch(/C'est toujours bon, ou souhaitez-vous changer quelque chose \?/)
            // Une seule question, pas une collecte champ par champ.
            expect(section).toMatch(/ne pose PAS les questions une par une/)
        })

        test('une correction sur un champ ne relance pas les autres', () => {
            expect(buildKnownContactSection(CONTACT)).toMatch(/corrige UN SEUL champ.*ne les redemande pas/s)
        })

        // C'est le défaut exact qui a produit une adresse de livraison sur une commande à
        // retirer en boutique.
        test('interdit la ligne adresse en retrait boutique', () => {
            expect(buildKnownContactSection(CONTACT)).toMatch(/N'affiche PAS la ligne Adresse.*RETRAIT EN BOUTIQUE/s)
        })

        test('interdit de les présenter comme acquises avant confirmation', () => {
            expect(buildKnownContactSection(CONTACT)).toMatch(/tant que le client ne les a pas confirmées/)
        })

        test('un champ vide n\'apparaît pas', () => {
            const section = buildKnownContactSection({ name: 'Koffi Kadis', phone: '0987543257' })
            expect(section).not.toMatch(/Adresse de livraison/)
            expect(section).not.toMatch(/Email/)
        })

        test('l\'email est repris quand il existe', () => {
            const section = buildKnownContactSection({ ...CONTACT, email: 'koffi@example.com' })
            expect(section).toMatch(/• Email : koffi@example\.com/)
        })
    })

    describe('ne produit rien sans coordonnées exploitables', () => {
        test('objet vide, nul ou absent', () => {
            expect(buildKnownContactSection(null)).toBe('')
            expect(buildKnownContactSection(undefined)).toBe('')
            expect(buildKnownContactSection({})).toBe('')
        })

        // Une adresse seule ne suffit pas à identifier quelqu'un : sans nom ni téléphone,
        // proposer « je reprends vos coordonnées » n'aurait aucun sens.
        test('une adresse sans nom ni téléphone', () => {
            expect(buildKnownContactSection({ address: 'Cocody' })).toBe('')
        })

        test('un nom seul suffit à déclencher la proposition', () => {
            expect(buildKnownContactSection({ name: 'Koffi Kadis' })).toMatch(/• Nom : Koffi Kadis/)
        })
    })
})
