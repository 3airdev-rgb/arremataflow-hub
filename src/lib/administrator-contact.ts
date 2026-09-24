const planLimitKeyByContactType = {
  Investidor: "maxInvestors",
  Assessor: "maxAdvisors",
  Responsável: "maxProjectManagers",
} as const;

export type PlanLimitKey =
  (typeof planLimitKeyByContactType)[keyof typeof planLimitKeyByContactType];

export function planLimitKeyForContactType(type: string): PlanLimitKey | null {
  return (planLimitKeyByContactType as Record<string, PlanLimitKey | undefined>)[type] ?? null;
}

export type AdministratorRegistration = {
  name: string;
  legalDocument: string;
  email: string;
  phone: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
};

export function administratorContactColumns(registration: AdministratorRegistration) {
  const details: Record<string, unknown> = {};
  const put = (key: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) details[key] = trimmed;
  };
  put("endereco", registration.address);
  put("numero", registration.addressNumber);
  put("complemento", registration.addressComplement);
  put("bairro", registration.district);
  put("cidade", registration.city);
  put("estado", registration.state);
  put("cep", registration.postalCode);
  const phone = registration.phone.trim();
  return {
    name: registration.name.trim(),
    document: registration.legalDocument.replace(/\D/g, ""),
    email: registration.email.trim().toLowerCase(),
    phones: phone ? [phone] : [],
    details,
  };
}

export function countableManagerChange(
  existingManagerIds: string[],
  requestedManagerIds: string[],
  administratorContactIds: string[],
) {
  const administrators = new Set(administratorContactIds);
  const existing = new Set(existingManagerIds.filter((id) => !administrators.has(id)));
  const additions = [...new Set(requestedManagerIds)].filter(
    (id) => !administrators.has(id) && !existing.has(id),
  );
  return { existingCount: existing.size, additions };
}
