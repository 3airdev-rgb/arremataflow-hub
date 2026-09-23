import { createFileRoute } from "@tanstack/react-router";
import { uploadDocument } from "@/lib/documents.server";

export const Route = createFileRoute("/api/documents/upload")({
  server: { handlers: { POST: ({ request }) => uploadDocument(request) } },
});
