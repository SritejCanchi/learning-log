---
name: log
description: Save learnings, decisions and mistakes from the current conversation to the personal learning log right now, without waiting for the session to end. Use when the user runs /learning-log:log or says "log this", "save this learning", "add this to my log".
---

# Log now

The learning log lives in `~/.claude/learning-log/` (or `$LEARNING_LOG_DIR` if set).
Entries are Markdown files in `entries/`. The exact entry format is in `ENTRY_FORMAT.md`,
two folders up from this skill's base directory. Read it first.

## Steps

1. Read `ENTRY_FORMAT.md`.
2. Draft one entry from this conversation, following that format. If the user named a
   specific thing to log ("log the spawn fix"), focus on that; otherwise cover the whole
   conversation so far. Project = the working directory's folder name, or `scratch` if it is
   a desktop-app scratch workspace.
3. Show the draft to the user, compactly. Ask: save as is, or change something?
4. On approval, write it to `entries/<YYYY-MM-DD_HHMMSS>_<project>_manual.md` with the full
   frontmatter from `ENTRY_FORMAT.md`: `source: manual`, `status: approved`,
   `review_due` = today + 14 days, `reviews: 0`. Create the folder if it does not exist.
5. Confirm in one line with the file name and the review date.

The automatic capture at session end skips titles already logged today for the same
project, so logging manually does not create duplicates.
