import { and, eq, sql } from "drizzle-orm";

type Database = (typeof import("@/db/index.server"))["db"];
type Schema = typeof import("@/db/schema");

export type ProjectRole = "owner" | "admin" | "project_manager" | "advisor" | "investor";

const rank: Record<ProjectRole, number> = {
  owner: 4,
  admin: 4,
  project_manager: 3,
  advisor: 2,
  investor: 1,
};

export function highestProjectRole(roles: ProjectRole[]): ProjectRole | null {
  return roles.reduce<ProjectRole | null>(
    (best, role) => (!best || rank[role] > rank[best] ? role : best),
    null,
  );
}

export async function getProjectRole(
  db: Database,
  schema: Schema,
  membership: { organizationId: string; role: string },
  email: string,
  projectId: string,
): Promise<ProjectRole | null> {
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.organizationId, membership.organizationId),
      ),
    )
    .limit(1);
  if (!project) return null;
  if (membership.role === "owner" || membership.role === "admin") return membership.role;
  const rows: Array<{ role: string }> = await db
    .select({ role: schema.projectParticipants.role })
    .from(schema.projectParticipants)
    .innerJoin(schema.contacts, eq(schema.contacts.id, schema.projectParticipants.contactId))
    .where(
      and(
        eq(schema.projectParticipants.projectId, projectId),
        eq(schema.contacts.organizationId, membership.organizationId),
        eq(schema.contacts.status, "active"),
        sql`lower(${schema.contacts.email}) = lower(${email})`,
      ),
    );
  const roles = rows
    .map(({ role }) => (role === "responsible" ? "project_manager" : role))
    .filter(
      (role): role is ProjectRole =>
        role === "project_manager" || role === "advisor" || role === "investor",
    );
  return highestProjectRole(roles);
}

export async function requireProjectRole(
  db: Database,
  schema: Schema,
  membership: { organizationId: string; role: string },
  email: string,
  projectId: string,
  minimum: "investor" | "advisor" | "project_manager" = "investor",
) {
  const role = await getProjectRole(db, schema, membership, email, projectId);
  if (!role || rank[role] < rank[minimum]) throw new Error("Sem permissão para este projeto.");
  return role;
}
