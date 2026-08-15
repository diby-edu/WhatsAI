/**
 * Régression réelle (production, 12/08/2026) — signalée par le marchand qui avait remarqué
 * que « à chaque fois que c'est écrit de cette manière, le reste de la conversation ne se
 * passe pas bien » :
 *
 *   « Pour les 5 gourdes en Rouge, je vais ajouter cela à votre commande.
 *
 *     Voici le récapitulatif de votre demande :
 *       · Goube enfant (Rouge) x 5
 *
 *     Vous passez en boutique ou vous souhaitez être livré ? »
 *
 * Aucun prix, aucun total : le modèle a rédigé le récap à la main au lieu d'appeler
 * preview_cart. L'ÉTAPE 2 du workflow l'interdit pourtant explicitement, avec cet exemple
 * précis — la règle de prompt ne suffit pas.
 *
 * Et ce n'est pas cosmétique : sans passage par l'outil, le total n'existe pas côté système,
 * donc la livraison ne pourra jamais s'y ajouter ensuite. C'est exactement la conversation
 * qui a fini par une escalade, le client réclamant ses frais de livraison.
 *
 * La détection est volontairement étroite — une ligne à puce finissant par une quantité, ET
 * aucun montant nulle part dans le message.
 */

const { findPricelessRecap } = require('../../../src/lib/whatsapp/ai/generator')

describe('findPricelessRecap', () => {
    describe('détecte le récap fabriqué observé en production', () => {
        test('cas exact : puce, nom d\'article, quantité, aucun prix', () => {
            const content = 'Pour les 5 gourdes en Rouge, je vais ajouter cela à votre commande.\n\nVoici le récapitulatif de votre demande :\n  · Goube enfant (Rouge) x 5\n\nVous passez en boutique ou vous souhaitez être livré ?'
            const found = findPricelessRecap(content, true)
            expect(found).not.toBeNull()
            expect(found.sentence).toBe('· Goube enfant (Rouge) x 5')
        })

        test('autres puces et le × typographique', () => {
            for (const line of [
                '• Sac enfant (Noir) x 10',
                '- Sac enfant Bleu × 8',
                '* Goube enfant Rouge x 3',
            ]) {
                expect(findPricelessRecap(`Voici votre commande :\n${line}`, true)).not.toBeNull()
            }
        })

        test('plusieurs articles sans prix', () => {
            const content = 'Récapitulatif :\n• Sac enfant (Bleu) x 8\n• Sac enfant (Noir) x 6'
            expect(findPricelessRecap(content, true)).not.toBeNull()
        })
    })

    describe('ne touche jamais un message qui porte des montants', () => {
        test('le vrai récap de preview_cart', () => {
            const content = 'Voici votre commande :\n*• 10 sac enfant Noir 💰 7 000 FCFA × 10 = 70 000 FCFA*\n*Frais de livraison : 2 000 FCFA*\n*TOTAL : 72 000 FCFA*'
            expect(findPricelessRecap(content, true)).toBeNull()
        })

        test('une liste de couleurs avec prix', () => {
            const content = '*Pour les gourdes, les couleurs disponibles sont :*\n• Rouge 💰 9 000 FCFA\n• Bleu 💰 6 500 FCFA'
            expect(findPricelessRecap(content, true)).toBeNull()
        })

        // Le catalogue d'accueil est numéroté, pas à puces, et porte des montants : doublement
        // hors de portée. On le vérifie quand même — c'est le message le plus envoyé de tous.
        test('le catalogue d\'accueil', () => {
            const content = 'Bienvenue ! 👋\nVoici nos articles :\n1. *goube enfant* 💰 6 500 FCFA\n2. *sac enfant* 💰 5 000 FCFA\n\nQuel article vous intéresse ?'
            expect(findPricelessRecap(content, true)).toBeNull()
        })
    })

    describe('ne touche pas un message sans liste d\'articles', () => {
        test('une question simple', () => {
            expect(findPricelessRecap('Pour les 5 gourdes, quelle couleur : Rouge ou Bleu ?', true)).toBeNull()
        })

        test('une puce sans quantité', () => {
            expect(findPricelessRecap('Vos coordonnées :\n• Nom : Simone Ehivet\n• Téléphone : 5478986431', true)).toBeNull()
        })

        test('une confirmation ordinaire', () => {
            expect(findPricelessRecap('Merci, votre numéro a bien été enregistré.', true)).toBeNull()
        })
    })

    describe('se tait hors de son périmètre', () => {
        test('hors mode lead_only', () => {
            expect(findPricelessRecap('Voici votre commande :\n• Sac enfant (Noir) x 10', false)).toBeNull()
        })

        test('entrées vides', () => {
            expect(findPricelessRecap('', true)).toBeNull()
            expect(findPricelessRecap(null, true)).toBeNull()
        })
    })
})

/**
 * Deuxième forme du MÊME défaut, observée le 13/08/2026 à 22:34 :
 *
 *   « Merci ! Voici ce que j'ai pour le moment :
 *       - 10 sacs enfant (Noir)
 *       - 5 gourdes (Orange)
 *     Vous passez en boutique ou vous souhaitez être livré ? »
 *
 * Le détecteur est resté muet parce qu'il exigeait « … x N » EN FIN de ligne — la syntaxe du
 * seul échantillon dont je disposais en l'écrivant. Ici la quantité est en tête.
 *
 * La leçon est dans le test : ce qu'on cherche n'est pas une syntaxe mais une PROPRIÉTÉ —
 * une liste d'articles sans le moindre montant. Ces cas verrouillent les deux formes connues
 * et, surtout, les messages légitimes qui portent eux aussi des chiffres.
 */
describe('findPricelessRecap — quantité en tête de ligne (13/08/2026)', () => {
    const MESSAGE_REEL = 'Merci ! Voici ce que j\'ai pour le moment :\n\n- 10 sacs enfant (Noir)\n- 5 gourdes (Orange) \n\nVous passez en boutique ou vous souhaitez être livré ?'

    test('cas exact de production', () => {
        const found = findPricelessRecap(MESSAGE_REEL, true)
        expect(found).not.toBeNull()
        expect(found.sentence).toBe('- 10 sacs enfant (Noir)')
    })

    test('les deux formes connues sont couvertes', () => {
        expect(findPricelessRecap('Récapitulatif :\n· Goube enfant (Rouge) x 5', true)).not.toBeNull()
        expect(findPricelessRecap('Récapitulatif :\n· 5 Goube enfant (Rouge)', true)).not.toBeNull()
    })

    /**
     * Le bloc de coordonnées porte lui aussi des chiffres — le téléphone. Et le gras WhatsApp
     * place son astérisque AVANT la puce, ce qu'une lecture trop littérale manquait : le bloc
     * passait alors pour une liste d'articles sans prix.
     */
    test('le bloc de coordonnées n\'est jamais pris pour une liste d\'articles', () => {
        const gras = '*Vos coordonnées :*\n*• Nom : Koffi Kadis*\n*• Téléphone : 0987543257*\n*• Adresse : Adjamé*'
        const simple = 'Vos coordonnées :\n• Nom : Koffi Kadis\n• Téléphone : 0987543257'
        expect(findPricelessRecap(gras, true)).toBeNull()
        expect(findPricelessRecap(simple, true)).toBeNull()
    })

    test('une date ou une heure en puce ne déclenche rien', () => {
        expect(findPricelessRecap('Votre demande :\n• Date : 14/08\n• Heure : 10h', true)).toBeNull()
    })
})
