import { createFileRoute } from "@tanstack/react-router";
import { downloadDocument } from "@/lib/documents.server";

export const Route = createFileRoute("/api/documents/$id")({
  server: { handlers: { GET: ({ request, params }) => downloadDocument(request, params.id) } },
});
