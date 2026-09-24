import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/index.server";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth.server";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});

export const signupCallbackPath = "/cadastro/empresa";

const accepted = () =>
  Response.json({
    ok: true,
    message: "Se o e-mail puder ser cadastrado, enviamos o link de confirmação.",
  });

/**
 * Cadastro público de quem vai contratar o sistema. O cadastro por convite continua separado;
 * a resposta é a mesma para e-mail novo ou já existente para não revelar quem tem conta.
 */
export async function registerAccount(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return new Response("Origem inválida.", { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return new Response("Formato de requisição inválido.", { status: 415 });
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { ok: false, message: "Revise o nome, o e-mail e a senha (mínimo de 12 caracteres)." },
      { status: 400 },
    );
  const { name, email, password } = parsed.data;

  const [existing] = await db
    .select({ id: schema.users.id, emailVerified: schema.users.emailVerified })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`)
    .limit(1);

  if (existing) {
    if (!existing.emailVerified)
      await auth.api
        .sendVerificationEmail({ body: { email, callbackURL: signupCallbackPath } })
        .catch(() => undefined);
    return accepted();
  }

  const context = await auth.$context;
  const passwordHash = await context.password.hash(password);
  const userId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values({ id: userId, name, email, emailVerified: false });
    await tx.insert(schema.accounts).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  });
  try {
    await auth.api.sendVerificationEmail({ body: { email, callbackURL: signupCallbackPath } });
  } catch (error) {
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    console.error("Falha ao enviar a confirmação de e-mail.", error);
    return Response.json(
      { ok: false, message: "Não foi possível enviar o e-mail de confirmação agora." },
      { status: 503 },
    );
  }
  return accepted();
}
