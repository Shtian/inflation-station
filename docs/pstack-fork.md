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
- `poteto-mode` and 8 of its 23 playbooks: bug-fix, feature, refactoring, investigation,
  perf-issue, prototype, shipping, opening-a-pr.
- Quality and workflow skills: `how`, `unslop`, `no-comments`, `interrogate`, `blast-radius`,
  `arena`, `architect`, `why`, `technical-writing`, `create-verification-skill`, `figure-it-out`.
- Agents: `poteto-agent`, `comment-sicko`.

## What was dropped, and why

- **Parallelism.** `swarm`, `poteto-mode/scripts/` (Bun orchestration, watch-pr),
  and the autopilot/orchestrate/autonomous-run/babysit/hillclimb/session-pickup/
  pause-safely/worktree-cleanup playbooks. This repo is one person and one agent at a time.
  `multi-phase-plan` went the same way during adaptation. Its premise is spawning one
  owner agent per PR and verifying each with ten swarm lanes on cloud VMs driven by
  `control-ui`. Nothing recognisable survives removing that, so it was dropped rather
  than rewritten into something upstream never wrote.
- **Cursor-only runtime.** `setup-pstack` (writes a `.cursor/rules/*.mdc`), `automate-me`
  (mines Cursor transcripts), `make-bot-ui` (Cursor Bots), all of `automations/benny/`
  (Cursor Automations), and `poteto-mode/references/bugbot-triage.md`.
- **Already covered here.** `tdd` collides with an existing skill. `reflect`, `recall`,
  `teach`, `bro`, `maintain-verification-skill`, `typescript-best-practices`, and the
  eval/visual-parity/forensics/authoring-a-skill playbooks did not earn their place.
- **Unavailable.** `poteto-mode` routes to `deslop`, `control-cli`, and `control-ui`,
  which ship in the separate `cursor-team-kit` plugin. Those trigger lines are removed
  in the adaptation commit.

## Adaptations applied

Everything below is the diff between the snapshot commit and its successor.

- **Models.** All Cursor slugs removed. A model is pinned only where a second opinion is
  the deliverable: `interrogate`, `arena`, `architect`, and `why` run `opus` as the
  judgment voice and `sonnet` as the second. Code delegates omit `model` and inherit.
- **Tools.** `AskQuestion` to `AskUserQuestion`, `Task` to `Agent`, `subagent_type:
  generalPurpose` to `general-purpose`. Cursor's `readonly: true` has no Claude Code
  equivalent, so those became explicit "do not modify files" instructions. Read-only
  fan-out uses the built-in `Explore` subagent.
- **Frontmatter.** Dropped `mode`, `icon`, `color`, `reminder`, and `is_background`,
  none of which Claude Code reads. `reminder` is how Cursor makes poteto-mode
  self-invoking; the replacement is the routing rule in `AGENTS.md`.
- **Dropped skills that were still referenced.** `deslop`, `control-ui`, `control-cli`
  (all `cursor-team-kit`), Cursor's built-in `create-skill` (now
  `example-skills:skill-creator`), Bugbot triage, and the Babysit playbook.
- **Forge.** `gh` only. Origin CLI branches removed throughout.
- **Paths.** `.cursor/skills/` to `.claude/skills/`, and `~/.cursor/rules/pstack-models.mdc`
  removed entirely since model roles are hardcoded here.
