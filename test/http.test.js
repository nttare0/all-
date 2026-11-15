import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createNodeHandler } from '../src/handler.js';

// Starts the HTTP transport on an ephemeral port and connects a real MCP client.
async function withHttpServer(options, run) {
  const server = createServer(createNodeHandler(options));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/mcp`;
  try {
    await run({ url, origin: `http://127.0.0.1:${port}` });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function connect(url, headers) {
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });
  const client = new Client({ name: 'http-test-client', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

test('HTTP transport lists and invokes the design tools over Streamable HTTP', async () => {
  await withHttpServer({}, async ({ url }) => {
    const client = await connect(url);
    try {
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map(t => t.name).sort(), ['design_brief', 'design_review_checklist']);

      const brief = await client.callTool({ name: 'design_brief', arguments: { product: 'Planner', audience: 'Students', goal: 'Plan a week', platform: 'mobile' } });
      assert.match(brief.content[0].text, /Students/);
      assert.match(brief.content[0].text, /safe areas/);

      const invalid = await client.callTool({ name: 'design_brief', arguments: { product: 'x', audience: 'y', goal: 'z', platform: 'invalid' } });
      assert.equal(invalid.isError, true);
    } finally {
      await client.close();
    }
  });
});

test('allowed origin preflights and blocked origins are rejected', async () => {
  await withHttpServer({ allowedOrigins: 'https://app.example.com' }, async ({ url }) => {
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://app.example.com');

    // An origin outside the allowlist is refused outright.
    const blocked = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(blocked.status, 403);
  });
});

test('health probe responds and unknown paths return 404', async () => {
  await withHttpServer({}, async ({ url }) => {
    const base = url.replace('/mcp', '');
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'ok');
    const missing = await fetch(`${base}/nope`);
    assert.equal(missing.status, 404);
  });
});

test('bearer token is enforced when MCP_AUTH_TOKEN is set', async () => {
  await withHttpServer({ authToken: 's3cret' }, async ({ url }) => {
    const initBody = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'x', version: '1' } }
    });
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

    const denied = await fetch(url, { method: 'POST', headers, body: initBody });
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('www-authenticate') ?? '', /Bearer/);

    const allowed = await fetch(url, { method: 'POST', headers: { ...headers, Authorization: 'Bearer s3cret' }, body: initBody });
    assert.equal(allowed.status, 200);

    const client = await connect(url, { Authorization: 'Bearer s3cret' });
    try {
      const checklist = await client.callTool({ name: 'design_review_checklist', arguments: { platform: 'web', focus: 'accessibility' } });
      assert.match(checklist.content[0].text, /keyboard/);
    } finally {
      await client.close();
    }
  });
});

test('stdio and HTTP transports expose identical tool definitions', async () => {
  const { createServer: createMcpServer } = await import('../src/server.js');
  const server = createMcpServer();
  const stdioTools = server._registeredTools ? Object.keys(server._registeredTools).sort() : [];
  assert.deepEqual(stdioTools, ['design_brief', 'design_review_checklist']);
});

test('serial bridge tools are reachable over HTTP too', async () => {
  const { fileURLToPath } = await import('node:url');
  const { createSerialBridge } = await import('../src/bridge.js');
  const fakeServerPath = fileURLToPath(new URL('./fixtures/fake-serial-server.js', import.meta.url));
  const bridge = createSerialBridge({ command: process.execPath, args: [fakeServerPath] });
  try {
    await withHttpServer({ bridge }, async ({ url }) => {
      const client = await connect(url);
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
        const { tools } = await client.listTools();
        assert.ok(tools.some(t => t.name === 'serial_list_ports'), 'bridged tools should be listed');
        const ports = await client.callTool({ name: 'serial_list_ports', arguments: {} });
        assert.match(ports.content[0].text, /ttyACM0/);
      } finally {
        await client.close();
      }
    });
  } finally {
    await bridge.close();
  }
});
