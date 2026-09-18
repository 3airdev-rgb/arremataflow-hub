CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "financial_movement_id" uuid,
  "display_name" text NOT NULL,
  "original_name" text NOT NULL,
  "category" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "storage_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" text NOT NULL,
  "uploaded_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "documents_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
  CONSTRAINT "documents_version_check" CHECK ("version" > 0),
  CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_financial_movement_id_financial_movements_id_fk" FOREIGN KEY ("financial_movement_id") REFERENCES "public"."financial_movements"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "documents_project_category_idx" ON "documents" USING btree ("project_id", "category");
--> statement-breakpoint
CREATE INDEX "documents_financial_movement_idx" ON "documents" USING btree ("financial_movement_id");
