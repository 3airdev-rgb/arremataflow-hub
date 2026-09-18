ALTER TABLE "users" ADD COLUMN "active_organization_id" uuid;
UPDATE "users" u
SET "active_organization_id" = (
  SELECT om."organization_id" FROM "organization_members" om
  WHERE om."user_id" = u."id" AND om."status" = 'active'
  ORDER BY om."created_at" ASC LIMIT 1
);
ALTER TABLE "users" ADD CONSTRAINT "users_active_organization_id_organizations_id_fk"
  FOREIGN KEY ("active_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
