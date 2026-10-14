# Query your data from Claude (MCP server)

`scripts/mcp-server.ts` is a local MCP server that lets Claude Code or Claude Desktop answer questions about your transactions. It runs over stdio, reads the database in `DATABASE_URL`, and never writes to it.

It exposes five tools:

- `summarizeSpending` totals spend between two days, grouped by category, merchant, month, or account. Transfers and incoming amounts are left out.
- `searchTransactions` finds individual transactions, at most 100 per call.
- `getMonthInReview` returns the same month facts the monthly review shows.
- `listCategories` and `listAccounts` return ids for the filters.

Days are local calendar days (`YYYY-MM-DD`). Amounts are NOK.

## Claude Code

Run this from the repo root:

```bash
claude mcp add inflation-station -- pnpm tsx scripts/mcp-server.ts
```

The server is added for this project only, so it is available when you start `claude` in this folder. It uses `prisma/dev.db` unless `DATABASE_URL` is set in your shell.

To use it from any folder, add it with user scope and an absolute repo path:

```bash
claude mcp add --scope user inflation-station -- pnpm --dir /abs/path/to/inflation-station exec tsx scripts/mcp-server.ts
```

## Claude Desktop

Claude Desktop starts the server from an unknown folder with a minimal `PATH`, so every path must be absolute. `pnpm` also starts `node` through `PATH`, so set `PATH` to the folder that holds both. Use a stable folder. With fnm, `which pnpm` prints a per-shell path that disappears when the shell closes, so use `~/.local/share/fnm/aliases/default/bin` instead.

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS:

```json
{
  "mcpServers": {
    "inflation-station": {
      "command": "/absolute/path/to/node-bin/pnpm",
      "args": [
        "--dir",
        "/abs/path/to/inflation-station",
        "exec",
        "tsx",
        "scripts/mcp-server.ts"
      ],
      "env": {
        "DATABASE_URL": "file:/abs/path/to/inflation-station/prisma/dev.db",
        "PATH": "/absolute/path/to/node-bin:/usr/bin:/bin"
      }
    }
  }
}
```

Set `DATABASE_URL` explicitly. The default is the relative `file:./prisma/dev.db`, and Prisma does not load `.env`. On a self-hosted install, point it at the same file as the app's `.env`.

Restart Claude Desktop after you change the file.
