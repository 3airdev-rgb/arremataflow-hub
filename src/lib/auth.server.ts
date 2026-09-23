import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as authSchema from "@/db/schema";
import { organizationMembers, users } from "@/db/schema";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email.server";

if (typeof drizzleAdapter !== "function") {
  throw new Error("AUTH_BOOTSTRAP_ERROR: drizzleAdapter is unavailable in the production bundle.");
}

if (typeof betterAuth !== "function") {
  throw new Error("AUTH_BOOTSTRAP_ERROR: betterAuth is unavailable in the production bundle.");
}


const secret = process.env["BETTER_AUTH_SECRET"];

if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
}

let databaseAdapter: ReturnType<typeof drizzleAdapter>;
try {
  databaseAdapter = drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    usePlural: true,
  });
} catch (cause) {
  throw new Error("AUTH_BOOTSTRAP_ERROR: failed to initialize the Drizzle adapter.", { cause });
}

const authOptions = {
  appName: "ArremataFlow",
  baseURL: process.env["BETTER_AUTH_URL"],
  secret,
  database: databaseAdapter,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Redefinição de senha — ArremataFlow",
        html: `<p>Olá, ${escapeHtml(user.name)}.</p><p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos.</p><p><a href="${escapeHtml(url)}">Criar nova senha</a></p><p>Se você não solicitou esta alteração, ignore esta mensagem.</p>`,
      });
    },
    onPasswordReset: async ({ user }) => {
      await db.transaction(async (transaction) => {
        await transaction
          .update(users)
          .set({ emailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, user.id));
        await transaction
          .update(organizationMembers)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(organizationMembers.userId, user.id));
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  advanced: {
    useSecureCookies: process.env["NODE_ENV"] === "production",
  },
  trustedOrigins: [...new Set([
    process.env["BETTER_AUTH_URL"],
    process.env["APP_PUBLIC_URL"],
    ...(process.env["AUTH_TRUSTED_ORIGINS"] || "").split(","),
  ].map((origin) => origin?.trim()).filter((origin): origin is string => Boolean(origin)))],
} satisfies BetterAuthOptions;

export const auth = (() => {
  try {
    return betterAuth(authOptions);
  } catch (cause) {
    throw new Error("AUTH_BOOTSTRAP_ERROR: failed to initialize Better Auth.", { cause });
  }
})();
