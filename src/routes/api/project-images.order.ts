import { createFileRoute } from "@tanstack/react-router";
import { orderProjectImages } from "@/lib/project-images.server";
export const Route = createFileRoute("/api/project-images/order")({
  server: { handlers: { POST: ({ request }) => orderProjectImages(request) } },
});
