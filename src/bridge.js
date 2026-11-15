import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// An optional bridge to a second MCP server. Tools are discovered at runtime with
// tools/list and re-exposed (prefixed) through this server, so the upstream's real
// parameter names and descriptions reach the agent instead of being re-declared here.
//
// Nothing is spawned until the first tools/list or tools/call arrives, so stdio-only
// clients that never ask for the bridge pay no cost, and a missing binary yields a
// clear error when connected rather than at startup.

const LIFECYCLE_TOOLS = /^(open|close|list_ports)$/;

/** Convert an upstream JSON Schema object into a loose Zod shape that preserves names. */
function shapeFromJsonSchema(inputSchema) {
  const properties = inputSchema?.properties ?? {};
  const required = new Set(inputSchema?.required ?? []);
  const shape = {};
  for (const key of Object.keys(properties)) {
    shape[key] = required.has(key) ? z.any() : z.any().optional();
  }
  return z.looseObject(shape);
}

/** Flatten upstream MCP content blocks into the text the calling agent sees. */
function contentToText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map(block => {
      if (block.type === 'text') return block.text;
      if (block.type === 'image') return `[image: ${block.mimeType ?? 'unknown'}]`;
      if (block.type === 'audio') return `[audio: ${block.mimeType ?? 'unknown'}]`;
      return JSON.stringify(block);
    })
    .join('\n');
}

export function createSerialBridge({
  command = process.env.SERIAL_MCP_COMMAND ?? 'serial-mcp-server',
  args = (process.env.SERIAL_MCP_ARGS ?? 'serve').split(' ').filter(Boolean),
  prefix = process.env.SERIAL_MCP_PREFIX ?? 'serial_',
  env = {}
} = {}) {
  let clientPromise;
  let cachedTools;
  let readyPromise;

  const connect = () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        const client = new Client({ name: 'minimal-interface-design', version: '0.1.0' });
        client.onerror = error => console.error('serial bridge error:', error.message);
        const transport = new StdioClientTransport({
          command,
          args,
          stderr: 'inherit',
          env: { ...process.env, ...env }
        });
        try {
          await client.connect(transport);
        } catch (error) {
          clientPromise = undefined; // allow a later retry
          throw new Error(
            `Could not start the serial MCP server (\`${command} ${args.join(' ')}\`). ` +
              `Build and install it from https://github.com/adancurusul/serial-mcp-server, ` +
              `or set SERIAL_MCP_COMMAND to the binary path. Cause: ${error.message}`
          );
        }
        return client;
      })();
    }
    return clientPromise;
  };

  /**
   * Discover upstream tools and register them on the target server.
   * The upstream list is cached, so registering onto a second (or thousandth)
   * server instance — as the stateless HTTP transport does per request — costs
   * no IPC round trip.
   */
  const register = async target => {
    const client = await connect();
    if (!cachedTools) {
      // Share one discovery round trip between concurrent first requests.
      readyPromise ??= client.listTools().then(result => {
        cachedTools = result.tools ?? [];
        return cachedTools;
      });
      await readyPromise;
    }
    const tools = cachedTools;

    for (const tool of tools) {
      const name = `${prefix}${tool.name}`;
      const category = LIFECYCLE_TOOLS.test(tool.name) ? 'session' : 'operation';
      const hints =
        category === 'session'
          ? ' Ports must be opened before use and closed afterwards.'
          : '';

      target.registerTool(name, {
        description: `[serial bridge] ${tool.description ?? tool.name}.${hints}`,
        inputSchema: shapeFromJsonSchema(tool.inputSchema),
        annotations: {
          readOnlyHint: tool.name === 'list_ports',
          openWorldHint: true
        }
      }, async args => {
        try {
          const result = await client.callTool({ name: tool.name, arguments: args });
          return {
            content: [{ type: 'text', text: contentToText(result.content) || '(no output)' }],
            ...(result.isError ? { isError: true } : {})
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Serial bridge call \`${tool.name}\` failed: ${error.message}` }],
            isError: true
          };
        }
      });
    }

    return tools.map(tool => `${prefix}${tool.name}`);
  };

  const close = async () => {
    if (!clientPromise) return;
    const client = await clientPromise.catch(() => undefined);
    clientPromise = undefined;
    readyPromise = undefined;
    await client?.close().catch(() => undefined);
  };

  return { connect, register, close, command, args, prefix };
}
