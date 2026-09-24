import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => (await import("@/lib/signup.server")).registerAccount(request),
    },
  },
});
