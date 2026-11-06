---
name: review
description: Work through the personal learning log - turn captured sessions into drafts, approve or discard drafts, and quiz the user on entries due for spaced review. Use when the user runs /learning-log:review or says "review my log", "approve my drafts", "quiz me on my learnings".
---

# Review the learning log

All changes to the log go through one script, so the user approves a single command once
instead of a prompt for every file edit:

```
node "<this skill's base directory>/../../scripts/log.mjs" <command>
```

Below, `log` means that full command. Never edit or move log files with Edit, Write or
`mv`: use `log`. Reading files with Read is fine.

The entry format is in `ENTRY_FORMAT.md`, two folders up from this skill's base directory.

## Step 0: See what is waiting

Run `log list`. It prints the log folder and three groups: PENDING (captured sessions with
no draft yet), DRAFTS, and DUE FOR REVIEW. If all are empty, say so in one line and stop.

Work through items **one at a time**, in that order. Before each item, say where you are
("Draft 2 of 4"). Use the AskUserQuestion tool for choices when it is available; otherwise
ask in plain text. If the user says stop, stop and report what is left.

## Step 1: Draft pending excerpts

For each PENDING file: Read it (it is in `pending/` in the log folder) and `ENTRY_FORMAT.md`,
extract an entry, then save it:

```
log draft <file> <<'EOF'
TITLE: ...
TAGS: ...

## Learnings
...
EOF
```

If there is nothing worth logging, pipe `NOTHING_TO_LOG` instead.

## Step 2: Approve drafts

For each DRAFT, Read it from `drafts/` and show the title, project, date and a compact view of
its sections. Ask: **Approve**, **Edit**, or **Discard**.
- **Approve**: `log approve <file>`. It sets the first review for 14 days from now.
- **Edit**: write the changed body with `log update <file> <<'EOF' ... EOF`, show it, ask again.
- **Discard**: `log discard <file>`. It keeps the file in `drafts/.discarded/`.

## Step 3: Spaced review

For each DUE entry, Read it from `entries/`, then:
1. Show only the title and project, and ask its first quiz question. If it has no quiz, ask
   the user to recall the main learning. Do not show the answer yet.
2. After the user answers, show the stored answer and the entry's Mistakes section, and say
   briefly how their answer compares.
3. Ask for a recall score from 1 to 5 (1 = forgot, 5 = instant).
4. Run `log score <file> <score>`. It sets the next review date.

## Finish

One line: what was drafted, approved, discarded and reviewed, plus the next review date
(from a final `log list`).
