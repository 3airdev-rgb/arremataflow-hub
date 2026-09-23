import { createFileRoute } from "@tanstack/react-router";
import { deleteProjectImage, readProjectImage } from "@/lib/project-images.server";
export const Route = createFileRoute("/api/project-images/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => readProjectImage(request, params.id),
      DELETE: ({ request, params }) => deleteProjectImage(request, params.id),
    },
  },
});
