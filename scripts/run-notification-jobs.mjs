import pg from "pg";
import PDFDocument from "pdfkit";
import { createTransport } from "nodemailer";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});
const zone = "America/Sao_Paulo";
const html = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char],
  );
const brl = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const localParts = (now = new Date()) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
const dateKey = (parts) => `${parts.year}-${parts.month}-${parts.day}`;

async function sendEmail({ to, subject, htmlBody, attachments = [] }) {
  const from = process.env.AUTH_EMAIL_FROM;
  if (!from) throw new Error("AUTH_EMAIL_FROM não configurado.");
  if ((process.env.EMAIL_PROVIDER || "resend").toLowerCase() === "smtp") {
    const transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: (process.env.SMTP_PASSWORD || "").replace(/\s/g, ""),
          }
        : undefined,
    });
    await transporter.sendMail({
      from,
      to,
      subject,
      html: htmlBody,
      attachments: attachments.map((item) => ({ filename: item.filename, content: item.content })),
    });
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: htmlBody,
      attachments: attachments.map((item) => ({
        filename: item.filename,
        content: item.content.toString("base64"),
      })),
    }),
  });
  if (!response.ok) throw new Error(`Falha no envio: ${response.status}`);
}

async function deliverOnce({ organizationId, kind, key, recipientEmail, send }) {
  const dedupeKey = `${kind}:${key}:${recipientEmail.toLowerCase()}`;
  const claim = await pool.query(
    `insert into scheduled_email_deliveries (organization_id, kind, dedupe_key, recipient_email) values ($1,$2,$3,$4) on conflict (dedupe_key) do nothing returning id`,
    [organizationId, kind, dedupeKey, recipientEmail],
  );
  if (!claim.rowCount) return;
  try {
    await send();
    await pool.query(
      `update scheduled_email_deliveries set status='sent', sent_at=now() where id=$1`,
      [claim.rows[0].id],
    );
  } catch (error) {
    await pool.query(`delete from scheduled_email_deliveries where id=$1`, [claim.rows[0].id]);
    throw error;
  }
}

function createTablePdf(title, project, period, columns, rows, drawChart) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).fillColor("#123e56").text("ArremataFlow", { align: "center" });
    doc.moveDown(0.4).fontSize(15).fillColor("#10263b").text(title, { align: "center" });
    doc
      .fontSize(9)
      .fillColor("#475467")
      .text(`${project.code} · ${project.name}`, { align: "center" })
      .text(`Período: ${period}`, { align: "center" });
    if (drawChart) drawChart(doc);
    doc.moveDown();
    const widths = columns.map((column) => column.width);
    const left = doc.page.margins.left;
    const header = () => {
      let x = left;
      doc
        .rect(
          left,
          doc.y,
          widths.reduce((a, b) => a + b, 0),
          22,
        )
        .fill("#eaf1f5");
      columns.forEach((column, index) => {
        doc
          .fillColor("#123e56")
          .fontSize(8)
          .text(column.label, x + 4, doc.y - 17, { width: widths[index] - 8 });
        x += widths[index];
      });
      doc.moveDown(0.8);
    };
    header();
    rows.forEach((row, rowIndex) => {
      if (doc.y > 750) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      if (rowIndex % 2)
        doc
          .rect(
            left,
            y - 3,
            widths.reduce((a, b) => a + b, 0),
            20,
          )
          .fill("#f3f6f8");
      let x = left;
      columns.forEach((column, index) => {
        doc
          .fillColor("#10263b")
          .fontSize(7.5)
          .text(String(row[column.key] ?? ""), x + 4, y, {
            width: widths[index] - 8,
            height: 18,
            ellipsis: true,
          });
        x += widths[index];
      });
      doc.y = y + 20;
    });
    if (!rows.length)
      doc.fillColor("#667085").fontSize(10).text("Nenhum registro encontrado no período.");
    doc.end();
  });
}

async function runTaskAlerts(parts) {
  if (Number(parts.hour) < 8) return;
  const organizations = await pool.query(
    `select id, name from organizations where status='active' and task_deadline_emails=true`,
  );
  for (const organization of organizations.rows) {
    const tasks = await pool.query(
      `select t.id, t.title, t.description, t.category, t.due_date, p.id project_id, p.code project_code, p.name project_name, coalesce(u.name,c.name) recipient_name, coalesce(u.email,c.email) recipient_email from tasks t join projects p on p.id=t.project_id join task_assignees ta on ta.task_id=t.id left join users u on u.id=ta.user_id left join contacts c on c.id=ta.contact_id where t.organization_id=$1 and t.status <> 'concluido' and t.due_date between (current_date + interval '1 day') and (current_date + interval '3 days') and coalesce(u.email,c.email,'') <> ''`,
      [organization.id],
    );
    for (const task of tasks.rows)
      await deliverOnce({
        organizationId: organization.id,
        kind: "task-deadline",
        key: `${dateKey(parts)}:${task.id}`,
        recipientEmail: task.recipient_email,
        send: () =>
          sendEmail({
            to: task.recipient_email,
            subject: `Tarefa próxima do vencimento · ${task.project_name}`,
            htmlBody: `<p>Olá ${html(task.recipient_name)},</p><p>A tarefa abaixo vencerá nos próximos 3 dias:</p><p><strong>Projeto:</strong> ${html(task.project_code)} · ${html(task.project_name)}<br><strong>Tarefa:</strong> ${html(task.title)}<br><strong>Categoria:</strong> ${html(task.category)}<br><strong>Vencimento:</strong> ${new Date(`${task.due_date}T12:00:00Z`).toLocaleDateString("pt-BR")}<br><strong>Detalhamento:</strong> ${html(task.description || "Não informado")}</p>`,
          }),
      });
  }
}

