/*
 * Independent audit.  Run with:  node tests/audit.js
 *
 * engine.test.js checks single hand-calculated cases.  This file does something
 * different: it generates thousands of random profiles and checks the PROPERTIES
 * that must hold for every one of them — the things that would break silently:
 *
 *   1. sources() adds up to calculate(), per area and in total  (the Sankey's arithmetic)
 *   2. every Sankey column carries the same total (cause = activity = area = trunk)
 *   3. every lever really saves what it claims, when applied alone
 *   4. several levers together never save more than the sum of their parts
 *   5. the order in which levers are ticked does not change the result
 *   6. the Monte Carlo range brackets the central value and is stable
 *   7. nothing is negative, NaN or infinite
 *   8. the same factor is drawn ONCE per sample (correlated, not averaged away)
 *   9. the Potential bar's widths are the tonnes (that picture is the arithmetic too)
 *  10. the benchmark data agrees with itself, and the excluded-share flow is the arithmetic
 *  11. compensation is described, never subtracted, and its ladder is the mix
 *  12. there is ONE Sankey renderer — a phone scrolls the same diagram, it does not get its own
 *  13. rebound is stated, never subtracted — the savings stay upper bounds
 *  14. every claim on the Context tab is sourced, and nothing is attributed to a
 *      company that the source does not attribute to that company
 */
require("../data/factors.js");
require("../data/benchmarks.js");
require("../js/engine.js");
require("../js/questions.js");
require("../js/chart.js");
require("../js/sankey.js");
require("../data/context.js");
const { engine, factors: F } = globalThis.GreenApp;
// The goal is read from the data, never repeated here — a target the audit hard-codes
// is a target the audit stops checking the moment the app changes it.
const TARGET = globalThis.GreenApp.benchmarks.targets.y2030.value;

let failed = 0, passed = 0, checks = 0;
function ok(name, cond, extra) {
  checks++;
  if (cond) { passed++; }
  else { failed++; console.log("  ✗ " + name + (extra ? "  " + extra : "")); }
}
function report(name) { console.log("  ✓ " + name + " (" + checks + " checks)"); checks = 0; }

// ---------- random profile generator ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2026);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const maybe = (p) => rnd() < p;
const num = (max, step) => Math.round(rnd() * max / step) * step;

const FREQ = ["never", "monthly", "weekly", "often", "daily", "twiceDaily"];
const WASTE = ["rarely", "sometimes", "often"];
const AIR = ["never", "rare", "monthly", "weekly", "often"];
const foodIds = Object.keys(F.foodGroups).filter((k) => k !== "source");

function randomProfile() {
  const size = 1 + Math.floor(rnd() * 5);
  const heating = pick(["gas", "oil", "district", "pellets", "wood", "heatpump", "electric"]);
  const measured = maybe(0.35);
  const p = {
    household: { size: size },
    home: {
      type: pick(["house", "flat"]), tenure: pick(["own", "rent", "unknown"]),
      area: { v: measured ? null : 30 + num(170, 5), c: pick(["exact", "estimate", "guess"]) },
      building: pick(["old", "average", "modern", "efficient", "passive"]),
      heating: heating,
      heatKnown: { v: measured ? 2000 + num(25000, 100) : null, c: "exact" },
      electricity: { v: maybe(0.7) ? 800 + num(5000, 50) : null, c: pick(["exact", "estimate", "guess"]) },
      electricityChoice: pick(["own", "included", "unknown"]),
      greenTariff: maybe(0.3)
    },
    car: {
      type: pick(["none", "petrol", "diesel", "hybrid", "ev"]),
      km: { v: num(30000, 500), c: pick(["exact", "estimate", "guess"]) },
      people: 1 + Math.floor(rnd() * 4),
      dependence: pick(["easy", "partly", "dependent", "unknown"])
    },
    transit: { trainHours: { v: num(300, 5), c: "estimate" }, cityHours: { v: num(500, 5), c: "estimate" } },
    flights: {
      short: Math.floor(rnd() * 9), medium: Math.floor(rnd() * 5), long: Math.floor(rnd() * 5),
      cls: pick(["economy", "premium", "business"]), purpose: pick(["leisure", "mix", "work", "unknown"])
    },
    food: { portions: {}, airFreight: {}, waste: {} },
    goods: { clothes: num(3000, 50), electronics: num(3000, 50), furniture: num(2000, 50), other: num(1500, 50),
             secondHand: {} },
    services: { eatingOut: num(6000, 50), hotels: num(4000, 50), leisure: num(3000, 50) },
    digital: { streamingHoursDay: num(8, 0.5), aiPromptsDay: num(200, 5), aiImagesMonth: num(100, 5), aiVideosMonth: num(20, 1) },
    money: {}, offsets: {}
  };
  foodIds.forEach((id) => { if (maybe(0.7)) p.food.portions[id] = pick(FREQ); });
  ["berries", "vegetables", "exotic"].forEach((k) => { if (maybe(0.6)) p.food.airFreight[k] = pick(AIR); });
  ["meatFish", "dairy", "bread", "fruitVeg", "leftovers"].forEach((k) => { if (maybe(0.6)) p.food.waste[k] = pick(WASTE); });
  ["clothes", "electronics", "furniture", "other"].forEach((k) => { p.goods.secondHand[k] = pick(["new", "mix", "mostly"]); });
  return p;
}

const N = 3000;
const profiles = []; for (let i = 0; i < N; i++) profiles.push(randomProfile());
const clone = (o) => JSON.parse(JSON.stringify(o));
const finite = (x) => typeof x === "number" && isFinite(x);

console.log("Auditing " + N + " randomly generated profiles\n");

// ---------- 1 + 2: the Sankey is the arithmetic ----------
console.log("Sankey conservation — every column carries the same total");
const DOMAINS = ["housing", "transport", "flights", "food", "goods", "services"];
profiles.forEach((p, i) => {
  const res = engine.calculate(p);
  const src = engine.sources(p);
  // per area
  DOMAINS.forEach((dom) => {
    const s = src.filter((r) => r.domain === dom).reduce((a, r) => a + r.t, 0);
    ok("area " + dom + " (profile " + i + ")", Math.abs(s - res.byDomain[dom]) < 1e-9,
       "sources " + s.toFixed(9) + " vs calculate " + res.byDomain[dom].toFixed(9));
  });
  // column totals: cause → activity → area → trunk
  const byCause = {}, byActivity = {}, byArea = {};
  src.forEach((r) => {
    byCause[r.cause] = (byCause[r.cause] || 0) + r.t;
    byActivity[r.domain + "/" + r.id] = (byActivity[r.domain + "/" + r.id] || 0) + r.t;
    byArea[r.domain] = (byArea[r.domain] || 0) + r.t;
  });
  const sum = (o) => Object.keys(o).reduce((a, k) => a + o[k], 0);
  ok("columns equal (profile " + i + ")",
     Math.abs(sum(byCause) - sum(byActivity)) < 1e-9 &&
     Math.abs(sum(byArea) - sum(byActivity)) < 1e-9 &&
     Math.abs(sum(byArea) - res.total) < 1e-9);
  // every row must be positive and have a cause the diagram knows
  src.forEach((r) => ok("row sane", finite(r.t) && r.t > 0 && r.causeLabel && r.causeGroupLabel && r.label));
});
report("sources() = calculate() for every area and every column");

