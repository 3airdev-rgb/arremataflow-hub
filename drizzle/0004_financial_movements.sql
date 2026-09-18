CREATE TABLE "financial_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "category" text NOT NULL,
  "amount" numeric(18,2) NOT NULL,
  "movement_date" timestamp with time zone DEFAULT now() NOT NULL,
  "status" text DEFAULT 'pendente' NOT NULL,
  "holder_name" text,
  "holder_document" text,
  "holder_type" text,
  "document_type" text,
  "receipt_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_movements_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "financial_movements_type_check" CHECK ("type" IN ('receita', 'despesa'))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid,
  "actor_id" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "financial_movements" ADD CONSTRAINT "financial_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE INDEX "financial_movements_project_date_idx" ON "financial_movements" USING btree ("project_id", "movement_date");
--> statement-breakpoint
CREATE INDEX "financial_movements_org_idx" ON "financial_movements" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_project_date_idx" ON "audit_logs" USING btree ("project_id", "created_at");
