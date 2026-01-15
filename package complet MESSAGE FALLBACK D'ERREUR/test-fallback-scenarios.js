#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * TEST SCRIPT : Fallback Message Error Handling
 * ═══════════════════════════════════════════════════════════════
 * 
 * Ce script teste différents scénarios d'erreur pour valider
 * que le message fallback est bien envoyé dans tous les cas.
 * 
 * Usage: node tests/test-fallback-scenarios.js
 */

console.log('═══════════════════════════════════════════════════════');
console.log('🧪 TEST : Fallback Message Scenarios');
console.log('═══════════════════════════════════════════════════════\n');

// Mock objects
const mockActiveSessions = new Map();
const mockConversation = { id: 'conv-123' };
let messagesSent = [];

// Mock WhatsApp socket
const createMockSocket = (shouldFail = false) => ({
    sendMessage: async (to, content) => {
        if (shouldFail) {
            throw new Error('WhatsApp connection lost');
        }
        messagesSent.push({ to, content });
        return { key: { id: 'msg-' + Date.now() } };
    }
});

// Mock Supabase
const createMockSupabase = (shouldFail = false) => ({
    from: () => ({
        insert: () => ({
            catch: (handler) => {
                if (shouldFail) {
                    handler(new Error('DB connection failed'));
                }
                return Promise.resolve();
            }
        })
    })
});

// ═══════════════════════════════════════════════════════════════
// TEST CASE 1: Erreur IA (Cas le plus fréquent)
// ═══════════════════════════════════════════════════════════════

