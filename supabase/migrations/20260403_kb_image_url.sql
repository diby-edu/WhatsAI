-- Add image_url to knowledge_base (for KB items with associated images)
ALTER TABLE public.knowledge_base
    ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Drop existing function before changing return type
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);

-- Update match_documents to return image_url
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_agent_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  image_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.content,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity,
    knowledge_base.image_url
  FROM knowledge_base
  WHERE
    knowledge_base.agent_id = p_agent_id
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_documents(vector, float, int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION match_documents(vector, float, int, uuid) TO authenticated;
