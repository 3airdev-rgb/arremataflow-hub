import pg from "pg";
import { administratorContactColumns } from "../src/lib/administrator-contact.ts";
import { userProfileTypes } from "../src/lib/contact-profile.ts";
import { validateDocument } from "../src/lib/utils-validation.ts";

const apply = process.argv.includes("--apply");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

const report = [];

// O driver devolve colunas "date" como Date à meia-noite local.
const dateOnly = (value) =>
  value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : (value ?? "");

await client.connect();
try {
  if (apply) await client.query("begin");
  const organizations = await client.query("select * from organizations order by name");
  for (const organization of organizations.rows) {
    const administrators = await client.query(
      `select u.id, u.name, u.email
       from organization_members m
       join users u on u.id = m.user_id
       where m.organization_id = $1 and m.role in ('owner', 'admin')
       order by m.created_at`,
      [organization.id],
    );
    const titular =
      administrators.rows.find((row) => row.id === organization.created_by) ??
      administrators.rows[0];
    if (!titular) {
      report.push(`${organization.name}: sem administrador, ignorada.`);
      continue;
    }
    const columns = administratorContactColumns({
      name: organization.name,
      legalDocument: organization.legal_document ?? "",
      email: titular.email,
      phone: organization.phone ?? "",
      address: organization.address ?? "",
      addressNumber: organization.address_number ?? "",
      addressComplement: organization.address_complement ?? "",
      district: organization.district ?? "",
      city: organization.city ?? "",
      state: organization.state ?? "",
      postalCode: organization.postal_code ?? "",
      birthDate: dateOnly(organization.birth_date),
      maritalStatus: organization.marital_status ?? "",
      bankName: organization.bank_name ?? "",
      bankAgency: organization.bank_agency ?? "",
      bankAccount: organization.bank_account ?? "",
    });
    if (!validateDocument(columns.document)) {
      report.push(`${organization.name}: sem CPF/CNPJ válido nas Configurações, ignorada.`);
      continue;
    }
    for (const type of userProfileTypes) {
      const matches = await client.query(
        `select id, email, document from contacts
         where organization_id = $1 and type = $2 and (document = $3 or lower(email) = $4)`,
        [organization.id, type, columns.document, columns.email],
      );
      const own = matches.rows.find((row) => row.email.toLowerCase() === columns.email);
      const conflict = matches.rows.find(
        (row) => row.email.toLowerCase() !== columns.email && row.document === columns.document,
      );
      if (conflict) {
        report.push(
          `${organization.name} / ${type}: CPF/CNPJ já usado por outro contato, ignorado.`,
        );
        continue;
      }
      if (own) {
        report.push(`${organization.name} / ${type}: atualizado.`);
        if (apply)
          await client.query(
            `update contacts set name = $1, document = $2, email = $3, phones = $4::jsonb,
               details = $5::jsonb, status = 'active', updated_at = now() where id = $6`,
            [
              columns.name,
              columns.document,
              columns.email,
              JSON.stringify(columns.phones),
              JSON.stringify(columns.details),
              own.id,
            ],
          );
      } else {
        report.push(`${organization.name} / ${type}: criado.`);
        if (apply)
          await client.query(
            `insert into contacts (organization_id, type, name, document, email, phones, details, created_by)
             values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
            [
              organization.id,
              type,
              columns.name,
              columns.document,
              columns.email,
              JSON.stringify(columns.phones),
              JSON.stringify(columns.details),
              titular.id,
            ],
          );
      }
    }
  }
  if (apply) await client.query("commit");
} catch (error) {
  if (apply) await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

console.log(apply ? "APLICADO:" : "SIMULAÇÃO:");
for (const line of report) console.log(`  ${line}`);
