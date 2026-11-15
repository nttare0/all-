import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

const list = value => (value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined);

/**
 * Build a Node.js request handler that serves the design tools over Streamable HTTP.
 * Stateless: a fresh McpServer and transport are created per request, so the same
 * handler works from a long-running process or a serverless function.
 */
export function createNodeHandler({ authToken, allowedOrigins, allowedHosts, jsonResponses = false } = {}) {
  const origins = list(allowedOrigins) ?? ['*'];
  const allowAllOrigins = origins.includes('*');

  const authorized = req => {
    if (!authToken) return true;
    const header = req.headers.authorization ?? '';
    const provided = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
    const expected = Buffer.from(authToken);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  };

  const corsHeaders = req => {
    const origin = req.headers.origin;
    const allow = allowAllOrigins ? '*' : origins.includes(origin) ? origin : origins[0];
    return {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id',
      ...(allowAllOrigins ? {} : { Vary: 'Origin' })
    };
  };

  return async function handle(req, res) {
    const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain', ...corsHeaders(req) }).end('ok');
      return;
    }
    if (pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...corsHeaders(req) }).end('Not found');
      return;
    }
    // When an origin allowlist is configured, browser callers from other origins are
    // refused up front instead of relying on the browser to enforce the header.
    const originBlocked = !allowAllOrigins && req.headers.origin && !origins.includes(req.headers.origin);
    if (originBlocked) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Origin not allowed');
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req)).end();
      return;
    }
    if (!authorized(req)) {
      res.writeHead(401, {
        'Content-Type': 'text/plain',
        'WWW-Authenticate': 'Bearer realm="mcp"',
        ...corsHeaders(req)
      }).end('Unauthorized');
      return;
    }

    for (const [key, value] of Object.entries(corsHeaders(req))) res.setHeader(key, value);

    const mcp = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: jsonResponses,
      allowedHosts: list(allowedHosts),
      allowedOrigins: allowAllOrigins ? undefined : origins
    });

    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });

    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('MCP request failed:', error instanceof Error ? error.message : error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Internal server error');
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  };
}
