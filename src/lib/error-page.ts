export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>ArremataFlow — Não foi possível carregar</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0f4056" />
    <link rel="icon" href="/favicon.jpg?v=4" type="image/jpeg" />
    <link rel="shortcut icon" href="/favicon.jpg?v=4" type="image/jpeg" />
    <style>
      * { box-sizing: border-box; }
      body { font: 15px/1.5 Inter, system-ui, -apple-system, sans-serif; background: #f4f8fa; color: #102a3a; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 30rem; width: 100%; text-align: center; padding: 2.5rem; border: 1px solid #dbe6eb; border-radius: 1rem; background: #fff; box-shadow: 0 12px 32px rgba(15, 64, 86, 0.08); }
      .brand { display: inline-flex; align-items: center; gap: .65rem; margin-bottom: 1.5rem; color: #0f4056; font-size: 1.1rem; font-weight: 700; }
      .brand img { width: 2rem; height: 2rem; border-radius: .4rem; object-fit: cover; }
      h1 { font-size: 1.35rem; margin: 0 0 0.6rem; }
      p { color: #59707d; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #0f4056; color: #fff; }
      .secondary { background: #fff; color: #0f4056; border-color: #b8cbd4; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand"><img src="/favicon.jpg?v=4" alt="" /> ArremataFlow</div>
      <h1>Não foi possível carregar esta página</h1>
      <p>Ocorreu uma falha inesperada. Tente novamente ou volte ao início.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}
