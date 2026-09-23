CREATE TABLE IF NOT EXISTS "property_inspections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "inspector_name" text NOT NULL,
  "inspector_email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "form_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sent_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "property_inspections_project_idx" ON "property_inspections" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "property_inspections_org_idx" ON "property_inspections" ("organization_id");
