import { and, asc, eq } from "drizzle-orm";
import type { DbExecutor, Schema } from "@/db/types";

export async function resolveActiveMembership(db: DbExecutor, schema: Schema, userId: string) {
  const [user] = await db
    .select({ activeOrganizationId: schema.users.activeOrganizationId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (user?.activeOrganizationId) {
    const [selected] = await db
      .select({
        organizationId: schema.organizationMembers.organizationId,
        role: schema.organizationMembers.role,
      })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.userId, userId),
          eq(schema.organizationMembers.organizationId, user.activeOrganizationId),
          eq(schema.organizationMembers.status, "active"),
        ),
      )
      .limit(1);
    if (selected) return selected;
  }

  const [fallback] = await db
    .select({
      organizationId: schema.organizationMembers.organizationId,
      role: schema.organizationMembers.role,
    })
    .from(schema.organizationMembers)
    .where(
      and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.status, "active"),
      ),
    )
    .orderBy(asc(schema.organizationMembers.createdAt))
    .limit(1);
  if (fallback)
    await db
      .update(schema.users)
      .set({ activeOrganizationId: fallback.organizationId, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  return fallback;
}
