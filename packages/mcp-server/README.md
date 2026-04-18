# @littlecolorbook/mcp-server

Exposes the LittleColorBook Phase 4 agent control plane as native MCP tools for Claude Desktop and any other MCP-aware client.

Instead of shelling out to curl, Claude can call `get_agent_context`, `propose_action`, `execute_proposal`, `list_journal`, `approve_proposal`, and `reject_proposal` as first-class tools — getting structured JSON back with full type context.

The server is a thin HTTP forwarder. All business logic, database access, and Meta API calls remain inside the existing Next.js routes. The MCP server has no direct DB or Meta access.

---

## Quick start (local path)

Build the server once:

```bash
cd packages/mcp-server
npm install
npm run build
```

Then add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "littlecolorbook-growth": {
      "command": "node",
      "args": ["C:/Users/hands/littlecoloringbook/packages/mcp-server/dist/index.js"],
      "env": {
        "AGENT_API_BASE_URL": "https://littlecolorbook.com",
        "AGENT_API_KEY": "your-agent-api-key-here"
      }
    }
  }
}
```

`claude_desktop_config.json` lives at:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AGENT_API_KEY` | Yes | — | Forwarded as `X-Agent-Key`. Copy from Vercel env. |
| `AGENT_API_BASE_URL` | No | `https://littlecolorbook.com` | Override for local dev (e.g. `http://localhost:3000`). |

---

## Tool reference

| Tool | HTTP | Description |
|---|---|---|
| `get_agent_context` | `GET /api/agent/context` | Full ad system snapshot: campaigns, ads with flags, performers, budget utilization, recent proposals and journal. |
| `propose_action` | `POST /api/agent/propose` | Submit a typed proposal (pause_ad, scale_budget, duplicate_to_scaling_campaign, request_creative, update_targeting, update_audience, report_insight, flag_risk). |
| `execute_proposal` | `POST /api/agent/execute/:id` | Execute an approved proposal. Triggers the Meta API call. |
| `list_journal` | `GET /api/agent/journal` | Read journal entries with optional filters: kind, limit, offset, relatedProposalId. |
| `approve_proposal` | `POST /api/agent/approve/:id` | Admin: approve a pending proposal. Requires adminEmail in ADMIN_EMAILS. |
| `reject_proposal` | `POST /api/agent/reject/:id` | Admin: reject a pending or approved proposal. Requires adminEmail in ADMIN_EMAILS. |

---

## Debugging with MCP Inspector

```bash
# From the packages/mcp-server directory
npx @modelcontextprotocol/inspector node dist/index.js
```

Set the env vars in the Inspector UI or pass them via shell:

```bash
AGENT_API_KEY=your-key AGENT_API_BASE_URL=http://localhost:3000 \
  npx @modelcontextprotocol/inspector node dist/index.js
```

The Inspector opens a browser UI where you can call each tool interactively and inspect the raw JSON-RPC traffic.

---

## Local dev against Next.js dev server

```json
{
  "mcpServers": {
    "littlecolorbook-dev": {
      "command": "node",
      "args": ["C:/Users/hands/littlecoloringbook/packages/mcp-server/dist/index.js"],
      "env": {
        "AGENT_API_BASE_URL": "http://localhost:3000",
        "AGENT_API_KEY": "your-local-agent-key"
      }
    }
  }
}
```

---

## Development

```bash
npm run build      # compile TypeScript to dist/
npm run typecheck  # type-check only (no output)
npm run test       # run smoke tests with vitest
```
