
// 🏎️ TEST AUTOMATIQUE DU PRICING (MANUEL)
// Exécuter avec: node tests/pricing_test_manual.js

const { calculateItemPrice } = require('../src/lib/whatsapp/ai/tools/pricing-logic')

console.log('🏁 DÉMARRAGE DES TESTS PRICING...\n')

let passed = 0
let failed = 0

function assert(description, condition) {
    if (condition) {
        console.log(`✅ ${description}`)
        passed++
    } else {
        console.error(`❌ ${description}`)
        if (arguments[2]) {
            console.log(`   📉 REÇU: ${arguments[2].price}`)
            console.log('   📜 LOGS:', arguments[2].logs)
        }
        failed++
    }
}

// --- MOCK PRODUCT ---
const PIZZA = {
    name: 'Pizza',
    price_fcfa: 5000,
    variants: [
        {
            name: 'Taille',
            type: 'fixed', // Remplace le prix
            options: [
                { name: 'Moyenne', price: 5000 },
                { name: 'Grande', price: 7000 }
            ]
        },
        {
            name: 'Supplément',
            type: 'supplement', // S'ajoute au prix
            options: [
                { name: 'Fromage', price: 1000 },
                { name: 'Champignons', price: 500 }
            ]
        }
    ]
}

// TEST 1: Cas Nominal (Rien de spécial)
// Un produit sans variantes obligatoires n'existe pas dans cet exemple, simulons un produit simple
const COLA = { name: 'Cola', price_fcfa: 1000, variants: [] }
const res1 = calculateItemPrice(COLA, {}, '')
assert('Produit simple renvoie prix de base', res1.price === 1000, res1)

// TEST 2: Variante "Taille Grande" (Remplacement prix)
const res2 = calculateItemPrice(PIZZA, { 'Taille': 'Grande' }, '')
assert('Taille Grande remplace le prix (7000)', res2.price === 7000, res2)

// TEST 3: Variante + Supplément (7000 + 1000)
const res3 = calculateItemPrice(PIZZA, { 'Taille': 'Grande', 'Supplément': 'Fromage' }, '')
assert('Grande + Fromage = 8000', res3.price === 8000, res3)

// TEST 4: Supplément seul (Sur prix base Moyenne par défaut ?)
const res4 = calculateItemPrice(PIZZA, { 'Supplément': 'Fromage' }, '')
assert('Manque taille -> Erreur attendue', res4.error !== null, res4)

// TEST 5: Matching flexible ("grande" minuscule)
const res5 = calculateItemPrice(PIZZA, { 'Taille': 'grande' }, '')
assert('Matching flexible fonctionne', res5.price === 7000, res5)

// TEST 6: Fallback nom produit ("Pizza Grande")
const res6 = calculateItemPrice(PIZZA, {}, 'Je veux une Pizza Grande')
assert('Fallback nom produit fonctionne', res6.price === 7000, res6)


console.log(`\n📊 RÉSULTAT: ${passed} PASSÉS, ${failed} ÉCHOUÉS`)
if (failed === 0) console.log('🎉 SUCCÈS TOTAL !')
else console.log('💥 IL Y A DES ERREURS.')
