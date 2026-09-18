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
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["AUTH_EMAIL_FROM"];

  if (!apiKey || !from) {
    throw new Error("Transactional email is not configured.");
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
