export const MIN_BIRTH_YEAR = 1900;

/** Aplica a máscara DD/MM/AAAA enquanto a pessoa digita (só números, no máximo 8). */
export function maskBirthDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const pad = (value: number) => String(value).padStart(2, "0");

function parts(display: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return null;
  return { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
}

const isRealDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

/** Mensagem de erro para o texto digitado; nulo quando está vazio, incompleto ou válido. */
export function birthDateError(display: string, now: Date = new Date()): string | null {
  if (display.length < 10) return null;
  const p = parts(display);
  if (!p || !isRealDate(p.year, p.month, p.day)) return "Data inválida. Use o formato DD/MM/AAAA.";
  if (p.year < MIN_BIRTH_YEAR) return `O ano deve ser ${MIN_BIRTH_YEAR} ou posterior.`;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (Date.UTC(p.year, p.month - 1, p.day) > today)
    return "A data de nascimento não pode ser futura.";
  return null;
}

/** DD/MM/AAAA -> AAAA-MM-DD; nulo se estiver incompleta ou inválida. */
export function birthDateToIso(display: string, now: Date = new Date()): string | null {
  if (display.length < 10 || birthDateError(display, now)) return null;
  const p = parts(display);
  return p ? `${p.year}-${pad(p.month)}-${pad(p.day)}` : null;
}

/** AAAA-MM-DD -> DD/MM/AAAA; vazio se não for uma data completa. */
export function isoToBirthDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function ageFromIso(iso: string, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age >= 0 ? age : null;
}
