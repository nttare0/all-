import { createNodeHandler } from '../src/handler.js';
import { createSerialBridge } from '../src/bridge.js';

// Vercel Node.js function. vercel.json routes every request path here, so only
// /mcp (and a /healthz probe) respond; everything else returns 404.
// On a serverless platform the serial bridge is only useful when the binary is
// present in the bundle, which is unusual. Leave SERIAL_MCP_COMMAND unset there.
const bridge = process.env.SERIAL_MCP_COMMAND ? createSerialBridge() : undefined;

const handler = createNodeHandler({
  authToken: process.env.MCP_AUTH_TOKEN,
  allowedHosts: process.env.ALLOWED_HOSTS,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
  jsonResponses: process.env.MCP_JSON_RESPONSES === '1',
  bridge
});

export default function vercelHandler(req, res) {
  return handler(req, res);
}
