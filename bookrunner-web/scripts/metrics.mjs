// Engineering metrics for the Alpha slides. Run from bookrunner-web/ after `npm run coverage`:
//   npx vitest run --reporter=json --outputFile=test-results.json && node scripts/metrics.mjs
// Reads test-results.json (Vitest JSON reporter) and coverage/coverage-summary.json.
import { readFileSync, existsSync } from "node:fs";

const results = JSON.parse(readFileSync("test-results.json", "utf8"));
const tests = results.testResults.flatMap((f) => f.assertionResults);
const passed = tests.filter((t) => t.status === "passed").length;
const ai = tests.filter((t) => t.title.startsWith("[ai]")).length;
const manual = tests.filter((t) => t.title.startsWith("[manual]")).length;

const perIssue = {};
for (const t of tests) {
  const m = (t.ancestorTitles[0] ?? "").match(/^#(\d+)/);
  const key = m ? `#${m[1]}` : "untagged";
  perIssue[key] = (perIssue[key] ?? 0) + 1;
}
const tagged = Object.keys(perIssue).filter((k) => k !== "untagged");

console.log(`Total tests:        ${tests.length}`);
console.log(`Pass rate:          ${((passed / tests.length) * 100).toFixed(1)}% (${passed}/${tests.length})`);
console.log(`AI vs manual:       ${ai} ai / ${manual} manual (${tests.length - ai - manual} untagged)`);
console.log(`Issues with tests:  ${tagged.length}`);
console.log(`Avg tests / issue:  ${(tagged.reduce((n, k) => n + perIssue[k], 0) / Math.max(tagged.length, 1)).toFixed(1)}`);
console.log("Per issue:", perIssue);

if (existsSync("coverage/coverage-summary.json")) {
  const cov = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total;
  console.log(`Line coverage:      ${cov.lines.pct}%`);
} else {
  console.log("Line coverage:      run `npm run coverage` with reporter json-summary first");
}
