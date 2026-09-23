import { createFileRoute } from "@tanstack/react-router";
import { uploadProjectImage } from "@/lib/project-images.server";
export const Route = createFileRoute("/api/project-images/upload")({ server: { handlers: { POST: ({ request }) => uploadProjectImage(request) } } });
