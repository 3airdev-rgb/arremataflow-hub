import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const user = (await client.query("select id from users limit 1")).rows[0];
  const organization = (await client.query("select id from organizations limit 1")).rows[0];
  if (!user || !organization) throw new Error("Usuário ou empresa de teste ausente.");
  const project = (await client.query("insert into projects(organization_id, code, name, address, created_by) values($1, 'TEST-IMG', 'Teste de fotos', 'Local', $2) returning id", [organization.id, user.id])).rows[0];
  const first = (await client.query("insert into project_images(organization_id, project_id, storage_key, original_name, mime_type, size_bytes, sha256, display_order, is_main, uploaded_by) values($1,$2,$3,'foto.jpg','image/jpeg',128,$4,0,true,$5) returning id", [organization.id, project.id, `${organization.id}/${project.id}/images/test.jpg`, "a".repeat(64), user.id])).rows[0];
  const linked = await client.query("select p.id from projects p join project_images i on i.project_id=p.id where p.id=$1 and i.id=$2", [project.id, first.id]);
  if (linked.rowCount !== 1) throw new Error("A foto não ficou vinculada ao projeto.");
  await client.query("savepoint duplicate_main");
  let uniqueMainProtected = false;
  try {
    await client.query("insert into project_images(organization_id, project_id, storage_key, original_name, mime_type, size_bytes, sha256, display_order, is_main, uploaded_by) values($1,$2,$3,'foto2.png','image/png',128,$4,1,true,$5)", [organization.id, project.id, `${organization.id}/${project.id}/images/test2.png`, "b".repeat(64), user.id]);
  } catch { uniqueMainProtected = true; await client.query("rollback to savepoint duplicate_main"); }
  if (!uniqueMainProtected) throw new Error("A restrição de imagem principal única não funcionou.");
  console.log("Teste transacional concluído: fotos vinculadas e imagem principal protegida.");
  await client.query("rollback");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release(); await pool.end();
}
