/**
 * Régression réelle (production, 12/08/2026) : le client répond « Angré château ».
 * Angré est un quartier de Cocody, facturé 1 000 FCFA dans la configuration. L'agent a
 * annoncé 2 000 FCFA — un montant qui existe ailleurs dans la grille de zones, mais pas
 * pour ce lieu. Le client a vu un prix, le vendeur en verra un autre au moment de facturer.
 *
 * Vérifiable sans jugement : un nom de zone réellement configurée apparaît quelque part
 * dans la conversation récente, ou il n'y en a aucun.
 */

const { findInventedDeliveryFee } = require('../../../src/lib/whatsapp/ai/generator')

const AGENT_ZONES = {
    delivery_fee_mode: 'zones',
    delivery_zones: {
        communes: [
            { name: 'Cocody', fee: 1000 },
            { name: 'Yopougon', fee: 2000 },
            { name: 'Port-Bouët', fee: 2000 },
        ],
        hors_abidjan: [],
        international: [],
    },
}

describe('findInventedDeliveryFee', () => {
    describe('détecte un tarif annoncé pour un lieu hors zones configurées', () => {
        test('cas exact observé en production : aucune zone ne correspond au lieu cité', () => {
            const content = 'Pour la livraison à Trucmuche Lointain, les frais de livraison sont de 2 000 FCFA.'
            const history = [{ role: 'user', content: 'Trucmuche Lointain' }]
            const invented = findInventedDeliveryFee(content, AGENT_ZONES, history)
            expect(invented).not.toBeNull()
            expect(invented.sentence).toMatch(/2 000 FCFA/)
        })

        test('le lieu peut avoir été donné plusieurs tours plus tôt, pas dans le message courant', () => {
            const content = 'Les frais de livraison sont de 2 000 FCFA.'
            const history = [
                { role: 'user', content: 'Je veux 10 sacs' },
                { role: 'assistant', content: 'Quelle couleur ?' },
                { role: 'user', content: 'Un lieu qui n\'existe dans aucune zone' },
            ]
            expect(findInventedDeliveryFee(content, AGENT_ZONES, history)).not.toBeNull()
        })
    })

    describe('se tait quand le tarif correspond à une vraie zone', () => {
        test('la zone est mentionnée dans le message courant', () => {
            const content = 'Pour la livraison à Cocody, les frais de livraison sont de 1 000 FCFA.'
            expect(findInventedDeliveryFee(content, AGENT_ZONES, [])).toBeNull()
        })

        test('la zone a été donnée plus tôt dans la conversation', () => {
            const content = 'Les frais de livraison sont de 2 000 FCFA.'
            const history = [{ role: 'user', content: 'Je suis à Yopougon' }]
            expect(findInventedDeliveryFee(content, AGENT_ZONES, history)).toBeNull()
        })

        test('tolère une faute ou une variante du nom de la zone', () => {
            const content = 'Pour la livraison à Port Bouet, les frais de livraison sont de 2 000 FCFA.'
            const history = [{ role: 'user', content: 'Port Bouet' }]
            expect(findInventedDeliveryFee(content, AGENT_ZONES, history)).toBeNull()
        })

        // Régression trouvée en écrivant ces tests : "Port-Bouët" (nom configuré, avec
        // tiret) n'était reconnu que si le client tapait le tiret exact — la façon la plus
        // courante de l'écrire côté client ("Port Bouet", sans tiret ni accent) était
        // pourtant à tort traitée comme une zone inconnue.
        test('reconnaît une zone à tiret même écrite sans tiret côté client', () => {
            const content = 'Pour la livraison à Port Bouet, les frais de livraison sont de 2 000 FCFA.'
            expect(findInventedDeliveryFee(content, AGENT_ZONES, [{ role: 'user', content: 'Port Bouet' }])).toBeNull()
        })

        test('reconnaît aussi la zone à tiret écrite avec son tiret d\'origine', () => {
            const content = 'Pour la livraison à Port-Bouët, les frais de livraison sont de 2 000 FCFA.'
            expect(findInventedDeliveryFee(content, AGENT_ZONES, [{ role: 'user', content: 'Port-Bouët' }])).toBeNull()
        })
    })

    describe('se tait hors de son périmètre', () => {
        test('agent qui ne facture pas par zones', () => {
            const content = 'Les frais de livraison sont de 2 000 FCFA.'
            expect(findInventedDeliveryFee(content, { delivery_fee_mode: 'flat' }, [])).toBeNull()
        })

        test('aucune annonce de frais dans le message', () => {
            expect(findInventedDeliveryFee('Quelle couleur souhaitez-vous ?', AGENT_ZONES, [])).toBeNull()
        })

        test('aucune zone configurée du tout', () => {
            const content = 'Les frais de livraison sont de 2 000 FCFA.'
            expect(findInventedDeliveryFee(content, { delivery_fee_mode: 'zones', delivery_zones: {} }, [])).toBeNull()
        })

        test('entrées vides ou absentes', () => {
            expect(findInventedDeliveryFee('', AGENT_ZONES, [])).toBeNull()
            expect(findInventedDeliveryFee(null, AGENT_ZONES, [])).toBeNull()
            expect(findInventedDeliveryFee('Les frais de livraison sont de 2 000 FCFA.', null, [])).toBeNull()
        })
    })
})
