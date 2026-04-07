/**
 * ═══════════════════════════════════════════════════════════════
 * RAG - Knowledge Base Search (SECURED v2.0)
 * ═══════════════════════════════════════════════════════════════
 * 
 * SECURITY FIX: Added agent_id filtering to prevent data leaks
 * between agents (cross-tenant data exposure).
 */

/**
 * Découpe un message multi-questions en sous-requêtes distinctes.
 * Détecte les séparateurs : "?", "et aussi", numérotation "1)", "2)", etc.
 * Retourne max 3 sous-requêtes (pour limiter les appels API).
 */
function splitIntoSubQueries(text) {
    // Nettoyage préalable
    const clean = text.replace(/\s+/g, ' ').trim()

    // Séparateurs entre questions
    const segments = clean
        // Scinder sur "?" en gardant le "?" avec le segment
        .split(/(?<=\?)\s+/)
        // Ou sur "et aussi", "et aussi", "et en plus", "et également"
        .flatMap(s => s.split(/\s+(?:et aussi|aussi|également|de plus|et en plus)\s+/i))
        // Ou sur numérotation "1)", "2)", "1.", "2."
        .flatMap(s => s.split(/(?:^|\s)(?:[1-9][).])\s+/))
        .map(s => s.trim())
        .filter(s => s.length >= 5)

    if (segments.length <= 1) return [clean]

    // Limiter à 3 sous-requêtes max
    return segments.slice(0, 3)
}

/**
 * Effectue une recherche vectorielle pour une seule requête.
 * Retourne les documents avec leur similarity score.
 */
async function searchSingleQuery(openai, supabase, agentId, query) {
    const genericPatterns = /catalogue|service|propos|offre|vend|disponib|qu.est.ce|avez.vous|que faites/i
    const isGenericQuery = genericPatterns.test(query)

    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    })
    const embedding = embeddingResponse.data[0].embedding

    const { data: documents, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: isGenericQuery ? 0.2 : 0.3,
        match_count: isGenericQuery ? 15 : 8,
        p_agent_id: agentId
    })

    if (error) {
        console.error('Vector search error:', error)
        if (error.message?.includes('p_agent_id')) {
            console.error('❌ CRITICAL: match_documents function needs migration!')
        }
        return []
    }

    return documents || []
}

/**
 * RAG - Knowledge Base Search (Multi-Query)
 * @param {Object} openai OpenAI Instance
 * @param {Object} supabase Supabase Instance
 * @param {string} agentId Agent ID (CRITICAL: Used for filtering)
 * @param {string} userQuery User's message
 * @returns {Promise<Array>} List of relevant documents
 */
async function findRelevantDocuments(openai, supabase, agentId, userQuery) {
    try {
        // ═══════════════════════════════════════════════════════════
        // VALIDATION INPUT
        // ═══════════════════════════════════════════════════════════

        if (!userQuery || typeof userQuery !== 'string') {
            console.warn('Invalid userQuery:', typeof userQuery)
            return []
        }

        if (!agentId) {
            console.error('❌ SECURITY: agentId is required for RAG search!')
            return []
        }

        // ═══════════════════════════════════════════════════════════
        // SANITIZATION & LIMITATION
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
        // MULTI-QUERY : détecter plusieurs questions
        // ═══════════════════════════════════════════════════════════

        const subQueries = splitIntoSubQueries(sanitizedQuery)

        if (subQueries.length > 1) {
            console.log(`🔍 Multi-query RAG: ${subQueries.length} sous-requêtes détectées`)

            // Lancer toutes les recherches en parallèle
            const results = await Promise.all(
                subQueries.map(q => searchSingleQuery(openai, supabase, agentId, q))
            )

            // Fusionner et dédupliquer par id (garder le score le plus élevé)
            const merged = new Map()
            for (const docs of results) {
                for (const doc of docs) {
                    const key = doc.id
                    if (!merged.has(key) || doc.similarity > merged.get(key).similarity) {
                        merged.set(key, doc)
                    }
                }
            }

            // Trier par similarité décroissante
            const finalDocs = Array.from(merged.values()).sort((a, b) => b.similarity - a.similarity)
            console.log(`🔍 Multi-query RAG: ${finalDocs.length} docs uniques après fusion`)
            return finalDocs
        }

        // ═══════════════════════════════════════════════════════════
        // RECHERCHE SIMPLE (query unique)
        // ═══════════════════════════════════════════════════════════

        return await searchSingleQuery(openai, supabase, agentId, sanitizedQuery)

    } catch (error) {
        console.error('RAG Error:', error)
        return []
    }
}

module.exports = { findRelevantDocuments }
