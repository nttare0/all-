# Interface Design Skill

A lightweight agent skill and MCP server for creating thoughtful digital interfaces with minimal, maintainable code.

The skill guides an agent through research, visual direction, implementation, usability, accessibility, and verification. It supports web, mobile, desktop, and cross-platform projects.

## What's included

- **[Design skill](skills/interface-design/SKILL.md)** — a practical workflow and Nielsen's 10 usability heuristics.
- **[Research index](skills/interface-design/references/research.md)** — selected official guidance and community references.
- **MCP server** — a design brief and a manual review checklist, available over stdio or Streamable HTTP.

## Get started

Requires Node.js 18 or later.

```sh
npm ci
npm test
```

Copy the `skills/interface-design` folder into your agent's supported skills directory, or provide `SKILL.md` to the agent directly. Skill installation varies by client.

To connect the MCP server, add this entry to your client's MCP configuration, replacing the path with the absolute path to this repository:

```json
{
  "mcpServers": {
    "minimal-interface-design": {
      "command": "node",
      "args": ["/absolute/path/to/all-/src/index.js"]
    }
  }
}
```

Reload your client if needed. You can also run `npm start` to start the stdio server manually; it waits for an MCP client.

## HTTP transport

Run the same two tools as a network service instead of a spawned process:

```sh
npm run start:http
```

This starts a stateless Streamable HTTP endpoint at `http://localhost:3000/mcp` (and a `GET /healthz` probe). Clients that cannot spawn a process — hosted agents, web apps — connect to the URL:

```json
{
  "mcpServers": {
    "minimal-interface-design": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Configuration is via environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `MCP_AUTH_TOKEN` | unset | When set, requires `Authorization: Bearer <token>` |
| `ALLOWED_HOSTS` | unset | Comma-separated `Host` allowlist (DNS-rebinding protection) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated `Origin` allowlist; other origins get `403` |
| `MCP_JSON_RESPONSES` | unset | `1` returns plain JSON instead of an SSE stream |

The transport is stateless: a fresh server and transport handle each request, with no session IDs and no resumability. That keeps it portable to serverless platforms, but it means the server cannot push unsolicited messages to clients. Set `MCP_AUTH_TOKEN` before exposing the endpoint publicly. The tools return text guidance, so authentication is the only thing standing between the internet and this repo's advice output — not secrets, but not something to leave open either.

### Deploying to Vercel

The repository includes `api/mcp.js` and a `vercel.json` rewrite that sends every path to it, so `vercel deploy` produces `https://<project>.vercel.app/mcp`. Set `MCP_AUTH_TOKEN` in the project's environment variables before sharing the URL.

## MCP tools

- `design_brief` — creates a brief from a product, audience, goal, platform, and optional constraints.
- `design_review_checklist` — creates a manual checklist for a platform, optionally focused on hierarchy, accessibility, responsiveness, usability, safety, or simplicity.

Supported platforms are `web`, `mobile`, `desktop`, and `cross-platform`. Both transports are defined once in `src/server.js`, so they expose identical tools and schemas.

These tools provide guidance only: they do not browse, render, inspect code, or perform an accessibility audit. Use your agent's own tools to implement and test the interface. No API key is required.

## License

[MIT](LICENSE)
