#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { createSerialBridge } from './bridge.js';

// Default entry point: runs over stdio for clients that spawn the process locally.
// For a network-reachable server, run src/http.js instead.
//
// Set SERIAL_MCP_COMMAND (and optionally SERIAL_MCP_ARGS) to additionally expose a
// serial-mcp-server's tools through this server. Unset means the design tools only.
const bridge = process.env.SERIAL_MCP_COMMAND ? createSerialBridge() : undefined;

await createServer({ bridge }).connect(new StdioServerTransport());