// ---------- 7: no NaN, no negative, no infinity ----------
console.log("Sanity of the central result");
profiles.forEach((p, i) => {
  const r = engine.calculate(p);
  ok("total finite (" + i + ")", finite(r.total) && r.total > 0);
  DOMAINS.forEach((d) => ok("domain finite " + d, finite(r.byDomain[d]) && r.byDomain[d] >= 0));
});
report("no NaN, no negative, no infinite value");

// ---------- 3: every lever saves what it says ----------
console.log("Levers — each one alone");
let leverCount = 0;
profiles.slice(0, 400).forEach((p, i) => {
  const before = engine.calculate(p).total;
  engine.levers(p).forEach((l) => {
    leverCount++;
    const q = clone(p); l.change(q);
    const after = engine.calculate(q).total;
    ok("lever " + l.id + " saved matches recalculation", Math.abs((before - after) - l.saved) < 1e-9);
    ok("lever " + l.id + " really reduces", l.saved > 0 && after < before);
    ok("lever " + l.id + " is labelled", !!l.label && !!l.detail && !!l.control);
    // Every measure has to say what you do INSTEAD and why that moves the number. A saving
    // with no alternative attached is just a reproach, and people act on alternatives.
    ok("lever " + l.id + " offers an alternative, not just a prohibition", l.detail.length > 60);
    ok("lever " + l.id + " explains why it works", !!l.why && l.why.length > 40);
    ok("lever " + l.id + " is named as something you do", !/^(stop|don.t|avoid|no more|quit|give up|cut out|reduce)\b/i.test(l.label));
  });
});
report(leverCount + " levers recalculated from scratch");

// ---------- 4 + 5: levers together ----------
console.log("Levers — combined");
profiles.slice(0, 300).forEach((p, i) => {
  const all = engine.levers(p);
  if (all.length < 2) return;
  const picked = all.filter(() => maybe(0.5));
  if (picked.length < 2) return;
  const together = engine.combined(p, picked);
  // combined() must BE the recalculation, not an approximation of it
  const q = clone(p); picked.forEach((l) => l.change(q));
  ok("combined is a real recalculation (" + i + ")",
     Math.abs(together - (engine.calculate(p).total - engine.calculate(q).total)) < 1e-12);
  ok("combined ≥ the single biggest (" + i + ")", together >= Math.max.apply(null, picked.map((l) => l.saved)) - 1e-9,
     "together " + together.toFixed(4) + " [" + picked.map((l) => l.id) + "]");
  ok("what is left over is still positive", engine.calculate(p).total - together > -1e-9);
  // order independence
  const reversed = picked.slice().reverse();
  ok("order does not matter (" + i + ")", Math.abs(engine.combined(p, reversed) - together) < 1e-9,
     "[" + picked.map((l) => l.id) + "]");
});
report("combined savings are consistent and order-independent");

// Savings are NOT additive, and not always in the direction people expect.
// Two levers can save LESS together (skip a flight + stop flying: the same flight)
// but also MORE together (green tariff + heat pump: clean power for the new system).
// Both are correct, and both are reasons the app must recalculate instead of adding up.
console.log("Overlap and synergy");
{
  const p = {
    household: { size: 2 }, home: { type: "house", tenure: "own", area: { v: 120, c: "exact" }, building: "average",
      heating: "gas", heatKnown: { v: null, c: "guess" }, electricity: { v: 3500, c: "exact" },
      electricityChoice: "own", greenTariff: false },
    car: { type: "petrol", km: { v: 15000, c: "exact" }, people: 1, dependence: "easy" },
    transit: { trainHours: { v: 0, c: "exact" }, cityHours: { v: 0, c: "exact" } },
    flights: { short: 2, medium: 0, long: 2, cls: "economy", purpose: "leisure" },
    food: { portions: { beef: "weekly", cheese: "daily" }, airFreight: {}, waste: {} },
    goods: { clothes: 500, electronics: 500, furniture: 200, other: 200, secondHand: {} },
    services: { eatingOut: 1000, hotels: 500, leisure: 400 },
    digital: { streamingHoursDay: 2, aiPromptsDay: 10, aiImagesMonth: 0, aiVideosMonth: 0 },
    money: {}, offsets: {}
  };
  const all = engine.levers(p);
  const by = (id) => all.filter((l) => l.id === id)[0];
  const pairSum = (a, b) => by(a).saved + by(b).saved;
  const pairTogether = (a, b) => engine.combined(p, [by(a), by(b)]);

  const overlapT = pairTogether("noFlights", "flight"), overlapS = pairSum("noFlights", "flight");
  ok("overlapping levers save less together than apart", overlapT < overlapS - 0.01);
  console.log("    stop flying + skip a trip: " + overlapS.toFixed(2) + " t added up, but " + overlapT.toFixed(2) + " t in reality");

  const synT = pairTogether("greenTariff", "heatPump"), synS = pairSum("greenTariff", "heatPump");
  ok("green power + electrification save MORE together", synT > synS + 0.01);
  console.log("    green tariff + heat pump: " + synS.toFixed(2) + " t added up, but " + synT.toFixed(2) + " t in reality");

  const evT = pairTogether("greenTariff", "ev"), evS = pairSum("greenTariff", "ev");
  ok("green power + electric car save MORE together", evT > evS + 0.01);
  console.log("    green tariff + electric car: " + evS.toFixed(2) + " t added up, but " + evT.toFixed(2) + " t in reality");
}
report("overlap and synergy both appear, and both are recalculated");

// ---------- pathToTarget ----------
console.log("Reaching the goal");
profiles.slice(0, 200).forEach((p, i) => {
  const path = engine.pathToTarget(p, TARGET);
  const check = engine.calculate(p).total - engine.combined(p, path.levers);
  ok("path total matches recalculation (" + i + ")", Math.abs(check - path.total) < 1e-9);
  ok("reached flag is honest (" + i + ")", path.reached === (path.total <= TARGET));
  const ids = path.levers.map((l) => l.id);
  ok("no lever is picked twice", ids.length === new Set(ids).size);
});
report("pathToTarget is honest about what it reaches");

