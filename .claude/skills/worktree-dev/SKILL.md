---
name: worktree-dev
description: "Run the app or the Playwright suites from a T3/git worktree of this repo. Use before `pnpm dev`, `pnpm exec playwright test`, or playwright-cli verification in any checkout under ~/.t3/worktrees, or when the dev server loops on reload."
---

# Run from a worktree

Several worktrees of this repo run at once. They share ports, not files.

1. **Prepare the checkout once.** Run `pnpm install --frozen-lockfile && pnpm exec prisma generate && pnpm exec varlock codegen`. Never symlink `node_modules` from another checkout.
2. **Point at a database by absolute path.** Use `DATABASE_URL=file:/abs/path/to.db`. A relative `file:./...` path is resolved from wherever the process starts, which has pointed sessions at the wrong file. A new worktree has no `.env`, and `pnpm dev`, `pnpm build`, and `pnpm lint` refuse to start without `DATABASE_URL`, so pass it on the command line or write it to the worktree's `.env`.
3. **Pick a free port.** Check `lsof -nP -iTCP:<port> -sTCP:LISTEN` first. Port 3000 is often held by another worktree. Start the server detached (`nohup pnpm dev --port <port> > /tmp/<worktree>-dev.log 2>&1 &`), so a background-task time limit does not kill it.
4. **E2E suites.** Both serve the prebuilt `.output`, so run `pnpm build` first and again after every change. The stubbed suite binds 3000 and reuses any server already there. If another worktree holds 3000, the suite tests that worktree's code. Pick free ports and run `PLAYWRIGHT_STUBBED_PORT=<port> PLAYWRIGHT_INTEGRATED_PORT=<port> pnpm exec playwright test`. Do not write a temporary Playwright config.
5. **Reload loop or stale build.** Stop the server, `rm -rf node_modules/.vite`, and start `vp dev` again. For a stale e2e run, rebuild `.output` with `pnpm build`.
6. **After any dev-server or e2e run,** check `git status` and revert generated changes before you commit.
