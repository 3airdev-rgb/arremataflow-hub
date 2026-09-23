ALTER TABLE "organizations" ADD COLUMN "task_deadline_emails" boolean DEFAULT true NOT NULL;
ALTER TABLE "organizations" ADD COLUMN "weekly_investor_reports" boolean DEFAULT true NOT NULL;

CREATE TABLE "scheduled_email_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "recipient_email" text NOT NULL,
  "status" text DEFAULT 'processing' NOT NULL,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "scheduled_email_deliveries_dedupe_uidx" ON "scheduled_email_deliveries" USING btree ("dedupe_key");
CREATE INDEX "scheduled_email_deliveries_org_kind_idx" ON "scheduled_email_deliveries" USING btree ("organization_id", "kind");
