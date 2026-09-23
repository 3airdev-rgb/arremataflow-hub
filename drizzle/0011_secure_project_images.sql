CREATE TABLE "project_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL UNIQUE,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" text NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_main" boolean DEFAULT false NOT NULL,
  "uploaded_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_images_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880),
  CONSTRAINT "project_images_mime_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
CREATE INDEX "project_images_project_order_idx" ON "project_images" ("project_id", "display_order");
CREATE INDEX "project_images_org_idx" ON "project_images" ("organization_id");
CREATE UNIQUE INDEX "project_images_one_main_uidx" ON "project_images" ("project_id") WHERE "is_main" = true;
