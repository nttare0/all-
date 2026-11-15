import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { designBrief, reviewChecklist } from './design.js';

const platform = z.enum(['web', 'mobile', 'desktop', 'cross-platform']);
const text = result => ({ content: [{ type: 'text', text: result }] });

// Shared by the stdio entry point and the HTTP entry point so the two transports
// always expose identical tools, schemas, and output.
export function createServer({ bridge, eagerBridge = false } = {}) {
  const server = new McpServer({ name: 'minimal-interface-design', version: '0.1.0' });

  server.registerTool('design_brief', {
    description: 'Create a concise interface design brief and minimal implementation plan. Does not generate or inspect a design.',
    inputSchema: {
      product: z.string().min(1).describe('Product or feature being designed'),
      audience: z.string().min(1).describe('Intended users'),
      goal: z.string().min(1).describe('Primary user goal'),
      platform: platform.describe('Target platform'),
      constraints: z.string().optional().describe('Technical, branding, or other constraints')
    }
  }, async args => text(designBrief(args)));

  server.registerTool('design_review_checklist', {
    description: 'Return a manual interface review checklist. This tool does not inspect screenshots or code.',
    inputSchema: {
      platform,
      focus: z.enum(['all', 'hierarchy', 'accessibility', 'responsiveness', 'usability', 'safety', 'simplicity']).default('all')
    }
  }, async args => text(reviewChecklist(args)));

  if (bridge) {
    if (eagerBridge) {
      // Stateless HTTP finishes each request as soon as it is answered, so the
      // bridge must be registered before the transport handles anything —
      // otherwise tools/list would never contain the upstream tools.
      // No per-instance logging here: stateless HTTP builds a server per request.
      server.bridgeReady = bridge
        .register(server)
        .catch(error => console.error(`serial bridge unavailable: ${error.message}`));
    } else {
      // On a long-lived stdio session, register after initialize and then tell
      // the client the tool list changed.
      server.server.oninitialized = () => {
        bridge
          .register(server)
          .then(names => {
            if (names.length === 0) return;
            console.error(`serial bridge: exposed ${names.length} tool(s) — ${names.join(', ')}`);
            if (server.isConnected()) {
              return server.server.sendToolListChanged().catch(() => undefined);
            }
          })
          .catch(error => console.error(`serial bridge unavailable: ${error.message}`));
      };
    }
    server.server.onclose = () => void bridge.close();
  }

  return server;
}
