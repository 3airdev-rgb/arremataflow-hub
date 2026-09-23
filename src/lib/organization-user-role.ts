export type OperationalRole = "project_manager" | "advisor" | "investor";

const priority: Record<string, number> = {
  owner: 4,
  admin: 4,
  project_manager: 3,
  advisor: 2,
  investor: 1,
};

export function resolveInvitedMembership(
  existing: { role: string; status: string } | undefined,
  requestedRole: OperationalRole,
  fromProject: boolean,
  newAccount: boolean,
) {
  // Papéis vindos de vínculos são calculados por projeto; o perfil da empresa é a base.
  const baseRole = fromProject && requestedRole === "project_manager" ? "investor" : requestedRole;
  const role =
    existing && (fromProject || (priority[existing.role] ?? 0) > (priority[baseRole] ?? 0))
      ? existing.role
      : baseRole;
  return { role, status: newAccount ? "invited" : "active", invitationNeeded: newAccount } as const;
}
