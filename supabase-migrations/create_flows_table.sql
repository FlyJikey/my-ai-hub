-- Migration: Create flows table for AI Flow Editor
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS flows (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name        text NOT NULL DEFAULT 'Новый поток',
    nodes       jsonb NOT NULL DEFAULT '[]'::jsonb,
    edges       jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for faster ordering
CREATE INDEX IF NOT EXISTS flows_updated_at_idx ON flows (updated_at DESC);

-- Optional: enable Row Level Security (comment out if not needed)
-- ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all" ON flows FOR ALL USING (true);