// The Potential tab is only worth having if the goal is actually reachable. A calculator that
// tells someone "even every change together isn't enough" and stops has given up on them.
// So: every profile, however extreme, must have a route to the goal in data/benchmarks.js.
console.log("The goal has to be reachable for everyone");
{
  let worst = null, unreached = 0;
  profiles.forEach((p, i) => {
    const path = engine.pathToTarget(p, TARGET);
    if (!path.reached) {
      unreached++;
      if (!worst || path.total > worst.total) worst = { i, total: path.total, before: engine.calculate(p).total };
    }
  });
  ok("every random profile has a route to the goal", unreached === 0,
     unreached + " of " + profiles.length + " could not get there; worst ends at " +
     (worst ? worst.total.toFixed(2) + " t (from " + worst.before.toFixed(1) + " t)" : "–"));
  // And a deliberately absurd one: a big old oil-heated house alone, a diesel doing 35,000 km,
  // 24 flights in business class, meat twice a day and €22,000 a year on things.
  const absurd = {
    household: { size: 1 },
    home: { type: "house", tenure: "own", area: { v: 220, c: "exact" }, building: "old", heating: "oil",
      heatKnown: { v: null, c: "guess" }, electricity: { v: 9000, c: "exact" }, electricityChoice: "own", greenTariff: false },
    car: { type: "diesel", km: { v: 35000, c: "exact" }, people: 1, dependence: "easy" },
    transit: { trainHours: { v: 0, c: "exact" }, cityHours: { v: 0, c: "exact" } },
    flights: { short: 10, medium: 6, long: 8, cls: "business", purpose: "leisure" },
    food: {
      portions: { beef: "daily", pork: "daily", poultry: "often", sausage: "daily", fish: "often",
        cheese: "twiceDaily", milk: "twiceDaily", butter: "daily", eggs: "daily", rice: "daily",
        coffee: "twiceDaily", chocolate: "daily" },
      airFreight: { berries: "often", vegetables: "often", exotic: "often" },
      waste: { meatFish: "often", dairy: "often", bread: "often", fruitVeg: "often", leftovers: "often" }
    },
    goods: { clothes: 8000, electronics: 8000, furniture: 6000, other: 6000, secondHand: {} },
    services: { eatingOut: 16000, hotels: 12000, leisure: 8000 },
    digital: { streamingHoursDay: 8, aiPromptsDay: 300, aiImagesMonth: 200, aiVideosMonth: 60 },
    money: {}, offsets: {}
  };
  const before = engine.calculate(absurd).total;
  const path = engine.pathToTarget(absurd, TARGET);
  ok("even the most extreme profile can reach the goal", path.reached,
     before.toFixed(1) + " t only comes down to " + path.total.toFixed(2) + " t");
  console.log("    worst case: " + before.toFixed(1) + " t → " + path.total.toFixed(2) + " t with " + path.levers.length + " changes");
  // and the easy ones have to come first
  const firstBig = path.levers.findIndex((l) => l.control === "big");
  const lastOrdinary = path.levers.map((l) => l.control !== "big").lastIndexOf(true);
  ok("the ordinary changes are offered before the drastic ones", firstBig === -1 || firstBig > lastOrdinary,
     path.levers.map((l) => l.id + (l.control === "big" ? "*" : "")).join(", "));
}
report("nobody is told the goal is out of reach");

// ---------- 6: uncertainty range ----------
console.log("Monte Carlo range");
profiles.slice(0, 40).forEach((p, i) => {
  const c = engine.calculate(p).total;
  const s = engine.simulate(p, { samples: 800 });
  ok("low < high (" + i + ")", s.low < s.high);
  ok("central inside the range (" + i + ")", s.low <= c && c <= s.high, c.toFixed(3) + " not in [" + s.low.toFixed(3) + ", " + s.high.toFixed(3) + "]");
  ok("median close to central (" + i + ")", Math.abs(s.median - c) / c < 0.15, "median " + s.median.toFixed(3) + " vs central " + c.toFixed(3));
  const again = engine.simulate(p, { samples: 800 });
  ok("same seed → same range (" + i + ")", s.low === again.low && s.high === again.high);
});
report("the range brackets the central value and is reproducible");

// ---------- 8: shared factors must be drawn once per sample ----------
// The Austrian electricity mix is ONE number. If the engine drew it separately for
// the home, the heat pump, the train and the EV, those draws would average out and
// the range would come out too narrow. This test forces the situation and checks
// that the draws move together.
console.log("Correlated factors");
{
  // Directly: within one sample a key must come back with the same value every time.
  const { randomDrawer, mulberry32: seeded } = engine._internals;
  const rand = seeded(7);
  const d = randomDrawer(rand);
  const a = d("factor.electricity", 0.209, 0.15);
  const b = d("factor.electricity", 0.209, 0.15);   // the heat pump asks for the same mix
  const c = d("factor.electricity", 0.209, 0.15);   // and so does the electric car
  ok("the same factor keeps its value inside one sample", a === b && b === c, a + " / " + b + " / " + c);
  ok("and it is actually drawn, not just the central value", a !== 0.209);
  const other = d("factor.fuel.gas", 0.249, 0.10);
  ok("a different factor is drawn independently", other !== 0.249 && other / 0.249 !== a / 0.209);
  const d2 = randomDrawer(rand);
  ok("the next sample draws it again", d2("factor.electricity", 0.209, 0.15) !== a);
}
{
  const evProfile = clone(profiles[0]);
  evProfile.home = { type: "flat", tenure: "own", area: { v: 80, c: "exact" }, building: "average",
    heating: "heatpump", heatKnown: { v: null, c: "guess" }, electricity: { v: 3000, c: "exact" },
    electricityChoice: "own", greenTariff: false };
  evProfile.car = { type: "ev", km: { v: 15000, c: "exact" }, people: 1, dependence: "easy" };
  // Everything else off, so the only uncertain quantity that matters is the electricity mix.
  evProfile.flights = { short: 0, medium: 0, long: 0, cls: "economy", purpose: "leisure" };
  evProfile.food = { portions: {}, airFreight: {}, waste: {} };
  evProfile.goods = { clothes: 0, electronics: 0, furniture: 0, other: 0, secondHand: {} };
  evProfile.services = { eatingOut: 0, hotels: 0, leisure: 0 };
  evProfile.digital = { streamingHoursDay: 0, aiPromptsDay: 0, aiImagesMonth: 0, aiVideosMonth: 0 };
  evProfile.transit = { trainHours: { v: 0, c: "exact" }, cityHours: { v: 0, c: "exact" } };

  const s = engine.simulate(evProfile, { samples: 4000 });
  const c = engine.calculate(evProfile).total;
  // Home heat, home electricity and the car all scale with the SAME factor (unc 0.15),
  // plus the heat-pump COP (0.20) and the ±10% model error. If the electricity factor
  // were drawn independently three times, the 80% band would collapse well below this.
  const spread = (s.high - s.low) / c;
  ok("an electricity-heavy profile keeps a realistic spread", spread > 0.25,
     "80% band is only ±" + (spread * 50).toFixed(1) + "% of the central value — factors are being averaged away");
  console.log("    80% band = " + (spread * 100).toFixed(1) + "% of the central value");
}
report("one physical quantity is drawn once per sample");

/* ---------- 9. the bar on "Pick your changes" is the arithmetic ----------
 * The bar claims three things: the full width is the footprint you have today and never
 * moves, the coloured part is what is left area by area, and the hatched part on the
 * right is exactly the tonnes the ticked changes removed. Parse the widths back out of
 * the HTML it generates and check every one against the engine — the same rule the
 * Sankey is held to. A bar that rounds its way to a comfortable picture is a lie.
 */
