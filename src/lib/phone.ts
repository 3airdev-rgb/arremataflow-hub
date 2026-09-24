import { z } from "zod";

export const PHONE_PLACEHOLDER = "+5548999999999";

const NATIONAL_PATTERN = /^[1-9]\d(?:9\d{8}|[2-5]\d{7})$/;

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  let national: string;
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("55")) return null;
    national = digits.slice(2);
  } else if (digits.length > 11 && digits.startsWith("55")) {
    national = digits.slice(2);
  } else {
    national = digits;
  }
  return NATIONAL_PATTERN.test(national) ? `+55${national}` : null;
}

export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  let local: string;
  if (value.trim().startsWith("+")) {
    if ("55".startsWith(digits)) return "";
    local = digits.startsWith("55") ? digits.slice(2) : digits;
  } else if (digits.length > 11 && digits.startsWith("55")) {
    local = digits.slice(2);
  } else {
    local = digits;
  }
  local = local.slice(0, 11);
  return local ? `+55${local}` : "";
}

export const phoneSchema = z
  .string()
  .trim()
  .max(40)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (normalized === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Informe o telefone no formato ${PHONE_PLACEHOLDER} (código do país e DDD).`,
      });
      return z.NEVER;
    }
    return normalized;
  });
