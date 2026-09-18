/*
 * Writes METHOD.md from data/docs.js, so the document and the app say the same thing.
 *   node tools/make-method.js
 */
require("../data/factors.js");
require("../data/benchmarks.js");
require("../data/docs.js");
const fs = require("fs");
const path = require("path");
const { docs, factors: F, benchmarks: B } = globalThis.GreenApp;

const out = [];
out.push("# How the Green App calculates a carbon footprint");
out.push("");
out.push("*Method and sources · documentation version " + docs.version + " · factor data version " + F.version + "*");
out.push("");
out.push("This file is generated from `data/docs.js` by `node tools/make-method.js`. Edit the data file, not this one.");
out.push("");
docs.intro.forEach((p) => { out.push(p); out.push(""); });

out.push("## Contents");
out.push("");
docs.sections.forEach((s) => {
  out.push("- [" + s.title + "](#" + s.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ /g, "-") + ")");
});
out.push("");

docs.sections.forEach((s) => {
  out.push("## " + s.title);
  out.push("");
  s.body.forEach((p) => { out.push(p); out.push(""); });
  if (s.formula) { out.push("**The arithmetic**"); out.push(""); out.push("```"); out.push(s.formula); out.push("```"); out.push(""); }
  if (s.code) { out.push("**In the code:** `" + s.code + "`"); out.push(""); }
  if (s.check) { out.push("**Check it:** " + s.check); out.push(""); }
  if (s.sources) {
    out.push("**Sources**");
    out.push("");
    s.sources.forEach((x) => out.push("- " + x));
    out.push("");
  }
});

// ---- appendix: every number, straight out of the data files ----
function walk(obj, trail, rows) {
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (k === "source" && typeof v === "string") rows.push([trail.join("."), v]);
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      if (typeof v.source === "string" && v.value !== undefined) {
        rows.push([trail.concat(k).join("."), v.value + (v.unit ? " " + v.unit : "") +
          (v.unc !== undefined ? "  (±" + Math.round(v.unc * 100) + "%)" : "") + " — " + v.source]);
      } else walk(v, trail.concat(k), rows);
    }
  });
  return rows;
}
out.push("## Appendix: every number and where it comes from");
out.push("");
out.push("Generated directly from `data/factors.js` and `data/benchmarks.js`, so it cannot go stale.");
out.push("");
walk(F, ["factors"], []).concat(walk(B, ["benchmarks"], [])).forEach(([k, v]) => {
  out.push("- **`" + k + "`** — " + v);
});
out.push("");
out.push("---");
out.push("");
out.push("Run `node tests/engine.test.js` and `node tests/audit.js` to check the arithmetic yourself.");
out.push("");

const file = path.join(__dirname, "..", "METHOD.md");
fs.writeFileSync(file, out.join("\n"));
console.log("Wrote " + file + " — " + out.join("\n").length + " characters, " + docs.sections.length + " sections.");
