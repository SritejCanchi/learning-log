// Shared paths and helpers for the learning-log hooks.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DATA_DIR =
  process.env.LEARNING_LOG_DIR ||
  path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "learning-log");

export const DIRS = {
  drafts: path.join(DATA_DIR, "drafts"),
  pending: path.join(DATA_DIR, "pending"),
  entries: path.join(DATA_DIR, "entries"),
  state: path.join(DATA_DIR, ".state"),
  logs: path.join(DATA_DIR, ".logs"),
};

export function ensureDirs() {
  for (const d of Object.values(DIRS)) fs.mkdirSync(d, { recursive: true });
}

export function log(msg) {
  try {
    ensureDirs();
    fs.appendFileSync(path.join(DIRS.logs, "hooks.log"), `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

// Headless `claude -p` / SDK runs (scripts, CI) are not logged and get no reminder,
// unless LEARNING_LOG_INCLUDE_HEADLESS is set.
export function isHeadless() {
  if (process.env.LEARNING_LOG_INCLUDE_HEADLESS) return false;
  return process.env.CLAUDE_CODE_SESSION_ATTENDED === "0" || process.env.CLAUDE_CODE_ENTRYPOINT === "sdk-cli";
}

export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${today(d)}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function slug(s) {
  return (s || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "unknown";
}

// Project name from cwd; desktop-app scratch folders collapse to "scratch".
export function projectName(cwd) {
  if (!cwd) return "unknown";
  if (/scratch-workspaces[\\/]/i.test(cwd)) return "scratch";
  return path.basename(cwd.replace(/[\\/]+$/, ""));
}

// Minimal YAML-frontmatter reader: flat `key: value` pairs only.
export function readFrontmatter(file) {
  try {
    const txt = fs.readFileSync(file, "utf8");
    const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return {};
    const out = {};
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (kv) out[kv[1]] = kv[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function listMd(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