console.log("The bar on Pick your changes");
{
  const chart = globalThis.GreenApp.chart;
  const domains = globalThis.GreenApp.benchmarks.domains;
  const widths = (html, cls) => {
    const re = new RegExp('class="' + cls + '" style="width:([0-9.]+)%', "g");
    const out = []; let m;
    while ((m = re.exec(html))) out.push(parseFloat(m[1]));
    return out;
  };
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const near = (a, b, eps) => Math.abs(a - b) <= eps;

  profiles.slice(0, 300).forEach((p, i) => {
    const all = engine.levers(p);
    if (!all.length) return;
    // a different handful of changes for every profile, including none and all of them
    const take = i % 4 === 0 ? [] : (i % 4 === 1 ? all : all.filter((_, k) => (k + i) % 3 === 0));
    const after = clone(p);
    take.forEach((l) => l.change(after));
    const base = engine.calculate(p), left = engine.calculate(after);
    if (!(base.total > 0)) return;

    const html = chart.horizontal({
      domains: domains, now: base.byDomain, after: left.byDomain,
      baseTotal: base.total, total: left.total, goal: { value: TARGET, label: "goal" }
    });
    const segs = widths(html, "pb-seg"), shadow = widths(html, "pb-shadow");
    const t = (w) => w / 100 * base.total;   // a width, read back as tonnes

    ok("the track is always exactly full", near(sum(segs) + sum(shadow), 100, 1e-9),
       "drew " + (sum(segs) + sum(shadow)).toFixed(9) + "%");
    const expected = domains.map((d) => left.byDomain[d.id] || 0).filter((v) => v > 1e-9);
    ok("every area's width is its own tonnes",
       segs.length === expected.length && segs.every((w, k) => near(t(w), expected[k], 1e-6)),
       segs.map(t).map((x) => x.toFixed(4)) + " vs " + expected.map((x) => x.toFixed(4)));
    ok("the hatched part is exactly what the changes removed",
       near(t(sum(shadow)), base.total - left.total, 1e-6),
       t(sum(shadow)).toFixed(6) + " t drawn vs " + (base.total - left.total).toFixed(6) + " t removed");
    ok("the coloured part is exactly what is left", near(t(sum(segs)), left.total, 1e-6));
    ok("nothing is drawn wider than the track", sum(segs) + sum(shadow) <= 100 + 1e-9 && segs.every((w) => w >= 0));
  });

  // The scale is the baseline and nothing else: ticking changes must not rescale the bar.
  const p0 = profiles[1], lv = engine.levers(p0), b0 = engine.calculate(p0);
  const one = clone(p0); lv.slice(0, 3).forEach((l) => l.change(one));
  const l0 = engine.calculate(one);
  const h1 = chart.horizontal({ domains: domains, now: b0.byDomain, after: b0.byDomain, baseTotal: b0.total, total: b0.total });
  const h2 = chart.horizontal({ domains: domains, now: b0.byDomain, after: l0.byDomain, baseTotal: b0.total, total: l0.total });
  ok("the full width is the same before and after ticking",
     near(sum(widths(h1, "pb-seg")) + sum(widths(h1, "pb-shadow")),
          sum(widths(h2, "pb-seg")) + sum(widths(h2, "pb-shadow")), 1e-9));
  ok("with nothing ticked there is no hatched part", widths(h1, "pb-shadow").length === 0);
  ok("with changes ticked the coloured part is shorter",
     sum(widths(h2, "pb-seg")) < sum(widths(h1, "pb-seg")));
}
report("the bar's widths are the tonnes");

/* ---------- 10. the benchmarks agree with themselves, and the flow is the arithmetic ----------
 * data/benchmarks.js now carries a national total, a split of it by who did the buying, a
 * lifestyle average derived from that split, and a breakdown of the part the bars exclude.
 * Four numbers that must agree, written by hand in four places — exactly the shape of thing
 * that drifts silently the next time one of them is edited. So: check them against each other,
 * then check that the drawn diagram is those numbers and not a pleasant approximation of them.
 */
