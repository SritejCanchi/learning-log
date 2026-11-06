---
name: review
description: Work through the personal learning log - turn captured sessions into drafts, approve or discard drafts, and quiz the user on entries due for spaced review. Use when the user runs /learning-log:review or says "review my log", "approve my drafts", "quiz me on my learnings".
---

# Review the learning log

Data lives in `~/.claude/learning-log/` (or `$LEARNING_LOG_DIR` if set):

| Folder | Contains |
|---|---|
| `pending/` | Raw transcript excerpts captured at session end that have no draft yet |
| `drafts/` | Drafted entries waiting for approval |
| `drafts/.discarded/` | Drafts the user discarded (kept, not deleted) |
| `entries/` | Approved entries; the log itself |

The entry format is in `ENTRY_FORMAT.md`, two folders up from this skill's base directory.

Work through items **one at a time**. Before each item, say where you are
("Draft 2 of 4"). Use the AskUserQuestion tool for choices when it is available.
If the user says stop at any point, stop and report what is left.

## Step 1: Draft pending excerpts

For each file in `pending/` (oldest first):
1. Read it and `ENTRY_FORMAT.md`. Extract an entry from the excerpt.
2. If there is nothing worth logging, delete the pending file and say so in one line.
3. Otherwise write the full entry (frontmatter from the pending file's `session`, `project`,
   `cwd`, `source`; `status: draft`) to `drafts/` with the same file name, then delete the
   pending file.

## Step 2: Approve drafts

For each file in `drafts/` (oldest first), show the title, project, date and a compact view
of its sections. Ask: **Approve**, **Edit**, or **Discard**.
- **Approve**: set `status: approved`, `review_due` = today + 14 days, then move the file
  to `entries/`.
- **Edit**: apply the user's changes, show the result, ask again.
- **Discard**: move the file to `drafts/.discarded/`. Never delete drafts.

## Step 3: Spaced review

Due entries: files in `entries/` with `status: approved` and `review_due` on or before today.
For each one:
1. Show only the title and project, then ask its first quiz question. If it has no quiz,
   ask the user to recall the main learning.
2. After the user answers, show the stored answer and the entry's Mistakes section.
3. Ask the user to score their recall from 1 to 5 (1 = forgot, 5 = instant).
4. Update the frontmatter: `last_reviewed` = today, `review_score` = the score,
   `reviews` + 1, and `review_due`:
   - score 1-2: today + 3 days
   - score 3: today + 14 days
   - score 4-5: today + 14 × 2^(reviews before this one) days, max 180

## Finish

One line: what was drafted, approved, discarded and reviewed, plus the next review date
(the earliest `review_due` in `entries/`).
