ALTER TABLE "task_meeting_participants" ADD COLUMN "provider_id" uuid REFERENCES "service_providers"("id") ON DELETE CASCADE;
ALTER TABLE "task_meeting_participants" ADD COLUMN "portfolio_id" uuid REFERENCES "sales_portfolio"("id") ON DELETE CASCADE;
