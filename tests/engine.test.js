/*
 * Math tests. Run with:  node tests/engine.test.js
 * Expected values are calculated by hand (see comments) — not copied from the engine.
 */
require("../data/factors.js");
require("../data/benchmarks.js");
require("../js/engine.js");
require("../js/questions.js");
const { engine, questions } = globalThis.GreenApp;

let failed = 0, passed = 0;
function close(name, actual, expected, tol = 1e-6) {
  if (Math.abs(actual - expected) <= tol) { passed++; console.log("  ✓ " + name + " = " + actual.toFixed(5)); }
  else { failed++; console.log("  ✗ " + name + ": expected " + expected + ", got " + actual); }
}
function ok(name, cond) {
  if (cond) { passed++; console.log("  ✓ " + name); } else { failed++; console.log("  ✗ " + name); }
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- Case 1: typical Austrian couple ----------
const typical = {
  household: { size: 2 },
  home: { area: { v: 80, c: "exact" }, building: "average", heating: "gas", electricity: { v: 2800, c: "exact" }, greenTariff: false },
  car: { type: "petrol", km: { v: 10000, c: "estimate" }, people: 1 },
  transit: { trainHours: { v: 2 * 52, c: "estimate" }, cityHours: { v: (40 / 60) * 230, c: "estimate" } },
  flights: { short: 2, medium: 0, long: 0, cls: "economy" }, // 2 one-way legs = one trip there and back
  food: {
    portions: { beef: "weekly", pork: "often", poultry: "weekly", sausage: "often", fish: "monthly",
                cheese: "daily", milk: "daily", butter: "daily", eggs: "often", coffee: "twiceDaily" },
    airFreight: { berries: "monthly", vegetables: "never", exotic: "never" },
    waste: { fruitVeg: "often", leftovers: "sometimes" }
  },
  goods: { clothes: 600, electronics: 800, furniture: 300, other: 400, secondHand: { clothes: "new", electronics: "new", furniture: "new", other: "new" } },
  services: { eatingOut: 1200, hotels: 800, leisure: 600 },
  digital: { streamingHoursDay: 2, aiPromptsDay: 20, aiImagesMonth: 10, aiVideosMonth: 0 },
  money: { bankType: "conventional", savings: "none" },
  offsets: {}
};
console.log("Case 1 — typical couple, gas heating, petrol car, omnivore");
const r1 = engine.calculate(typical);
// heat: 80 m² × 120 + 2 × 700 = 11,000 kWh ÷ 0.9 × 0.249 = 3,043.33 kg ; electricity 2,800 × 0.209 = 585.2 → ÷ 2
close("housing (t)", r1.byDomain.housing, 1.8142667, 1e-6);
// car 0.07 × 8.9 × 0.327 + 0.035 = 0.238721 kg/km × 10,000 = 2,387.21
// train: 2 h/week × 52 = 104 h × 80 km/h = 8,320 km × 0.02 = 166.4
// city: 40 min/workday × 230 = 153.3 h × 18 km/h = 2,760 km × 0.05 = 138
close("transport (t)", r1.byDomain.transport, 2.69161, 1e-6);
close("flights (t)", r1.byDomain.flights, 0.38016, 1e-9); // 2 legs × 1,100 km × 1.08 × 0.16
// food: portions/week × 52 × portion kg × kg CO2e/kg
//   meat  = beef 1.5×52×0.15×13.6 (159.12) + pork 4×52×0.125×4.6 (119.6) + poultry 53.625 + sausage 30.16 + fish 9.75 = 372.255
//   dairy = cheese 82.992 + milk 109.2 + butter 50.96 + eggs 37.44 = 280.592 ; coffee 14×52×0.01×5.6 = 40.768 ; base 380
//   eaten = 1,073.615
//   waste "rarely" = 2% → ×0.02/0.98 on meat, dairy, bread (57) and the rest (247 + 40.768)
//   fruit & veg (20% of base = 76) "often" = 20% → 76 × 0.25 = 19 ; leftovers "sometimes" +3% of eaten (32.21)
//   air freight: berries 12 purchases × 0.25 kg × 8 = 24
close("food (t)", r1.byDomain.food, 1.1691829, 1e-6);
close("goods (t)", r1.byDomain.goods, 0.61, 1e-9); // 600×.3 + 800×.3 + 300×.3 + 400×.25
// services: eating out 1200×.15 = 180 (the venue only — the meals themselves are already in "food",
//   so a full food-service factor would count the same steak twice) + hotels 800×.25 = 200
//   + leisure 600×.12 = 72 → 452 ; digital: 2h×365×.055 = 40.15, 20×365×.0003 = 2.19, 120×.001 = .12 → 42.46
// (insurance and banking are deliberately not counted)
close("services (t)", r1.byDomain.services, 0.49446, 1e-9);
close("TOTAL (t)", r1.total, 7.1596796, 1e-6);
close("digital detail (kg)", engine.details(typical).digitalKg, 42.46, 1e-9);

// ---------- Food waste depends on WHAT is thrown away ----------
console.log("\nFood waste by category");
const meatWaster = clone(typical); meatWaster.food.waste = { meatFish: "often" };
const breadWaster = clone(typical); breadWaster.food.waste = { bread: "often" };
// meat "often" (20%): 372.255 × 0.25 = 93.06 kg extra instead of 7.60
close("throws away meat often (t)", engine.calculate(meatWaster).byDomain.food, 1.2049922, 1e-6);
close("throws away bread often (t)", engine.calculate(breadWaster).byDomain.food, 1.1326122, 1e-6);
ok("wasting meat costs more than wasting bread", engine.calculate(meatWaster).byDomain.food > engine.calculate(breadWaster).byDomain.food);

// ---------- Case 2: low-carbon single ----------
const green = {
  household: { size: 1 },
  home: { area: { v: 50, c: "exact" }, building: "efficient", heating: "heatpump", electricity: { v: 1800, c: "exact" }, greenTariff: true },
  car: { type: "ev", km: { v: 5000, c: "exact" }, people: 2 },
  transit: { trainHours: { v: 0, c: "exact" }, cityHours: { v: 0, c: "exact" } },
  flights: { short: 0, medium: 0, long: 0, cls: "economy" },
  food: { portions: { plantProtein: "daily", plantDrink: "daily" }, airFreight: {}, waste: {} },
  goods: { clothes: 200, electronics: 300, furniture: 0, other: 100, secondHand: { clothes: "mostly", electronics: "mostly", other: "mostly" } },
  services: { eatingOut: 0, hotels: 0, leisure: 0 },
  digital: { streamingHoursDay: 0, aiPromptsDay: 0, aiImagesMonth: 0, aiVideosMonth: 0 },
  money: { bankType: "conventional", savings: "none" },
  offsets: { durable: 1, avoidance: 2, contributionEur: 100 }
};
console.log("\nCase 2 — heat pump, green tariff, shared EV, vegan");
const r2 = engine.calculate(green);
// heat 50 × 45 + 700 = 2,950 ÷ 3.2 × 0.03 = 27.656 ; elec 1,800 × 0.03 = 54
close("housing (t)", r2.byDomain.housing, 0.08165625, 1e-9);
close("transport (t)", r2.byDomain.transport, 0.15175, 1e-9); // (0.19×0.03 + 0.055) × 5,000 ÷ 2
// food: tofu 7×52×0.125×1.1 = 50.05 ; oat drink 7×52×0.2×0.35 = 25.48 ; base 380 → 455.53
// waste all 2%: 455.53 × 0.02/0.98 = 9.2965
close("food (t)", r2.byDomain.food, 0.46482653, 1e-6);
close("goods (t)", r2.byDomain.goods, 0.105, 1e-9); // (60 + 90 + 25) × 0.6
close("TOTAL (t)", r2.total, 0.80323278, 1e-6);
const comp = engine.compensation(green);
ok("compensation reported per type: 3 t total, 2 types", comp.tonnes === 3 && comp.byType.length === 2);
ok("compensation NOT subtracted from footprint", Math.abs(r2.total - 0.80323278) < 1e-6);

// ---------- Case 3: long-haul business flight ----------
console.log("\nCase 3 — one long-haul trip in business (2 one-way legs)");
const biz = clone(typical);
biz.flights = { short: 0, medium: 0, long: 2, cls: "business" };
// 2 legs × 7,500 km × 1.08 × 0.142 × 2.9 = 6,671.16 kg
close("flights (t)", engine.calculate(biz).byDomain.flights, 6.67116, 1e-6);
const oneWay = clone(biz); oneWay.flights.long = 1;
close("one leg is exactly half", engine.calculate(oneWay).byDomain.flights, 3.33558, 1e-6);

// ---------- Air-freighted food ----------
console.log("\nAir freight");
const flyer = clone(typical);
flyer.food.airFreight = { berries: "weekly", vegetables: "monthly", exotic: "rare" };
// berries 52 × 0.25 × 8 = 104 ; veg 12 × 0.4 × 8 = 38.4 ; exotic 4 × 0.5 × 8 = 16 → 158.4 kg (vs 24 kg)
close("more air freight adds (t)", engine.calculate(flyer).byDomain.food - r1.byDomain.food, 0.1344, 1e-9);
const grounded = clone(typical); grounded.food.airFreight = {};
close("none at all (t)", r1.byDomain.food - engine.calculate(grounded).byDomain.food, 0.024, 1e-9);

// ---------- Measured energy use ----------
console.log("\nMeasured yearly energy (from the bill)");
const measured = clone(typical);
measured.home.heatKnown = { v: 12000, c: "exact" }; // 12,000 kWh gas
// (12,000 × 0.249 + 2,800 × 0.209) ÷ 2 = 1,786.6 kg — area & building age no longer matter
close("housing with 12,000 kWh gas (t)", engine.calculate(measured).byDomain.housing, 1.7866, 1e-9);
const measuredBig = clone(measured); measuredBig.home.area = { v: 300, c: "exact" };
close("…same when floor area changes", engine.calculate(measuredBig).byDomain.housing, 1.7866, 1e-9);

// ---------- Levers ----------
console.log("\nLevers (what could change)");
const lv = Object.fromEntries(engine.levers(typical).map((l) => [l.id, l]));
close("green tariff saves (t)", lv.greenTariff.saved, 0.2506, 1e-9);          // 2,800 × (0.209 − 0.03) ÷ 2
close("heat pump saves (t)", lv.heatPump.saved, 1.1624479, 1e-6);            // (11,000 ÷ 0.9 × 0.249 − 11,000 ÷ 3.2 × 0.209) ÷ 2
close("1 °C lower saves (t)", lv.temperature.saved, 0.07968, 1e-9);          // 9,600 × 6% ÷ 0.9 × 0.249 ÷ 2
const lvm = Object.fromEntries(engine.levers(measured).map((l) => [l.id, l]));
// measured: heat 10,800 → space 8,640 × 45/120 = 3,240 + hot water 2,160 = 5,400 ÷ 0.9 × 0.249
close("renovation saves, measured case (t)", lvm.renovate.saved, 0.747, 1e-9);
ok("levers sorted biggest first", engine.levers(typical).every((l, i, a) => i === 0 || a[i - 1].saved >= l.saved));
typical.home.type = "house"; typical.home.tenure = "own";
ok("owner of a house decides on the heating", engine.levers(typical).find((l) => l.id === "heatPump").control === "yours");
const flatOwner = clone(typical); flatOwner.home.type = "flat";
ok("flat owner needs the co-owners", engine.levers(flatOwner).find((l) => l.id === "heatPump").control === "shared");
const renter = clone(typical); renter.home.tenure = "rent";
ok("renter: heat pump marked as landlord's decision", engine.levers(renter).find((l) => l.id === "heatPump").control === "landlord");

// ---------- Uncertainty ----------
console.log("\nUncertainty (Monte Carlo)");
const s1 = engine.simulate(typical, { samples: 4000, seed: 42 });
const s1b = engine.simulate(typical, { samples: 4000, seed: 42 });
ok("same answers → identical range (reproducible)", s1.low === s1b.low && s1.high === s1b.high);
ok("central value lies inside the range (" + s1.low.toFixed(2) + "–" + s1.high.toFixed(2) + ")", s1.low < r1.total && r1.total < s1.high);
ok("median within 5% of central value", Math.abs(s1.median - r1.total) / r1.total < 0.05);
ok("every area has a range around its value", Object.keys(r1.byDomain).every((k) => s1.byDomain[k].low <= r1.byDomain[k] + 1e-9 && r1.byDomain[k] <= s1.byDomain[k].high + 1e-9));
const guessy = clone(typical);
guessy.car.km.c = "guess"; guessy.home.area.c = "guess";
const s2 = engine.simulate(guessy, { samples: 4000, seed: 42 });
ok("guessing widens the range (" + (s1.high - s1.low).toFixed(2) + " → " + (s2.high - s2.low).toFixed(2) + " t)", (s2.high - s2.low) > (s1.high - s1.low));
const big = engine.biggestUncertainty(guessy, { samples: 2000, seed: 42 });
ok("biggest uncertainty identified: " + (big && big.key), big && (big.key === "input.carKm" || big.key === "input.area"));

// ---------- Sankey sources ----------
console.log("\nSankey sources");
const src = engine.sources(typical);
const byDom = {};
src.forEach((x) => { byDom[x.domain] = (byDom[x.domain] || 0) + x.t; });
Object.keys(r1.byDomain).forEach((k) => close("sources add up to " + k, byDom[k] || 0, r1.byDomain[k], 1e-9));
close("sources add up to the total", Object.keys(byDom).reduce((a, k) => a + byDom[k], 0), r1.total, 1e-9);
ok("every source has a label", src.every((x) => x.label && x.t > 0));

// ---------- Reaching the goal ----------
console.log("\nReaching the 1.5 °C goal");
const flyer2 = clone(typical);
flyer2.flights = { short: 2, medium: 2, long: 2, cls: "economy", purpose: "leisure" };
flyer2.car.dependence = "partly";
const before = engine.calculate(flyer2).total;
const path = engine.pathToTarget(flyer2, 3.0);
ok("a heavy flyer can reach 3.0 t (" + before.toFixed(1) + " → " + path.total.toFixed(1) + " t via " + path.levers.map((l) => l.id).join(" + ") + ")", path.reached);
const allLevers = engine.levers(flyer2);
ok("there is a lever that removes flights completely", allLevers.some((l) => l.id === "noFlights"));
const zeroFlights = JSON.parse(JSON.stringify(flyer2));
allLevers.find((l) => l.id === "noFlights").change(zeroFlights);
close("…and it really zeroes them", engine.calculate(zeroFlights).byDomain.flights, 0, 1e-12);

// ---------- Every question is labelled ----------
console.log("\nQuestion labels");
const steps = questions.steps;
ok("every question has a section and an influence weight", steps.every((s) => s.section && ["high", "medium", "low", "none"].includes(s.weight)));
ok("every key word really appears in its question", steps.every((s) => {
  if (!s.keyword) return true;
  const text = typeof s.ask === "function" ? s.ask(questions.blankProfile()) : s.ask;
  return text.toLowerCase().includes(s.keyword.toLowerCase());
}));
ok("no insurance question any more", !steps.some((s) => s.id === "insurance"));
ok("city transit has no 'per workday' unit", !steps.find((s) => s.id === "cityTime").units.some((u) => /workday/.test(u[0])));
ok("flights are asked one-way, not as return trips", ["flightsShort", "flightsMedium", "flightsLong"].every((id) => /flights \/ year/.test(steps.find((s) => s.id === id).unit)));
ok("air-freight options don't mention a season", !steps.find((s) => s.id === "airFreight").options.some((o) => /season/i.test(o[0])));

// a return trip skipped = 2 legs
const flyerLevers = engine.levers(Object.assign(clone(typical), { flights: { short: 0, medium: 0, long: 4, cls: "economy", purpose: "leisure" } }));
const flightLever = flyerLevers.find((l) => l.id === "flight");
close("skipping one return trip saves 2 legs (t)", flightLever.saved, 2 * 7500 * 1.08 * 0.142 / 1000, 1e-6);

// ---------- Period conversion in the chat ----------
console.log("\nPeriod conversion");
const P = questions.toYear;
close("40 min per workday → hours/year", P(40, "min", "workday"), 153.33333, 1e-4);
close("3 hours per month → hours/year", P(3, "h", "month"), 36, 1e-9);
close("€50 per week → €/year", P(50, "eur", "week"), 2600, 1e-9);

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
