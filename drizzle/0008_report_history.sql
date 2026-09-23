CREATE TABLE "report_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "generated_by" text NOT NULL,
  "report_key" text NOT NULL,
  "format" text NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "row_count" integer DEFAULT 0 NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_format_check" CHECK ("format" IN ('view','pdf','csv'));
--> statement-breakpoint
CREATE INDEX "report_runs_org_date_idx" ON "report_runs" USING btree ("organization_id", "generated_at");
