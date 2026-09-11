# pstack fork

The skills under `.claude/skills/poteto-mode/`, `.claude/skills/principle-*/`, and
several quality skills are a fork of [pstack](https://github.com/cursor/plugins/tree/main/pstack)
by Lauren Tan, MIT licensed. The license is kept verbatim at `docs/pstack-LICENSE`.

## Provenance

- Upstream: `cursor/plugins`, path `pstack/`
- Commit: `f5bdd6826fd0a0d9cbc4347134c3a74a200b9d9d` (2026-09-10)
- Plugin version at that commit: 0.15.2

## This is a fork, not a dependency

pstack is a Cursor plugin. Adapting it to Claude Code means editing prose inside the
skill bodies (model names mid-sentence, trigger lines pointing at Cursor built-ins),
so there is no clean seam for an overlay and no merge path back. Upstream changes are
worth re-reading for ideas. They are not worth merging.

The vendored snapshot and the adaptation are deliberately separate commits, so
`git diff` between them is the permanent record of what was changed and why.

## What was taken

- 21 of 23 principles. The two Delegation principles (`guard-the-context-window`,
  `never-block-on-the-human`) are about running agent fleets, which this repo does not do.
- `poteto-mode` and 9 of its 23 playbooks: bug-fix, feature, refactoring, investigation,
  perf-issue, multi-phase-plan, prototype, shipping, opening-a-pr.
- Quality and workflow skills: `how`, `unslop`, `no-comments`, `interrogate`, `blast-radius`,
  `arena`, `architect`, `why`, `technical-writing`, `create-verification-skill`, `figure-it-out`.
- Agents: `poteto-agent`, `comment-sicko`.

## What was dropped, and why

- **Parallelism.** `swarm`, `poteto-mode/scripts/` (Bun orchestration, watch-pr),
  and the autopilot/orchestrate/autonomous-run/babysit/hillclimb/session-pickup/
  pause-safely/worktree-cleanup playbooks. This repo is one person and one agent at a time.
- **Cursor-only runtime.** `setup-pstack` (writes a `.cursor/rules/*.mdc`), `automate-me`
  (mines Cursor transcripts), `make-bot-ui` (Cursor Bots), all of `automations/benny/`
  (Cursor Automations), and `poteto-mode/references/bugbot-triage.md`.
- **Already covered here.** `tdd` collides with an existing skill. `reflect`, `recall`,
  `teach`, `bro`, `maintain-verification-skill`, `typescript-best-practices`, and the
  eval/visual-parity/forensics/authoring-a-skill playbooks did not earn their place.
- **Unavailable.** `poteto-mode` routes to `deslop`, `control-cli`, and `control-ui`,
  which ship in the separate `cursor-team-kit` plugin. Those trigger lines are removed
  in the adaptation commit.
