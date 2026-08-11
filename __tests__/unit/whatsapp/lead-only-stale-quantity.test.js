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

        test('question de variante, pas de quantité', () => {
            const content = 'Pour les 10 sacs enfant, quelle couleur souhaitez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })).toBeNull()
        })

        test('question de quantité sur un article absent de l\'état', () => {
            const content = 'Pour les chapeaux, combien en voulez-vous ?'
            expect(findStaleQuantityQuestion(content, { items: [SAC_COMPLET] })).toBeNull()
        })

        test('entrées vides ou absentes', () => {
            expect(findStaleQuantityQuestion('', { items: [SAC_COMPLET] })).toBeNull()
            expect(findStaleQuantityQuestion('Combien ?', null)).toBeNull()
            expect(findStaleQuantityQuestion('Combien ?', {})).toBeNull()
            expect(findStaleQuantityQuestion('Combien ?', { items: [] })).toBeNull()
        })
    })
})