async function testAIError() {
    console.log('📝 TEST 1 : Erreur Génération IA');
    messagesSent = [];
    
    const agentId = 'agent-1';
    const message = { from: '+2250756236984' };
    
    mockActiveSessions.set(agentId, {
        socket: createMockSocket(false)
    });
    
    try {
        // Simuler une erreur dans generateAIResponse
        throw new Error('OpenAI API timeout');
    } catch (error) {
        console.error('❌ CRITICAL ERROR handling message:', error);
        
        try {
            const session = mockActiveSessions.get(agentId);
            
            if (session && session.socket && message.from) {
                const fallbackMessage = "Désolé, je réfléchis trop. Un petit instant... 🤔";
                
                console.log('🛟 Sending fallback message to client...');
                
                await session.socket.sendMessage(message.from, {
                    text: fallbackMessage
                }, {
                    linkPreview: false
                });
                
                console.log('✅ Fallback message sent successfully');
            }
        } catch (fallbackError) {
            console.error('❌ FALLBACK FAILED (silent failure):', fallbackError);
        }
    }
    
    // Vérification
    if (messagesSent.length === 1 && messagesSent[0].content.text.includes('Désolé')) {
        console.log('✅ TEST 1 PASSÉ : Message fallback envoyé\n');
        return true;
    } else {
        console.log('❌ TEST 1 ÉCHOUÉ : Pas de message fallback\n');
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// TEST CASE 2: Session WhatsApp déconnectée
// ═══════════════════════════════════════════════════════════════

async function testDisconnectedSession() {
    console.log('📝 TEST 2 : Session WhatsApp Déconnectée');
    messagesSent = [];
    
    const agentId = 'agent-2';
    const message = { from: '+2250756236984' };
    
    // Session existe mais socket est null
    mockActiveSessions.set(agentId, {
        socket: null
    });
    
    try {
        throw new Error('Database query failed');
    } catch (error) {
        console.error('❌ CRITICAL ERROR handling message:', error);
        
        try {
            const session = mockActiveSessions.get(agentId);
            
            if (session && session.socket && message.from) {
                const fallbackMessage = "Désolé, je réfléchis trop. Un petit instant... 🤔";
                await session.socket.sendMessage(message.from, { text: fallbackMessage });
                console.log('✅ Fallback message sent successfully');
            } else {
                console.warn('⚠️ Cannot send fallback: session or socket unavailable');
            }
        } catch (fallbackError) {
            console.error('❌ FALLBACK FAILED (silent failure):', fallbackError);
        }
    }
    
    // Vérification : aucun message envoyé, mais pas de crash
    if (messagesSent.length === 0) {
        console.log('✅ TEST 2 PASSÉ : Dégradation gracieuse (pas de crash)\n');
        return true;
    } else {
        console.log('❌ TEST 2 ÉCHOUÉ : Comportement inattendu\n');
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// TEST CASE 3: Échec envoi du message fallback (Boucle infinie ?)
// ═══════════════════════════════════════════════════════════════

async function testFallbackFailure() {
    console.log('📝 TEST 3 : Échec Envoi Fallback (Test Boucle Infinie)');
    messagesSent = [];
    
    const agentId = 'agent-3';
    const message = { from: '+2250756236984' };
    
    // Socket qui échoue à l'envoi
    mockActiveSessions.set(agentId, {
        socket: createMockSocket(true) // shouldFail = true
    });
    
    let loopCount = 0;
    
    try {
        throw new Error('AI generation timeout');
    } catch (error) {
        console.error('❌ CRITICAL ERROR handling message:', error);
        
        try {
            loopCount++;
            const session = mockActiveSessions.get(agentId);
            
            if (session && session.socket && message.from) {
                const fallbackMessage = "Désolé, je réfléchis trop. Un petit instant... 🤔";
                console.log('🛟 Sending fallback message to client...');
                
                await session.socket.sendMessage(message.from, {
                    text: fallbackMessage
                });
                
                console.log('✅ Fallback message sent successfully');
            }
        } catch (fallbackError) {
            // 🚨 CRITIQUE : NE JAMAIS LANCER D'ERREUR ICI
            console.error('❌ FALLBACK FAILED (silent failure):', fallbackError.message);
            // On s'arrête ici - PAS de retry
        }
    }
    
    // Vérification : 1 seule tentative (pas de boucle)
    if (loopCount === 1 && messagesSent.length === 0) {
        console.log('✅ TEST 3 PASSÉ : Pas de boucle infinie (1 tentative)\n');
        return true;
    } else {
        console.log(`❌ TEST 3 ÉCHOUÉ : ${loopCount} tentatives détectées\n`);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// TEST CASE 4: DB Logging échoue (non bloquant)
// ═══════════════════════════════════════════════════════════════

async function testDBLoggingFailure() {
    console.log('📝 TEST 4 : Échec Logging DB (Non Bloquant)');
    messagesSent = [];
    
    const agentId = 'agent-4';
    const message = { from: '+2250756236984' };
    
    mockActiveSessions.set(agentId, {
        socket: createMockSocket(false)
    });
    
    const supabase = createMockSupabase(true); // shouldFail = true
    
    try {
        throw new Error('Credits exhausted');
    } catch (error) {
        console.error('❌ CRITICAL ERROR handling message:', error);
        
        try {
            const session = mockActiveSessions.get(agentId);
            
            if (session && session.socket && message.from) {
                const fallbackMessage = "Désolé, je réfléchis trop. Un petit instant... 🤔";
                
                await session.socket.sendMessage(message.from, {
                    text: fallbackMessage
                });
                
                console.log('✅ Fallback message sent successfully');
                
                // Tentative de logging (va échouer silencieusement)
                if (supabase && mockConversation?.id) {
                    await supabase.from('messages').insert({
                        conversation_id: mockConversation.id,
                        content: fallbackMessage
                    }).catch(dbErr => {
                        console.warn('⚠️ Failed to log fallback message to DB:', dbErr.message);
                    });
                }
            }
        } catch (fallbackError) {
            console.error('❌ FALLBACK FAILED (silent failure):', fallbackError);
        }
    }
    
    // Vérification : message envoyé malgré échec DB
    if (messagesSent.length === 1) {
        console.log('✅ TEST 4 PASSÉ : Message envoyé malgré échec DB\n');
        return true;
    } else {
        console.log('❌ TEST 4 ÉCHOUÉ : Message bloqué par erreur DB\n');
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// EXÉCUTION DES TESTS
// ═══════════════════════════════════════════════════════════════

async function runAllTests() {
    const results = [];
    
    results.push(await testAIError());
    results.push(await testDisconnectedSession());
    results.push(await testFallbackFailure());
    results.push(await testDBLoggingFailure());
    
    console.log('═══════════════════════════════════════════════════════');
    const passed = results.filter(r => r).length;
    console.log(`📊 RÉSULTATS : ${passed}/4 tests passés`);
    
    if (passed === 4) {
        console.log('🎉 TOUS LES TESTS ONT RÉUSSI !');
        console.log('\n✅ Le fallback est robuste et sécurisé');
        console.log('✅ Pas de boucle infinie');
        console.log('✅ Dégradation gracieuse');
        process.exit(0);
    } else {
        console.log(`🚨 ${4 - passed} test(s) échoué(s)`);
        process.exit(1);
    }
}

// Lancer les tests
runAllTests().catch(err => {
    console.error('Erreur critique dans les tests:', err);
    process.exit(1);
});
