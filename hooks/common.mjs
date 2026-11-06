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

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return today(new Date(y, m - 1, d + n));
}

// Parse a drafter body ("TITLE: ...", "TAGS: ...", then ## sections).
// Returns null for NOTHING_TO_LOG; throws if there are no sections.
export function parseBody(out) {
  if (/^\s*NOTHING_TO_LOG\s*$/.test(out)) return null;
  const title = (out.match(/^TITLE:\s*(.+)$/m)?.[1] || "Untitled session").trim().replace(/\r?\n/g, " ");
  const tags = (out.match(/^TAGS:\s*(.+)$/m)?.[1] || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const sections = out.replace(/^TITLE:.*$/m, "").replace(/^TAGS:.*$/m, "").replace(/^# .*$/m, "").trim();
  if (!/^## /m.test(sections)) throw new Error(`no "## " sections in body: ${out.slice(0, 200)}`);
  return { title, tags, sections };
}

export function buildEntry(meta, { title, tags, sections }) {
  return [
    "---",
    `title: ${title}`,
    `date: ${meta.date || today()}`,
    `project: ${meta.project || "unknown"}`,
    `cwd: ${meta.cwd || ""}`,
    `session: ${meta.session || ""}`,
    `source: ${meta.source || "manual"}`,
    `tags: [${tags.join(", ")}]`,
    `status: ${meta.status || "draft"}`,
    `review_due: ${meta.review_due || ""}`,
    `last_reviewed: ${meta.last_reviewed || ""}`,
    `review_score: ${meta.review_score || ""}`,
    `reviews: ${meta.reviews || 0}`,
    "---",
    "",
    `# ${title}`,
    "",
    sections,
    "",
  ].join("\n");
}

// Set flat frontmatter fields in an entry's text.
export function setFields(text, fields) {
  return text.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (all, body) => {
    let b = body;
    for (const [k, v] of Object.entries(fields)) {
      const re = new RegExp(`^${k}:.*$`, "m");
      b = re.test(b) ? b.replace(re, `${k}: ${v}`) : `${b}\n${k}: ${v}`;
    }
    return `---\n${b}\n---`;
  });
}

export async function readStdinText() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
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
