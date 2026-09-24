export type TaskPersonSource = {
  value: string;
  label: string;
  email: string;
  type: string;
  /** Só pode ser convidado para reunião (prestadores e comercialização), não é responsável. */
  participantOnly: boolean;
};

export type TaskPersonOption = {
  value: string;
  label: string;
  email: string;
  /** Todos os papéis da pessoa, sem repetição, ex.: "Administrador, Assessor". */
  type: string;
  participantOnly: boolean;
  /** Outros valores (cadastros duplicados) que representam a mesma pessoa. */
  aliases: string[];
};

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

type Merged = TaskPersonOption & { emails: Set<string>; name: string; types: string[] };

/**
 * Junta cadastros da mesma pessoa (mesmo e-mail ou mesmo nome) em uma única opção.
 * O primeiro cadastro da lista define o valor usado; os demais viram aliases.
 */
export function mergeTaskPeople(sources: TaskPersonSource[]): TaskPersonOption[] {
  const people: Merged[] = [];
  for (const source of sources) {
    const email = source.email.trim().toLowerCase();
    const name = normalizeName(source.label);
    const found = people.find(
      (person) => (email && person.emails.has(email)) || (name && person.name === name),
    );
    if (!found) {
      people.push({
        value: source.value,
        label: source.label,
        email: source.email,
        type: source.type,
        participantOnly: source.participantOnly,
        aliases: [],
        emails: new Set(email ? [email] : []),
        name,
        types: [source.type],
      });
      continue;
    }
    if (source.value !== found.value && !found.aliases.includes(source.value))
      found.aliases.push(source.value);
    if (email) found.emails.add(email);
    if (source.type && !found.types.includes(source.type)) found.types.push(source.type);
    found.participantOnly = found.participantOnly && source.participantOnly;
    found.type = found.types.join(", ");
  }
  return people.map((person) => ({
    value: person.value,
    label: person.label,
    email: person.email,
    type: person.type,
    participantOnly: person.participantOnly,
    aliases: person.aliases,
  }));
}

/** Converte um valor salvo (possivelmente de um cadastro duplicado) no valor da opção atual. */
export function canonicalTaskValue(options: TaskPersonOption[], value: string): string {
  const match = options.find((option) => option.value === value || option.aliases.includes(value));
  return match ? match.value : value;
}
