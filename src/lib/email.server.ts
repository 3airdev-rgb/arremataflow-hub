type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);
}

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const provider = (process.env["EMAIL_PROVIDER"] || "resend").toLowerCase();
  const from = process.env["AUTH_EMAIL_FROM"];

  if (provider === "smtp") {
    const host = process.env["SMTP_HOST"];
    const port = Number(process.env["SMTP_PORT"] || 587);
    const user = process.env["SMTP_USER"];
    const password = process.env["SMTP_PASSWORD"];
    if (!from || !host || !Number.isInteger(port) || !user || !password) {
      throw new Error("A configuração SMTP está incompleta.");
    }
    const { createTransport } = await import("nodemailer");
    const transporter = createTransport({
      host,
      port,
      secure: process.env["SMTP_SECURE"] === "true",
      requireTLS: port === 587,
      auth: { user, pass: password.replace(/\s/g, "") },
    });
    await transporter.sendMail({ from, to: message.to, subject: message.subject, html: message.html });
    return;
  }

  const apiKey = process.env["RESEND_API_KEY"];

  if (!apiKey || !from) {
    throw new Error("O envio de e-mail não está configurado.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...message, from }),
  });

  if (!response.ok) {
    throw new Error(`Transactional email failed with status ${response.status}.`);
  }
}
