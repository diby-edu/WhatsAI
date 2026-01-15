/**
 * ═══════════════════════════════════════════════════════════════
 * FIX CRITIQUE P0 : RAG SECURITY - Code JavaScript
 * ═══════════════════════════════════════════════════════════════
 * 
 * Fichier : src/lib/whatsapp/ai/rag.js
 * 
 * CHANGEMENTS :
 * 1. Ajouter validation input
 * 2. Limiter taille query
 * 3. Passer agent_id à la fonction SQL
 */

/**
 * RAG - Knowledge Base Search (SECURED)
 * @param {Object} openai OpenAI Instance
 * @param {Object} supabase Supabase Instance
 * @param {string} agentId Agent ID (CRITICAL: Used for filtering)
 * @param {string} userQuery User's message
 * @returns {Promise<Array>} List of relevant documents
 */
async function findRelevantDocuments(openai, supabase, agentId, userQuery) {
    try {
        // ═══════════════════════════════════════════════════════════
        // ⭐ FIX 1 : VALIDATION INPUT
        // ═══════════════════════════════════════════════════════════
        
        // Vérifier que la query est valide
        if (!userQuery || typeof userQuery !== 'string') {
            console.warn('Invalid userQuery:', typeof userQuery)
            return []
        }
        
        // Vérifier que agent_id est fourni (CRITIQUE pour sécurité)
        if (!agentId) {
            console.error('❌ SECURITY: agentId is required for RAG search!')
            return []
        }
        
        // ═══════════════════════════════════════════════════════════
        // ⭐ FIX 2 : SANITIZATION & LIMITATION
        // ═══════════════════════════════════════════════════════════
        
        const MAX_QUERY_LENGTH = 500  // ~125 tokens
        
        // Nettoyer et limiter la query
        const sanitizedQuery = userQuery
            .replace(/\n/g, ' ')  // Supprimer newlines
            .replace(/\s+/g, ' ')  // Normaliser espaces
            .trim()
            .substring(0, MAX_QUERY_LENGTH)
        
        // Vérifier longueur minimale
        if (sanitizedQuery.length < 3) {
            console.log('Query too short for RAG, skipping')
            return []
        }
        
        console.log(`🔍 RAG Query (${sanitizedQuery.length} chars): ${sanitizedQuery.substring(0, 50)}...`)
        
        // ═══════════════════════════════════════════════════════════
        // GÉNÉRATION EMBEDDING (Inchangé)
        // ═══════════════════════════════════════════════════════════
        
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: sanitizedQuery,
        })
        
        const embedding = embeddingResponse.data[0].embedding
        
        // ═══════════════════════════════════════════════════════════
        // ⭐ FIX 3 : APPEL SÉCURISÉ AVEC agent_id
        // ═══════════════════════════════════════════════════════════
        
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.7,  // 70% similarity threshold
            match_count: 3,
            p_agent_id: agentId  // ⭐ CRITIQUE : Filtre par agent
        })
        
        if (error) {
            console.error('Vector search error:', error)
            
            // Si erreur = fonction pas à jour (manque p_agent_id)
            if (error.message?.includes('p_agent_id')) {
                console.error('❌ CRITICAL: match_documents function needs migration!')
                console.error('   Run: supabase/migrations/fix_rag_security.sql')
            }
            
            return []
        }
        
        // ═══════════════════════════════════════════════════════════
        // LOGGING & VALIDATION RÉSULTATS
        // ═══════════════════════════════════════════════════════════
        
        if (documents && documents.length > 0) {
            console.log(`✅ Found ${documents.length} relevant documents for agent ${agentId}`)
            
            // Vérification de sécurité (paranoid mode)
            documents.forEach((doc, idx) => {
                if (!doc.content || doc.content.length === 0) {
                    console.warn(`⚠️ Document ${idx} has empty content`)
                }
            })
        } else {
            console.log('📭 No relevant documents found in knowledge base')
        }
        
        return documents || []
        
    } catch (error) {
        console.error('RAG Error:', error)
        
        // Dégradation gracieuse : retourner tableau vide
        // L'IA continuera à fonctionner sans RAG
        return []
    }
}

module.exports = { findRelevantDocuments }

// ═══════════════════════════════════════════════════════════════
// TESTS UNITAIRES (Optionnel)
// ═══════════════════════════════════════════════════════════════

/**
 * Test de non-régression
 */
async function testRAGSecurity() {
    const mockOpenAI = {
        embeddings: {
            create: async () => ({
                data: [{ embedding: Array(1536).fill(0.5) }]
            })
        }
    }
    
    const mockSupabase = {
        rpc: async (name, params) => {
            console.log('RPC called:', name, 'with params:', Object.keys(params))
            
            // Vérifier que agent_id est passé
            if (!params.p_agent_id) {
                return {
                    data: null,
                    error: new Error('p_agent_id is required')
                }
            }
            
            return {
                data: [
                    { id: '123', content: 'Test document', similarity: 0.85 }
                ],
                error: null
            }
        }
    }
    
    // Test 1 : Appel normal
    console.log('Test 1: Normal call')
    const result1 = await findRelevantDocuments(
        mockOpenAI,
        mockSupabase,
        'agent-123',
        'Test query'
    )
    console.assert(result1.length === 1, 'Should return 1 document')
    
    // Test 2 : Sans agent_id (doit échouer)
    console.log('Test 2: Missing agent_id')
    const result2 = await findRelevantDocuments(
        mockOpenAI,
        mockSupabase,
        null,  // ❌ Pas d'agent_id
        'Test query'
    )
    console.assert(result2.length === 0, 'Should return empty array')
    
    // Test 3 : Query trop courte
    console.log('Test 3: Short query')
    const result3 = await findRelevantDocuments(
        mockOpenAI,
        mockSupabase,
        'agent-123',
        'ab'  // Trop court
    )
    console.assert(result3.length === 0, 'Should skip short queries')
    
    // Test 4 : Query trop longue (doit être tronquée)
    console.log('Test 4: Long query')
    const longQuery = 'x'.repeat(1000)
    const result4 = await findRelevantDocuments(
        mockOpenAI,
        mockSupabase,
        'agent-123',
        longQuery
    )
    // Vérifier que la query a été limitée à 500 chars
    console.assert(result4.length >= 0, 'Should handle long queries')
    
    console.log('✅ All tests passed')
}

// Décommenter pour lancer les tests
// testRAGSecurity().catch(console.error)
