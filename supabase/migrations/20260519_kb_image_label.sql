-- Ajout colonne image_label sur knowledge_base
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS image_label TEXT;

-- match_documents retourne maintenant les champs image pour le RAG
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_agent_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  title text,
  image_url text,
  image_label text,
  extra_image_urls jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_base.id,
    knowledge_base.content,
    knowledge_base.title,
    knowledge_base.image_url,
    knowledge_base.image_label,
    knowledge_base.extra_image_urls,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
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
