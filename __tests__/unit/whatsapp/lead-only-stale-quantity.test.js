/**
 * Régression réelle : l'agent redemande une quantité qu'il connaît déjà.
 * Observé en production le 11/08/2026 — le client a dû répondre "J'ai dis 10".
 *
 * Quatre règles de prompt successives n'ont pas suffi (~20 % de réponses fautives
 * persistantes). Le détecteur ci-dessous constate le cas par code ; generator.js
 * demande alors au modèle de reformuler. Il ne choisit jamais la question à poser.
 *
 * Le risque de ce genre de garde-fou étant le FAUX POSITIF (bloquer une question
 * légitime), la majorité de ces tests vérifie qu'il se tait quand il le doit.
 */

const { findStaleQuantityQuestion } = require('../../../src/lib/whatsapp/ai/generator')

const SAC_COMPLET = { product_name: 'sac enfant', variant_status: 'valid', variant: 'Noir', quantity: 10 }
const GOUBE_SANS_QUANTITE = { product_name: 'goube enfant', variant_status: 'valid', variant: 'Rouge', quantity: null }
const GOUBE_COMPLET = { product_name: 'goube enfant', variant_status: 'valid', variant: 'Bleu', quantity: 1 }

describe('findStaleQuantityQuestion', () => {
    describe('détecte la question impossible', () => {
        test('cas exact observé en production', () => {
            const content = 'Bonjour ! 😊 Nous ne vendons pas de chaises blanches. Pour les 10 sacs enfant noir, quelle est la quantité souhaitée ?'
            const stale = findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })
            expect(stale).not.toBeNull()
            expect(stale.item.product_name).toBe('sac enfant')
            expect(stale.item.quantity).toBe(10)
        })

        test('couvre les autres formulations observées', () => {
            const formulations = [
                'Pour les sacs enfant, combien en voulez-vous ?',
                'Pour les 10 sacs enfant noir, quelle quantité souhaitez-vous ?',
                'Combien de sacs enfant souhaitez-vous ?',
                'Pour les sacs enfants en Bleu, combien en souhaitez-vous ?',
            ]
            for (const content of formulations) {
                expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })).not.toBeNull()
            }
        })

        test('détecte même quand la quantité est acquise sans variante valide', () => {
            const sacQuantiteSeule = { product_name: 'sac enfant', variant_status: 'invalid', requested_variant: 'rose', quantity: 8 }
            const content = 'Pour les 8 sacs enfant, combien en voulez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [sacQuantiteSeule] })).not.toBeNull()
        })
    })

    describe('angles morts découverts en vérification de bout en bout', () => {
        test('la question NUE, sans nom de produit, est détectée', () => {
            // Forme la plus fréquente : le modèle scinde en deux phrases et la question
            // se retrouve sans produit. Exiger le nom dans la même phrase rendait le
            // détecteur aveugle 5 fois sur 6.
            const content = 'Vous avez choisi une gourde enfant en bleu. Combien en souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [GOUBE_COMPLET] })).not.toBeNull()
        })

        test('une question nue reste légitime si un article attend encore sa quantité', () => {
            const content = 'Pour les 10 sacs noirs, c\'est noté. Combien en voulez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET, GOUBE_SANS_QUANTITE] })).toBeNull()
        })

        test('reconnaît le produit malgré une faute dans le nom du catalogue', () => {
            // Le catalogue dit "goube enfant", le client et le modèle écrivent "gourde".
            // Une comparaison littérale ne voyait jamais le produit.
            const content = 'Pour les gourdes enfant bleues, quelle quantité souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [GOUBE_COMPLET] })).not.toBeNull()
        })

        test('tolère pluriels et accords sans confondre deux produits distincts', () => {
            const content = 'Pour les sacs enfants noirs, combien en voulez-vous ?'
            const stale = findStaleQuantityQuestion(content, { items: [SAC_COMPLET, GOUBE_SANS_QUANTITE] })
            expect(stale).not.toBeNull()
            expect(stale.item.product_name).toBe('sac enfant')
        })
    })

    describe('se tait quand la question est légitime', () => {
        test('question portant sur l\'article dont la quantité manque vraiment', () => {
            const content = 'Pour les 10 sacs enfant noir, c\'est noté. Concernant les goube enfant rouge, quelle quantité souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET, GOUBE_SANS_QUANTITE] })).toBeNull()
        })

        test('aucune quantité connue dans l\'état', () => {
            const content = 'Combien de sacs enfant souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [{ product_name: 'sac enfant', quantity: null }] })).toBeNull()
        })

        test('réponse sans aucune question de quantité', () => {
            const content = 'Pour les 10 sacs enfant noir, c\'est noté. Vous passez en boutique ou vous souhaitez être livré ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })).toBeNull()
        })

        test('une question de couleur reste légitime tant qu\'une ligne attend sa couleur', () => {
            const sacSansCouleur = { product_name: 'sac enfant', variant_status: 'missing', variant: null, quantity: 6 }
            const content = 'Pour les 6 sacs enfant, quelle couleur souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET, sacSansCouleur] })).toBeNull()
        })
    })

    describe('couleur déjà choisie — élargissement du 12/08/2026', () => {
        // Découvert en vérifiant la réécriture de bout en bout : privée de sa question de
        // quantité, elle la remplaçait par une question de COULEUR sur un article dont la
        // couleur était déjà acquise. Ma mesure ne voyait rien, ne cherchant que les
        // quantités — troisième fois que je mesure avec un détecteur aveugle.
        test('redemander une couleur déjà choisie est détecté', () => {
            const content = 'Pour les 10 sacs enfant, quelle couleur souhaitez-vous ?'
            const stale = findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })
            expect(stale).not.toBeNull()
            expect(stale.variantAlreadyKnown).toBe(true)
        })

        test('couvre la question nue, sans nom de produit', () => {
            const content = 'Très bien pour la gourde. Quelle couleur souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [GOUBE_COMPLET] })).not.toBeNull()
        })

        test('reste muet si une seule ligne attend encore sa couleur', () => {
            const goubeSansCouleur = { product_name: 'goube enfant', variant_status: 'missing', variant: null, quantity: 4 }
            const content = 'Quelle couleur souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET, goubeSansCouleur] })).toBeNull()
        })

        test('reste muet sur une variante refusée, qui doit être redemandée', () => {
            const sacInvalide = { product_name: 'sac enfant', variant_status: 'invalid', requested_variant: 'rose', quantity: 8 }
            const content = 'Le rose n\'existe pas. Quelle couleur souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [sacInvalide] })).toBeNull()
        })

        test('une question sur un article absent de l\'état est traitée comme suspecte', () => {
            // Arbitrage assumé : depuis la règle "question nue", une demande de quantité
            // alors que PLUS AUCUNE ligne n'en attend déclenche une reformulation, même si
            // elle nomme un article inconnu ("Pour les chapeaux, combien en voulez-vous ?").
            // C'est le prix à payer pour couvrir la forme scindée en deux phrases, qui est
            // le vrai défaut de terrain. Le coût est nul : demander à l'IA de reformuler une
            // question portant sur un article qu'on ne vend pas n'a aucun inconvénient.
            const content = 'Pour les chapeaux, combien en voulez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })).not.toBeNull()
        })

        test('mais reste muet si une ligne attend réellement une quantité', () => {
            const content = 'Pour les chapeaux, combien en voulez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET, GOUBE_SANS_QUANTITE] })).toBeNull()
        })

        test('entrées vides ou absentes', () => {
            expect(findStaleQuantityQuestion('', { items: [SAC_COMPLET] })).toBeNull()
            expect(findStaleQuantityQuestion('Combien ?', null)).toBeNull()
            expect(findStaleQuantityQuestion('Combien ?', {})).toBeNull()
            expect(findStaleQuantityQuestion('Combien ?', { items: [] })).toBeNull()
        })
    })
})
