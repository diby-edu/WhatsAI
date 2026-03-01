-- Fix: allow agent deletion even when outbound_messages rows exist
-- Root cause: FK was created without ON DELETE action in production schema.

DO $$
DECLARE
    fk RECORD;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'outbound_messages'
          AND column_name = 'agent_id'
    ) THEN
        -- Drop the canonical constraint name if it already exists
        ALTER TABLE public.outbound_messages
            DROP CONSTRAINT IF EXISTS outbound_messages_agent_id_fkey;

        -- Drop every FK from outbound_messages(agent_id) -> agents(id), regardless of naming/format
        FOR fk IN
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'outbound_messages'
              AND c.contype = 'f'
              AND (
                  pg_get_constraintdef(c.oid) ILIKE '%(agent_id)%REFERENCES public.agents(id)%'
                  OR pg_get_constraintdef(c.oid) ILIKE '%(agent_id)%REFERENCES agents(id)%'
              )
        LOOP
            EXECUTE format('ALTER TABLE public.outbound_messages DROP CONSTRAINT IF EXISTS %I', fk.conname);
        END LOOP;

        ALTER TABLE public.outbound_messages
            ADD CONSTRAINT outbound_messages_agent_id_fkey
            FOREIGN KEY (agent_id)
            REFERENCES public.agents(id)
            ON DELETE CASCADE;
    END IF;
END $$;
