ALTER TABLE "judicial_actions" ADD COLUMN IF NOT EXISTS "movements" jsonb DEFAULT '[]'::jsonb NOT NULL;
