-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_base table
-- We use 1536 dimensions because that's what OpenAI's text-embedding-3-small uses
ALTER TABLE public.knowledge_base 
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    knowledge_base.id,
    knowledge_base.content,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  from knowledge_base
  where 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  order by knowledge_base.embedding <=> query_embedding
  limit match_count;
end;
$$;
