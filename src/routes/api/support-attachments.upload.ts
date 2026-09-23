import { createFileRoute } from "@tanstack/react-router";
import { uploadSupportAttachment } from "@/lib/support-attachments.server";
export const Route = createFileRoute("/api/support-attachments/upload")({
  server: { handlers: { POST: ({ request }) => uploadSupportAttachment(request) } },
});
