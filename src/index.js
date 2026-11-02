#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { designBrief, reviewChecklist } from './design.js';

const server = new McpServer({ name: 'minimal-interface-design', version: '0.1.0' });
const platform = z.enum(['web', 'mobile', 'desktop', 'cross-platform']);
const text = result => ({ content: [{ type: 'text', text: result }] });

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

await server.connect(new StdioServerTransport());
