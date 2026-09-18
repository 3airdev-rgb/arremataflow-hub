import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
type RateEntry = { count: number; resetAt: number };
const globalSecurity = globalThis as typeof globalThis & { arremataflowRateLimits?: Map<string, RateEntry> };
const rateLimits = globalSecurity.arremataflowRateLimits ?? new Map<string, RateEntry>();
globalSecurity.arremataflowRateLimits = rateLimits;

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function authRateLimit(request: Request) {
  if (request.method !== "POST") return null;
  const path = new URL(request.url).pathname;
  const policy = path.includes("/api/auth/sign-in") ? { max: 10, window: 15 * 60_000 }
    : path.includes("/api/auth/forget-password") ? { max: 5, window: 60 * 60_000 }
      : path.includes("/api/auth/reset-password") ? { max: 10, window: 60 * 60_000 } : null;
  if (!policy) return null;
  if (Number(request.headers.get("content-length") || 0) > 64 * 1024) return new Response("Requisição muito grande.", { status: 413 });
  const now = Date.now(), key = `${clientAddress(request)}:${path}`;
  const current = rateLimits.get(key);
  const entry = !current || current.resetAt <= now ? { count: 1, resetAt: now + policy.window } : { ...current, count: current.count + 1 };
  rateLimits.set(key, entry);
  if (rateLimits.size > 10_000) for (const [storedKey, value] of rateLimits) if (value.resetAt <= now) rateLimits.delete(storedKey);
  if (entry.count <= policy.max) return null;
  return new Response("Muitas tentativas. Aguarde antes de tentar novamente.", { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } });
}

function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  const development = process.env["NODE_ENV"] !== "production";
  headers.set("Content-Security-Policy", `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'${development ? " ws: http: https:" : ""}${development ? "" : "; upgrade-insecure-requests"}`);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (!development) headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const limited = authRateLimit(request);
      if (limited) return withSecurityHeaders(limited);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
