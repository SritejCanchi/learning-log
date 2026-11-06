// Detached worker: turns one pending/ excerpt into a drafts/ entry via headless `claude -p`.
// On any failure the pending file is left in place for /learning-log:review to handle.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DIRS, ensureDirs, log, today, readFrontmatter, listMd, parseBody, buildEntry } from "./common.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = process.env.LEARNING_LOG_MODEL || "sonnet";
const CLAUDE = process.env.LEARNING_LOG_CLAUDE || "claude";
const TIMEOUT_MS = 6 * 60 * 1000;

function runClaude(prompt) {
  // Clean env: drop the parent session's CLAUDE* variables (desktop sockets, session ids)
  // so the child is a plain standalone CLI call. Keep LEARNING_LOG_CHILD so its own hooks no-op.
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^CLAUDE/.test(k) && k !== "CLAUDE_CONFIG_DIR") continue;
    env[k] = v;
  }
  env.LEARNING_LOG_CHILD = "1";
  const cmd = `${CLAUDE} -p --model ${MODEL} --no-session-persistence --strict-mcp-config --tools ""`;
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, { shell: true, windowsHide: true, env, cwd: DIRS.state });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error("timeout"));
    }, TIMEOUT_MS);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`exit ${code}: ${(err || out).trim().slice(0, 300)}`));
    });
    p.stdin.end(prompt);
  });
}

function alreadyLogged(project) {
  // Titles logged today for the same project, so the drafter does not repeat them.
  const t = today();
  return [...listMd(DIRS.entries), ...listMd(DIRS.drafts)]
    .map((f) => readFrontmatter(f))
    .filter((fm) => fm.project === project && fm.date === t && fm.title)
    .map((fm) => `- ${fm.title}`)
    .join("\n");
}

async function main() {
  const pendingFile = process.argv[2];
  if (!pendingFile || !fs.existsSync(pendingFile)) return;
  ensureDirs();
  const fm = readFrontmatter(pendingFile);
  const body = fs.readFileSync(pendingFile, "utf8").replace(/^---[\s\S]*?\n---\r?\n/, "");
  const format = fs.readFileSync(path.join(ROOT, "ENTRY_FORMAT.md"), "utf8");
  const seen = alreadyLogged(fm.project);

  const prompt = [
    "Follow these instructions exactly. Output only the entry body, or NOTHING_TO_LOG.",
    "",
    format,
    seen ? `\n## Already logged today for this project (do not repeat these)\n${seen}\n` : "",
    `\n## Session to extract from (project: ${fm.project})\n`,
    body,
  ].join("\n");

  const out = await runClaude(prompt);
  const parsed = parseBody(out);
  if (!parsed) {
    fs.unlinkSync(pendingFile);
    log(`nothing to log: ${path.basename(pendingFile)}`);
    return;
  }
  const meta = { project: fm.project, cwd: fm.cwd, session: fm.session, source: fm.source, status: "draft" };
  fs.writeFileSync(path.join(DIRS.drafts, path.basename(pendingFile)), buildEntry(meta, parsed));
  fs.unlinkSync(pendingFile);
  log(`drafted ${path.basename(pendingFile)}: ${parsed.title}`);
}

main()
  .catch((e) => log(`worker failed (excerpt kept in pending/): ${e?.message || e}`))
  .finally(() => process.exit(0));
