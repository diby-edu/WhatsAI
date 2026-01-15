-- ═══════════════════════════════════════════════════════════════
-- FIX CRITIQUE P0 : RAG SECURITY - Filtre par agent_id
-- ═══════════════════════════════════════════════════════════════
-- 
-- PROBLÈME : La fonction match_documents ne filtre pas par agent_id
-- IMPACT : Agent A peut accéder aux documents de Agent B
-- GRAVITÉ : 🔴 CRITIQUE (Fuite de données entre clients)
-- 
-- Fichier : supabase/migrations/fix_rag_security.sql
-- Date : 2025-01-15
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Supprimer l'ancienne fonction (DANGEREUSE)
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS match_documents(vector, float, int);

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Créer la nouvelle fonction (SÉCURISÉE)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_agent_id uuid  -- ⭐ NOUVEAU : Filtre par agent
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
    -- ⭐ FILTRE DE SÉCURITÉ CRITIQUE
    knowledge_base.agent_id = p_agent_id
    -- Filtre de similarité
    AND 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 3 : Tests de Validation
-- ═══════════════════════════════════════════════════════════════

-- Test 1 : Vérifier l'isolation entre agents
DO $$
DECLARE
    test_agent_a UUID := gen_random_uuid();
    test_agent_b UUID := gen_random_uuid();
    test_user UUID := gen_random_uuid();
    test_doc_a UUID;
    test_doc_b UUID;
    result_count INT;
BEGIN
    -- Créer 2 documents pour 2 agents différents
    INSERT INTO knowledge_base (id, agent_id, user_id, title, content, embedding)
    VALUES 
        (gen_random_uuid(), test_agent_a, test_user, 'Doc A', 'Secret Agent A', array_fill(0.1, ARRAY[1536])::vector),
        (gen_random_uuid(), test_agent_b, test_user, 'Doc B', 'Secret Agent B', array_fill(0.1, ARRAY[1536])::vector);
    
    -- Test : Agent A ne doit voir QUE ses docs
    SELECT COUNT(*) INTO result_count
    FROM match_documents(
        array_fill(0.1, ARRAY[1536])::vector,
        0.0,  -- Accept all similarities
        10,
        test_agent_a  -- Agent A query
    );
    
    ASSERT result_count = 1, 'Agent A should only see 1 document (his own)';
    
    -- Test : Agent B ne doit voir QUE ses docs
    SELECT COUNT(*) INTO result_count
    FROM match_documents(
        array_fill(0.1, ARRAY[1536])::vector,
        0.0,
        10,
        test_agent_b  -- Agent B query
    );
    
    ASSERT result_count = 1, 'Agent B should only see 1 document (his own)';
    
    -- Nettoyer
    DELETE FROM knowledge_base WHERE agent_id IN (test_agent_a, test_agent_b);
    
    RAISE NOTICE 'Test 1 PASSED: Agent isolation works correctly';
END $$;

-- Test 2 : Vérifier qu'on ne peut PAS voir les docs d'un autre agent
DO $$
DECLARE
    test_agent_a UUID := gen_random_uuid();
    test_agent_b UUID := gen_random_uuid();
    test_user UUID := gen_random_uuid();
    leaked_content TEXT;
BEGIN
    -- Agent A a un doc "secret"
    INSERT INTO knowledge_base (agent_id, user_id, title, content, embedding)
    VALUES (test_agent_a, test_user, 'Secret', 'Password: 123456', array_fill(0.5, ARRAY[1536])::vector);
    
    -- Agent B essaye de lire avec la même embedding (similarité parfaite)
    SELECT content INTO leaked_content
    FROM match_documents(
        array_fill(0.5, ARRAY[1536])::vector,
        0.0,
        10,
        test_agent_b  -- Agent B essaye d'accéder
    )
    WHERE content LIKE '%Password%';
    
    ASSERT leaked_content IS NULL, 'Agent B should NOT see Agent A secrets';
    
    -- Nettoyer
    DELETE FROM knowledge_base WHERE agent_id = test_agent_a;
    
    RAISE NOTICE 'Test 2 PASSED: No data leak between agents';
END $$;

-- Test 3 : Performance (Index existe ?)
DO $$
DECLARE
    has_index BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'knowledge_base'
        AND indexdef LIKE '%embedding%'
    ) INTO has_index;
    
    IF NOT has_index THEN
        RAISE WARNING 'No vector index found! Performance will be poor. Create one with:
        CREATE INDEX knowledge_base_embedding_idx ON knowledge_base USING ivfflat (embedding vector_cosine_ops);';
    ELSE
        RAISE NOTICE 'Test 3 PASSED: Vector index exists';
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 4 : Créer un index si pas présent (Optionnel - Performance)
-- ═══════════════════════════════════════════════════════════════

-- Vérifier si l'extension ivfflat est disponible
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Si ivfflat n'est pas disponible, utiliser un index standard
-- CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
-- ON knowledge_base (agent_id, embedding);

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 5 : Permissions
-- ═══════════════════════════════════════════════════════════════

-- Autoriser service_role à exécuter
GRANT EXECUTE ON FUNCTION match_documents(vector, float, int, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION match_documents(vector, float, int, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- ÉTAPE 6 : Documentation
-- ═══════════════════════════════════════════════════════════════

COMMENT ON FUNCTION match_documents IS 
'SECURED vector search for knowledge base. 
Filters results by agent_id to prevent data leaks between agents.
Parameters:
  - query_embedding: Vector embedding of the search query
  - match_threshold: Minimum similarity score (0.0 to 1.0)
  - match_count: Maximum number of results to return
  - p_agent_id: UUID of the agent (SECURITY: filters documents)
Returns: Table of (id, content, similarity) ordered by relevance';

-- ═══════════════════════════════════════════════════════════════
-- NOTES DE DÉPLOIEMENT
-- ═══════════════════════════════════════════════════════════════

-- 1. Exécuter cette migration en STAGING d'abord
-- 2. Vérifier que les 3 tests passent
-- 3. Mettre à jour le code JS (rag.js) pour passer agent_id
-- 4. Tester l'appli complète
-- 5. Déployer en PRODUCTION

-- ROLLBACK (si problème) :
-- DROP FUNCTION match_documents(vector, float, int, uuid);
-- -- Puis recréer l'ancienne version (DANGEREUSE, à éviter)
