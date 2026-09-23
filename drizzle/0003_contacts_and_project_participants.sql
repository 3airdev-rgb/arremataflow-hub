CREATE TABLE "contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "document" text NOT NULL,
  "email" text NOT NULL,
  "phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "role" text NOT NULL,
  "percentage" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_org_document_uidx" ON "contacts" USING btree ("organization_id","document");
--> statement-breakpoint
CREATE INDEX "contacts_org_type_idx" ON "contacts" USING btree ("organization_id","type");
--> statement-breakpoint
CREATE UNIQUE INDEX "project_participants_project_contact_role_uidx" ON "project_participants" USING btree ("project_id","contact_id","role");
--> statement-breakpoint
CREATE INDEX "project_participants_contact_idx" ON "project_participants" USING btree ("contact_id");
