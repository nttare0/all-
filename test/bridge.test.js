import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { createSerialBridge } from '../src/bridge.js';

const fakeServerPath = fileURLToPath(new URL('./fixtures/fake-serial-server.js', import.meta.url));

// Connects a client to a server that has the serial bridge attached, mirrors how
// a real client performs initialize -> tools/list -> tools/call.
async function withBridge(options, run) {
  const bridge = createSerialBridge({ command: process.execPath, args: [fakeServerPath], ...options });
  const server = createServer({ bridge });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'bridge-test', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    await run({ client, bridge });
  } finally {
    await client.close();
    await bridge.close();
  }
}

test('bridged tools appear with the serial_ prefix and real parameter names', async () => {
  await withBridge({}, async ({ client }) => {
    // Bridge registration happens after initialize; wait for the list to settle.
    await new Promise(resolve => setTimeout(resolve, 400));
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name).sort();
    assert.deepEqual(names, [
      'design_brief',
      'design_review_checklist',
      'serial_close',
      'serial_list_ports',
      'serial_macro_plan',
      'serial_open',
      'serial_read',
      'serial_set_control_lines',
      'serial_write'
    ]);

    const open = tools.find(t => t.name === 'serial_open');
    assert.match(open.description, /serial bridge/);
    // Real upstream names from serial-mcp-server's OpenArgs, not invented ones.
    assert.deepEqual(Object.keys(open.inputSchema.properties).sort(), ['baud_rate', 'data_bits', 'flow_control', 'parity', 'port', 'stop_bits']);
    assert.deepEqual(open.inputSchema.required.sort(), ['baud_rate', 'port']);
  });
});

test('a real session proxies through: open, write, close', async () => {
  await withBridge({}, async ({ client }) => {
    await new Promise(resolve => setTimeout(resolve, 400));

    const ports = await client.callTool({ name: 'serial_list_ports', arguments: {} });
    assert.deepEqual(JSON.parse(ports.content[0].text).ports, ['/dev/ttyACM0', '/dev/ttyUSB0']);

    const opened = await client.callTool({ name: 'serial_open', arguments: { port: '/dev/ttyACM0', baud_rate: 115200 } });
    assert.equal(opened.isError, undefined);
    const { connection_id } = JSON.parse(opened.content[0].text);
    assert.match(connection_id, /^conn-/);

    const written = await client.callTool({ name: 'serial_write', arguments: { connection_id, data: 'PING\n' } });
    assert.equal(JSON.parse(written.content[0].text).echo, 'PONG');

    const captured = await client.callTool({ name: 'serial_read', arguments: { connection_id, duration_ms: 5000 } });
    assert.equal(JSON.parse(captured.content[0].text).completion_reason, 'idle_timeout');

    const closed = await client.callTool({ name: 'serial_close', arguments: { connection_id } });
    assert.equal(JSON.parse(closed.content[0].text).closed, connection_id);
  });
});

test('upstream errors surface as isError without breaking the bridge', async () => {
  await withBridge({}, async ({ client }) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const bad = await client.callTool({ name: 'serial_open', arguments: { port: '/dev/nope', baud_rate: 9600 } });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /no such port/);

    const design = await client.callTool({ name: 'design_review_checklist', arguments: { platform: 'web', focus: 'hierarchy' } });
    assert.match(design.content[0].text, /main task clear/);
  });
});

test('unknown arguments are passed through to the upstream tool', async () => {
  await withBridge({}, async ({ client }) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const plan = await client.callTool({ name: 'serial_macro_plan', arguments: { macro: 'ping', file: 'examples/macros/ping.json', future_option: true } });
    assert.equal(plan.isError, undefined);
    const body = JSON.parse(plan.content[0].text);
    assert.equal(body.macro, 'ping');
    assert.equal(body.simulated, true);
  });
});

test('a missing serial binary degrades gracefully instead of breaking the server', async () => {
  await withBridge({ command: '/nonexistent/serial-mcp-server' }, async ({ client }) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['design_brief', 'design_review_checklist']);
    const design = await client.callTool({ name: 'design_brief', arguments: { product: 'p', audience: 'a', goal: 'g', platform: 'web' } });
    assert.match(design.content[0].text, /Design brief/);
  });
});

test('bridge is off by default so plain stdio clients are unaffected', async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'plain', version: '1.0.0' });
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['design_brief', 'design_review_checklist']);
  } finally {
    await client.close();
  }
});
