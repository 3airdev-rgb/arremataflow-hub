CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL, "title" text NOT NULL, "description" text DEFAULT '' NOT NULL,
  "category" text NOT NULL, "due_date" date, "status" text DEFAULT 'nao_iniciado' NOT NULL,
  "is_online_meeting" boolean DEFAULT false NOT NULL, "meeting_url" text, "meeting_time" text,
  "created_by" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tasks_status_check" CHECK ("status" IN ('nao_iniciado','andamento','aguardando','pendente','concluido')),
  CONSTRAINT "tasks_meeting_check" CHECK (NOT "is_online_meeting" OR ("meeting_url" IS NOT NULL AND "meeting_time" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "task_assignees" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "task_id" uuid NOT NULL, "contact_id" uuid, "user_id" text, CONSTRAINT "task_assignees_one_target" CHECK (("contact_id" IS NULL) <> ("user_id" IS NULL)));
--> statement-breakpoint
CREATE TABLE "task_meeting_participants" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "task_id" uuid NOT NULL, "contact_id" uuid, "user_id" text, CONSTRAINT "task_participants_one_target" CHECK (("contact_id" IS NULL) <> ("user_id" IS NULL)));
--> statement-breakpoint
CREATE TABLE "notifications" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "organization_id" uuid NOT NULL, "project_id" uuid, "recipient_user_id" text NOT NULL, "type" text NOT NULL, "title" text NOT NULL, "message" text NOT NULL, "link" text, "read_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
ALTER TABLE "tasks" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade; ALTER TABLE "tasks" ADD FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade; ALTER TABLE "tasks" ADD FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "task_assignees" ADD FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade; ALTER TABLE "task_assignees" ADD FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade; ALTER TABLE "task_assignees" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "task_meeting_participants" ADD FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade; ALTER TABLE "task_meeting_participants" ADD FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE cascade; ALTER TABLE "task_meeting_participants" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "notifications" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade; ALTER TABLE "notifications" ADD FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade; ALTER TABLE "notifications" ADD FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "tasks_project_due_idx" ON "tasks" ("project_id", "due_date"); CREATE INDEX "task_assignees_task_idx" ON "task_assignees" ("task_id"); CREATE INDEX "task_meeting_participants_task_idx" ON "task_meeting_participants" ("task_id"); CREATE INDEX "notifications_recipient_read_idx" ON "notifications" ("recipient_user_id", "read_at", "created_at");
