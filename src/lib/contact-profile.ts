export type PersonProfile = {
  nome: string;
  documento: string;
  dataNascimento?: string | undefined;
  estadoCivil?: string | undefined;
  celulares: string[];
  endereco?: string | undefined;
  numero?: string | undefined;
  complemento?: string | undefined;
  bairro?: string | undefined;
  cep?: string | undefined;
  email: string;
  banco?: string | undefined;
  agencia?: string | undefined;
  conta?: string | undefined;
  website?: string | undefined;
  cidade?: string | undefined;
  estado?: string | undefined;
};

const detailKeys = [
  "dataNascimento",
  "estadoCivil",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "banco",
  "agencia",
  "conta",
  "website",
  "cidade",
  "estado",
] as const;

type ContactRow = {
  name: string;
  document: string;
  email: string;
  phones: string[];
  details: Record<string, unknown>;
};

export function contactRowToProfile(row: ContactRow): PersonProfile {
  const profile: PersonProfile = {
    nome: row.name,
    documento: row.document,
    email: row.email,
    celulares: row.phones.length ? row.phones : [""],
  };
  for (const key of detailKeys) {
    const value = row.details[key];
    if (typeof value === "string") profile[key] = value;
  }
  return profile;
}

export function profileToContactColumns(profile: PersonProfile): ContactRow {
  const details: Record<string, unknown> = {};
  for (const key of detailKeys) {
    const value = profile[key];
    if (value !== undefined) details[key] = value;
  }
  return {
    name: profile.nome,
    document: profile.documento.replace(/\D/g, ""),
    email: profile.email.trim().toLowerCase(),
    phones: profile.celulares.map((phone) => phone.trim()).filter(Boolean),
    details,
  };
}

export const profileTypeLabels: Record<string, string> = {
  Responsável: "Gestor de Projetos",
  Assessor: "Assessor",
  Investidor: "Investidor",
};

const profileLabelOrder = ["Responsável", "Assessor", "Investidor"];

export function joinProfileLabels(types: string[]): string {
  const labels = profileLabelOrder
    .filter((type) => types.includes(type))
    .map((type) => profileTypeLabels[type]!);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export const userProfileTypes = ["Investidor", "Assessor", "Responsável"] as const;

export const requiresUserAccount = (type: string) =>
  (userProfileTypes as readonly string[]).includes(type);

export function uniquePeople<T extends { email: string; tipo?: string }>(
  people: T[],
  typePriority: string[],
): T[] {
  const rank = (person: T) => {
    const index = typePriority.indexOf(person.tipo ?? "");
    return index === -1 ? typePriority.length : index;
  };
  const best = new Map<string, T>();
  for (const person of people) {
    const key = person.email.trim().toLowerCase();
    const current = best.get(key);
    if (!current || rank(person) < rank(current)) best.set(key, person);
  }
  return [...best.values()];
}
