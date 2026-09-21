/*
 * Calculation engine — deterministic, no AI involved.
 *
 *   calculate(profile)       → central result in tonnes CO2e per person per year
 *   simulate(profile, opts)  → Monte Carlo: range (10th–90th percentile) + per-domain
 *   biggestUncertainty(...)  → which of YOUR answers widens the range most
 *
 * Uncertainty: every uncertain number is drawn from a log-normal distribution
 * whose median is the central value and whose 90% interval is ×/÷ (1 + unc).
 * A fixed random seed makes results reproducible: same answers → same range.
 */
(function (root) {
  function defineEngine(F, B) {
    // ---------- random numbers (seeded) ----------
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function standardNormal(rand) {
      var u = 1 - rand(), v = rand(); // Box–Muller
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // A "drawer" returns the central value, or a random sample in simulation.
    function centralDrawer() {
      return function (key, central) { return central; };
    }
    // One sample = one possible world. Inside that world every physical quantity has ONE
    // value: the Austrian electricity mix is the same number for your fridge, your heat
    // pump, your train and your EV. So a key is drawn once per sample and then remembered.
    // (Drawing it afresh each time would quietly average the uncertainty away and make the
    // range look far tighter than it is — see tests/audit.js, "Correlated factors".)
    // A z is still consumed on every call, so the random stream stays aligned between runs
    // (common random numbers), which is what makes biggestUncertainty() a fair comparison.
    function randomDrawer(rand, fixedKey) {
      var drawn = {};
      return function (key, central, unc) {
        var z = standardNormal(rand);            // always consume → common random numbers
        if (drawn[key] !== undefined) z = drawn[key]; else drawn[key] = z;
        if (!unc || key === fixedKey) return central;
        var sigma = Math.log(1 + unc) / 1.645;
        return central * Math.exp(sigma * z);
      };
    }

    // User number answers look like { v: 80, c: "estimate" }
    function inputUnc(answer) {
      return F.inputConfidence[(answer && answer.c) || "estimate"];
    }

    // ---------- domain calculations (kg CO2e per person per year) ----------
    //
    // Reading these six functions is reading the whole calculation. They take the profile the
    // chat filled in and a "drawer" d(key, value, uncertainty), which returns the central value
    // when calculating and a random draw when simulating the range. Every number they use comes
    // from data/factors.js with its source attached — none is written here.
    //
    // The full method in prose, with every source, is in METHOD.md and under
    // "</> View the code" → "Method & sources".

    // HOUSING — heating + hot water + household electricity, divided by the people who share it.
    //
    // Two routes. If the household knows its yearly consumption from the bill (h.heatKnown),
    // that is used directly and split 80/20 between space heating and hot water. Otherwise it is
    // estimated from floor area × the typical demand of a building of that age, plus 700 kWh of
    // hot water per person. Useful heat ÷ system efficiency × the fuel's factor.
    //
    // Sources: Umweltbundesamt Österreich, Emissionsfaktoren REP-0948 (2025) — Austrian
    //   electricity mix 0.209, natural gas 0.249, heating oil 0.342, district heat 0.172,
    //   pellets 0.026, firewood 0.025 kg CO2e per kWh. Heat-demand bands from Austrian energy
    //   performance certificates (OIB), simplified. Heat-pump seasonal COP 3.2, typical field value.
    // Note: there is no double counting with electric heating — the electricity question asks
    //   explicitly for the figure WITHOUT the heating part when the home is heated electrically.
    // Scenario fields (used only by levers): home.heatingAfter, home.renovateTo, home.heatAdjust
    function housing(p, d) {
      var h = p.home, size = Math.max(1, p.household.size);
      var sizeKey = Math.min(5, size);
      var elecFactorDef = h.greenTariff ? F.electricity.greenTariff : F.electricity.austriaMix;
      var elecFactor = d("factor.electricity", elecFactorDef.value, elecFactorDef.unc);
      var cop = d("factor.cop", F.heatingEfficiency.heatpumpCOP.value, F.heatingEfficiency.heatpumpCOP.unc);
      var efficiency = function (sys) { return sys === "heatpump" ? cop : F.heatingEfficiency[sys]; };

      var spaceHeat, hotWater;
      if (h.heatKnown && h.heatKnown.v != null) {
        // Measured: yearly fuel/electricity from the bill → useful heat with the CURRENT system's efficiency
        var heat = d("input.heat", h.heatKnown.v, inputUnc(h.heatKnown)) * efficiency(h.heating);
        spaceHeat = heat * F.measuredSpaceHeatShare.value;
        hotWater = heat - spaceHeat;
      } else {
        // Estimated: floor area × typical demand of the building + hot water per person
        var area = h.area.v != null ? h.area.v : F.defaultAreaM2[sizeKey];
        area = d("input.area", area, inputUnc(h.area));
        var demandDef = F.heatDemand[h.building];
        spaceHeat = area * d("factor.heatDemand", demandDef.value, demandDef.unc);
        hotWater = size * d("factor.hotWater", F.hotWaterPerPerson.value, F.hotWaterPerPerson.unc);
      }
      var renovation = F.heatDemand[h.renovateTo || h.building].value / F.heatDemand[h.building].value;
      // Scenario multipliers, all 1 unless a lever set them: areaFactor = a smaller home,
      // heatAdjust = a lower room temperature, waterAdjust = less hot water.
      var heatKwh = spaceHeat * renovation * (h.heatAdjust || 1) * (h.areaFactor || 1)
                  + hotWater * (h.waterAdjust || 1);

      var system = h.heatingAfter || h.heating, heatKg;
      if (system === "heatpump" || system === "electric") {
        heatKg = (heatKwh / efficiency(system)) * elecFactor;
      } else {
        var fuel = F.heatingFuel[system];
        heatKg = (heatKwh / efficiency(system)) * d("factor.fuel." + system, fuel.value, fuel.unc);
      }

      var elecKwh = h.electricity.v != null ? h.electricity.v : F.defaultElectricityKwh[sizeKey];
      elecKwh = d("input.electricity", elecKwh, inputUnc(h.electricity));
      // Scenario: elecEfficiency = using less, solarShare = the share your own roof covers
      // directly. Both are 1 and 0 unless a lever set them.
      var elecKg = elecKwh * (h.elecEfficiency || 1) * (1 - (h.solarShare || 0)) * elecFactor;

      return (heatKg + elecKg) / size;
    }

    // CAR & PUBLIC TRANSPORT.
    //
    // A car is two different things and the Sankey shows them apart: the fuel burned on the road
    // (here, now) and the factory that built the car (somewhere else, years ago). Fuel = litres
    // per 100 km × kWh per litre × the fuel's factor. Manufacturing is amortised per km.
    // The whole car is divided by how many people are usually in it.
    //
    // Public transport is asked in TIME, not distance, because people know how long they sat on
    // the train and not how far it went: hours × an average door-to-door speed × a per-passenger-
    // kilometre factor.
    //
    // Sources: Umweltbundesamt Österreich REP-0948 (2025) — petrol 0.327, diesel 0.330 kg CO2e
    //   per kWh of fuel including upstream. Manufacturing: ~6 t for a mid-size combustion car and
    //   ~10 t including the battery for an electric one, over 180,000 km (published LCA studies,
    //   order of magnitude). Austrian rail 0.020 kg/pkm (OBB runs largely on hydro), city transit
    //   0.050 — estimates carrying +/-50%. Average speeds are estimates and carry +/-30%.
    // Why the transit questions are labelled "small effect": even a 50% error here moves a
    //   typical total by well under a tenth of a tonne.
    function transport(p, d) {
      var c = p.car, kg = 0, S = F.averageSpeedKmh;
      var carType = c.typeAfter || c.type; // scenario: next car is electric
      if (c.type !== "none") {
        var km = d("input.carKm", c.km.v || 0, inputUnc(c.km)) * (c.kmFactor || 1); // km per year
        var perKm;
        if (carType === "ev") {
          var elecDef = p.home.greenTariff ? F.electricity.greenTariff : F.electricity.austriaMix;
          perKm = (F.car.ev.kWhPer100 / 100) * d("factor.carConsumption", 1, F.car.fuelConsumptionUnc)
                * d("factor.electricity", elecDef.value, elecDef.unc)
                + d("factor.carMaking.ev", F.car.manufacturing.ev.value, F.car.manufacturing.ev.unc);
        } else {
          var spec = F.car[carType];
          perKm = (spec.litresPer100 / 100) * spec.kWhPerLitre * spec.fuelFactor
                * d("factor.carConsumption", 1, F.car.fuelConsumptionUnc)
                + d("factor.carMaking.combustion", F.car.manufacturing.combustion.value, F.car.manufacturing.combustion.unc);
        }
        kg += (km * perKm) / Math.max(1, c.people); // shared rides split the emissions
      }
      // Public transport is asked in TIME (hours per year) and converted with an average speed.
      // transit.factor is 1 unless the "travel shorter distances" lever set it: distance costs
      // carbon in every mode, so it applies to the train and the tram as well as the car.
      var t = p.transit, tf = t.factor || 1;
      kg += d("input.trainHours", t.trainHours.v || 0, inputUnc(t.trainHours)) * tf
          * d("factor.speed.train", S.train.value, S.train.unc)
          * d("factor.train", F.transit.train.value, F.transit.train.unc);
      kg += d("input.cityHours", t.cityHours.v || 0, inputUnc(t.cityHours)) * tf
          * d("factor.speed.city", S.city.value, S.city.unc)
          * d("factor.city", F.transit.city.value, F.transit.city.unc);
      if (t.extraTrainKm) kg += t.extraTrainKm * tf * d("factor.train", F.transit.train.value, F.transit.train.unc); // scenario
      return kg;
    }

    // FLIGHTS — counted ONE WAY, per leg.
    //
    // This is deliberate: people mix modes (fly out, train back), and a calculator that only
    // understands return trips cannot represent that. A normal return holiday is 2 legs.
    // legs x typical one-way distance x 1.08 (detours and holding patterns) x kg per
    // passenger-km x class multiplier.
    //
    // The factors INCLUDE radiative forcing — contrails and nitrogen oxides at altitude roughly
    // double the effect of the CO2 alone. That single choice is why a flight looks larger here
    // than in calculators that count CO2 only, and it is also the least settled science in the
    // whole model, which is why these factors carry +/-35%.
    //
    // Sources: UK DESNZ/DEFRA conversion factors 2025, the "with RF" set (long-haul business
    //   0.411 kg/pkm divided by the 2.9 class ratio gives the economy value; short and medium
    //   haul approximated in the same style). The 1.08 uplift is the DESNZ indirect-routing
    //   method. Lee et al. (2021), Atmospheric Environment, for the non-CO2 warming.
    function flights(p, d) {
      var fl = p.flights, kg = 0;
      ["short", "medium", "long"].forEach(function (cat) {
        var n = fl[cat] || 0;
        if (!n) return;
        var km = F.flights.distanceKm[cat] * F.flights.distanceUplift; // one-way leg
        var f = F.flights.perPkm[cat];
        kg += n * km * d("factor.flight." + cat, f.value, f.unc) * F.flights.classMultiplier[fl.cls][cat];
      });
      return kg;
    }

    // Food: what you eat × how often × portion × per-kg footprint, plus a plant-based base,
    // out-of-season produce, and waste depending on WHICH foods you throw away.
    // FOOD.
    //
    // What you eat x how often x portion size x a per-kilo footprint, plus a plant-based base of
    // 380 kg a year for everything nobody is asked about (bread, potatoes, pasta, vegetables,
    // fruit, oils, sugar, drinks) so the model does not reward someone for simply not mentioning
    // what they eat. Then waste, then air freight.
    //
    // Waste is asked per CATEGORY, because what you throw away matters far more than how much:
    // meat and dairy carry roughly ten times the footprint of bread per kilo. The rate applies to
    // what was bought, not what was eaten, which is why it is kg x r / (1 - r).
    //
    // Air freight covers only the few fresh products that actually fly. Bananas, citrus, apples,
    // grapes, avocado, pineapple, dates and nuts travel by ship or truck and are NOT counted.
    //
    // Sources: ifeu (2020), Oekologische Fussabdruecke von Lebensmitteln und Gerichten in
    //   Deutschland, for the German Umweltbundesamt — boundary: to the supermarket checkout,
    //   including land-use change. Air freight: ifeu gives strawberries in season 0.3 vs. flown
    //   3.4 kg CO2e/kg; pineapple by air 15.1 vs. by ship 0.6.
    // Deliberately NOT adjusted: organic (ifeu finds no clear per-kilo advantage — lower inputs
    //   are offset by lower yields) and local/seasonal (cold-stored Austrian apples in April are
    //   0.4 kg/kg vs. 0.8 from New Zealand, and the winter-tomato difference is worth only
    //   5-15 kg a year at typical amounts).
    // The 380 kg base, the pack sizes, the purchase counts and the waste rates are our own
    //   estimates. They are the weakest numbers in this function.
    function food(p, d) {
      var FG = F.foodGroups, fo = p.food, waste = fo.waste || {};
      // how often each category is thrown away: rarely / sometimes / often
      var rate = function (cat) { return F.wasteRate[waste[cat] || "rarely"]; };
      var extra = function (kg, r) { return kg * r / (1 - r); }; // bought but thrown away
      var sums = { meat: 0, dairy: 0, plant: 0 };
      Object.keys(FG).forEach(function (id) {
        if (id === "source") return;
        var g = FG[id], freq = (fo.portions && fo.portions[id]) || "never";
        var perWeek = F.portionsPerWeek[freq];
        if (!perWeek) return;
        var kgFood = perWeek * 52 * g.portionG / 1000;
        sums[g.group] += kgFood * d("factor.food." + id, g.kgCO2ePerKg, g.unc);
      });
      // baseFactor is 1 unless the "cut out drinks, sweets & processed food" lever set it
      var base = d("factor.plantBase", F.plantBaseKg.value, F.plantBaseKg.unc) * (fo.baseFactor || 1);
      var W = F.wasteCategories;
      var eaten = sums.meat + sums.dairy + sums.plant + base;
      var wasted = extra(sums.meat, rate("meatFish"))
                 + extra(sums.dairy, rate("dairy"))
                 + extra(base * W.bread.plantBaseShare, rate("bread"))
                 + extra(base * W.fruitVeg.plantBaseShare, rate("fruitVeg"))
                 + extra(base * (1 - W.bread.plantBaseShare - W.fruitVeg.plantBaseShare) + sums.plant, F.wasteRate.rarely)
                 + eaten * F.leftoversExtra[waste.leftovers || "rarely"];
      // Air-freighted fresh food: purchases per year × pack size × the extra CO2 of flying it
      var AF = F.airFreight, air = 0, chosen = fo.airFreight || {};
      Object.keys(AF.items).forEach(function (k) {
        var n = AF.purchasesPerYear[chosen[k] || "never"];
        if (n) air += n * AF.items[k].kgPerPurchase * d("factor.airFreight." + k, AF.extraPerKg.value, AF.extraPerKg.unc);
      });
      return eaten + wasted + air;
    }

    // GOODS — the one area worked from money rather than physical quantities, because nobody
    // knows the weight of what they bought. Euros per year x kg CO2e per euro x a second-hand
    // factor applied per category (new 1.0, mixed 0.85, mostly used 0.60 — not zero, because a
    // used item is still transported, refurbished and sold).
    //
    // Source: order of magnitude from EU multi-regional input-output data (EXIOBASE) for consumer
    //   goods, simplified. These intensities are the roughest numbers in the whole calculator
    //   (+/-45-50%); the honest upgrade would be Austrian EXIOBASE values. Spending answers are
    //   also systematically under-reported by people.
    // Worth knowing: phones, laptops and TVs are HERE, not in the digital section. Making a
    //   smartphone is ~60 kg CO2e and a laptop ~150-300 kg, around 80% of their lifetime
    //   footprint — which is why the "digital" line looks small (see METHOD.md).
    function goods(p, d) {
      var kg = 0, GI = F.goodsIntensity;
      ["clothes", "electronics", "furniture", "other"].forEach(function (k) {
        var sh = (p.goods.secondHand && p.goods.secondHand[k]) || "new"; // per category
        // spendFactor = "buy less" levers, capFactor = the "down to the Austrian average" lever
        kg += (p.goods[k] || 0) * (p.goods.spendFactor || 1) * (p.goods.capFactor || 1)
            * d("factor.goods." + k, GI[k].value, GI[k].unc) * F.secondHand[sh]; // € per year
      });
      return kg;
    }

    // DIGITAL — usage only. The devices themselves are in goods() above.
    //
    // Sources: Carbon Trust (2021), Carbon impact of video streaming — ~55 g CO2e per hour in
    //   Europe including the viewing device; this corrected a widely circulated earlier figure of
    //   about 3.2 kg per hour, which was wrong by an order of magnitude. AI: Google (2025) reports
    //   a median Gemini text prompt at 0.24 Wh and 0.03 g CO2e, independent estimates for
    //   ChatGPT-class models 0.1-0.3 g (Hannah Ritchie, 2025); images ~0.3-1.2 Wh; a generated
    //   five-second video roughly 1 kWh. All four carry +/-100% — the least settled data in the app.
    function digital(p, d) {
      var D = F.digital, g = p.digital;
      return (g.streamingHoursDay || 0) * 365 * d("factor.streaming", D.streamingPerHour.value, D.streamingPerHour.unc)
           + (g.aiPromptsDay || 0) * 365 * d("factor.aiText", D.aiTextPrompt.value, D.aiTextPrompt.unc)
           + (g.aiImagesMonth || 0) * 12 * d("factor.aiImage", D.aiImage.value, D.aiImage.unc)
           + (g.aiVideosMonth || 0) * 12 * d("factor.aiVideo", D.aiVideo.value, D.aiVideo.unc);
    }

    // SERVICES — euros per year x kg CO2e per euro, plus digital.
    //
    // eatingOut is the RESTAURANT'S OWN share (kitchen energy, premises, dishwashing, staff,
    // kitchen waste), not the meal. The food questions ask what you eat "at home or out", so the
    // meal is already counted there; charging a full food-service intensity here would count the
    // same steak twice. This was found by the audit and corrected from 0.35 to 0.15 kg/EUR.
    // See METHOD.md, "Double counting we had to avoid".
    function services(p, d) {
      var kg = 0, SI = F.servicesIntensity;
      var f = (p.services.factor || 1) * (p.services.capFactor || 1); // scenario multipliers
      ["eatingOut", "hotels", "leisure"].forEach(function (k) {
        kg += (p.services[k] || 0) * f * d("factor.services." + k, SI[k].value, SI[k].unc); // € per year
      });
      return kg + digital(p, d);
    }

    // ---------- public API ----------
    function run(profile, drawer) {
      var kg = {
        housing: housing(profile, drawer),
        transport: transport(profile, drawer),
        flights: flights(profile, drawer),
        food: food(profile, drawer),
        goods: goods(profile, drawer),
        services: services(profile, drawer)
      };
      // Model simplification error (a simplified calculator can never be exact): ±10%
      var model = drawer("factor.model", 1, 0.10);
      var out = { byDomain: {}, total: 0 };
      Object.keys(kg).forEach(function (k) {
        kg[k] *= model;
        out.byDomain[k] = kg[k] / 1000;
        out.total += kg[k] / 1000;
      });
      return out;
    }

    function calculate(profile) {
      return run(profile, centralDrawer());
    }

    function percentile(sorted, q) {
      var i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
    }

    function simulate(profile, opts) {
      opts = opts || {};
      var n = opts.samples || 4000;
      var rand = mulberry32(opts.seed || 42);
      var totals = [], dom = {};
      for (var i = 0; i < n; i++) {
        // a fresh drawer per sample: the memory of "what the electricity factor is"
        // must last for one possible world, not for the whole simulation
        var r = run(profile, randomDrawer(rand, opts.fixedKey));
        totals.push(r.total);
        Object.keys(r.byDomain).forEach(function (k) { (dom[k] = dom[k] || []).push(r.byDomain[k]); });
      }
      var num = function (a, b) { return a - b; };
      totals.sort(num);
      var byDomain = {};
      Object.keys(dom).forEach(function (k) { dom[k].sort(num); byDomain[k] = { low: percentile(dom[k], 0.10), high: percentile(dom[k], 0.90) }; });
      return { low: percentile(totals, 0.10), median: percentile(totals, 0.5), high: percentile(totals, 0.90), byDomain: byDomain, samples: n };
    }

    // Which of the user's own answers adds most uncertainty?
    // Re-run the simulation with that answer held exact and see how much the range shrinks.
    function biggestUncertainty(profile, opts) {
      opts = opts || {};
      var base = simulate(profile, opts);
      var baseWidth = base.high - base.low;
      var keys = ["input.heat", "input.area", "input.electricity", "input.carKm", "input.trainHours", "input.cityHours"];
      var best = null;
      keys.forEach(function (key) {
        var s = simulate(profile, { samples: opts.samples, seed: opts.seed, fixedKey: key });
        var gain = baseWidth - (s.high - s.low);
        if (!best || gain > best.gain) best = { key: key, gain: gain };
      });
      return best && best.gain > 0.3 ? best : null; // only worth asking if it narrows the range noticeably
    }

    // Compensation is reported per type and NEVER subtracted from the footprint.
    /* Compensation, described but never subtracted.
     * The two shares are the Oxford Offsetting Principles' two shifts, measured on the mix a
     * person actually bought: how much of it REMOVES carbon rather than preventing emissions
     * somewhere else, and how much is stored for a century or more. They are shares of the
     * mix, never of the footprint — which is the point. A tonne of avoidance credit and a
     * tonne of direct air capture are not the same tonne, so the total they add up to is not
     * a number worth putting next to a footprint.
     */
    function compensation(profile) {
      var o = profile.offsets || {}, list = [], tonnes = 0;
      Object.keys(F.offsetTypes).filter(function (k) { return k !== "source"; })
        .sort(function (a, b) { return F.offsetTypes[a].rank - F.offsetTypes[b].rank; })
        .forEach(function (k) {
          if (o[k] > 0) { list.push({ type: k, tonnes: o[k], info: F.offsetTypes[k] }); tonnes += o[k]; }
        });
      var share = function (pred) {
        if (!(tonnes > 0)) return 0;
        return list.reduce(function (a, x) { return a + (pred(x.info) ? x.tonnes : 0); }, 0) / tonnes;
      };
      return { tonnes: tonnes, byType: list,
               removalShare: share(function (i) { return i.removal; }),
               centuryShare: share(function (i) { return i.centuryStorage; }),
               contributionEur: o.contributionEur || 0, certification: o.certification || null };
    }


    // ---------- where exactly the emissions come from (for the Sankey) ----------
    // Each entry: which area it belongs to, what the activity is, and WHY it is carbon
    // (the fuel, the electricity, or the upstream chain). Central values only; a test
    // checks that these sum to exactly the same numbers as calculate().
    // group: where the emission physically happens.
    //   direct      – fuel you burn yourself, here
    //   electricity – burned in power stations, mostly in Austria and its neighbours
    //   upstream    – farms, factories, ships and offices, in large part abroad
    //   (consumption-based accounting counts all three, wherever they happen)
    var CAUSES = {
      gas:        { label: "Natural gas", group: "direct" },
      oil:        { label: "Heating oil", group: "direct" },
      district:   { label: "District heat", group: "electricity" },
      pellets:    { label: "Wood & pellets", group: "direct" },
      wood:       { label: "Wood & pellets", group: "direct" },
      grid:       { label: "Electricity, Austrian mix", group: "electricity" },
      green:      { label: "Electricity, renewable tariff", group: "electricity" },
      petrol:     { label: "Petrol", group: "direct" },
      diesel:     { label: "Diesel", group: "direct" },
      jet:        { label: "Jet fuel & contrails", group: "direct" },
      farming:    { label: "Farming: methane, fertiliser, land", group: "upstream" },
      factories:  { label: "Factories & materials", group: "upstream" },
      chain:      { label: "Supply chain of services", group: "upstream" }
    };
    var CAUSE_GROUPS = {
      direct:      "Burned for you directly",
      electricity: "Power stations",
      upstream:    "Farms, factories & supply chains — largely abroad"
    };

    function sources(p) {
      var d = centralDrawer(), out = [], size = Math.max(1, p.household.size), sizeKey = Math.min(5, size);
      var elecCause = p.home.greenTariff ? "green" : "grid";
      var push = function (domain, id, label, kg, cause) {
        if (kg > 0.0001) out.push({ domain: domain, id: id, label: label, t: kg / 1000, cause: cause,
          causeLabel: CAUSES[cause].label, causeGroup: CAUSES[cause].group, causeGroupLabel: CAUSE_GROUPS[CAUSES[cause].group] });
      };

      // --- housing ---
      var h = p.home;
      var elecDef = h.greenTariff ? F.electricity.greenTariff : F.electricity.austriaMix;
      var elecFactor = elecDef.value, cop = F.heatingEfficiency.heatpumpCOP.value;
      var eff = function (sys) { return sys === "heatpump" ? cop : F.heatingEfficiency[sys]; };
      var spaceHeat, hotWater;
      if (h.heatKnown && h.heatKnown.v != null) {
        var heat = h.heatKnown.v * eff(h.heating);
        spaceHeat = heat * F.measuredSpaceHeatShare.value;
        hotWater = heat - spaceHeat;
      } else {
        var area = h.area.v != null ? h.area.v : F.defaultAreaM2[sizeKey];
        spaceHeat = area * F.heatDemand[h.building].value;
        hotWater = size * F.hotWaterPerPerson.value;
      }
      var renovation = F.heatDemand[h.renovateTo || h.building].value / F.heatDemand[h.building].value;
      var system = h.heatingAfter || h.heating;
      var electricHeat = system === "heatpump" || system === "electric";
      var perKwh = electricHeat ? elecFactor / eff(system) : F.heatingFuel[system].value / eff(system);
      var heatCause = electricHeat ? elecCause : system;
      push("housing", "spaceHeat", "Space heating", spaceHeat * renovation * (h.heatAdjust || 1) * (h.areaFactor || 1) * perKwh / size, heatCause);
      push("housing", "hotWater", "Hot water", hotWater * (h.waterAdjust || 1) * perKwh / size, heatCause);
      var elecKwh = h.electricity.v != null ? h.electricity.v : F.defaultElectricityKwh[sizeKey];
      push("housing", "electricity", "Electricity at home", elecKwh * (h.elecEfficiency || 1) * (1 - (h.solarShare || 0)) * elecFactor / size, elecCause);

      // --- car & transit --- (fuel and building the car are shown apart: different causes)
      var c = p.car, S = F.averageSpeedKmh, t = p.transit;
      if (c.type !== "none") {
        var carType = c.typeAfter || c.type, km = (c.km.v || 0) * (c.kmFactor || 1) / Math.max(1, c.people);
        if (carType === "ev") {
          push("transport", "carFuel", "Car: charging", km * (F.car.ev.kWhPer100 / 100) * elecFactor, elecCause);
          push("transport", "carMaking", "Car: building it", km * F.car.manufacturing.ev.value, "factories");
        } else {
          var spec = F.car[carType];
          push("transport", "carFuel", "Car: fuel", km * (spec.litresPer100 / 100) * spec.kWhPerLitre * spec.fuelFactor, carType === "diesel" ? "diesel" : "petrol");
          push("transport", "carMaking", "Car: building it", km * F.car.manufacturing.combustion.value, "factories");
        }
      }
      var tf = t.factor || 1;
      push("transport", "train", "Train", ((t.trainHours.v || 0) * S.train.value + (t.extraTrainKm || 0)) * tf * F.transit.train.value, "grid");
      push("transport", "city", "Bus, tram & metro", (t.cityHours.v || 0) * S.city.value * tf * F.transit.city.value, "diesel");

      // --- flights ---
      var fl = p.flights;
      [["short", "Short flights"], ["medium", "Medium flights"], ["long", "Long flights"]].forEach(function (x) {
        var n = fl[x[0]] || 0;
        if (!n) return;
        push("flights", x[0], x[1], n * F.flights.distanceKm[x[0]] * F.flights.distanceUplift * F.flights.perPkm[x[0]].value * F.flights.classMultiplier[fl.cls][x[0]], "jet");
      });

      // --- food ---
      var FG = F.foodGroups, fo = p.food, waste = fo.waste || {};
      var rate = function (cat) { return F.wasteRate[waste[cat] || "rarely"]; };
      var extra = function (kg, r) { return kg * r / (1 - r); };
      var sums = { meat: 0, dairy: 0, plant: 0 }, byGroup = {};
      Object.keys(FG).forEach(function (id) {
        if (id === "source") return;
        var g = FG[id], perWeek = F.portionsPerWeek[(fo.portions && fo.portions[id]) || "never"];
        if (!perWeek) return;
        var kg = perWeek * 52 * g.portionG / 1000 * g.kgCO2ePerKg;
        sums[g.group] += kg;
        byGroup[id] = kg;
      });
      var base = F.plantBaseKg.value * (fo.baseFactor || 1), W = F.wasteCategories;
      var eaten = sums.meat + sums.dairy + sums.plant + base;
      Object.keys(byGroup).forEach(function (id) { push("food", id, FG[id].label, byGroup[id], "farming"); });
      push("food", "base", "Bread, veg, fruit, drinks…", base, "farming");
      push("food", "waste", "Thrown away", extra(sums.meat, rate("meatFish")) + extra(sums.dairy, rate("dairy"))
        + extra(base * W.bread.plantBaseShare, rate("bread")) + extra(base * W.fruitVeg.plantBaseShare, rate("fruitVeg"))
        + extra(base * (1 - W.bread.plantBaseShare - W.fruitVeg.plantBaseShare) + sums.plant, F.wasteRate.rarely)
        + eaten * F.leftoversExtra[waste.leftovers || "rarely"], "farming");
      var AF = F.airFreight, air = 0, chosen = fo.airFreight || {};
      Object.keys(AF.items).forEach(function (k) { air += AF.purchasesPerYear[chosen[k] || "never"] * AF.items[k].kgPerPurchase * AF.extraPerKg.value; });
      push("food", "airFreight", "Flown-in food", air, "jet");

      // --- goods ---
      ["clothes", "electronics", "furniture", "other"].forEach(function (k) {
        var sh = (p.goods.secondHand && p.goods.secondHand[k]) || "new";
        push("goods", k, F.goodsIntensity[k].label, (p.goods[k] || 0) * (p.goods.spendFactor || 1) * (p.goods.capFactor || 1) * F.goodsIntensity[k].value * F.secondHand[sh], "factories");
      });

      // --- services ---
      ["eatingOut", "hotels", "leisure"].forEach(function (k) {
        // eatingOut is the venue's own operation (kitchen, premises, staff), not the food —
        // the food is already in the "Food" column — so its cause is the service chain.
        push("services", k, F.servicesIntensity[k].label, (p.services[k] || 0) * (p.services.factor || 1) * (p.services.capFactor || 1) * F.servicesIntensity[k].value, "chain");
      });
      push("services", "digital", "Streaming & AI", digital(p, d), elecCause);

      return out;
    }

    // ---------- levers: what could THIS person change, and how much would it save? ----------
    // Each lever copies the profile, changes one thing, and recalculates. saved = before − after.
    var STEP_DOWN = { twiceDaily: "daily", daily: "often", often: "weekly", weekly: "monthly", monthly: "never", never: "never" };
    // Levers must be *order-independent*: ticking "stop flying" and "train instead of short
    // flights" in either order has to give the same number, or the Potential tab would show
    // a different total depending on the order you happened to click. So every change writes
    // a TARGET STATE (the same value however often it is applied), never a delta.
    var FREQ_ORDER = ["never", "monthly", "weekly", "often", "daily", "twiceDaily"];
    function freqRank(f) { var i = FREQ_ORDER.indexOf(f); return i < 0 ? 0 : i; }
    function maxFreq(a, b) { return freqRank(a) >= freqRank(b) ? (a || "never") : b; }
    /*
     * What this person could change.
     *
     * Every lever copies the profile, changes ONE thing, and recalculates — nothing here is a
     * stored "typical saving". Each one is written as three pieces of text, because a number
     * with no alternative attached is just a reproach:
     *
     *   label  – the change, named as something you DO, not something you stop
     *   detail – the concrete alternative: what takes its place, and why that is not a sacrifice
     *   why    – the mechanism, with the number, so the size is checkable rather than asserted
     *
     * control says who actually decides (see CONTROL in app.js). "big" means it is yours, but
     * it changes how you live rather than what you buy — those are listed separately and
     * pathToTarget only reaches for them once the ordinary ones run out.
     */
    function levers(profile) {
      var before = calculate(profile).total, out = [];
      var h = profile.home, tenure = h.tenure || "unknown";
      // who can decide on heating and insulation: own house → you; own flat → with the other owners; renting → landlord
      var buildingControl = tenure === "own" ? (h.type === "house" ? "yours" : "shared") : tenure === "rent" ? "landlord" : "unknown";
      // text = [what you do instead, why it moves the number]
      function add(id, label, text, control, change) {
        var p = JSON.parse(JSON.stringify(profile));
        change(p);
        var saved = before - calculate(p).total;
        if (saved > 0.02) out.push({ id: id, label: label, detail: text[0], why: text[1], control: control, saved: saved, change: change });
      }
      var LS = F.leverSizes;

      // ---------- home & energy ----------
      if (!h.greenTariff) add("greenTariff", "Switch to a certified green electricity tariff", [
        "Same sockets, same appliances, often the same price: an Austrian supplier selling only hydro, wind and PV, carrying the Umweltzeichen UZ 46. About ten minutes online, and tenants can switch too if the contract is in their name.",
        "It changes what the power station burns on your behalf: 0.209 kg CO₂e per kWh on the Austrian mix, roughly 0.030 on a renewable tariff — without changing a single thing you do."
      ], h.electricityChoice === "included" ? "landlord" : "yours", function (p) { p.home.greenTariff = true; });

      add("temperature", "Heat to 20 °C and dress for the room", [
        "A programmable thermostat: 20 °C where you sit, 17 °C where you sleep — which is what sleep research recommends anyway — and a jumper for the evening. Warm feet matter more than warm air.",
        "Every degree less is about 6% less heating energy, and heating is usually the largest single line in an Austrian home."
      ], "yours", function (p) { p.home.heatAdjust = 1 - F.lowerTemperature.perDegree; });

      add("electricityCut", "Swap the power-hungry things for efficient ones", [
        "LED lighting, an A-rated fridge and washing machine, a drying rack instead of a tumble dryer, and one switchable power strip for the standby crowd. Nothing you own gets used less — it just uses less.",
        "Roughly a third of a household's electricity goes to things that have an efficient equivalent, and the saving repeats every year for the life of the appliance."
      ], "yours", function (p) { p.home.elecEfficiency = Math.min(p.home.elecEfficiency || 1, 1 - LS.electricityCut.value); });

      add("hotWater", "Shower warm rather than hot, and shorter", [
        "A water-saving shower head — the good ones feel stronger, not weaker — the tank at 55 °C instead of 65, and a four-minute song as the timer.",
        "Hot water is about a fifth of the energy a home uses, and 55 °C is still comfortably above the temperature that keeps a tank safe."
      ], h.tenure === "rent" ? "partly" : "yours", function (p) { p.home.waterAdjust = Math.min(p.home.waterAdjust || 1, 1 - LS.hotWaterCut.value); });

      if (tenure === "own") add("solar", "Put your own power station on the roof", [
        "A domestic PV system, with Austrian Förderung covering part of the cost. You use what you generate during the day and sell the rest; with a battery you keep the evening too.",
        "It covers about a third of your electricity directly. Only that self-used third counts for you — the exported rest belongs to whoever uses it, which is why this is not a licence to use more."
      ], h.type === "house" ? "yours" : "shared", function (p) { p.home.solarShare = Math.max(p.home.solarShare || 0, LS.solarSelfUse.value); });

      if (["gas", "oil", "electric", "district"].indexOf(h.heating) >= 0) add("heatPump", "Heat with a heat pump instead of a flame", [
        "An air-to-water heat pump: quiet, no chimney, no fuel deliveries, and it cools the house in summer as well. ‘Raus aus Öl und Gas’ covers a large share of the cost in Austria.",
        "It moves heat rather than making it — one kWh of electricity delivers about 3.2 kWh of warmth — so the same comfort needs roughly a third of the energy, and cleaner energy at that."
      ], buildingControl, function (p) { p.home.heatingAfter = "heatpump"; });

      // Insulation used to be hidden for wood and pellet heating, on the reasoning that burning
      // wood is nearly carbon-neutral anyway. That was wrong for a large, badly insulated house:
      // at 190 m² on firewood it is still the biggest single thing left after everything else.
      // The saving itself decides now — add() drops any lever under 0.02 t.
      if (["old", "average", "modern"].indexOf(h.building) >= 0) add("renovate", "Insulate, and stop heating the street", [
        "Roof, facade and windows to today’s standard. Warm walls mean no cold draughts by the window, no mould in the corners and a markedly quieter house — the comfort arrives before the bill does.",
        "An unrenovated pre-1980 building needs about 170 kWh per m² a year; at today’s standard, 45. It is the one change that makes every other heating decision smaller."
      ], buildingControl, function (p) { p.home.renovateTo = "efficient"; });

      // Living space per person in Austria is among the highest in Europe, and heating scales
      // with it almost one to one — so this is a real lever, and a big life change.
      var areaPerPerson = (h.area && h.area.v ? h.area.v : F.defaultAreaM2[Math.min(5, Math.max(1, profile.household.size))]) / Math.max(1, profile.household.size);
      if (areaPerPerson > 30 || (h.heatKnown && h.heatKnown.v)) add("smallerHome", "Live in less space, better placed", [
        "A smaller flat closer to where your life actually happens, or letting a room you never use. Less to heat, less to clean, less to fill — and usually a shorter way to everything.",
        "Austria has some of the largest homes per person in Europe, around 45 m², and heating scales with floor area almost one to one."
      ], "big", function (p) { p.home.areaFactor = Math.min(p.home.areaFactor || 1, 1 - LS.smallerHome.value); });

      // ---------- getting around ----------
      var c = profile.car, carControl = { easy: "yours", partly: "partly", dependent: "hard" }[c.dependence] || "unknown";
      if (c.type !== "none") {
        add("driveLess", "Cycle and ride the trips that don’t need a car", [
          "Bike or public transport for the short regular ones — the shops, the school run, the commute — and keep the car for what it is actually good at. An e-bike turns a hilly 6 km into a non-event.",
          "Short trips are the most polluting per kilometre, because a cold engine burns far more, and they are the easiest to replace. A third fewer kilometres is a third less fuel."
        ], carControl, function (p) { p.car.kmFactor = 0.7; });
        if (c.type !== "ev") add("ev", "Make your next car electric", [
          "When the one you have is due anyway. Charging at home costs less per kilometre than petrol, there is no service interval to speak of, and it is quiet enough to change how driving feels.",
          "On the Austrian grid an electric car is about 0.09 kg per km against 0.24 for petrol, building it included. Replacing a working car early would waste the carbon already in it — which is why this one waits."
        ], "later", function (p) { p.car.typeAfter = "ev"; });
      }

      // Distance costs carbon in every mode. Someone spending 280 hours a year on trains has a
      // real transport footprint, and until now nothing in the list acknowledged that.
      if (((profile.transit.trainHours.v || 0) + (profile.transit.cityHours.v || 0)) > 50)
        add("travelLess", "Put your daily life within reach", [
          "Live nearer to work, or work nearer to home, and take fewer but longer trips instead of many short ones. People who shorten a commute almost always describe it as getting hours of their week back.",
          "Distance costs carbon in every mode. A train is far cleaner per kilometre than a car, not free — 280 hours a year on trains is still about 22,000 km."
        ], "big", function (p) { p.transit.factor = Math.min(p.transit.factor || 1, 1 - F.leverSizes.travelLess.value); });

      if (c.type !== "none") add("carFree", "Trade the car for a pass and a membership", [
        "A yearly public-transport pass, a bike worth riding, and car-sharing for the handful of trips that genuinely need a car. In Vienna that combination costs a fraction of what owning does, with no parking and no Pickerl.",
        "Owning is what makes driving the default: once the money is spent, every trip looks free. Letting the car go removes the pull and the manufacturing footprint at the same time."
      ], carControl, function (p) { p.car.type = "none"; p.car.km = { v: 0, c: "exact" }; });

      // ---------- flights ----------
      // A ladder, not three versions of the same thing: swap the short ones for trains, swap one
      // far trip for a closer one, or take the year overland. Ticking two of them is recalculated
      // together, and the app marks any whose saving a bigger one has already taken.
      var fl = profile.flights, flightControl = { leisure: "yours", mix: "partly", work: "hard" }[fl.purpose] || "unknown";
      var shortByTrainKm = fl.short * F.flights.distanceKm.short;
      if (fl.short) add("shortFlights", "Take the night train instead of the short flight", [
        "Nightjet runs from Vienna to Venice, Rome, Zurich, Hamburg, Brussels and Paris. You board in the evening, sleep, and step out in the city centre — no airport, no 4 a.m. alarm, and one hotel night saved each way.",
        "A 1,100 km flight is about 0.19 t per leg; the same distance by Austrian rail is about 0.02 t. Roughly a tenth, for a journey most people end up preferring."
      ], flightControl, function (p) {
        p.transit.extraTrainKm = Math.max(p.transit.extraTrainKm || 0, shortByTrainKm); p.flights.short = 0; });

      var longest = fl.long ? "long" : fl.medium ? "medium" : null;
      if (longest) add("flight", "Trade one far trip for a closer one", [
        "One long-haul holiday swapped for somewhere you can reach overland — the Adriatic, the Alps, Sicily, the Baltic coast. Two days less in transit is two days more actually being there.",
        "A return long-haul flight is about 2.3 t, which is three quarters of an entire year’s 1.5 °C budget. No other single decision on this list moves that much."
      ], flightControl, function (p) { p.flights[longest] = Math.max(0, p.flights[longest] - 2); });

      if (fl.short + fl.medium + fl.long > 0) add("noFlights", "Take a year of travelling overland", [
        "Interrail, night trains and ferries for twelve months. Slower, and the going becomes part of the holiday instead of the price you pay for it — you also see the places in between.",
        "For anyone who flies more than once or twice a year, flying is usually the single largest thing in their footprint: bigger than their home, their car and their food put together."
      ], "big", function (p) {
        p.transit.extraTrainKm = Math.max(p.transit.extraTrainKm || 0, shortByTrainKm);
        p.flights.short = 0; p.flights.medium = 0; p.flights.long = 0;
      });

      // ---------- food ----------
      // The meals you drop have to be replaced by something, so each of these raises plant
      // protein to at least the frequency it replaces — maxFreq, never a plain assignment,
      // so two of them ticked together can't cancel each other out.
      var por = profile.food.portions || {};
      var meatIds = ["beef", "pork", "poultry", "sausage", "fish"].filter(function (k) { return por[k] && por[k] !== "never"; });
      var dairyAll = ["cheese", "milk", "butter", "eggs"].filter(function (k) { return por[k] && por[k] !== "never"; });

      if (por.beef && por.beef !== "never") add("beef", "Swap beef and lamb for chicken, pork or pulses", [
        "The same dishes with a different protein: chicken in the curry, lentils in the bolognese, pork in the goulash. Keep beef for the occasions where it is the point of the meal, and buy it better when you do.",
        "Beef is 13.6 kg CO₂e per kg against 5.5 for chicken and 1.1 for pulses: cattle produce methane and need by far the most land. It is the largest single swap available on a plate."
      ], "yours", function (p) {
        p.food.portions.plantProtein = maxFreq(p.food.portions.plantProtein, por.beef);
        p.food.portions.beef = "never"; });

      if (meatIds.length) add("vegetarian", "Eat vegetarian, and eat well doing it", [
        "Meals built on beans, lentils, eggs, cheese and vegetables that are actually in season. Austrian cooking already does this properly: Käsespätzle, Eiernockerl, Krautfleckerl, Gemüsestrudel, Erdäpfelgulasch.",
        "Meat and fish are usually about a third of a food footprint while being a small share of what you actually eat."
      ], "yours", function (p) {
        p.food.portions.plantProtein = maxFreq(p.food.portions.plantProtein, "daily");
        meatIds.forEach(function (k) { p.food.portions[k] = "never"; });
      });

      if (meatIds.length || dairyAll.length) add("vegan", "Eat plant-based", [
        "Pulses, grains, nuts, vegetables, and the oat drink that is now in every Austrian supermarket. Worth taking B12 as a supplement — it is the one thing plants genuinely don’t supply.",
        "Dairy is the other half of the animal share: cheese is 5.7 and butter 7.0 kg CO₂e per kg, against 1.1 for tofu and pulses."
      ], "yours", function (p) {
        p.food.portions.plantProtein = maxFreq(p.food.portions.plantProtein, "daily");
        p.food.portions.plantDrink = maxFreq(p.food.portions.plantDrink, "daily");
        meatIds.concat(dairyAll).forEach(function (k) { p.food.portions[k] = "never"; });
      });

      var dairyIds = ["cheese", "butter", "milk"].filter(function (k) { return por[k] && por[k] !== "never"; });
      if (dairyIds.length) add("dairy", "Make cheese and butter the treat, not the base", [
        "One step less often — daily becomes three or four times a week — and when you do have it, buy the one you will actually taste. Good olive oil on bread, and the cheese saved for where it matters.",
        "It takes roughly ten litres of milk to make a kilo of cheese, which is why cheese and butter sit close to meat per kilo."
      ], "yours", function (p) {
        dairyIds.forEach(function (k) { p.food.portions[k] = STEP_DOWN[p.food.portions[k]]; }); });

      var w = profile.food.waste || {};
      if (Object.keys(w).some(function (k) { return w[k] && w[k] !== "rarely"; })) add("waste", "Plan the week and cook from what you have", [
        "Shop with a list for a few days at a time rather than for a fortnight, freeze what you won’t get to, and keep one evening a week for leftovers. It saves money at about the same rate it saves carbon.",
        "Food thrown away carries its entire footprint with it — and meat or dairy in the bin costs roughly ten times what bread does per kilo."
      ], "yours", function (p) { p.food.waste = {}; });

      // food.airFreight is a map {berries|vegetables|exotic: frequency} — an object is always
      // truthy, so it has to be checked entry by entry, not with `!== "never"`.
      var af = profile.food.airFreight || {};
      if (Object.keys(af).some(function (k) { return af[k] && af[k] !== "never"; }))
        add("airFreight", "Buy the fruit that came by ship, not by plane", [
          "Frozen berries in winter — picked ripe, so often better than the flown ones — and the origin label as the rule of thumb: overseas and perishable means it flew. Bananas, citrus, apples, avocados, dates and nuts all come by ship or truck anyway.",
          "Flying food adds about 8 kg CO₂e per kilo, ten to twenty-five times what growing it cost. It is the one place where how food travelled matters more than what the food is."
        ], "yours", function (p) { p.food.airFreight = {}; });

      // The plant-based base (bread, veg, oils, drinks…) is the floor of the food number and
      // nothing else touches it. Drinks, sweets and ready meals are the part of it you can drop.
      add("drinksSnacks", "Drink the tap water and buy the real thing", [
        "Vienna’s tap water arrives from the Alps by gravity and is better than anything in a bottle. Swap the soft drinks for it, and the ready meals for something cooked — the same money buys noticeably better food.",
        "Soft drinks, alcohol, sweets, snacks and convenience food are roughly a sixth of the food nobody asks you about, and the part with the least nutrition behind it."
      ], "yours", function (p) { p.food.baseFactor = Math.min(p.food.baseFactor || 1, 1 - LS.drinksAndSnacks.value); });

      // ---------- stuff, going out, digital ----------
      // Buying and spending levers stack: each writes the LOWEST factor asked for so far
      // (Math.min), so ticking "half as much" and "almost nothing" together means almost
      // nothing, in either order, rather than multiplying into a number nobody chose.
      var g = profile.goods, goodsSpend = g.clothes + g.electronics + g.furniture + g.other;
      if (["clothes", "electronics", "furniture", "other"].some(function (k) { return g[k] > 0 && (!g.secondHand || g.secondHand[k] !== "mostly"); }))
        add("secondHand", "Buy used first, new only when you have to", [
          "Willhaben and the Tandler shops for furniture and clothes, Refurbed for phones and laptops — refurbished electronics come with a warranty now — and the Reparaturbonus for fixing what you already own.",
          "Making a thing is where most of its footprint sits: about 80% for a phone or a laptop. A second owner halves that without anyone manufacturing anything."
        ], "yours", function (p) {
          p.goods.secondHand = { clothes: "mostly", electronics: "mostly", furniture: "mostly", other: "mostly" }; });

      if (goodsSpend > 0) {
        add("buyLess", "Buy half as much, twice as good", [
          "Fewer things, chosen to last, and repaired when they break. Austria’s Reparaturbonus pays part of the repair bill, and a jacket that survives ten winters beats three that don’t.",
          "Goods are counted by what you spend, because spending is what production responds to. Spending half is producing half."
        ], "yours", function (p) { p.goods.spendFactor = Math.min(p.goods.spendFactor || 1, LS.buyLess.value); });
        add("buyAlmostNothing", "A no-buy year", [
          "For twelve months, replace only what actually breaks. Borrow, swap, and use a library of things (Leila in Vienna lends everything from drills to raclette grills). Most people who try it describe it as a relief rather than a deprivation.",
          "Most of what gets bought replaces something that still worked. This is the version of ‘buy less’ that shows where the floor actually is."
        ], "big", function (p) { p.goods.spendFactor = Math.min(p.goods.spendFactor || 1, LS.buyAlmostNone.value); });
      }

      var sv = profile.services, svSpend = sv.eatingOut + sv.hotels + sv.leisure;
      if (svSpend > 0) {
        add("spendLess", "Cook more of the week, go out better", [
          "Two or three restaurant meals a week instead of five, and put the difference into the ones you keep. Cooking with other people is the cheap half of a social life and usually the better half.",
          "A restaurant’s own operation — kitchen, premises, staff, waste — is about 0.15 kg CO₂e per euro on top of the food itself."
        ], "yours", function (p) { p.services.factor = Math.min(p.services.factor || 1, LS.spendLess.value); });
        add("spendMuchLess", "Fewer holidays, longer, closer", [
          "One proper two-week holiday instead of four long weekends, somewhere you can reach overland. Longer stays cost less per day, and you stop spending the first two days recovering from the journey.",
          "Hotels are about 0.25 kg CO₂e per euro, and the short-break habit multiplies the travelling as well as the nights."
        ], "big", function (p) { p.services.factor = Math.min(p.services.factor || 1, LS.spendMuchLess.value); });
      }

      // "Down to the Austrian average" levers. These only appear for people who are ABOVE the
      // average in that area, and the factor is worked out from their own answers — so the lever
      // is honest for a big spender and simply absent for everyone else. They stack with the
      // behavioural levers above: average first, then half of that, then mostly second-hand.
      var now = calculate(profile).byDomain;
      if (goodsSpend > 0 && now.goods > B.austria.byDomain.goods * 1.05)
        add("goodsAverage", "Buy no more than an average Austrian", [
          "Not austerity — the average. Your spending on clothes, gadgets and furniture brought down to what a typical Austrian household spends, which is not a frugal life by any standard.",
          "You are above the Austrian average in this area; this is what it looks like to be at it. It stacks with buying used and buying less."
        ], "big", function (p) { p.goods.capFactor = Math.min(p.goods.capFactor || 1, B.austria.byDomain.goods / now.goods); });
      if (svSpend > 0 && now.services > B.austria.byDomain.services * 1.05)
        add("servicesAverage", "Go out and travel like an average Austrian", [
          "Your restaurants, hotels and leisure brought down to what a typical Austrian spends — which still buys a good deal of eating out and a real holiday.",
          "You are above the Austrian average here; this is what being at it costs. It stacks with cooking more and holidaying closer."
        ], "big", function (p) { p.services.capFactor = Math.min(p.services.capFactor || 1, B.austria.byDomain.services / now.services); });

      var dg = profile.digital || {};
      if ((dg.streamingHoursDay || 0) > LS.streamingCut.value || (dg.aiVideosMonth || 0) > 0)
        add("digitalLess", "Watch on purpose instead of on autopilot", [
          "Pick what you are going to watch and stop when it ends, rather than letting autoplay run the evening. And leave generated video alone — it is the one genuinely heavy thing in all of digital.",
          "An hour of streaming is about 55 g, which is small. One generated AI video is about 350 g — roughly six hours of streaming for five seconds of footage."
        ], "yours", function (p) {
          p.digital.streamingHoursDay = Math.min(p.digital.streamingHoursDay || 0, LS.streamingCut.value);
          p.digital.aiVideosMonth = 0;
        });

      out.sort(function (a, b) { return b.saved - a.saved; });
      return out;
    }

    // Several levers together (savings are not simply additive, e.g. green tariff + heat pump)
    function combined(profile, leverList) {
      var p = JSON.parse(JSON.stringify(profile));
      leverList.forEach(function (l) { l.change(p); });
      return calculate(profile).total - calculate(p).total;
    }

    // Which set of changes gets this person under a target (biggest first, stop when reached)?
    // Levers that exclude each other are fine: applying both just means applying the stronger one.
    // Order matters for kindness, not for arithmetic: take the ordinary changes first, biggest
    // saving first, and only reach for the ones marked "big" (a no-buy year, a smaller home,
    // living like the average) once the ordinary ones have run out. Nobody should be told to
    // move house before they have been told to switch electricity tariff.
    function pathToTarget(profile, target, onlyControls) {
      var all = levers(profile).filter(function (l) { return !onlyControls || onlyControls.indexOf(l.control) >= 0; });
      var ordered = all.filter(function (l) { return l.control !== "big"; })
                       .concat(all.filter(function (l) { return l.control === "big"; }));
      var chosen = [], total = calculate(profile).total;
      for (var i = 0; i < ordered.length && total > target; i++) {
        var test = chosen.concat([ordered[i]]);
        var after = calculate(profile).total - combined(profile, test);
        if (after < total - 0.01) { chosen = test; total = after; }
      }
      return { levers: chosen, total: total, reached: total <= target };
    }

    function details(profile) {
      return { digitalKg: digital(profile, centralDrawer()) };
    }

    // Emissions your MONEY finances. Note what this function does not do: it is not called
    // by calculate(), not called by run(), and nothing it returns ever reaches the total.
    // Investments are attributed emissions, not consumed ones — the cement company you
    // part-own through a pension fund is already counted in the footprint of whoever buys
    // its cement — so adding this to a consumption footprint would count the same tonnes
    // twice. It is returned as a range because the two published reference points for the
    // same quantity differ by a factor of six (see F.financedEmissions).
    function financed(profile) {
      var eur = (profile.money && profile.money.amount) || 0;
      if (!eur) return null;
      var Fi = F.financedEmissions;
      return {
        eur: eur,
        low: eur / 10000 * Fi.low.value,
        high: eur / 10000 * Fi.high.value,
        labelled: profile.money.savings === "labelled"
      };
    }

    return {
      calculate: calculate,
      simulate: simulate,
      biggestUncertainty: biggestUncertainty,
      compensation: compensation,
      details: details,
      financed: financed,
      levers: levers,
      combined: combined,
      sources: sources,
      causeGroups: CAUSE_GROUPS,
      pathToTarget: pathToTarget,
      _internals: { housing: housing, transport: transport, flights: flights, food: food, goods: goods, services: services, digital: digital,
                    centralDrawer: centralDrawer, randomDrawer: randomDrawer, mulberry32: mulberry32 }
    };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.engine = defineEngine(G.factors, G.benchmarks);
  G.sources["js/engine.js"] = defineEngine.toString();
})(typeof window !== "undefined" ? window : globalThis);
