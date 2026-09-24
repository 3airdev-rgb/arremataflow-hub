import { joinProfileLabels } from "./contact-profile.ts";

export type ParticipantLink = { contactId: string; role: string };

const notifiableRoles = ["responsible", "advisor", "investor"] as const;
export type NotifiableRole = (typeof notifiableRoles)[number];
export type AddedParticipant = { contactId: string; roles: NotifiableRole[] };

const roleToContactType: Record<NotifiableRole, string> = {
  responsible: "Responsável",
  advisor: "Assessor",
  investor: "Investidor",
};

const isNotifiableRole = (role: string): role is NotifiableRole =>
  (notifiableRoles as readonly string[]).includes(role);

export function newlyAddedParticipants(
  previous: ParticipantLink[],
  next: ParticipantLink[],
): AddedParticipant[] {
  const existing = new Set(previous.map((link) => `${link.contactId}:${link.role}`));
  const added = new Map<string, Set<NotifiableRole>>();
  for (const link of next) {
    if (!isNotifiableRole(link.role) || existing.has(`${link.contactId}:${link.role}`)) continue;
    const roles = added.get(link.contactId) ?? new Set<NotifiableRole>();
    roles.add(link.role);
    added.set(link.contactId, roles);
  }
  return [...added].map(([contactId, roles]) => ({
    contactId,
    roles: notifiableRoles.filter((role) => roles.has(role)),
  }));
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!,
  );

export function buildProjectAssignmentEmail(input: {
  recipientName: string;
  projectCode: string;
  projectName: string;
  roles: NotifiableRole[];
  projectUrl: string;
}) {
  const roleLabel = joinProfileLabels(input.roles.map((role) => roleToContactType[role]));
  return {
    subject: `Você foi adicionado ao projeto ${input.projectCode}`,
    html:
      `<p>Olá, ${escapeHtml(input.recipientName)}.</p>` +
      `<p>Você foi adicionado ao projeto <strong>${escapeHtml(input.projectCode)} - ${escapeHtml(input.projectName)}</strong> como <strong>${escapeHtml(roleLabel)}</strong>.</p>` +
      `<p><a href="${escapeHtml(input.projectUrl)}">Acessar o projeto</a></p>`,
  };
}
