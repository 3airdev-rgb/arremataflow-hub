import { usuarios as mockUsers } from "@/lib/mock-data";

export type LocalRole = "Administrador" | "Assessor" | "Investidor";
export type LocalPermission =
  | "Visualizar projetos"
  | "Visualizar painel financeiro"
  | "Adicionar movimentações financeiras"
  | "Enviar documentos"
  | "Editar projetos"
  | "Administrar usuários";

export type LocalAccessUser = {
  id: string;
  nome: string;
  email: string;
  perfil: LocalRole;
  status: "Ativo" | "Convite enviado";
  permissions: LocalPermission[];
  password?: string;
};

export type LocalInvitation = {
  id: string;
  userId: string;
  nome: string;
  email: string;
  perfil: LocalRole;
  projectId?: string;
  projectName?: string;
  projectUrl?: string;
  createdAt: string;
  status: "Enviado" | "Aceito";
};

const USERS_KEY = "arremataflow:access-users";
const INVITES_KEY = "arremataflow:invitations";
const SESSION_KEY = "arremataflow:session-user";

export const memberPermissions: LocalPermission[] = [
  "Visualizar projetos",
  "Visualizar painel financeiro",
  "Adicionar movimentações financeiras",
  "Enviar documentos",
];

export const adminPermissions: LocalPermission[] = [
  ...memberPermissions,
  "Editar projetos",
  "Administrar usuários",
];

const allowedRoles: LocalRole[] = ["Administrador", "Assessor", "Investidor"];

const defaultUsers: LocalAccessUser[] = mockUsers
  .filter((user) => allowedRoles.includes(user.perfil as LocalRole))
  .map((user) => {
  const mapped: LocalAccessUser = {
    ...user,
    perfil: user.perfil as LocalRole,
    status: user.status as LocalAccessUser["status"],
    permissions: user.perfil === "Administrador" ? adminPermissions : memberPermissions,
  };
  return mapped;
  });

function synchronizeRegisteredPeople(users: LocalAccessUser[]) {
  if (typeof window === "undefined") return users;

  let people: Array<{ id?: string; nome?: string; email?: string; tipo?: string; perfil?: string }> = [];
  try {
    people = JSON.parse(localStorage.getItem("arremataflow:people") || "[]");
  } catch {
    return users;
  }

  const synchronized = users.filter((user) => allowedRoles.includes(user.perfil));
  people.forEach((person) => {
    const role = (person.tipo || person.perfil) as LocalRole;
    if ((role !== "Assessor" && role !== "Investidor") || !person.nome) return;

    const email = person.email?.trim() || "";
    const existingIndex = synchronized.findIndex((user) =>
      (email && user.email.toLowerCase() === email.toLowerCase()) || user.nome === person.nome
    );
    const profile: LocalAccessUser = {
      id: person.id || `local-person-user-${role.toLowerCase()}-${person.nome.toLowerCase().replace(/\W+/g, "-")}`,
      nome: person.nome,
      email,
      perfil: role,
      status: "Convite enviado",
      permissions: memberPermissions,
    };

    if (existingIndex < 0) synchronized.push(profile);
    else synchronized[existingIndex] = {
      ...synchronized[existingIndex],
      nome: person.nome,
      email: email || synchronized[existingIndex]!.email,
      perfil: role,
      permissions: memberPermissions,
    };
  });

  return synchronized;
}

export function getLocalAccessUsers(): LocalAccessUser[] {
  if (typeof window === "undefined") return defaultUsers;
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    const initialUsers = synchronizeRegisteredPeople(defaultUsers);
    localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
    return initialUsers;
  }
  try {
    const synchronized = synchronizeRegisteredPeople(JSON.parse(stored) as LocalAccessUser[]);
    localStorage.setItem(USERS_KEY, JSON.stringify(synchronized));
    return synchronized;
  } catch {
    return defaultUsers;
  }
}

