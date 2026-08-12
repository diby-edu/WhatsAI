/**
 * Régression réelle (production, 11/08/2026) : une conversation complète
 * ("10 sac enfant noir", retrait en boutique, nom, téléphone) s'est terminée sans que
 * l'IA appelle preview_cart. Le lead enregistré n'avait ni articles ni montant — le
 * tableau de bord affichait "—" et le vendeur devait rouvrir WhatsApp pour facturer.
 *
 * Le moteur, lui, connaissait les articles depuis le premier message. Ce filet
 * reconstruit le détail depuis lead_state quand le panier calculé manque.
 */

const { buildItemsFromLeadState } = require('../../../src/lib/whatsapp/ai/tools/tool-capture-lead')

const PRODUCTS = [
    {
        id: 'p-sac', name: 'sac enfant', product_type: 'product', price_fcfa: 5000,
        variants: [{ name: 'Couleur', type: 'fixed', options: [
            { value: 'Bleu', price: 5000 }, { value: 'Jaune', price: 6000 }, { value: 'Noir', price: 7000 },
        ] }],
    },
    {
        id: 'p-goube', name: 'goube enfant', product_type: 'product', price_fcfa: 6500,
        variants: [{ name: 'Couleur', type: 'fixed', options: [
            { value: 'Rouge', price: 9000 }, { value: 'Bleu', price: 6500 },
        ] }],
    },
]

const line = over => ({ product_id: 'p-sac', product_name: 'sac enfant', variant_status: 'valid', variant: 'Noir', quantity: 10, ...over })

describe('buildItemsFromLeadState', () => {
    test('reconstruit le cas exact perdu en production', () => {
        const items = buildItemsFromLeadState({ items: [line()] }, PRODUCTS)
        expect(items).toEqual([{
            product_name: 'sac enfant', variant: 'Noir', quantity: 10,
            unit_price: 7000, subtotal: 70000,
        }])
    })

    test('utilise le prix de la variante, pas le prix de base', () => {
        // Le prix "Prix Fixe" de l'option REMPLACE le prix de base : Noir = 7 000, pas 5 000.
        const [item] = buildItemsFromLeadState({ items: [line({ variant: 'Jaune' })] }, PRODUCTS)
        expect(item.unit_price).toBe(6000)
        expect(item.subtotal).toBe(60000)
    })

    test('additionne plusieurs lignes de produits différents', () => {
        const items = buildItemsFromLeadState({ items: [
            line({ variant: 'Bleu', quantity: 5 }),
            line({ product_id: 'p-goube', product_name: 'goube enfant', variant: 'Rouge', quantity: 2 }),
        ] }, PRODUCTS)
        expect(items).toHaveLength(2)
        expect(items.reduce((s, i) => s + i.subtotal, 0)).toBe(5 * 5000 + 2 * 9000)
    })

    test('ignore une ligne dont la variante est invalide (aucun prix fiable)', () => {
        expect(buildItemsFromLeadState({ items: [
            line({ variant_status: 'invalid', variant: null, requested_variant: 'rose', quantity: 8 }),
        ] }, PRODUCTS)).toBeNull()
    })

    test('ignore une ligne sans quantité', () => {
        expect(buildItemsFromLeadState({ items: [line({ quantity: null })] }, PRODUCTS)).toBeNull()
    })

    test('refuse TOUT l\'état dès qu\'une ligne est invalide, plutôt qu\'un détail partiel', () => {
        // Comportement volontairement durci après la conversation réelle du 11/08/2026 :
        // ne garder que les lignes exploitables produisait un lead amputé. Là-bas, 8 sacs
        // "rose" et 6 "orange" avaient été résolus en Bleu et Jaune DANS la conversation
        // mais jamais dans l'état — un détail partiel aurait facturé la seule gourde et
        // perdu les 14 sacs. Une ligne invalide signale que l'état a décroché : on s'abstient.
        const items = buildItemsFromLeadState({ items: [
            line({ variant: 'Noir', quantity: 10 }),
            line({ variant_status: 'invalid', variant: null, requested_variant: 'rose', quantity: 8 }),
        ] }, PRODUCTS)
        expect(items).toBeNull()
    })

    // ── Refus de reconstruire quand l'état ne reflète plus la commande ────────────
    // Les deux cas viennent de conversations réelles où reconstruire aurait produit un
    // lead FAUX — plus nuisible qu'un lead sans détail, parce que le vendeur y croirait.

    test('refuse de reconstruire après une annulation du client', () => {
        // Conv. réelle : "Non je ne veux pas 10 sac enfant noir". L'IA retire la ligne de
        // la commande, le moteur la garde. Reconstruire réintroduirait les 10 sacs annulés.
        const state = { items: [line()], has_unapplied_change: true }
        expect(buildItemsFromLeadState(state, PRODUCTS)).toBeNull()
    })

    test('refuse de reconstruire tant qu\'une variante reste non résolue', () => {
        // Conv. réelle : 8 rose + 6 orange devenus Bleu et Jaune dans la conversation,
        // jamais dans l'état. Reconstruire perdrait les 14 sacs.
        const state = { items: [
            line({ variant_status: 'invalid', variant: null, requested_variant: 'rose', quantity: 8 }),
            line({ variant: 'Noir', quantity: 10 }),
        ] }
        expect(buildItemsFromLeadState(state, PRODUCTS)).toBeNull()
    })

    test('reconstruit normalement quand l\'état est sain', () => {
        const state = { items: [line()], has_unapplied_change: false }
        expect(buildItemsFromLeadState(state, PRODUCTS)).toHaveLength(1)
    })

    test('retourne null sur une entrée vide, absente ou sans catalogue', () => {
        expect(buildItemsFromLeadState(null, PRODUCTS)).toBeNull()
        expect(buildItemsFromLeadState({ items: [] }, PRODUCTS)).toBeNull()
        expect(buildItemsFromLeadState({}, PRODUCTS)).toBeNull()
        expect(buildItemsFromLeadState({ items: [line()] }, [])).toBeNull()
        expect(buildItemsFromLeadState({ items: [line()] }, null)).toBeNull()
    })

    test('ignore un article absent du catalogue de l\'agent', () => {
        expect(buildItemsFromLeadState({ items: [line({ product_id: 'inconnu' })] }, PRODUCTS)).toBeNull()
    })
})
