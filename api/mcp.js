import { createNodeHandler } from '../src/handler.js';

// Vercel Node.js function. vercel.json routes every request path here, so only
// /mcp (and a /healthz probe) respond; everything else returns 404.
const handler = createNodeHandler({
  authToken: process.env.MCP_AUTH_TOKEN,
  allowedHosts: process.env.ALLOWED_HOSTS,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  jsonResponses: process.env.MCP_JSON_RESPONSES === '1'
});

export default function vercelHandler(req, res) {
  return handler(req, res);
}
