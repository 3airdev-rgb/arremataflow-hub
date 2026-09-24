export const isAdminRole = (role: string) => role === "owner" || role === "admin";

export function homePathForRole(role: string) {
  if (isAdminRole(role)) return "/dashboard" as const;
  if (role === "investor") return "/investidor" as const;
  if (role === "advisor") return "/assessores" as const;
  return "/projetos" as const;
}
