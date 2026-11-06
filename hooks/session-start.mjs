// SessionStart hook: reminds you about drafts to approve, excerpts not yet drafted,
// and entries due for review. Also retries drafting for excerpts a failed worker left behind.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DIRS, ensureDirs, log, today, readFrontmatter, listMd, readStdinJson, isHeadless } from "./common.mjs";

const RETRY_AFTER_MS = 10 * 60 * 1000;
const MAX_RETRIES_PER_START = 3;

async function main() {
  if (process.env.LEARNING_LOG_CHILD) return;
  await readStdinJson();
  if (isHeadless()) return;
  ensureDirs();

  const drafts = listMd(DIRS.drafts);
  const pending = listMd(DIRS.pending);
  const t = today();
  const due = listMd(DIRS.entries).filter((f) => {
    const fm = readFrontmatter(f);
    return fm.status === "approved" && fm.review_due && fm.review_due <= t;
  });

  // Retry stale pending excerpts in the background (e.g. after `claude auth login`).
  if (!process.env.LEARNING_LOG_NO_WORKER) {
    const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.mjs");
    pending
      .filter((f) => Date.now() - fs.statSync(f).mtimeMs > RETRY_AFTER_MS)
      .slice(0, MAX_RETRIES_PER_START)
      .forEach((f) => {
        fs.utimesSync(f, new Date(), new Date()); // push back the next retry
        spawn(process.execPath, [worker, f], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
          env: { ...process.env, LEARNING_LOG_CHILD: "1" },
        }).unref();
        log(`retry ${path.basename(f)}`);
      });
  }

  const parts = [];
  if (drafts.length) parts.push(`${drafts.length} draft${drafts.length > 1 ? "s" : ""} to approve`);
  if (pending.length) parts.push(`${pending.length} session${pending.length > 1 ? "s" : ""} not drafted yet`);
  if (due.length) parts.push(`${due.length} entr${due.length > 1 ? "ies" : "y"} due for review`);
  if (!parts.length) return;

  const line = `Learning log: ${parts.join(", ")}. Run /learning-log:review`;
  process.stdout.write(
    JSON.stringify({
      systemMessage: line,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `${line}. In your first reply of this session, mention this once in one short line ` +
          `(e.g. "${line}."), then continue with the user's request. Do not start the review unless asked.`,
      },
    }),
  );
}

main().catch((e) => log(`session-start error: ${e?.stack || e}`)).finally(() => process.exit(0));
