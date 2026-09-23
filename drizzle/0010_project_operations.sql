CREATE TABLE "project_operational_data" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "regularization" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "possession" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "project_operational_data_project_uidx" ON "project_operational_data" ("project_id");
CREATE INDEX "project_operational_data_org_idx" ON "project_operational_data" ("organization_id");

CREATE TABLE "judicial_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "scope" text NOT NULL,
  "action_type" text NOT NULL,
  "process_number" text DEFAULT '' NOT NULL,
  "court" text DEFAULT '' NOT NULL,
  "last_movement_date" date,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "judicial_actions_scope_check" CHECK ("scope" IN ('regularization', 'possession'))
);
CREATE INDEX "judicial_actions_project_scope_idx" ON "judicial_actions" ("project_id", "scope");
CREATE INDEX "judicial_actions_org_idx" ON "judicial_actions" ("organization_id");
