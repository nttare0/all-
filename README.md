# Interface Design Skill

A lightweight agent skill and MCP server for creating thoughtful digital interfaces with minimal, maintainable code.

The skill guides an agent through research, visual direction, implementation, usability, accessibility, and verification. It supports web, mobile, desktop, and cross-platform projects.

## What's included

- **[Design skill](skills/interface-design/SKILL.md)** — a practical workflow and Nielsen's 10 usability heuristics.
- **[Research index](skills/interface-design/references/research.md)** — selected official guidance and community references.
- **MCP server** — a design brief and a manual review checklist, available over stdio.

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

## MCP tools

- `design_brief` — creates a brief from a product, audience, goal, platform, and optional constraints.
- `design_review_checklist` — creates a manual checklist for a platform, optionally focused on hierarchy, accessibility, responsiveness, usability, safety, or simplicity.

Supported platforms are `web`, `mobile`, `desktop`, and `cross-platform`.

These tools provide guidance only: they do not browse, render, inspect code, or perform an accessibility audit. Use your agent's own tools to implement and test the interface. No API key is required.

## License

[MIT](LICENSE)