async function runWeeklyReports(parts) {
  if (parts.weekday !== "Fri" || Number(parts.hour) < 21) return;
  const organizations = await pool.query(
    `select id, name from organizations where status='active' and weekly_investor_reports=true`,
  );
  for (const organization of organizations.rows) {
    const projects = await pool.query(
      `select id, code, name from projects where organization_id=$1 and status <> 'concluido'`,
      [organization.id],
    );
    for (const project of projects.rows) {
      const [investors, movements] = await Promise.all([
        pool.query(
          `select distinct c.name, c.email from project_participants pp join contacts c on c.id=pp.contact_id where pp.project_id=$1 and pp.role='investor' and c.status='active' and c.email <> ''`,
          [project.id],
        ),
        pool.query(
          `select movement_date, type, category, description, status, amount from financial_movements where project_id=$1 and movement_date >= now() - interval '7 days' and movement_date <= now() order by movement_date`,
          [project.id],
        ),
      ]);
      const period = `${new Date(Date.now() - 7 * 86400000).toLocaleDateString("pt-BR", { timeZone: zone })} a ${new Date().toLocaleDateString("pt-BR", { timeZone: zone })}`;
      const cashRows = movements.rows.map((item) => ({
        date: new Date(item.movement_date).toLocaleDateString("pt-BR", { timeZone: zone }),
        type: item.type === "receita" ? "Crédito" : "Débito",
        category: item.category,
        description: item.description,
        status: item.status,
        amount: brl(item.amount),
      }));
      const totals = new Map();
      movements.rows
        .filter((item) => item.type === "despesa")
        .forEach((item) =>
          totals.set(
            item.category || "Sem categoria",
            (totals.get(item.category || "Sem categoria") || 0) + Number(item.amount),
          ),
        );
      const totalExpense = [...totals.values()].reduce((sum, value) => sum + value, 0);
      const expenseRows = [...totals].map(([category, value]) => ({
        category,
        value: brl(value),
        percentage: `${totalExpense ? ((value / totalExpense) * 100).toFixed(2).replace(".", ",") : "0,00"}%`,
        raw: value,
      }));
      const cashPdf = await createTablePdf(
        "Fluxo de Caixa",
        project,
        period,
        [
          { key: "date", label: "Data", width: 52 },
          { key: "type", label: "Tipo", width: 48 },
          { key: "category", label: "Categoria", width: 75 },
          { key: "description", label: "Descrição", width: 170 },
          { key: "status", label: "Status", width: 65 },
          { key: "amount", label: "Valor", width: 90 },
        ],
        cashRows,
      );
      const colors = ["#0f6b8d", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
      const expensePdf = await createTablePdf(
        "Despesas por Categoria",
        project,
        period,
        [
          { key: "category", label: "Categoria", width: 245 },
          { key: "value", label: "Valor", width: 135 },
          { key: "percentage", label: "Percentual", width: 115 },
        ],
        expenseRows,
        (doc) => {
          let start = -90;
          const cx = 170,
            cy = doc.y + 82,
            radius = 58;
          expenseRows.forEach((item, index) => {
            const end = start + (totalExpense ? (item.raw / totalExpense) * 360 : 0);
            doc
              .save()
              .moveTo(cx, cy)
              .lineTo(
                cx + radius * Math.cos((start * Math.PI) / 180),
                cy + radius * Math.sin((start * Math.PI) / 180),
              )
              .arc(cx, cy, radius, start, end)
              .closePath()
              .fill(colors[index % colors.length])
              .restore();
            start = end;
            doc
              .fillColor(colors[index % colors.length])
              .rect(270, doc.y + index * 16, 9, 9)
              .fill()
              .fillColor("#10263b")
              .fontSize(8)
              .text(`${item.category} · ${item.percentage}`, 284, doc.y + index * 16 - 1);
          });
          doc.y = cy + radius + 8;
        },
      );
      for (const investor of investors.rows)
        await deliverOnce({
          organizationId: organization.id,
          kind: "weekly-investor-report",
          key: `${dateKey(parts)}:${project.id}`,
          recipientEmail: investor.email,
          send: () =>
            sendEmail({
              to: investor.email,
              subject: `Relatórios semanais · ${project.name}`,
              htmlBody: `<p>Olá ${html(investor.name)},</p><p>Seguem os relatórios dos últimos 7 dias do projeto <strong>${html(project.code)} · ${html(project.name)}</strong>.</p>`,
              attachments: [
                { filename: `fluxo-de-caixa-${project.code}.pdf`, content: cashPdf },
                { filename: `despesas-por-categoria-${project.code}.pdf`, content: expensePdf },
              ],
            }),
        });
    }
  }
}

async function tick() {
  const parts = localParts();
  await runTaskAlerts(parts);
  await runWeeklyReports(parts);
}
console.log("Processador de notificações iniciado (America/Sao_Paulo).");
await tick().catch((error) => console.error(error));
setInterval(() => void tick().catch((error) => console.error(error)), 60_000);
