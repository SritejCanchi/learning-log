#!/usr/bin/env node
// learning-log CLI. The skills change the log only through this script, so users approve
// one command once instead of a permission prompt for every file edit under ~/.claude/.
//
//   node log.mjs list
//   node log.mjs draft <pending-file>      stdin: entry body (TITLE/TAGS/## sections) or NOTHING_TO_LOG
//   node log.mjs approve <draft-file>
//   node log.mjs discard <draft-file>
//   node log.mjs update <draft-or-entry>   stdin: replacement entry body
//   node log.mjs add --project P [--cwd C] [--session S]   stdin: entry body; saved as approved
//   node log.mjs score <entry-file> <1-5>
//
// File arguments can be full paths or bare file names.
import fs from "node:fs";
import path from "node:path";
import {
  DATA_DIR, DIRS, ensureDirs, today, stamp, slug, addDays, listMd, readFrontmatter,
  parseBody, buildEntry, setFields, readStdinText,
} from "../hooks/common.mjs";

const FIRST_REVIEW_DAYS = 14;

function resolve(arg, ...dirs) {
  if (!arg) fail("missing file argument");
  if (fs.existsSync(arg)) return arg;
  for (const d of dirs) {
    const p = path.join(d, path.basename(arg));
    if (fs.existsSync(p)) return p;
  }
  fail(`not found: ${arg}`);
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function nextInterval(score, reviewsBefore) {
  if (score <= 2) return 3;
  if (score === 3) return 14;
  return Math.min(180, 14 * 2 ** reviewsBefore);
}

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function bodyFromStdin() {
  const parsed = parseBody(await readStdinText());
  return parsed;
}

const commands = {
  list() {
    const t = today();
    const row = (f) => {
      const fm = readFrontmatter(f);
      return `  ${path.basename(f)} | ${fm.title || "(pending excerpt)"} | ${fm.project || "?"} | ${fm.review_due ? "due " + fm.review_due : fm.date || fm.captured?.slice(0, 10) || ""}`;
    };
    const entries = listMd(DIRS.entries).filter((f) => readFrontmatter(f).status === "approved");
    const due = entries.filter((f) => (readFrontmatter(f).review_due || "9999") <= t);
    const groups = { PENDING: listMd(DIRS.pending), DRAFTS: listMd(DIRS.drafts), "DUE FOR REVIEW": due };
    console.log(`Log folder: ${DATA_DIR}`);
    for (const [name, files] of Object.entries(groups)) {
      console.log(`${name} (${files.length})`);
      files.sort().forEach((f) => console.log(row(f)));
    }
    const next = entries.map((f) => readFrontmatter(f).review_due).filter(Boolean).sort()[0];
    console.log(`ENTRIES: ${entries.length}${next ? ` | next review: ${next}` : ""}`);
  },

  async draft([file]) {
    const p = resolve(file, DIRS.pending);
    const fm = readFrontmatter(p);
    const parsed = await bodyFromStdin();
    if (!parsed) {
      fs.unlinkSync(p);
      return console.log(`nothing to log: removed ${path.basename(p)}`);
    }
    const out = path.join(DIRS.drafts, path.basename(p));
    fs.writeFileSync(out, buildEntry({ ...fm, status: "draft" }, parsed));
    fs.unlinkSync(p);
    console.log(`drafted: ${path.basename(out)} | ${parsed.title}`);
  },

  approve([file]) {
    const p = resolve(file, DIRS.drafts);
    const due = addDays(today(), FIRST_REVIEW_DAYS);
    const out = path.join(DIRS.entries, path.basename(p));
    fs.writeFileSync(out, setFields(fs.readFileSync(p, "utf8"), { status: "approved", review_due: due }));
    fs.unlinkSync(p);
    console.log(`approved: ${path.basename(out)} | first review ${due}`);
  },

  discard([file]) {
    const p = resolve(file, DIRS.drafts);
    const dir = path.join(DIRS.drafts, ".discarded");
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(p, path.join(dir, path.basename(p)));
    console.log(`discarded: ${path.basename(p)} (kept in drafts/.discarded/)`);
  },

  async update([file]) {
    const p = resolve(file, DIRS.drafts, DIRS.entries);
    const fm = readFrontmatter(p);
    const parsed = await bodyFromStdin();
    if (!parsed) fail("update needs an entry body, not NOTHING_TO_LOG");
    const tags = fm.tags?.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean) || [];
    fs.writeFileSync(p, buildEntry(fm, { ...parsed, tags: parsed.tags.length ? parsed.tags : tags }));
    console.log(`updated: ${path.basename(p)} | ${parsed.title}`);
  },

  async add(args) {
    const project = flag(args, "project") || "unknown";
    const parsed = await bodyFromStdin();
    if (!parsed) return console.log("nothing to log");
    const due = addDays(today(), FIRST_REVIEW_DAYS);
    const name = `${stamp()}_${slug(project)}_manual.md`;
    const meta = { project, cwd: flag(args, "cwd"), session: flag(args, "session"), source: "manual", status: "approved", review_due: due };
    fs.writeFileSync(path.join(DIRS.entries, name), buildEntry(meta, parsed));
    console.log(`saved: ${name} | first review ${due}`);
  },

  score([file, s]) {
    const p = resolve(file, DIRS.entries);
    const score = Number(s);
    if (!Number.isInteger(score) || score < 1 || score > 5) fail("score must be 1-5");
    const fm = readFrontmatter(p);
    const before = Number(fm.reviews || 0);
    const days = nextInterval(score, before);
    const due = addDays(today(), days);
    fs.writeFileSync(
      p,
      setFields(fs.readFileSync(p, "utf8"), { last_reviewed: today(), review_score: score, reviews: before + 1, review_due: due }),
    );
    console.log(`scored ${score}/5: ${path.basename(p)} | next review ${due} (in ${days} days)`);
  },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!commands[cmd]) fail(`unknown command "${cmd || ""}". Commands: ${Object.keys(commands).join(", ")}`);
ensureDirs();
Promise.resolve(commands[cmd](rest)).catch((e) => fail(e.message));
