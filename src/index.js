#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

// Default entry point: runs over stdio for clients that spawn the process locally.
// For a network-reachable server, run src/http.js instead.
await createServer().connect(new StdioServerTransport());
