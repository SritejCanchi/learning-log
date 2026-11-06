---
title: Building an auto-capture learning log plugin
date: 2026-11-05
project: learning-log
cwd: ~/projects/learning-log
session: 451bad88-0000-0000-0000-000000000000
source: auto (SessionEnd)
tags: [claude-code, hooks, plugins, learning-log, windows]
status: approved
review_due: 2026-11-19
last_reviewed:
review_score:
reviews: 0
---

# Building an auto-capture learning log plugin

## Learnings
- Existing Claude logging repos split along one axis: automatic capture (nathanonn, coleam00/claude-memory-compiler, chrismbryant/claude-journal-mcp) versus structured review (swastij's `/log` with Notion, melodykoh/learning-loop-skill). None combined auto-capture, a dedicated mistakes category and a spaced-review schedule.
- A manual `/log` skill loses an entry whenever you forget to run it. Hooks on SessionEnd and PreCompact remove that dependence.
- Splitting the work into two stages makes the hook reliable. The hook only copies the new transcript excerpt into `pending/`, which is local and cannot fail. A detached headless `claude -p` worker then drafts the entry, and if that fails the excerpt stays in `pending/`.
- Headless `claude -p` called from a hook authenticates separately from the desktop app. The desktop app keeps its own login, so a session can work while the standalone CLI login has expired. `claude auth login` in a terminal fixes it.
- The desktop app sets Claude-related env vars that can change how a spawned `claude` authenticates. When testing the headless call, compare running it with those vars removed against running it with them inherited.
- Capture is idempotent: running it a second time on the same transcript skipped the excerpt rather than creating a duplicate.
- `claude plugin validate` checks the manifest, hooks and skills. It is a quick check before installing a local plugin.
- A local plugin needs its own `marketplace.json` to be installed through `claude plugin marketplace add`, the same way the `i-have-adhd` plugin ships one.

## Decisions
- **Store the log as local Markdown in `~/.claude/learning-log/entries/`**: it works offline, needs no token and is searchable in any editor. Rejected: Notion via swastij's script and template, because it adds about 20 minutes of setup (token, template) for database views that were not needed.
- **Auto-draft, then human approval**: a hook drafts, and the next session start reports "N drafts to approve", so nothing depends on remembering. Rejected: saving drafts straight to the final log, because unreviewed LLM output would pollute it. Rejected: manual `/log` only, because forgotten entries are lost.
- **Build a custom plugin**: no existing repo had all three features. Rejected: installing coleam00/claude-memory-compiler, which has no mistakes category, no review schedule and probably per-project logs.
- **Review schedule of 14 days after approval, then intervals driven by a 1-5 recall score**: this copies swastij's review idea.

## Mistakes
- **What happened:** The first hook test failed with `sed: unterminated 's' command`, and the log files were not found. **Cause:** The test was an inline shell command with nested quoting, run through Bash on Windows with long `/c/Users/...` paths. **Next time:** Write the JSON payload and the runner to a small script file (like `run-hook.mjs`) instead of quoting it inline.
- **What happened:** The headless drafting call failed to authenticate while the main session worked fine. **Cause:** The standalone CLI login had expired, and it is separate from the desktop app's login. **Next time:** Test a trivial `claude -p` call first when building anything that spawns a headless Claude, and say up front that a separate login may be needed.
- **What happened:** The first comparison recommended swastij's `/log` without noticing that it is manual, and the user had to point that out. **Cause:** The comparison weighed features and did not ask how reliably capture happens. **Next time:** When recommending a logging tool, check early whether capture is automatic, since a forgotten step means lost data.

## Quiz
- **Q:** Why does the capture hook only copy the excerpt to `pending/` and leave drafting to a detached worker?
  **A:** Copying is local and cannot fail, so no session is lost. Drafting needs a headless `claude -p` call that depends on auth and the network. If it fails, the excerpt stays in `pending/` and `/learning-log:review` can draft it later.
- **Q:** Why might a headless `claude -p` call from a hook fail even when the desktop session works?
  **A:** The standalone CLI keeps its own login, separate from the desktop app's, and it can expire. Run `claude auth login` in a terminal.
