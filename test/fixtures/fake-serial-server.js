#!/usr/bin/env node
// Stand-in for serial-mcp-server, used by the bridge tests so they need no Rust
// toolchain and no hardware. Parameter names, defaults, and the connection-id flow
// mirror src/tools/types.rs in adancurusul/serial-mcp-server.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const ports = ['/dev/ttyACM0', '/dev/ttyUSB0'];
const connections = new Map(); // connection_id -> { port, baud_rate }
let nextId = 1;

const server = new McpServer({ name: 'fake-serial', version: '0.3.0' });
const json = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });

server.registerTool('list_ports', {
  description: 'List available serial ports.',
  inputSchema: {}
}, async () => json({ ports }));

server.registerTool('open', {
  description: 'Open a serial connection.',
  inputSchema: {
    port: z.string().describe('Serial port path'),
    baud_rate: z.number().describe('Baud rate'),
    data_bits: z.string().default('8'),
    stop_bits: z.string().default('1'),
    parity: z.string().default('none'),
    flow_control: z.string().default('none')
  }
}, async ({ port, baud_rate }) => {
  if (!ports.includes(port)) return { ...json({ error: `no such port: ${port}`, available: ports }), isError: true };
  const connection_id = `conn-${nextId++}`;
  connections.set(connection_id, { port, baud_rate });
  return json({ connection_id, port, baud_rate });
});

server.registerTool('write', {
  description: 'Write encoded data to an open connection.',
  inputSchema: {
    connection_id: z.string(),
    data: z.string(),
    encoding: z.enum(['utf8', 'hex', 'base64']).default('utf8')
  }
}, async ({ connection_id, data }) => {
  if (!connections.has(connection_id)) return { ...json({ error: `unknown connection: ${connection_id}` }), isError: true };
  return json({ written: data.length, encoding: 'utf8', echo: data.trim() === 'PING' ? 'PONG' : null });
});

server.registerTool('read', {
  description: 'Read data from an open connection with timeout handling or a bounded capture window.',
  inputSchema: {
    connection_id: z.string(),
    timeout_ms: z.number().optional(),
    duration_ms: z.number().optional(),
    start_trigger: z.enum(['first_byte', 'immediate']).optional(),
    initial_timeout_ms: z.number().optional(),
    idle_timeout_ms: z.number().optional(),
    max_bytes: z.number().optional(),
    encoding: z.enum(['utf8', 'hex', 'base64']).default('utf8')
  }
}, async ({ connection_id, duration_ms }) => {
  if (!connections.has(connection_id)) return { ...json({ error: `unknown connection: ${connection_id}` }), isError: true };
  if (duration_ms) {
    return json({ data: 'PONG\n', completion_reason: 'idle_timeout', waited_ms: 12, elapsed_ms: 1041, chunks: [{ bytes: 5 }] });
  }
  return json({ data: 'PONG\n', bytes: 5 });
});

server.registerTool('close', {
  description: 'Close an open connection.',
  inputSchema: { connection_id: z.string() }
}, async ({ connection_id }) => {
  connections.delete(connection_id);
  return json({ closed: connection_id });
});

server.registerTool('set_control_lines', {
  description: 'Set RTS and/or DTR on an open connection.',
  inputSchema: {
    connection_id: z.string(),
    rts: z.enum(['high', 'low']).optional(),
    dtr: z.enum(['high', 'low']).optional()
  }
}, async ({ connection_id, rts, dtr }) => {
  if (!connections.has(connection_id)) return { ...json({ error: `unknown connection: ${connection_id}` }), isError: true };
  return json({ connection_id, rts: rts ?? null, dtr: dtr ?? null });
});

server.registerTool('macro_plan', {
  description: 'Expand a loaded, inline, or file-backed macro or assembly without opening hardware.',
  inputSchema: {
    macro: z.string(),
    file: z.string().optional().describe('Path to a macro pack JSON file')
  }
}, async ({ macro }) => json({ macro, steps: [{ send: 'PING\n' }, { expect: { contains: 'PONG' } }], simulated: true }));

await server.connect(new StdioServerTransport());
