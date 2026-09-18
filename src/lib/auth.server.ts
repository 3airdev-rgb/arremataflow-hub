import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.server";
import * as authSchema from "@/db/schema";
import { organizationMembers, users } from "@/db/schema";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email.server";

const secret = process.env["BETTER_AUTH_SECRET"];

if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
}

export const auth = betterAuth({
  appName: "ArremataFlow",
  baseURL: process.env["BETTER_AUTH_URL"],
  secret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    usePlural: true,
  }),
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
  trustedOrigins: process.env["BETTER_AUTH_URL"] ? [process.env["BETTER_AUTH_URL"]] : [],
  plugins: [tanstackStartCookies()],
});
