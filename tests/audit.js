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
 */
require("../data/factors.js");
require("../data/benchmarks.js");
require("../js/engine.js");
require("../js/questions.js");
require("../js/chart.js");
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

console.log("\n" + passed + " checks passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
