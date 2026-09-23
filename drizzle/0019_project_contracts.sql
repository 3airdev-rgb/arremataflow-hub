CREATE TABLE IF NOT EXISTS "project_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "template_version" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "project_contracts_project_idx" ON "project_contracts" ("project_id", "updated_at");
CREATE INDEX IF NOT EXISTS "project_contracts_org_idx" ON "project_contracts" ("organization_id");
