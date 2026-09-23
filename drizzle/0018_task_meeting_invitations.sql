CREATE TABLE IF NOT EXISTS "task_meeting_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "recipient_name" text NOT NULL,
  "recipient_email" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "response" text,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "task_meeting_invitations_task_idx" ON "task_meeting_invitations" ("task_id");
