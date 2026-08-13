/**
 * Régression réelle (production, 12/08/2026) : l'agent raconte sa mécanique interne.
 *
 *   « Parfait ! Pour les 10 sacs enfant noir, je vais calculer le récapitulatif
 *     avec les frais de livraison. »
 *   « Je vais maintenant vérifier les frais pour Angré Château. Un instant, s'il
 *     vous plaît. … »  — suivi, DANS LE MÊME MESSAGE, du résultat.
 *
 * L'attente était donc du théâtre. Le client n'a pas à savoir qu'un calcul va avoir
 * lieu : il attend le résultat.
 *
 * Le retrait se fait à la PHRASE et jamais à la proposition — la narration est souvent
 * enchâssée, et couper la seule proposition laissait un fragment tronqué :
 * « Parfait ! Pour les 10 sacs enfant noir, ».
 */

const { stripLeadOnlyNarration } = require('../../../src/lib/whatsapp/ai/generator')

describe('stripLeadOnlyNarration', () => {
    describe('retire la narration observée en production', () => {
        test('annonce de calcul enchâssée dans une phrase', () => {
            const avant = "Parfait ! Pour les 10 sacs enfant noir, je vais calculer le récapitulatif avec les frais de livraison.\n\nVeuillez me donner votre adresse de livraison complète, s'il vous plaît."
            const apres = stripLeadOnlyNarration(avant, true)
            expect(apres).not.toMatch(/je vais calculer/i)
            // Aucun fragment tronqué : la phrase entière part.
            expect(apres).not.toMatch(/Pour les 10 sacs enfant noir,\s*$/m)
            expect(apres).toMatch(/Veuillez me donner votre adresse/)
            expect(apres).toMatch(/^Parfait !/)
        })

        test('attente simulée et points de suspension, résultat conservé', () => {
            const avant = "Merci ! Je vais maintenant vérifier les frais de livraison pour Angré Château. Un instant, s'il vous plaît.\n\n...\n\nPour la livraison à Angré Château, les frais sont de 2 000 FCFA.\n*TOTAL : 37 000 FCFA*"
            const apres = stripLeadOnlyNarration(avant, true)
            expect(apres).not.toMatch(/je vais maintenant vérifier/i)
            expect(apres).not.toMatch(/un instant/i)
            expect(apres).not.toMatch(/^\s*\.{2,}\s*$/m)
            // Le résultat, lui, doit rester intact.
            expect(apres).toMatch(/les frais sont de 2 000 FCFA/)
            expect(apres).toMatch(/\*TOTAL : 37 000 FCFA\*/)
        })

        test('couvre les autres formulations d\'attente', () => {
            for (const phrase of [
                'Un moment, je regarde ça.',
                'Veuillez patienter quelques secondes.',
                'Je vais préparer votre récapitulatif.',
                'Je vais procéder au calcul.',
                'Je reviens vers vous dans un instant.',
            ]) {
                expect(stripLeadOnlyNarration(`${phrase}\nVoici la suite.`, true)).toBe('Voici la suite.')
            }
        })
    })

    describe('ne touche pas aux messages légitimes', () => {
        test('un récapitulatif chiffré reste identique', () => {
            const recap = 'Voici votre commande :\n*• 10 sac enfant Noir 💰 7 000 FCFA × 10 = 70 000 FCFA*\n*Frais de livraison : 2 000 FCFA*\n*TOTAL : 72 000 FCFA*\n\nVous passez en boutique ou vous souhaitez être livré ?'
            expect(stripLeadOnlyNarration(recap, true)).toBe(recap)
        })

        test('"veuillez me donner" n\'est pas "veuillez patienter"', () => {
            const m = "Veuillez me donner votre adresse de livraison complète, s'il vous plaît."
            expect(stripLeadOnlyNarration(m, true)).toBe(m)
        })

        test('questions et confirmations ordinaires', () => {
            for (const m of [
                'Quelle couleur souhaitez-vous ?',
                'Merci, votre numéro a bien été enregistré.',
                'Merci ! Notre équipe vous recontacte rapidement pour finaliser. 🙌',
            ]) {
                expect(stripLeadOnlyNarration(m, true)).toBe(m)
            }
        })

        test('hors mode lead_only, ou contenu vide', () => {
            const m = 'Je vais calculer le récapitulatif.'
            expect(stripLeadOnlyNarration(m, false)).toBe(m)
            expect(stripLeadOnlyNarration('', true)).toBe('')
            expect(stripLeadOnlyNarration(null, true)).toBe(null)
        })
    })
})

/**
 * Ajouts après le test terrain du 12/08/2026.
 */
describe('stripLeadOnlyNarration — compléments terrain', () => {
    test('« je vais ajouter cela à votre commande » est de la narration', () => {
        const avant = 'Pour les 5 gourdes en Rouge, je vais ajouter cela à votre commande.\n\nVous passez en boutique ou vous souhaitez être livré ?'
        const apres = stripLeadOnlyNarration(avant, true)
        expect(apres).not.toMatch(/je vais ajouter/i)
        expect(apres).toMatch(/Vous passez en boutique/)
    })

    // Sans ce filet, un message intégralement narratif était réduit à une chaîne vide et le
    // client ne recevait plus rien — pire que la narration qu'on cherchait à retirer.
    test('un message entièrement narratif est conservé plutôt que vidé', () => {
        const avant = 'Un instant, je vérifie.'
        expect(stripLeadOnlyNarration(avant, true)).toBe(avant)
    })
})
