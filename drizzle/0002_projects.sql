CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "address" text NOT NULL,
  "city" text DEFAULT '' NOT NULL,
  "stage" text DEFAULT 'Aquisição' NOT NULL,
  "status" text DEFAULT 'nao_iniciado' NOT NULL,
  "responsible" text DEFAULT 'Não atribuído' NOT NULL,
  "main_image" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_code_uidx" ON "projects" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE INDEX "projects_org_updated_idx" ON "projects" USING btree ("organization_id","updated_at");
