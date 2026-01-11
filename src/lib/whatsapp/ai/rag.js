/**
 * RAG - Knowledge Base Search
 * @param {Object} openai OpenAI Instance
 * @param {Object} supabase Supabase Instance
 * @param {string} agentId Agent ID
 * @param {string} userQuery User's message
 * @returns {Promise<Array>} List of relevant documents
 */
async function findRelevantDocuments(openai, supabase, agentId, userQuery) {
    try {
        // 1. Generate embedding for user query
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: userQuery.replace(/\n/g, ' '),
        })
        const embedding = embeddingResponse.data[0].embedding

        // 2. Search in Supabase
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.7, // 70% similarity threshold
            match_count: 3
        })

        if (error) {
            console.error('Vector search error:', error)
            return []
        }

        return documents || []
    } catch (error) {
        console.error('RAG Error:', error)
        return []
    }
}

module.exports = { findRelevantDocuments }
