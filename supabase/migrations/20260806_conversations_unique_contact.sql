-- Empeche la creation de conversations en doublon pour un meme (agent, contact)
-- Contexte : race condition observee sur l'agent "longrich" (2 messages quasi
-- simultanes d'un meme client -> 2 lookups paralleles ne voyant aucune ligne
-- existante -> 2 INSERT -> conversation dupliquee -> PGRST116 "multiple rows"
-- sur tous les lookups suivants pour ce contact).

CREATE UNIQUE INDEX IF NOT EXISTS conversations_agent_contact_jid_unique
  ON public.conversations (agent_id, contact_jid)
  WHERE contact_jid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_agent_contact_phone_unique
  ON public.conversations (agent_id, contact_phone);
