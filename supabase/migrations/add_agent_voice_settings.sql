-- Add voice settings to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS enable_voice_responses BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'alloy'; -- alloy, echo, fable, onyx, nova, shimmer
