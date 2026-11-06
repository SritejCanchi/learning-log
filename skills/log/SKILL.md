---
name: log
description: Save learnings, decisions and mistakes from the current conversation to the personal learning log right now, without waiting for the session to end. Use when the user runs /learning-log:log or says "log this", "save this learning", "add this to my log".
---

# Log now

The log is changed only through one script, so the user approves a single command once:

```
node "<this skill's base directory>/../../scripts/log.mjs" <command>
```

Below, `log` means that full command. Never write log files with Edit or Write.

## Steps

1. Read `ENTRY_FORMAT.md`, two folders up from this skill's base directory.
2. Draft one entry from this conversation in that format (TITLE, TAGS, then ## sections).
   If the user named a specific thing to log ("log the spawn fix"), focus on that; otherwise
   cover the whole conversation so far.
3. Show the draft compactly. Ask: save as is, or change something?
4. On approval, save it. Project = the working directory's folder name, or `scratch` for a
   desktop-app scratch workspace:

   ```
   log add --project <project> --cwd "<working directory>" <<'EOF'
   TITLE: ...
   TAGS: ...

   ## Learnings
   ...
   EOF
   ```

5. Repeat the script's one-line result (file name and first review date) to the user.

The automatic capture at session end skips titles already logged today for the same
project, so logging manually does not create duplicates.