console.log("The benchmark data and the excluded-share flow");
{
  const B = globalThis.GreenApp.benchmarks, chart = globalThis.GreenApp.chart;
  const a = B.austria, ps = B.publicShare, fd = a.finalDemand;
  const sum = (xs) => xs.reduce((x, y) => x + y, 0);
  const near = (x, y, eps) => Math.abs(x - y) <= eps;

  ok("the final-demand shares are a whole", near(sum(Object.values(fd)), 1, 1e-9),
     "they sum to " + sum(Object.values(fd)));
  ok("the lifestyle average is the household share of the national total",
     near(a.total, a.nationalTotal * fd.households, 0.02),
     a.total + " vs " + (a.nationalTotal * fd.households).toFixed(3));
  ok("the Austrian per-area split adds up to the Austrian average",
     near(sum(Object.values(a.byDomain)), a.total, 0.02),
     sum(Object.values(a.byDomain)).toFixed(3) + " vs " + a.total);
  ok("the world average is still its own household share",
     near(sum(Object.values(B.world.byDomain)), B.world.total, 0.02));
  ok("the excluded share is everything that is not the household share",
     near(ps.austria, a.nationalTotal * (1 - fd.households), 0.02),
     ps.austria + " vs " + (a.nationalTotal * (1 - fd.households)).toFixed(3));
  ok("the excluded share's parts add up to the excluded share",
     near(sum(ps.parts.map((p) => p.shareOfNational)) * a.nationalTotal, ps.austria, 0.02));
  ps.parts.forEach((p) => {
    if (!p.parts) return;
    ok("the sub-blocks of " + p.id + " are a whole",
       near(sum(p.parts.map((k) => k.shareOfParent)), 1, 1e-9));
  });
  ps.parts.forEach((p) => {
    ok(p.id + " carries a source-worthy explanation", typeof p.detail === "string" && p.detail.length > 40);
    (p.parts || []).forEach((k) =>
      ok(k.id + " carries a source-worthy explanation", typeof k.detail === "string" && k.detail.length > 40));
  });

  /* The one number on this card that nobody publishes: what the excluded share would have
   * to come down to. It is arithmetic from the same report the lifestyle goal comes from,
   * so the audit re-derives it rather than trusting the value typed into benchmarks.js —
   * and insists it is still flagged as derived, because the moment that flag is lost it
   * starts reading as a target somebody set.
   */
  const HOUSEHOLD_SHARE_IN_TARGET = 0.72;   // Hot or Cool's own figure, the one the 2.5 t is built on
  const pt = ps.target;
  ok("the excluded share carries a target at all", !!pt && pt.value > 0);
  ok("it is marked as derived, not published", pt.derived === true);
  ok("it says where it came from", typeof pt.source === "string" && pt.source.length > 80);
  ok("it names the real Austrian commitments as context", /2040/.test(pt.context || "") && /Effort Sharing/.test(pt.context || ""));
  const wholeBudget = TARGET / HOUSEHOLD_SHARE_IN_TARGET;
  ok("the derived target is the budget minus the lifestyle part",
     near(pt.value, wholeBudget - TARGET, 0.01),
     pt.value + " vs " + (wholeBudget - TARGET).toFixed(3));
  ok("it is smaller than what Austria actually uses", pt.value < ps.austria);
  ok("it never drifts above the lifestyle goal", pt.value < TARGET);
  /* A number that means "the average Austrian" must never be printed as "yours". The card
   * once said "your 7.4 t bar" where 7.4 was the Austrian average and the reader's own bar
   * was 9.9. Nothing in 37 questions can allocate a share of a country's hospitals to one
   * person, so this share is an average and has to be labelled as one.
   */
  ok("the Austrian average and the excluded share are different quantities",
     Math.abs(a.total - ps.austria) > 1,
     "they are " + a.total + " and " + ps.austria + " — if these ever converge, check nothing is printing one for the other");

  // ---- the drawn diagram ----
  const nat = a.nationalTotal;
  const parts = ps.parts.map((p) => {
    const t = p.shareOfNational * nat;
    const out = { id: p.id, label: p.label, t: t, share: p.shareOfNational, color: p.color, detail: p.detail };
    if (p.parts) out.parts = p.parts.map((k) => ({ id: k.id, label: k.label, t: k.shareOfParent * t,
      share: k.shareOfParent * p.shareOfNational, color: k.color, detail: k.detail }));
    return out;
  });
  const total = sum(parts.map((p) => p.t));
  const html = chart.flow({ parts: parts, total: total, base: nat, trunkLabel: "Not in your bar" });

  const segs = [];
  const re = /data-kind="(part|leaf)" data-t="([0-9.eE+-]+)" style="width:([0-9.eE+-]+)%/g;
  let m; while ((m = re.exec(html))) segs.push({ kind: m[1], t: parseFloat(m[2]), w: parseFloat(m[3]) });

  const row1 = segs.filter((n) => n.kind === "part"), row2 = segs.filter((n) => n.kind === "leaf");
  ok("the top row is exactly full", near(sum(row1.map((n) => n.w)), 100, 1e-9),
     "drew " + sum(row1.map((n) => n.w)).toFixed(9) + "%");
  ok("the bottom row is exactly full", near(sum(row2.map((n) => n.w)), 100, 1e-9),
     "drew " + sum(row2.map((n) => n.w)).toFixed(9) + "%");
  ok("both rows are on the same scale — the bottom row divides the top one, it does not rescale",
     near(sum(row1.map((n) => n.t)), sum(row2.map((n) => n.t)), 1e-9));
  ok("every width is its own tonnes", segs.every((n) => near(n.w / 100 * total, n.t, 1e-9)),
     segs.map((n) => (n.w / 100 * total).toFixed(4) + "/" + n.t.toFixed(4)).join(" "));
  ok("the top row is one segment per part", row1.length === parts.length);
  ok("nothing is given a width it has not earned", segs.every((n) => n.w >= 0 && n.t >= 0));
  parts.forEach((p) => {
    if (!p.parts) return;
    ok(p.id + " equals its parts", near(sum(p.parts.map((k) => k.t)), p.t, 1e-9));
  });
  // The honest blank: a part with no measured breakdown must be drawn hatched, never coloured.
  const unknown = (html.match(/fl-unknown/g) || []).length;
  ok("every part without a measured breakdown is marked as not broken down",
     unknown === parts.filter((p) => !p.parts).length,
     unknown + " hatched for " + parts.filter((p) => !p.parts).length + " unmeasured parts");
  // the dashed mark has to sit at its own share of the bar, like every other width here
  const ghtml = chart.flow({ parts: parts, total: total, base: nat, trunkLabel: "x",
    goal: { value: pt.value, label: "derived" } });
  const gm = ghtml.match(/class="fl-goal-line" style="left:([0-9.]+)%/);
  ok("the derived mark is drawn", !!gm);
  ok("and it sits at its own share of the bar",
     gm && near(parseFloat(gm[1]) / 100 * total, pt.value, 1e-3),
     gm ? (parseFloat(gm[1]) / 100 * total).toFixed(4) + " vs " + pt.value : "-");
  ok("a bar with no target drawn carries no mark",
     chart.flow({ parts: parts, total: total, base: nat, trunkLabel: "x" }).indexOf("fl-goal-line") < 0);

  ok("a part WITH a measured breakdown is never hatched",
     !parts.filter((p) => p.parts).some((p) => html.indexOf('fl-unknown" data-kind="leaf" data-t="' + p.t) >= 0));
}
report("the benchmarks agree and the flow is the arithmetic");

/* ---------- 11. compensation is described, never subtracted ----------
 * The one thing that must never become true: a tonne of compensation reducing the footprint.
 * Plus the ladder's own arithmetic — the bar is the MIX, so its widths are shares of what was
 * bought and never of the footprint, and the two Oxford shares are the rungs they claim to be.
 */
console.log("Compensation");
{
  const chart = globalThis.GreenApp.chart, T = F.offsetTypes;
  const sum = (xs) => xs.reduce((x, y) => x + y, 0);
  const near = (x, y, eps) => Math.abs(x - y) <= (eps || 1e-9);
  const keys = Object.keys(T).filter((k) => k !== "source");

  // the ladder's rungs have to BE a ladder
  const ranks = keys.map((k) => T[k].rank).sort((a, b) => a - b);
  ok("every kind has a distinct rank", new Set(ranks).size === keys.length && ranks[0] === 1);
  keys.forEach((k) => {
    ok(k + " says what it stores and what can go wrong",
       typeof T[k].storage === "string" && T[k].storage.length > 8 &&
       typeof T[k].risk === "string" && T[k].risk.length > 8);
    ok(k + " carries a colour and a short name", /^#[0-9A-Fa-f]{6}$/.test(T[k].color || "") && !!T[k].short);
    // the two Oxford shifts only ever go forwards up the ladder
    if (T[k].centuryStorage) ok(k + ": century storage implies removal or protection", T[k].rank >= 4);
    if (T[k].rank >= 3) ok(k + ": the top three are removals", T[k].removal === true);
    if (T[k].rank <= 2) ok(k + ": the bottom two are not removals", T[k].removal === false);
  });
  // the ramp has to be readable without colour: lightness falls monotonically with rank
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const byRank = keys.slice().sort((a, b) => T[a].rank - T[b].rank);
  for (let i = 1; i < byRank.length; i++) {
    ok("the ramp keeps getting darker (" + byRank[i - 1] + " → " + byRank[i] + ")",
       lum(T[byRank[i]].color) < lum(T[byRank[i - 1]].color) - 0.03,
       lum(T[byRank[i - 1]].color).toFixed(3) + " → " + lum(T[byRank[i]].color).toFixed(3));
  }

  profiles.slice(0, 200).forEach((p, i) => {
    const before = engine.calculate(p).total;
    const q = clone(p);
    q.offsets = { any: true, types: [], avoidance: 1.1, forest: 0.6, natureRemoval: 0.9,
                  biochar: 0.3, durable: 0.2, contributionEur: 90, certification: "Gold Standard" };
    const after = engine.calculate(q).total;
    ok("buying compensation does not move the footprint", near(after, before, 1e-9),
       before.toFixed(6) + " → " + after.toFixed(6));

    const c = engine.compensation(q);
    ok("the total is what was bought", near(c.tonnes, 1.1 + 0.6 + 0.9 + 0.3 + 0.2, 1e-9));
    ok("the rungs come back weakest first",
       c.byType.every((x, k) => k === 0 || x.info.rank > c.byType[k - 1].info.rank));
    ok("the removal share is the removals over the whole mix",
       near(c.removalShare, (0.9 + 0.3 + 0.2) / c.tonnes, 1e-9));
    ok("the century share is the long-storage rungs over the whole mix",
       near(c.centuryShare, (0.3 + 0.2) / c.tonnes, 1e-9));
    ok("neither share can exceed the whole", c.removalShare <= 1 + 1e-9 && c.centuryShare <= c.removalShare + 1e-9);

    if (i > 0) return;   // the drawn bar only needs checking once — it has no per-profile input
    const rungs = c.byType.map((x) => ({ rank: x.info.rank, short: x.info.short, label: x.info.label,
      color: x.info.color, examples: x.info.examples, storage: x.info.storage, risk: x.info.risk, t: x.tonnes }));
    const html = chart.ladder({ rungs: rungs, total: c.tonnes,
      removalShare: c.removalShare, centuryShare: c.centuryShare });
    const w = [], re = /class="lad-seg[^"]*" data-t="([0-9.eE+-]+)" style="width:([0-9.eE+-]+)%/g;
    let m; while ((m = re.exec(html))) w.push({ t: parseFloat(m[1]), w: parseFloat(m[2]) });
    ok("the ladder draws every rung that was bought", w.length === rungs.length);
    ok("the ladder is exactly full", near(sum(w.map((x) => x.w)), 100, 1e-9));
    ok("every rung's width is its share of the MIX, not of the footprint",
       w.every((x) => near(x.w / 100 * c.tonnes, x.t, 1e-9)));
    ok("the ladder never scales itself against the footprint",
       !near(sum(w.map((x) => x.w)) / 100 * before, c.tonnes, 1e-9) || near(before, c.tonnes, 1e-9));
  });

  // nothing bought: the explainer ladder is evenly spaced and carries no tonnes
  const allRungs = byRank.map((k) => ({ rank: T[k].rank, short: T[k].short, label: T[k].label,
    color: T[k].color, examples: T[k].examples, storage: T[k].storage, risk: T[k].risk, t: 0 }));
  const emptyHtml = chart.ladder({ rungs: allRungs, total: 0, removalShare: 0, centuryShare: 0 });
  ok("with nothing bought the ladder is an explainer, evenly spaced",
     (emptyHtml.match(/lad-ghost/g) || []).length === allRungs.length);
  ok("and it claims no tonnes", emptyHtml.indexOf("lad-stat") < 0);
}
report("compensation is described, never subtracted");

/* ---------- 12. one diagram, one renderer ----------
 * A phone once got its own turned version of the Sankey. Two renderers meant two chances to
 * disagree about the same arithmetic, and the audit had to keep proving they did not. The
 * phone now gets the SAME diagram, drawn at a readable size in a container that scrolls, so
 * there is one renderer and nothing to reconcile. This check is what stops a second one
 * quietly reappearing.
 */
console.log("One diagram");
{
  const api = Object.keys(globalThis.GreenApp.sankey).sort().join(",");
  ok("the sankey exposes exactly one renderer", api === "attach,mergeSmall,model,render", api);
}
report("one diagram, one renderer");

/* ---------- 13. rebound is stated, never subtracted ----------
 * The app reports upper bounds and says so. The temptation is to "improve" the numbers by
 * discounting them for rebound, and that would be worse, not better: rebound depends on what
 * a particular person does with the money they stop spending, not on the lever, so a
 * discounted figure is an unmeasurable point estimate dressed up as a measurement. The rule
 * is the same one compensation and financed emissions follow — stated beside the number,
 * never inside it — and this section is what stops someone quietly changing it.
 */
console.log("Rebound");
{
  const rb = F.rebound;
  const src = globalThis.GreenApp.sources["js/engine.js"];
  ok("rebound is recorded as data", !!rb && rb.usedInArithmetic === false);
  ok("it cites where its numbers come from", typeof rb.source === "string" && rb.source.length > 80);
  ok("it separates direct rebound from re-spending",
     rb.directLow > 0 && rb.directHigh > rb.directLow && rb.packageCutBefore > rb.packageCutAfterHigh);
  ok("the package figures are a take-back, not a gain", rb.packageCutAfterHigh < rb.packageCutBefore);

  // The load-bearing one: the engine must never have seen this object.
  ok("the engine never reads it — the savings are not discounted",
     typeof src === "string" && src.indexOf("rebound") < 0,
     "engine.js mentions rebound");

  // And the savings themselves must still be exactly what a recalculation gives.
  profiles.slice(0, 60).forEach((p, i) => {
    const all = engine.levers(p);
    if (!all.length) return;
    const base = engine.calculate(p).total;
    all.slice(0, 4).forEach((l) => {
      const q = clone(p);
      l.change(q);
      const got = base - engine.calculate(q).total;
      ok("a lever's saving is the undiscounted recalculation (" + l.id + ")",
         Math.abs(got - l.saved) <= 1e-9, got.toFixed(6) + " vs " + l.saved.toFixed(6));
    });
  });
}
  /* The overview puts three quantities side by side, and only two of them may ever be
   * added. Financed emissions are attributed rather than consumed — already inside the
   * footprint of whoever buys what those companies make — so summing all three would count
   * the same tonnes twice. The arithmetic the card prints is checked here.
   */
  profiles.slice(0, 80).forEach((p) => {
    const lifestyle = engine.calculate(p).total;
    const B2 = globalThis.GreenApp.benchmarks;
    const publicShare = B2.publicShare.parts.reduce((a, x) => a + x.shareOfNational * B2.austria.nationalTotal, 0);
    ok("the excluded share is a real quantity", publicShare > 0);
    ok("it is not the lifestyle figure wearing a different label",
       Math.abs(publicShare - lifestyle) > 1e-6 || lifestyle === 0);

    // The one that matters: money must sit OUTSIDE the footprint. Give the profile a large
    // investment and the measured footprint must not move by a gram.
    const rich = clone(p);
    rich.money = { bankType: "conventional", savings: "conventional", amount: 250000 };
    ok("financed emissions are outside the footprint, not inside it",
       Math.abs(engine.calculate(rich).total - lifestyle) < 1e-9,
       lifestyle.toFixed(9) + " → " + engine.calculate(rich).total.toFixed(9));
    const fin = engine.financed(rich);
    ok("and they are reported as a range, never a single number", fin && fin.high > fin.low);
    ok("the range scales with the amount", fin.high > engine.financed(
       Object.assign(clone(p), { money: { bankType: "conventional", savings: "conventional", amount: 10000 } })).high);
  });
  /* The path and the stock. Two rules:
   *   · the trajectory must descend — it is the reason 2.5 t is not a destination;
   *   · the remaining budget is CO2 ONLY while everything else here is CO2e, so nothing may
   *     divide one by the other. A personal countdown would be arithmetic across two units.
   */
  {
    const T = globalThis.GreenApp.benchmarks.targets, rem = T.remaining;
    ok("the trajectory has more than one point", T.trajectory && T.trajectory.length >= 3);
    for (let i = 1; i < T.trajectory.length; i++) {
      ok("the path keeps falling (" + T.trajectory[i - 1].year + " → " + T.trajectory[i].year + ")",
         T.trajectory[i].value < T.trajectory[i - 1].value &&
         T.trajectory[i].year > T.trajectory[i - 1].year);
    }
    ok("the first waypoint is the goal the app compares against",
       Math.abs(T.trajectory[0].value - T.y2030.value) < 1e-9);
    ok("the remaining budget is flagged CO2-only", rem.isCO2Only === true);
    ok("it cites its source", typeof rem.source === "string" && rem.source.length > 80);
    ok("the per-person share is a plausible order of magnitude",
       rem.gtCO2 * 1e9 / rem.worldPopulation > 5 && rem.gtCO2 * 1e9 / rem.worldPopulation < 60,
       (rem.gtCO2 * 1e9 / rem.worldPopulation).toFixed(1) + " t");
    // the engine must not have learned about any of this
    const esrc = globalThis.GreenApp.sources["js/engine.js"];
    ok("the engine never reads the remaining budget",
       typeof esrc === "string" && esrc.indexOf("remaining") < 0 && esrc.indexOf("trajectory") < 0);
  }
report("rebound is stated, never subtracted");

/* 14. The Context tab ------------------------------------------------------------
 * The tab makes claims about what named companies did. That is exactly the kind of
 * content that decays into received wisdom, so it gets the same treatment as a tonne:
 * it has to come from the data file, and the data file has to cite it.
 *
 * The third check is the one that matters most. The tab's own argument is that
 * doomism has no funder — it spreads among people who accept the science. It would be
 * very easy for a later edit to make that page tidier by pinning doomism on an oil
 * company, and there is no source for that. So the audit forbids it.
 */
{
  const C = globalThis.GreenApp.context;
  const THIS_YEAR = new Date().getFullYear();
  ok("the context data exists", !!C && Array.isArray(C.timeline) && C.timeline.length > 10);

  const seenAt = new Set();
  C.timeline.forEach((e) => {
    const where = e.year + " " + (e.label || "?").slice(0, 40);
    ok("has a plausible year · " + where, Number.isInteger(e.year) && e.year >= 1950 && e.year <= THIS_YEAR);
    ok("has a label · " + where, typeof e.label === "string" && e.label.length > 3);
    ok("has a detail · " + where, typeof e.detail === "string" && e.detail.length > 20);
    /* One standard for every card, because three of them used to fail it and a reader
     * could not tell from the headline what had happened. */
    ok("the headline is a clause, not a bare label · " + where, e.label.split(" ").length >= 6,
       e.label);
    ok("the detail says why it matters · " + where, /why it matters/i.test(e.detail),
       e.detail.slice(0, 50));
    ok("has somewhere to click · " + where, typeof e.url === "string" && e.url.indexOf("https://") === 0);
    // the whole point: no event is here because it is well known
    ok("cites a source · " + where, typeof e.source === "string" && e.source.length > 15);
    ok("is on a known track · " + where, ["propaganda", "movement", "landmark"].indexOf(e.track) >= 0);
    // A column headed "fossil fuel propaganda" must not quietly relabel evidence about the
    // industry as an act of persuasion by it. The one entry that is a research finding is
    // marked, and the renderer gives it a different chip.
    if (e.kind) ok("the only marked kind is evidence · " + where, e.kind === "knew", e.kind);
    ok("has a unique sort key · " + where, typeof e.at === "string" && !seenAt.has(e.at));
    seenAt.add(e.at);
    if (e.delay) {
      const known = C.delay.groups.some((g) => g.moves.some((m) => m.id === e.delay)) || e.delay === C.delay.denial.id;
      ok("names a discourse that exists · " + where, known, e.delay);
    }
    if (e.technique) {
      ok("names a technique that exists · " + where,
         (C.delay.other || []).some((o) => o.id === e.technique), e.technique);
    }
  });

  // Nothing is attributed to a company that the source does not name.
  const ORGS = ["Exxon", "BP", "Shell", "Aramco", "OMV", "Chevron", "Mobil", "Peabody", "OPEC"];
  C.timeline.forEach((e) => {
    const said = e.label + " " + e.detail;
    ORGS.forEach((org) => {
      if (said.indexOf(org) >= 0) {
        ok("the source names " + org + " too · " + e.year,
           e.source.indexOf(org) >= 0 || e.source.indexOf("Union of Concerned Scientists") >= 0 ||
           e.source.indexOf("OECD Watch") >= 0 || e.source.indexOf("DeSmog") >= 0 ||
           e.source.indexOf("Climate Action Against Disinformation") >= 0 ||
           e.source.indexOf("OpenMind") >= 0 || e.source.indexOf("Conservation Law Foundation") >= 0);
      }
    });
  });

  // Doomism has no funder. No named organisation may be put on it.
  C.timeline.forEach((e) => {
    if (e.delay === "doomism") {
      ok("doomism is not pinned on a named organisation · " + e.year,
         !ORGS.some((o) => (e.label + " " + e.detail).indexOf(o) >= 0), e.label);
    }
  });
  ok("doomism appears in the taxonomy with no organisation attached",
     C.delay.groups.some((g) => g.moves.some((m) => m.id === "doomism")) &&
     !C.timeline.some((e) => e.delay === "doomism"));

  // The taxonomy is complete and attributed.
  ok("the taxonomy has four groups", C.delay.groups.length === 4);
  ok("the taxonomy cites Lamb et al.", C.delay.source.indexOf("Lamb") >= 0 && C.delay.source.indexOf("2020") >= 0);
  let moveCount = 0;
  C.delay.groups.forEach((g) => {
    ok("group has a question · " + g.label, typeof g.question === "string" && g.question.indexOf("?") > 0);
    ok("group has moves · " + g.label, g.moves.length >= 2);
    g.moves.forEach((m) => {
      moveCount++;
      ok("move says something · " + m.label, typeof m.says === "string" && m.says.length > 10);
      ok("move explains what it does · " + m.label, typeof m.does === "string" && m.does.length > 20);
    });
  });
  ok("all twelve discourses are present", moveCount === 12, moveCount + " found");

  // The worked examples, including the one aimed at this app's own side.
  ok("there are at least three claims", C.claims.length >= 3);
  C.claims.forEach((c) => {
    // A claim on a page about checking claims has to be checkable, so here the citation
    // is not enough on its own: each one needs somewhere to click. (This check fired the
    // moment `source` became `sources` — which is the only reason the change was noticed.)
    ok("claim cites sources · " + c.id, Array.isArray(c.sources) && c.sources.length >= 2);
    c.sources.forEach((x, i) => {
      ok("claim source " + i + " has text · " + c.id, typeof x.text === "string" && x.text.length > 20);
      ok("claim source " + i + " is clickable · " + c.id, typeof x.url === "string" && /^https:\/\/[^\s"]+\.[^\s"]+/.test(x.url));
    });
    // Both halves of a half-true claim need support, not just the half that is true.
    ok("the correction half is sourced too · " + c.id, c.sources.length >= 3 || c.status === "false");
    ok("claim names the move it is · " + c.id,
       C.delay.groups.some((g) => g.moves.some((m) => m.id === c.move)));
    ok("claim states what is true in it · " + c.id, typeof c.truth === "string" && c.truth.length > 20);
  });
  ok("at least one worked example is a claim from the climate side",
     C.claims.some((c) => /climate side|our own arguments|own side/.test(c.moveNote || "")));

  // Every URL anywhere in the file is https and looks like a URL. A page whose argument is
  // "you can check this" cannot afford a dead or malformed link.
  const urls = [];
  C.timeline.forEach((e) => { if (e.url) urls.push(["timeline " + e.year, e.url]); });
  C.claims.forEach((c) => c.sources.forEach((x) => urls.push(["claim " + c.id, x.url])));
  C.silence.points.forEach((p) => { if (p.url) urls.push(["silence", p.url]); });
  if (C.delay.url) urls.push(["taxonomy", C.delay.url]);
  if (C.delay.whyUrl) urls.push(["inoculation", C.delay.whyUrl]);
  urls.forEach(([where, u]) => {
    ok("https and well formed · " + where, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i.test(u), u);
    ok("not a bare homepage standing in for a citation · " + where,
       u.replace(/^https:\/\/[^/]+\//, "").length > 0 || /indicators\.climate/.test(u), u);
  });
  ok("the whole timeline is clickable", C.timeline.every((e) => !!e.url),
     C.timeline.filter((e) => !e.url).length + " without a link");
  ok("the taxonomy links the paper it is taken from", /cambridge\.org|doi/.test(C.delay.url || ""));

  /* The propaganda column, named. Two rules follow from calling it that:
   * every entry on it has to be either an act of persuasion with a technique named, or
   * explicitly marked as evidence — and no row headline may repeat a lobby's own name for
   * itself, because a headline is where a name gets laundered. */
  const prop = C.timeline.filter((e) => e.track === "propaganda");
  ok("the propaganda column is not empty", prop.length >= 8, prop.length + " entries");
  prop.forEach((e) => {
    ok("names a technique, or is marked as evidence · " + e.year,
       !!e.delay || !!e.technique || e.kind === "knew", e.label.slice(0, 40));
  });
  /* Self-chosen names that read as their own opposite. The earlier rule banned them from
   * headlines outright, which was too blunt: "Oil and coal companies set up a lobby called
   * 'Global Climate Coalition' that fights against climate policy" names the thing AND says
   * what it did, and is clearer than hiding the name in the detail. The laundering happens
   * when the name stands alone as a label. So the rule is now: if one of these appears in a
   * headline, the headline must also say what the thing actually did.
   */
  const LAUNDERED = ["Global Climate Coalition", "Beyond Petroleum", "Information Council for the Environment"];
  const SAYS_WHAT_IT_DID = /fights?\b|fight\b|against|block|oppos|lobby|advertis|campaign|rebrand|reposition|doubt|deny|denial/i;
  C.timeline.forEach((e) => {
    LAUNDERED.forEach((name) => {
      if (e.label.indexOf(name) >= 0) {
        ok("a lobby's own name is qualified where it is used · " + e.year,
           SAYS_WHAT_IT_DID.test(e.label), e.label);
        // and it appears as a name being reported, in quotation marks, not as plain prose
        ok("the name is quoted, not asserted · " + e.year,
           e.label.indexOf("\u201c" + name + "\u201d") >= 0, e.label);
      }
    });
  });

  // The silence section, and the app's own admission.
  ok("the silence section quotes its source", C.silence.attribution.indexOf("Marshall") >= 0);
  ok("every point in it is sourced", C.silence.points.every((p) => typeof p.source === "string" && p.source.length > 10));
  ok("the app admits its own frame", /BP/.test(C.ourselves.admission));
  ok("and does not claim to have fixed it", /1\.1/.test(C.ourselves.unresolved));

  /* Villach is the starting line of the whole page, so it has to be on it. A timeline of
   * climate propaganda that begins at the propaganda rather than at the science it was
   * written against would be telling half the story. */
  ok("the 1985 Villach conference is on the timeline",
     C.timeline.some((e) => e.year === 1985 && /Villach/.test(e.label)));
  ok("and the meta-silence has a place in the chronology, not only a card below it",
     C.timeline.some((e) => /meta-silence/i.test(e.label)));
  // Both tracks are sourced to the same standard. The movement side was the weaker half.
  ["propaganda", "movement", "landmark"].forEach((track) => {
    const rows = C.timeline.filter((e) => e.track === track);
    ok("every " + track + " entry has a link", rows.every((e) => !!e.url),
       rows.filter((e) => !e.url).map((e) => e.year).join(","));
  });

  // Finally: the renderer draws every event exactly once, and one pill per distinct year.
  const html = globalThis.GreenApp.chart.timeline({
    events: C.timeline, ariaLabel: "x",
    cite: (t, u) => (u ? '<a href="' + u + '">' + t + "</a>" : t)
  });
  // The citation is rendered inside the card, not only in the list underneath it.
  ok("every card carries its own source line",
     (html.match(/class="tl-src"/g) || []).length === C.timeline.length,
     (html.match(/class="tl-src"/g) || []).length + " of " + C.timeline.length);
  const rows = (html.match(/class="tl-row /g) || []).length;
  const pills = (html.match(/class="tl-yearmark"/g) || []).length;
  ok("every event is drawn exactly once", rows === C.timeline.length, rows + " of " + C.timeline.length);
  ok("one year marker per distinct year", pills === new Set(C.timeline.map((e) => e.year)).size);
  const drawnYears = (html.match(/<span>(\d{4})<\/span>/g) || []).map((m) => +m.replace(/\D/g, ""));
  let ascending = true;
  for (let i = 1; i < drawnYears.length; i++) if (drawnYears[i] < drawnYears[i - 1]) ascending = false;
  ok("the years come out in order", ascending, drawnYears.join(","));
}
report("the Context tab is sourced, and doomism has no owner");

console.log("\n" + passed + " checks passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
