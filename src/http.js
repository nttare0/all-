#!/usr/bin/env node
import { createServer as createHttpServer } from 'node:http';
import { createNodeHandler } from './handler.js';
import { createSerialBridge } from './bridge.js';

// Self-hosted HTTP transport for the same tools src/index.js serves over stdio.
// Stateless Streamable HTTP, so it also works behind serverless platforms.
//
// Environment:
//   PORT               listen port (default 3000)
//   HOST               bind address (default 0.0.0.0)
//   MCP_AUTH_TOKEN     if set, requires "Authorization: Bearer <token>"
//   ALLOWED_HOSTS      comma-separated Host allowlist (DNS-rebinding protection)
//   ALLOWED_ORIGINS    comma-separated Origin allowlist; default "*"
//   MCP_JSON_RESPONSES "1" returns plain JSON instead of an SSE stream
//   SERIAL_MCP_COMMAND  when set, bridges serial-mcp-server's tools into this server
//                       (SERIAL_MCP_ARGS defaults to "serve", SERIAL_MCP_PREFIX to "serial_")

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const authToken = process.env.MCP_AUTH_TOKEN;

// A single bridge process is shared by every request, even though a fresh MCP
// server is built per request in stateless mode.
const bridge = process.env.SERIAL_MCP_COMMAND ? createSerialBridge() : undefined;

const handler = createNodeHandler({
  authToken,
  allowedHosts: process.env.ALLOWED_HOSTS,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  jsonResponses: process.env.MCP_JSON_RESPONSES === '1',
  bridge
});

const server = createHttpServer(handler);

server.listen(port, host, () => {
  console.error(`MCP server listening on http://${host}:${port}/mcp (stateless${authToken ? ', auth required' : ''})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void bridge?.close();
    server.close(() => process.exit(0));
  });
}
