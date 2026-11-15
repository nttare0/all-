import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { designBrief, reviewChecklist } from './design.js';

const platform = z.enum(['web', 'mobile', 'desktop', 'cross-platform']);
const text = result => ({ content: [{ type: 'text', text: result }] });

// Shared by the stdio entry point and the HTTP entry point so the two transports
// always expose identical tools, schemas, and output.
export function createServer() {
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

  return server;
}
