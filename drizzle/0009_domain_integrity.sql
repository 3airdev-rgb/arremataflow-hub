ALTER TABLE "projects" ADD CONSTRAINT "projects_status_check" CHECK ("status" IN ('atrasado','pendente','aguardando','andamento','nao_iniciado','concluido')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "project_participants" ADD CONSTRAINT "project_participants_percentage_check" CHECK ("percentage" IS NULL OR ("percentage" ~ '^\d{1,3}([.,]\d{1,4})?$' AND replace("percentage", ',', '.')::numeric BETWEEN 0 AND 100)) NOT VALID;
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_role_check" CHECK ("role" IN ('owner','admin','advisor','investor')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_status_check" CHECK ("status" IN ('invited','active','disabled')) NOT VALID;
