import { createServerFn } from "@tanstack/react-start";

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const enforceAuthentication = process.env["AUTH_ENFORCEMENT_ENABLED"] !== "false";

  if (!enforceAuthentication) return { enforceAuthentication, session: null };

  const [{ getRequestHeaders }, { auth }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/lib/auth.server"),
  ]);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return { enforceAuthentication, session };
});
