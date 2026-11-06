// SessionEnd / PreCompact hook.
// 1. Condenses the not-yet-captured part of the transcript into pending/<file>.md
//    (synchronous and local, so nothing is lost even if the next step fails).
// 2. Spawns a detached worker that turns the pending excerpt into a draft entry
//    with a headless `claude -p` call. If that fails, the excerpt stays in
//    pending/ and /learning-log:review drafts it inside a live session.
// Never blocks or fails the session: every error path exits 0.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DIRS, ensureDirs, log, stamp, slug, projectName, readStdinJson, isHeadless } from "./common.mjs";

const MIN_CHARS = 2500; // below this, the new part of the session is too small to log
const HEAD_CHARS = 15000;
const TAIL_CHARS = 65000;

function stripNoise(s) {
  return s
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, "[ran $1]")
    .replace(/<local-command-std(out|err)>[\s\S]*?<\/local-command-std\1>/g, "")
    .trim();
}

function toolSummary(t) {
  const i = t.input || {};
  const what = i.description || i.command || i.file_path || i.path || i.url || i.query || i.pattern || i.skill || "";
  return `[tool ${t.name}${what ? ": " + String(what).replace(/\s+/g, " ").slice(0, 140) : ""}]`;
}

function condense(lines) {
  const out = [];
  for (const line of lines) {
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.isSidechain || o.isMeta || !o.message) continue;
    const c = o.message.content;
    if (o.type === "user") {
      if (typeof c === "string") {
        const t = stripNoise(c);
        if (t) out.push(`USER: ${t}`);
      } else if (Array.isArray(c)) {
        for (const part of c) {
          if (part.type === "text") {
            const t = stripNoise(part.text || "");
            if (t) out.push(`USER: ${t}`);
          } else if (part.type === "tool_result" && part.is_error) {
            const txt = Array.isArray(part.content)
              ? part.content.map((x) => x.text || "").join(" ")
              : String(part.content || "");
            out.push(`TOOL ERROR: ${txt.replace(/\s+/g, " ").slice(0, 400)}`);
          }
        }
      }
    } else if (o.type === "assistant" && Array.isArray(c)) {
      for (const part of c) {
        if (part.type === "text" && part.text?.trim()) out.push(`ASSISTANT: ${part.text.trim()}`);
        else if (part.type === "tool_use") out.push(toolSummary(part));
      }
    }
  }
  let text = out.join("\n\n");
  if (text.length > HEAD_CHARS + TAIL_CHARS) {
    text = text.slice(0, HEAD_CHARS) + "\n\n[... middle of session omitted ...]\n\n" + text.slice(-TAIL_CHARS);
  }
  return text;
}

async function main() {
  if (process.env.LEARNING_LOG_CHILD) return; // our own headless drafting call
  const input = await readStdinJson();
  if (isHeadless()) return;
  const { session_id: sid, transcript_path: tp, cwd, hook_event_name: event } = input;
  if (!sid || !tp || !fs.existsSync(tp)) return;
  ensureDirs();

  const stateFile = path.join(DIRS.state, `${sid}.json`);
  let state = { processedLines: 0 };
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {}

  const all = fs.readFileSync(tp, "utf8").split("\n").filter(Boolean);
  const fresh = all.slice(state.processedLines);
  const text = condense(fresh);
  if (text.length < MIN_CHARS) {
    log(`skip ${sid} ${event}: only ${text.length} new chars`);
    return; // keep the offset so this part is included next time
  }

  const project = projectName(cwd);
  const name = `${stamp()}_${slug(project)}_${sid.slice(0, 8)}.md`;
  const pendingFile = path.join(DIRS.pending, name);
  const fm = [
    "---",
    `session: ${sid}`,
    `project: ${project}`,
    `cwd: ${cwd || ""}`,
    `source: auto (${event})`,
    `captured: ${new Date().toISOString()}`,
    `lines: ${state.processedLines + 1}-${all.length}`,
    "status: pending",
    "---",
    "",
    "## Transcript excerpt",
    "",
  ].join("\n");
  fs.writeFileSync(pendingFile, fm + text + "\n");
  fs.writeFileSync(stateFile, JSON.stringify({ processedLines: all.length, updated: new Date().toISOString() }));
  log(`pending ${name} (${text.length} chars, ${event})`);

  if (process.env.LEARNING_LOG_NO_WORKER) return;
  const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.mjs");
  const child = spawn(process.execPath, [worker, pendingFile], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, LEARNING_LOG_CHILD: "1" },
  });
  child.unref();
}

main().catch((e) => log(`capture error: ${e?.stack || e}`)).finally(() => process.exit(0));
