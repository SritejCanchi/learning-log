# Learning-log entry format

Used by the background drafter (hooks/worker.mjs) and by the /learning-log:log and
/learning-log:review skills, so every entry looks the same.

## What to extract

You are reading a work session between a developer and Claude. Extract what is worth
remembering a month from now:

- **Learnings**: how something actually works, surprises, gotchas, techniques. Describe the
  mechanism, not the diff. "X fails on Windows because Node 24 refuses to spawn .cmd
  files without a shell", not "fixed spawn call".
- **Decisions**: choices made, with the reason and the alternatives rejected.
- **Mistakes**: things that went wrong or wasted time, made by the developer or by Claude:
  wrong assumptions, dead ends, missed steps, questions that should have been asked
  earlier. Give the cause and what to do next time.
- **Quiz**: 1 to 3 questions that test the most important learning, answerable from
  memory later.

Rules:
- Be specific: name the tool, file, command, error message or setting.
- Skip routine work, chit-chat and anything already obvious.
- Omit a section that has nothing real in it. Never pad.
- If the session has nothing worth remembering, output exactly `NOTHING_TO_LOG` and nothing else.

## Output shape (body only, no frontmatter)

```
TITLE: <short title, max 8 words>
TAGS: <2 to 5 lowercase tags, comma separated>

## Learnings
- ...

## Decisions
- **<decision>**: <why>. Rejected: <alternatives and why not>.

## Mistakes
- **What happened:** ... **Cause:** ... **Next time:** ...

## Quiz
- **Q:** ...
  **A:** ...
```

## Full entry file (what lands in drafts/ and entries/)

```
---
title: <title>
date: YYYY-MM-DD
project: <project folder name>
cwd: <working directory>
session: <session id, if known>
source: auto (SessionEnd) | auto (PreCompact) | manual
tags: [tag1, tag2]
status: draft | approved
review_due: YYYY-MM-DD        # empty while draft; approval sets today + 14 days
last_reviewed:
review_score:                 # 1-5, from the last review
reviews: 0
---

# <title>

## Learnings
...
```
