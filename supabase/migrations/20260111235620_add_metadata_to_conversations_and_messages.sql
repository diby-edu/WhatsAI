ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Also verify if messages table has proper metadata structure if needed
-- (messages table already has it based on usage, but ensuring won't hurt)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
