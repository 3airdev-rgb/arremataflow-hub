ALTER TABLE "support_tickets" ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;
ALTER TABLE "organization_plans" ADD COLUMN "billing_cycle" text;
ALTER TABLE "organization_plans" ADD COLUMN "subscription_amount" numeric(12,2);
CREATE TABLE "support_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "actor_id" text NOT NULL REFERENCES "users"("id"),
  "from_status" text,
  "to_status" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "support_status_history_ticket_idx" ON "support_status_history"("ticket_id", "created_at");
INSERT INTO "support_status_history" ("ticket_id", "actor_id", "from_status", "to_status", "created_at")
SELECT "id", "opened_by", NULL, 'open', "created_at" FROM "support_tickets";
CREATE TABLE "support_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "support_messages"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL UNIQUE,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "uploaded_by" text NOT NULL REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "support_attachments_ticket_idx" ON "support_attachments"("ticket_id");
