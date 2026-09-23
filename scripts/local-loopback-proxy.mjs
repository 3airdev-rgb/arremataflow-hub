import http from "node:http";

const proxy = http.createServer((request, response) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: 3000, path: request.url, method: request.method, headers: request.headers }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => { response.writeHead(502); response.end("Servidor indisponível."); });
  request.pipe(upstream);
});

proxy.on("upgrade", (request, socket, head) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: 3000, path: request.url, method: request.method, headers: request.headers });
  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n\r\n`);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket); socket.pipe(upstreamSocket);
  });
  upstream.on("error", () => socket.destroy()); upstream.end();
});

proxy.listen(8081, "127.0.0.1");
