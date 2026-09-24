ALTER TABLE "tasks" ADD COLUMN "transcript_document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL;
