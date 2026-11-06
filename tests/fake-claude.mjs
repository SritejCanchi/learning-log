// Stand-in for `claude -p` used by the smoke test. FAKE_MODE: entry | nothing | fail
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const mode = process.env.FAKE_MODE || "entry";
  if (mode === "fail") {
    console.error("Failed to authenticate.");
    process.exit(1);
  }
  if (!input.includes("## Session to extract from")) process.exit(3);
  if (mode === "nothing") return console.log("NOTHING_TO_LOG");
  console.log(
    [
      "TITLE: Retry flaky uploads with backoff",
      "TAGS: http, retries",
      "",
      "## Learnings",
      "- The upload API returns 503 under load; retrying with backoff fixes it.",
      "",
      "## Mistakes",
      "- **What happened:** Retried instantly. **Cause:** No backoff. **Next time:** Use exponential backoff.",
      "",
      "## Quiz",
      "- **Q:** What does the upload API return under load?",
      "  **A:** 503.",
    ].join("\n"),
  );
});
