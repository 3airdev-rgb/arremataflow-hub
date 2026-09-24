ALTER TABLE "plans" ADD COLUMN "kind" text DEFAULT 'standard' NOT NULL;
ALTER TABLE "plans" ADD COLUMN "description" text;
ALTER TABLE "plans" ADD COLUMN "owner_organization_id" uuid;
ALTER TABLE "plans" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
ALTER TABLE "plans" ADD COLUMN "stripe_monthly_price_id" text;
ALTER TABLE "plans" ADD COLUMN "stripe_annual_price_id" text;
ALTER TABLE "plans" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "plans" ADD CONSTRAINT "plans_kind_check" CHECK ("kind" IN ('standard', 'custom'));
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_organization_id_organizations_id_fk" FOREIGN KEY ("owner_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null;

ALTER TABLE "organization_plans" ADD COLUMN "stripe_customer_id" text;
ALTER TABLE "organization_plans" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "organization_plans" ADD COLUMN "trial_ends_at" timestamp with time zone;
ALTER TABLE "organization_plans" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;
ALTER TABLE "organization_plans" ADD COLUMN "status_updated_at" timestamp with time zone DEFAULT now() NOT NULL;
CREATE UNIQUE INDEX "organization_plans_stripe_subscription_uidx" ON "organization_plans" USING btree ("stripe_subscription_id") WHERE "stripe_subscription_id" IS NOT NULL;
CREATE INDEX "organization_plans_stripe_customer_idx" ON "organization_plans" USING btree ("stripe_customer_id");

CREATE TABLE "billing_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "plan_id" text,
  "amount" numeric(12, 2) NOT NULL,
  "currency" text DEFAULT 'brl' NOT NULL,
  "status" text NOT NULL,
  "method" text,
  "source" text DEFAULT 'manual' NOT NULL,
  "description" text,
  "stripe_invoice_id" text,
  "stripe_payment_intent_id" text,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "billing_payments_status_check" CHECK ("status" IN ('paid', 'pending', 'failed', 'refunded')),
  CONSTRAINT "billing_payments_source_check" CHECK ("source" IN ('stripe', 'manual'))
);
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null;
CREATE UNIQUE INDEX "billing_payments_stripe_invoice_uidx" ON "billing_payments" USING btree ("stripe_invoice_id") WHERE "stripe_invoice_id" IS NOT NULL;
CREATE INDEX "billing_payments_org_idx" ON "billing_payments" USING btree ("organization_id", "created_at");
CREATE INDEX "billing_payments_paid_at_idx" ON "billing_payments" USING btree ("paid_at");

CREATE TABLE "stripe_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "payload" jsonb NOT NULL
);