export function saveLocalAccessUsers(users: LocalAccessUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getLocalInvitations(): LocalInvitation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(INVITES_KEY) || "[]") as LocalInvitation[];
  } catch {
    return [];
  }
}

function saveInvitations(invitations: LocalInvitation[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(invitations));
}

export function inviteLocalUser(input: Pick<LocalAccessUser, "nome" | "email" | "perfil">, project?: { id: string; name: string }) {
  const users = getLocalAccessUsers();
  let user = users.find((item) => item.email.toLowerCase() === input.email.toLowerCase());
  if (!user) {
    user = {
      id: `local-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: input.nome,
      email: input.email,
      perfil: input.perfil,
      status: "Convite enviado",
      permissions: input.perfil === "Administrador" ? adminPermissions : memberPermissions,
    };
    saveLocalAccessUsers([...users, user]);
  }

  const invitations = getLocalInvitations();
  const duplicate = invitations.some((invite) =>
    invite.userId === user!.id && invite.projectId === project?.id && invite.status === "Enviado"
  );
  if (!duplicate) {
    const invitation: LocalInvitation = {
      id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      createdAt: new Date().toISOString(),
      status: "Enviado",
    };
    if (project) {
      invitation.projectId = project.id;
      invitation.projectName = project.name;
      invitation.projectUrl = `/projetos/${project.id}`;
    }
    saveInvitations([invitation, ...invitations]);
  }
  return user;
}

export function inviteProjectMembers(project: { id: string; name: string }, members: { nome: string; perfil: "Assessor" | "Investidor" }[]) {
  const users = getLocalAccessUsers();
  const people = JSON.parse(localStorage.getItem("arremataflow:people") || "[]") as { nome: string; email?: string }[];
  members.forEach((member) => {
    const known = users.find((user) => user.nome === member.nome) || people.find((person) => person.nome === member.nome);
    if (known?.email) inviteLocalUser({ nome: member.nome, email: known.email, perfil: member.perfil }, project);
  });
}

export function getCurrentLocalUser(): LocalAccessUser {
  const users = getLocalAccessUsers();
  const sessionId = typeof window !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  return users.find((user) => user.id === sessionId) || users.find((user) => user.perfil === "Administrador") || users[0]!;
}

export function localLogin(email: string, password: string) {
  const users = getLocalAccessUsers();
  const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user) return { ok: false, message: "Usuário não encontrado ou ainda não convidado." } as const;
  if (!user.password) return { ok: false, firstAccess: true, message: "Primeiro acesso: crie uma senha." } as const;
  if (user.password !== password) return { ok: false, message: "Senha incorreta." } as const;
  localStorage.setItem(SESSION_KEY, user.id);
  return { ok: true, user } as const;
}

export function createFirstAccessPassword(email: string, password: string) {
  const users = getLocalAccessUsers();
  const index = users.findIndex((item) => item.email.toLowerCase() === email.toLowerCase());
  if (index < 0) return { ok: false, message: "Use o mesmo e-mail que recebeu o convite." } as const;
  const current = users[index]!;
  const updated: LocalAccessUser = { ...current, password, status: "Ativo" };
  const nextUsers = [...users];
  nextUsers[index] = updated;
  saveLocalAccessUsers(nextUsers);
  localStorage.setItem(SESSION_KEY, updated.id);
  saveInvitations(getLocalInvitations().map((invite) => invite.userId === updated.id ? { ...invite, status: "Aceito" } : invite));
  return { ok: true, user: updated } as const;
}

export function canAccessProject(project: { id: string; assessores?: string[]; investidores?: string[] }, user = getCurrentLocalUser()) {
  if (user.perfil === "Administrador") return true;
  return getLocalInvitations().some((invite) => invite.userId === user.id && invite.projectId === project.id)
    || project.assessores?.includes(user.nome)
    || project.investidores?.includes(user.nome)
    || false;
}
