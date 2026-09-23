ALTER TABLE "users" ADD COLUMN "system_role" text;
CREATE TABLE "plans" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "monthly_price" numeric(12,2),
  "max_active_projects" integer,
  "max_investors" integer,
  "max_advisors" integer,
  "max_project_managers" integer,
  "first_response_hours" integer NOT NULL DEFAULT 24,
  "resolution_hours" integer NOT NULL DEFAULT 72,
  "menu_items" jsonb NOT NULL DEFAULT '[]',
  "advisory_modalities" jsonb NOT NULL DEFAULT '[]',
  "project_tabs" jsonb NOT NULL DEFAULT '[]',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "organization_plans" (
  "organization_id" uuid PRIMARY KEY REFERENCES "organizations"("id") ON DELETE CASCADE,
  "plan_id" text NOT NULL REFERENCES "plans"("id"),
  "status" text NOT NULL DEFAULT 'active',
  "assigned_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "developer_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" text NOT NULL REFERENCES "users"("id"),
  "action" text NOT NULL,
  "target_id" text NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "control_number" text NOT NULL UNIQUE,
  "opened_by" text NOT NULL REFERENCES "users"("id"),
  "subject" text NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "priority" text NOT NULL DEFAULT 'normal',
  "status" text NOT NULL DEFAULT 'open',
  "assigned_to" text REFERENCES "users"("id"),
  "first_response_due_at" timestamptz NOT NULL,
  "resolution_due_at" timestamptz NOT NULL,
  "first_responded_at" timestamptz,
  "resolved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "support_tickets_org_idx" ON "support_tickets"("organization_id");
CREATE TABLE "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id"),
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO "plans" ("id", "name", "menu_items", "advisory_modalities", "project_tabs") VALUES
  ('starter', 'Starter', '["Dashboard","Projetos","Investidores","Assessores","Relatórios","Notificações","Configurações","Suporte"]', '["completa","parcial","juridica","operacional","consultiva","nenhuma"]', '["Visão Geral","Regularização","Posse","Financeiro","Documentos","Tarefas","Obra","Venda","Resultado","Contratos","Distribuição de Resultados","Histórico"]'),
  ('professional', 'Profissional', '["Dashboard","Projetos","Investidores","Assessores","Relatórios","Notificações","Configurações","Suporte"]', '["completa","parcial","juridica","operacional","consultiva","nenhuma"]', '["Visão Geral","Regularização","Posse","Financeiro","Documentos","Tarefas","Obra","Venda","Resultado","Contratos","Distribuição de Resultados","Histórico"]'),
  ('custom', 'Personalizado', '["Dashboard","Projetos","Investidores","Assessores","Relatórios","Notificações","Configurações","Suporte"]', '["completa","parcial","juridica","operacional","consultiva","nenhuma"]', '["Visão Geral","Regularização","Posse","Financeiro","Documentos","Tarefas","Obra","Venda","Resultado","Contratos","Distribuição de Resultados","Histórico"]');
INSERT INTO "organization_plans" ("organization_id", "plan_id")
  SELECT "id", 'custom' FROM "organizations" ON CONFLICT DO NOTHING;
