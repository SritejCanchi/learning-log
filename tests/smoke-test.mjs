// End-to-end smoke test for the hooks. No network, no real Claude call.
// Run: node tests/smoke-test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = path.join(ROOT, "hooks");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "learning-log-test-"));
const dataDir = path.join(tmp, "data");
const transcript = path.join(tmp, "session.jsonl");
const SID = "11111111-2222-3333-4444-555555555555";

const baseEnv = { ...process.env, LEARNING_LOG_DIR: dataDir, CLAUDE_CODE_SESSION_ATTENDED: "1", CLAUDE_CODE_ENTRYPOINT: "cli" };
delete baseEnv.LEARNING_LOG_CHILD;
delete baseEnv.LEARNING_LOG_INCLUDE_HEADLESS;

function hook(script, event, env = {}) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, script)], {
    input: JSON.stringify({ session_id: SID, transcript_path: transcript, cwd: path.join(tmp, "my-app"), hook_event_name: event }),
    encoding: "utf8",
    env: { ...baseEnv, LEARNING_LOG_NO_WORKER: "1", ...env },
  });
  assert.equal(r.status, 0, `${script} exited ${r.status}: ${r.stderr}`);
  return r.stdout;
}

function worker(file, mode) {
  const fake = `"${process.execPath}" "${path.join(ROOT, "tests", "fake-claude.mjs")}"`;
  const r = spawnSync(process.execPath, [path.join(HOOKS, "worker.mjs"), file], {
    encoding: "utf8",
    env: { ...baseEnv, LEARNING_LOG_CLAUDE: fake, FAKE_MODE: mode },
  });
  assert.equal(r.status, 0);
}

const ls = (d) => (fs.existsSync(path.join(dataDir, d)) ? fs.readdirSync(path.join(dataDir, d)).filter((f) => f.endsWith(".md")) : []);
const line = (o) => JSON.stringify(o) + "\n";
const filler = "We traced the failing upload to a 503 from the API under load. ".repeat(30);

function writeTranscript(extra = "") {
  fs.writeFileSync(
    transcript,
    line({ type: "user", message: { role: "user", content: "<system-reminder>SECRET-NOISE</system-reminder>Why do uploads fail?" } }) +
      line({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: filler }, { type: "tool_use", name: "Bash", input: { description: "Run upload test" } }] } }) +
      line({ type: "user", message: { role: "user", content: [{ type: "tool_result", is_error: true, content: "Error: 503 Service Unavailable" }] } }) +
      line({ type: "user", isMeta: true, message: { role: "user", content: "META-NOISE" } }) +
      line({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: filler }] } }) +
      extra,
  );
}

let step = 0;
const ok = (name) => console.log(`ok ${++step} - ${name}`);

// 1. Capture writes a pending excerpt with noise stripped.
writeTranscript();
hook("capture.mjs", "SessionEnd");
const [pendingName] = ls("pending");
assert.ok(pendingName, "pending excerpt written");
const pending = fs.readFileSync(path.join(dataDir, "pending", pendingName), "utf8");
assert.match(pending, /project: my-app/);
assert.match(pending, /TOOL ERROR: Error: 503/);
assert.match(pending, /\[tool Bash: Run upload test\]/);
assert.doesNotMatch(pending, /SECRET-NOISE|META-NOISE/);
ok("capture writes a clean pending excerpt");

// 2. Capturing again with no new lines does nothing.
hook("capture.mjs", "SessionEnd");
assert.equal(ls("pending").length, 1);
ok("capture is idempotent");

// 3. Failed drafting keeps the excerpt.
worker(path.join(dataDir, "pending", pendingName), "fail");
assert.equal(ls("pending").length, 1);
assert.equal(ls("drafts").length, 0);
ok("failed draft keeps the pending excerpt");

// 4. Successful drafting writes a draft and removes the excerpt.
worker(path.join(dataDir, "pending", pendingName), "entry");
assert.equal(ls("pending").length, 0);
const [draftName] = ls("drafts");
const draft = fs.readFileSync(path.join(dataDir, "drafts", draftName), "utf8");
assert.match(draft, /title: Retry flaky uploads with backoff/);
assert.match(draft, /tags: \[http, retries\]/);
assert.match(draft, /status: draft/);
assert.match(draft, /## Mistakes/);
ok("worker turns the excerpt into a draft");

// 5. New activity in the same session is captured; NOTHING_TO_LOG discards it.
writeTranscript(line({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: filler }] } }));
fs.appendFileSync(transcript, line({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: filler + filler }] } }));
hook("capture.mjs", "PreCompact");
const [second] = ls("pending");
assert.ok(second, "second excerpt for new lines");
worker(path.join(dataDir, "pending", second), "nothing");
assert.equal(ls("pending").length, 0);
assert.equal(ls("drafts").length, 1);
ok("only new lines are captured, and NOTHING_TO_LOG discards them");

// 6. Session start reminds about drafts and due reviews.
fs.mkdirSync(path.join(dataDir, "entries"), { recursive: true });
fs.writeFileSync(path.join(dataDir, "entries", "old.md"), "---\ntitle: Old\nstatus: approved\nreview_due: 2000-01-01\n---\n");
const out = JSON.parse(hook("session-start.mjs", "SessionStart"));
assert.match(out.systemMessage, /1 draft to approve/);
assert.match(out.systemMessage, /1 entry due for review/);
ok("session start reports drafts and due reviews");

// 7. Headless runs are ignored.
const headless = { CLAUDE_CODE_SESSION_ATTENDED: "0", CLAUDE_CODE_ENTRYPOINT: "sdk-cli" };
assert.equal(hook("session-start.mjs", "SessionStart", headless), "");
fs.appendFileSync(transcript, line({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: filler + filler }] } }));
hook("capture.mjs", "SessionEnd", headless);
assert.equal(ls("pending").length, 0);
ok("headless claude -p runs are not logged and get no reminder");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nall ${step} checks passed`);
