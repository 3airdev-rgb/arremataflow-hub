import pg from "pg";
import { normalizePhone } from "../src/lib/phone.ts";

const apply = process.argv.includes("--apply");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

const changes = [];
const invalid = [];

function plan(table, id, field, current, update) {
  if (typeof current !== "string" || !current.trim()) return;
  const normalized = normalizePhone(current);
  if (normalized === null) invalid.push({ table, id, field, value: current });
  else if (normalized !== current)
    changes.push({ table, id, field, from: current, to: normalized, update });
}

await client.connect();
try {
  const organizations = await client.query("select id, phone from organizations");
  for (const row of organizations.rows)
    plan("organizations", row.id, "phone", row.phone, (to) =>
      client.query("update organizations set phone = $1 where id = $2", [to, row.id]),
    );

  const contacts = await client.query("select id, phones from contacts");
  for (const row of contacts.rows) {
    const phones = Array.isArray(row.phones) ? row.phones : [];
    const next = phones.map((phone) => {
      const normalized = typeof phone === "string" ? normalizePhone(phone) : null;
      if (normalized === null)
        invalid.push({ table: "contacts", id: row.id, field: "phones", value: phone });
      return normalized ?? phone;
    });
    if (JSON.stringify(next) !== JSON.stringify(phones))
      changes.push({
        table: "contacts",
        id: row.id,
        field: "phones",
        from: phones.join(", "),
        to: next.join(", "),
        update: () =>
          client.query("update contacts set phones = $1::jsonb where id = $2", [
            JSON.stringify(next),
            row.id,
          ]),
      });
  }

  const jsonColumns = [
    ["service_providers", "data", "phone"],
    ["sales_portfolio", "data", "phone"],
    ["sales_proposals", "data", "otherPhone"],
    ["property_inspections", "form_data", "inspectorPhone"],
    ["property_inspections", "form_data", "bailiffPhone"],
  ];
  for (const [table, column, key] of jsonColumns) {
    const rows = await client.query(`select id, ${column} ->> $1 as value from ${table}`, [key]);
    for (const row of rows.rows)
      plan(table, row.id, key, row.value, (to) =>
        client.query(
          `update ${table} set ${column} = jsonb_set(${column}, ARRAY[$1]::text[], to_jsonb($2::text)) where id = $3`,
          [key, to, row.id],
        ),
      );
  }

  if (apply) {
    await client.query("begin");
    for (const change of changes) await change.update(change.to);
    await client.query("commit");
  }
} catch (error) {
  if (apply) await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

console.log(`${apply ? "APLICADO" : "SIMULAÇÃO"}: ${changes.length} telefone(s) a converter.`);
for (const change of changes)
  console.log(`  ${change.table}.${change.field} [${change.id}]: ${change.from} -> ${change.to}`);
console.log(`${invalid.length} valor(es) fora do padrão, mantidos como estão:`);
for (const item of invalid)
  console.log(`  ${item.table}.${item.field} [${item.id}]: ${JSON.stringify(item.value)}`);
