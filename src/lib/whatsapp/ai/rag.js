/**
 * ═══════════════════════════════════════════════════════════════
 * RAG - Knowledge Base Search (SECURED v2.0)
 * ═══════════════════════════════════════════════════════════════
 * 
 * SECURITY FIX: Added agent_id filtering to prevent data leaks
 * between agents (cross-tenant data exposure).
 */

/**
 * RAG - Knowledge Base Search
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

        if (!userQuery || typeof userQuery !== 'string') {
            console.warn('Invalid userQuery:', typeof userQuery)
            return []
        }

        // ⭐ CRITICAL: agent_id is required for security
        if (!agentId) {
            console.error('❌ SECURITY: agentId is required for RAG search!')
            return []
        }

        // ═══════════════════════════════════════════════════════════
        // ⭐ FIX 2 : SANITIZATION & LIMITATION
        // ═══════════════════════════════════════════════════════════

        const MAX_QUERY_LENGTH = 500

        const sanitizedQuery = userQuery
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, MAX_QUERY_LENGTH)

        if (sanitizedQuery.length < 3) {
            console.log('Query too short for RAG, skipping')
            return []
        }

        // ═══════════════════════════════════════════════════════════
        // GÉNÉRATION EMBEDDING
        // ═══════════════════════════════════════════════════════════

        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: sanitizedQuery,
        })
        const embedding = embeddingResponse.data[0].embedding

        // ═══════════════════════════════════════════════════════════
        // ⭐ FIX 3 : SEARCH WITH agent_id FILTER (SECURITY)
        // ═══════════════════════════════════════════════════════════

        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: 3,
            p_agent_id: agentId  // ⭐ CRITICAL: Prevents cross-agent data leak
        })

        if (error) {
            console.error('Vector search error:', error)
            if (error.message?.includes('p_agent_id')) {
                console.error('❌ CRITICAL: match_documents function needs migration!')
            }
            return []
        }

        return documents || []
    } catch (error) {
        console.error('RAG Error:', error)
        return []
    }
}

module.exports = { findRelevantDocuments }
