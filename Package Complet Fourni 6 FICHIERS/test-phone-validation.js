#!/usr/bin/env node
/**
 * 🧪 TEST INTERACTIF : normalizePhoneNumber v2.2
 * 
 * Usage : node scripts/test-phone-validation.js
 */

const { normalizePhoneNumber } = require('../src/lib/whatsapp/utils/format');

console.log('═══════════════════════════════════════════════════════');
console.log('🧪 TEST : normalizePhoneNumber v2.2 (FIX CRITIQUE)');
console.log('═══════════════════════════════════════════════════════\n');

const testCases = [
    // ✅ CAS VALIDES
    { input: '+2250756236984', expected: '+2250756236984', shouldPass: true },
    { input: '+33 7 12 34 56 78', expected: '+33712345678', shouldPass: true },
    { input: '002250756236984', expected: '+2250756236984', shouldPass: true },
    { input: '(+225) 07-56-23-69-84', expected: '+2250756236984', shouldPass: true },
    { input: '+1 (555) 123-4567', expected: '+15551234567', shouldPass: true },
    
    // ❌ CAS INVALIDES (doivent retourner null)
    { input: '0756236984', expected: null, shouldPass: true },
    { input: '2250756236984', expected: null, shouldPass: true },
    { input: '+225ABC', expected: null, shouldPass: true },
    { input: '', expected: null, shouldPass: true },
    { input: null, expected: null, shouldPass: true },
    { input: '+225123', expected: null, shouldPass: true }, // Trop court
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    const result = normalizePhoneNumber(test.input);
    const isCorrect = result === test.expected;
    
    if (isCorrect) {
        console.log(`✅ Test ${index + 1} : PASSÉ`);
        console.log(`   Input     : "${test.input}"`);
        console.log(`   Attendu   : ${test.expected}`);
        console.log(`   Résultat  : ${result}\n`);
        passed++;
    } else {
        console.log(`❌ Test ${index + 1} : ÉCHOUÉ`);
        console.log(`   Input     : "${test.input}"`);
        console.log(`   Attendu   : ${test.expected}`);
        console.log(`   Résultat  : ${result} ⚠️\n`);
        failed++;
    }
});

console.log('═══════════════════════════════════════════════════════');
console.log(`📊 RÉSULTATS : ${passed}/${testCases.length} tests passés`);
if (failed === 0) {
    console.log('🎉 TOUS LES TESTS ONT RÉUSSI !');
    process.exit(0);
} else {
    console.log(`🚨 ${failed} test(s) échoué(s)`);
    process.exit(1);
}
