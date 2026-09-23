DROP INDEX IF EXISTS "contacts_org_document_uidx";
CREATE UNIQUE INDEX "contacts_org_document_type_uidx"
  ON "contacts" USING btree ("organization_id", "document", "type");
