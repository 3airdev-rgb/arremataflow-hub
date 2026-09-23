import { createFileRoute } from "@tanstack/react-router";
import { downloadSupportAttachment } from "@/lib/support-attachments.server";
export const Route = createFileRoute("/api/support-attachments/$id")({
  server: {
    handlers: { GET: ({ request, params }) => downloadSupportAttachment(request, params.id) },
  },
});
