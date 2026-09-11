import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("TASK_EMAIL_FROM");
    if (!apiKey || !from) throw new Error("Serviço de e-mail não configurado.");

    const { recipients, task } = await request.json();
    if (!Array.isArray(recipients) || !recipients.length) throw new Error("Nenhum destinatário informado.");

    const meetingDetails = task.is_online_meeting
      ? `<p><strong>Horário:</strong> ${escapeHtml(task.meeting_time)}</p>
         <p><strong>Link da reunião:</strong> <a href="${escapeHtml(task.meeting_url)}">${escapeHtml(task.meeting_url)}</a></p>`
      : "";
    const html = `
      <h2>Nova tarefa no ArremataFlow</h2>
      <p><strong>Categoria:</strong> ${escapeHtml(task.category)}</p>
      <p><strong>Título:</strong> ${escapeHtml(task.titulo)}</p>
      <p><strong>Prazo:</strong> ${escapeHtml(task.prazo || "Não informado")}</p>
      <p><strong>Descrição:</strong> ${escapeHtml(task.descricao || "Não informada")}</p>
      ${meetingDetails}
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipients, subject: `Nova tarefa: ${task.titulo}`, html }),
    });
    if (!response.ok) throw new Error(await response.text());

    return new Response(JSON.stringify(await response.json()), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro no envio" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
