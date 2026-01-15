-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : RAG Security Fix (Agent Isolation)
-- ═══════════════════════════════════════════════════════════════
-- 
-- CRITICAL: This migration fixes a data leak vulnerability where
-- Agent A could read documents from Agent B's knowledge base.
-- 
-- Date : 2026-01-15
-- ═══════════════════════════════════════════════════════════════

-- STEP 1 : Drop the old, insecure function
DROP FUNCTION IF EXISTS match_documents(vector, float, int);

-- STEP 2 : Create the new, secured function with agent_id filter
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_agent_id uuid  -- ⭐ NEW: Required filter for security
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.content,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE 
    -- ⭐ SECURITY FILTER: Only return docs belonging to this agent
    knowledge_base.agent_id = p_agent_id
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- STEP 3 : Grant permissions
GRANT EXECUTE ON FUNCTION match_documents(vector, float, int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION match_documents(vector, float, int, uuid) TO authenticated;

-- STEP 4 : Add documentation
COMMENT ON FUNCTION match_documents IS 
'SECURED vector search for knowledge base. Filters results by agent_id to prevent data leaks between agents.';
