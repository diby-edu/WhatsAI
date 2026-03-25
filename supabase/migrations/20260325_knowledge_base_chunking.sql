-- Migration : source_id + chunk_index pour le chunking KB
-- Phase 3.1 du plan d'implémentation

-- Ajouter les colonnes de chunking
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;

-- Backfill : les documents existants (sans source_id) deviennent leur propre source
UPDATE knowledge_base SET source_id = id WHERE source_id IS NULL;

-- Index pour les requêtes par source
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source_id ON knowledge_base(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_agent_chunk ON knowledge_base(agent_id, chunk_index);
