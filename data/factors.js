/*
 * Emission factors used by the calculation engine.
 *
 * Every factor has:
 *   value  – central estimate
 *   unc    – relative uncertainty (0.25 = the true value is ~90% likely within ×/÷ 1.25)
 *   unit   – what the number means
 *   source – where it comes from (verify and update yearly!)
 *
 * All values are life-cycle CO2e (all greenhouse gases, incl. upstream supply chain).
 */
(function (root) {
  function defineFactors() {
    return {
      version: "2026-09-v1",
      country: "AT",

      // ---------- HOUSING ----------
      electricity: {
        austriaMix: { value: 0.209, unc: 0.15, unit: "kg CO2e / kWh", source: "Umweltbundesamt AT, Emissionsfaktoren (REP-0948, 2025), Austrian electricity mix, data year 2022" },
        greenTariff: { value: 0.030, unc: 0.60, unit: "kg CO2e / kWh", source: "Estimate for certified 100% renewable tariff (hydro/wind/PV life-cycle). Market-based accounting; debated." }
      },
      heatingFuel: {
        gas:      { value: 0.249, unc: 0.10, unit: "kg CO2e / kWh fuel", source: "Umweltbundesamt AT REP-0948 (2025)" },
        oil:      { value: 0.342, unc: 0.10, unit: "kg CO2e / kWh fuel", source: "Umweltbundesamt AT REP-0948 (2025)" },
        district: { value: 0.172, unc: 0.35, unit: "kg CO2e / kWh heat", source: "Umweltbundesamt AT REP-0948 (2025), Austrian average; varies strongly by city" },
        pellets:  { value: 0.026, unc: 0.40, unit: "kg CO2e / kWh fuel", source: "Umweltbundesamt AT REP-0948 (2025)" },
        wood:     { value: 0.025, unc: 0.50, unit: "kg CO2e / kWh fuel", source: "Umweltbundesamt AT REP-0948 (2025)" }
      },
      heatingEfficiency: { // useful heat per kWh of fuel (heat pump: COP)
        gas: 0.90, oil: 0.85, district: 1.00, pellets: 0.85, wood: 0.75, electric: 1.00,
        heatpumpCOP: { value: 3.2, unc: 0.20, unit: "kWh heat / kWh electricity", source: "Typical seasonal COP, air/water heat pump" }
      },
      heatDemand: { // space heating, kWh per m² per year
        old:       { value: 170, unc: 0.25, unit: "kWh / m² / yr", label: "Before 1980, not renovated" },
        average:   { value: 120, unc: 0.25, unit: "kWh / m² / yr", label: "1980–2000 or partly renovated" },
        modern:    { value: 75,  unc: 0.25, unit: "kWh / m² / yr", label: "2000–2015" },
        efficient: { value: 45,  unc: 0.30, unit: "kWh / m² / yr", label: "After 2015 or fully renovated" },
        passive:   { value: 15,  unc: 0.40, unit: "kWh / m² / yr", label: "Passive house" },
        source: "Typical ranges from Austrian energy performance certificates (OIB); simplified"
      },
      // If people know their yearly consumption: convert bill units to kWh
      energyUnits: {
        gas:      [["kWh per year", 1], ["m³ per year", 10.5]],
        oil:      [["litres per year", 10], ["kWh per year", 1]],
        district: [["kWh per year", 1], ["MWh per year", 1000]],
        pellets:  [["kg per year", 4.8], ["tonnes per year", 4800]],
        wood:     [["Raummeter (rm) per year", 1800], ["kWh per year", 1]],
        heatpump: [["kWh electricity per year", 1]],
        electric: [["kWh per year", 1]],
        source: "Typical values: natural gas ≈ 10.5 kWh/m³, heating oil ≈ 10 kWh/l, pellets ≈ 4.8 kWh/kg, mixed firewood ≈ 1,800 kWh per stacked m³"
      },
      measuredSpaceHeatShare: { value: 0.80, source: "Assumption: ~80% of measured heating energy is space heating, ~20% hot water" },
      lowerTemperature: { perDegree: 0.06, source: "Rule of thumb: 1 °C lower room temperature saves ~6% heating energy (e.g. BUND, Verbund)" },
      hotWaterPerPerson: { value: 700, unc: 0.30, unit: "kWh heat / person / yr", source: "Typical Central European value" },
      defaultElectricityKwh: { 1: 1800, 2: 2800, 3: 3500, 4: 4200, 5: 4800, source: "Typical Austrian household consumption (excl. electric heating)" },
      defaultAreaM2: { 1: 60, 2: 85, 3: 100, 4: 115, 5: 125, source: "Approximate Austrian dwelling sizes by household size" },

      // ---------- GROUND TRANSPORT ----------
      car: {
        petrol: { litresPer100: 7.0, kWhPerLitre: 8.9, fuelFactor: 0.327 },
        diesel: { litresPer100: 6.0, kWhPerLitre: 9.9, fuelFactor: 0.330 },
        hybrid: { litresPer100: 5.0, kWhPerLitre: 8.9, fuelFactor: 0.327 },
        ev:     { kWhPer100: 19 }, // incl. charging losses
        fuelConsumptionUnc: 0.20,
        manufacturing: {
          combustion: { value: 0.035, unc: 0.30, unit: "kg CO2e / km", source: "~6 t vehicle production over ~180,000 km" },
          ev:         { value: 0.055, unc: 0.35, unit: "kg CO2e / km", source: "~10 t incl. battery over ~180,000 km" }
        },
        source: "Fuel factors: Umweltbundesamt AT REP-0948 (2025), petrol 327 g/kWh, diesel 330 g/kWh incl. upstream"
      },
      transit: {
        train: { value: 0.020, unc: 0.50, unit: "kg CO2e / passenger-km", source: "Austrian rail (mostly hydro-powered), incl. upstream; estimate" },
        city:  { value: 0.050, unc: 0.50, unit: "kg CO2e / passenger-km", source: "Mix of bus, tram and metro in Austrian cities; estimate" }
      },
      // People know time better than distance. Average door-to-door speeds incl. stops:
      averageSpeedKmh: {
        car:   { value: 40, unc: 0.30, source: "Mixed city/country driving incl. traffic; estimate" },
        train: { value: 80, unc: 0.30, source: "Mix of regional trains (~50 km/h) and Railjet (~120 km/h); estimate" },
        city:  { value: 18, unc: 0.30, source: "Bus/tram/metro incl. stops, e.g. Vienna U-Bahn ~32 km/h, tram ~15 km/h; estimate" }
      },

      // ---------- FLIGHTS ----------
      flights: {
        // Counted per ONE-WAY flight (leg), because people mix modes: fly out, take the train back.
        // one-way great-circle distance assumed per category
        distanceKm: { short: 1100, medium: 2800, long: 7500 },
        distanceUplift: 1.08, // detours & holding patterns (DESNZ method)
        perPkm: { // economy, incl. radiative forcing (non-CO2 effects) and upstream fuel
          short:  { value: 0.160, unc: 0.35, unit: "kg CO2e / passenger-km" },
          medium: { value: 0.150, unc: 0.35, unit: "kg CO2e / passenger-km" },
          long:   { value: 0.142, unc: 0.35, unit: "kg CO2e / passenger-km" }
        },
        classMultiplier: {
          economy: { short: 1.0, medium: 1.0, long: 1.0 },
          premium: { short: 1.0, medium: 1.6, long: 1.6 },
          business:{ short: 1.5, medium: 2.9, long: 2.9 }
        },
        source: "UK DESNZ/DEFRA conversion factors 2025 (with RF), long-haul business 0.411 kg/pkm ÷ 2.9 class ratio; short/medium approximated. Uncertainty mainly from radiative forcing science."
      },

      // ---------- FOOD ----------
      // Per-kg footprints at the supermarket checkout, incl. land-use change (ifeu 2020, Germany).
      // portionG = one typical portion; the user says how often they eat it.
      foodGroups: {
        beef:      { label: "Beef & lamb",            portionG: 150, kgCO2ePerKg: 13.6, unc: 0.30, group: "meat" },
        pork:      { label: "Pork",                   portionG: 125, kgCO2ePerKg: 4.6,  unc: 0.30, group: "meat" },
        poultry:   { label: "Chicken & turkey",       portionG: 125, kgCO2ePerKg: 5.5,  unc: 0.30, group: "meat" },
        sausage:   { label: "Sausage & cold cuts",    portionG: 50,  kgCO2ePerKg: 2.9,  unc: 0.40, group: "meat" },
        fish:      { label: "Fish & seafood",         portionG: 125, kgCO2ePerKg: 3.0,  unc: 0.50, group: "meat", note: "wild fish 2.4; farmed and shrimp higher" },
        cheese:    { label: "Cheese",                 portionG: 40,  kgCO2ePerKg: 5.7,  unc: 0.25, group: "dairy" },
        milk:      { label: "Milk & yogurt",          portionG: 200, kgCO2ePerKg: 1.5,  unc: 0.25, group: "dairy" },
        butter:    { label: "Butter & cream",         portionG: 20,  kgCO2ePerKg: 7.0,  unc: 0.30, group: "dairy", note: "butter 9.0, cream 4.2" },
        eggs:      { label: "Eggs",                   portionG: 60,  kgCO2ePerKg: 3.0,  unc: 0.25, group: "dairy" },
        plantProtein: { label: "Tofu, beans & lentils", portionG: 125, kgCO2ePerKg: 1.1, unc: 0.40, group: "plant" },
        plantDrink:{ label: "Oat / soy drink",        portionG: 200, kgCO2ePerKg: 0.35, unc: 0.40, group: "plant" },
        rice:      { label: "Rice",                   portionG: 75,  kgCO2ePerKg: 3.1,  unc: 0.40, group: "plant", note: "paddy rice emits methane" },
        coffee:    { label: "Coffee (cups)",          portionG: 10,  kgCO2ePerKg: 5.6,  unc: 0.40, group: "plant" },
        chocolate: { label: "Chocolate & sweets",     portionG: 25,  kgCO2ePerKg: 4.1,  unc: 0.40, group: "plant" },
        source: "ifeu (2020): Ökologische Fußabdrücke von Lebensmitteln und Gerichten in Deutschland, for Umweltbundesamt DE. Boundary: to checkout, incl. land-use change."
      },
      // Everything everyone eats regardless of the choices above: bread, grains, potatoes, vegetables,
      // fruit, oils, sugar, drinks. Bottom-up estimate with the ifeu values (e.g. 60 kg bread × 0.6 …).
      plantBaseKg: { value: 380, unc: 0.35, unit: "kg CO2e / person / yr", source: "Estimate from ifeu (2020) per-kg values and typical Austrian consumption amounts" },
      portionsPerWeek: { never: 0, monthly: 0.5, weekly: 1.5, often: 4, daily: 7, twiceDaily: 14 },
      // Out-of-season fresh produce: heated greenhouse or air freight is 10–25× regional & seasonal.
      // Air-freighted fresh produce. Winter tomatoes from Spain vs. heated Austrian greenhouses differ
      // (0.4 vs. 1.1–1.4 kg CO2/kg, Theurl et al.), but at typical amounts that is only ~5–15 kg/yr — not asked.
      airFreight: {
        // Only a few fresh products actually fly. Each row: typical pack size per purchase.
        items: {
          berries:    { label: "Fresh berries out of season", kgPerPurchase: 0.25, hint: "raspberries, blueberries, strawberries in winter" },
          vegetables: { label: "Fresh veg from overseas", kgPerPurchase: 0.40, hint: "asparagus, green beans, sugar snaps, baby corn" },
          exotic:     { label: "Delicate exotic fruit", kgPerPurchase: 0.50, hint: "papaya, passion fruit, fresh figs, lychee, ripe mango" }
        },
        purchasesPerYear: { never: 0, rare: 4, monthly: 12, weekly: 52, often: 150 },
        extraPerKg: { value: 8, unc: 0.60 },
        source: "ifeu (2020): strawberries in season 0.3 vs. air-freighted 3.4 kg CO2e/kg; pineapple by air 15.1 vs. ship 0.6. Pack sizes and purchase counts are estimates. Bananas, citrus, apples, grapes, avocado, pineapple, dates and nuts travel by ship or truck — they are not counted here."
      },
      wasteRate: { rarely: 0.02, sometimes: 0.08, often: 0.20, source: "Estimate: share of food bought that is thrown away. rarely = almost never, sometimes = a few times a month, often = every week" },
      leftoversExtra: { rarely: 0, sometimes: 0.03, often: 0.08 },
      wasteCategories: {
        meatFish: ["beef", "pork", "poultry", "sausage", "fish"],
        dairy: ["cheese", "milk", "butter", "eggs"],
        bread: { plantBaseShare: 0.15 },
        fruitVeg: { plantBaseShare: 0.20 }
      },

      // ---------- GOODS (spending-based) ----------
      goodsIntensity: { // kg CO2e per € spent
        clothes:     { value: 0.30, unc: 0.45, label: "Clothes & shoes" },
        electronics: { value: 0.30, unc: 0.45, label: "Phones, computers, TV & appliances" },
        furniture:   { value: 0.30, unc: 0.45, label: "Furniture & household items" },
        other:       { value: 0.25, unc: 0.50, label: "Hobby, sports gear, toys & other stuff" },
        source: "Order of magnitude from EU multi-regional input-output data (EXIOBASE) for consumer goods; simplified — replace with Austrian EXIOBASE values"
      },
      secondHand: { new: 1.0, mix: 0.85, mostly: 0.60 },

      // ---------- SERVICES & LEISURE ----------
      servicesIntensity: { // kg CO2e per € spent
        // eatingOut is the RESTAURANT'S OWN share only — kitchen energy, premises, dishwashing,
        // staff, kitchen waste. What you ate is already counted in the food questions, which ask
        // "at home or out". A full restaurant-meal factor (~0.4–0.5 kg/€) would charge the same
        // steak twice. See METHOD.md, "Double counting we had to avoid".
        eatingOut: { value: 0.15, unc: 0.50, label: "Restaurants & cafés (the venue, not the food)" },
        hotels:    { value: 0.25, unc: 0.45, label: "Hotels & holiday accommodation" },
        leisure:   { value: 0.12, unc: 0.50, label: "Events, gym, sports club, culture, courses" },
        source: "Order of magnitude from EXIOBASE service sectors; simplified. Eating out: a full food-service intensity is ~0.4–0.5 kg CO2e/€, of which roughly two thirds is the food itself — that part is already in the food model, so only the venue's own third is counted here. Insurance and banking are deliberately NOT included: a premium is mostly money moved around (claims, reserves), the emissions of running the company are ~0.1 t per person, almost the same for everyone, and the spending-based factor for it was the weakest number in this model."
      },
      digital: {
        streamingPerHour: { value: 0.055, unc: 0.60, unit: "kg CO2e / hour of video", source: "Carbon Trust (2021), ~55 g CO2e per hour of video streaming in Europe incl. device" },
        aiTextPrompt:     { value: 0.0003, unc: 1.0, unit: "kg CO2e / prompt", source: "Google (2025): median Gemini text prompt 0.24 Wh, 0.03 g CO2e; ChatGPT est. 0.1–0.3 g (Hannah Ritchie 2025)" },
        aiImage:          { value: 0.001, unc: 1.0, unit: "kg CO2e / image", source: "~0.3–1.2 Wh per image (Hannah Ritchie 2025)" },
        aiVideo:          { value: 0.35, unc: 1.0, unit: "kg CO2e / short video", source: "~1 kWh per 5-second generated video (Hannah Ritchie 2025) × ~0.35 kg/kWh data-centre grid" }
      },

      // ---------- ASSUMPTIONS BEHIND THE "WHAT YOU COULD CHANGE" LEVERS ----------
      // Each lever copies the profile, changes ONE of these and recalculates — no lever has a
      // stored "typical saving". These are the sizes of the changes themselves.
      leverSizes: {
        electricityCut: { value: 0.30, unit: "share of household electricity",
          source: "LED lighting, an A-rated fridge and washing machine, no standby, no electric heaters or dryer: 25–35% is the usual range in Austrian and German efficiency advice (klimaaktiv, Umweltberatung)" },
        solarSelfUse:   { value: 0.35, unit: "share of household electricity covered by your own roof",
          source: "A typical Austrian domestic PV system without a battery covers ~30% of household use directly (self-consumption); with a battery 50–70%. 35% is the conservative middle. The rest is exported and counts for whoever uses it." },
        hotWaterCut:    { value: 0.25, unit: "share of hot-water energy",
          source: "Shorter showers, a water-saving shower head and a tank at 55 °C instead of 65 °C: 20–30% in standard energy advice" },
        smallerHome:    { value: 0.25, unit: "share of heated floor area",
          source: "Moving to a home a quarter smaller per person, or letting a room. Austrian dwelling space per person is ~45 m², among the highest in Europe." },
        drinksAndSnacks:{ value: 0.18, unit: "share of the plant-based food base",
          source: "Soft drinks, alcohol, sweets, snacks and highly processed convenience food are roughly a sixth to a fifth of the base's footprint (ifeu 2020 per-kg values applied to typical Austrian amounts). An estimate." },
        buyLess:        { value: 0.50, source: "Buying half as much new: repair, borrow, keep things longer" },
        buyAlmostNone:  { value: 0.25, source: "A deliberate no-buy year: only replacing what actually breaks" },
        spendLess:      { value: 2 / 3, source: "A third less on eating out, hotels and leisure" },
        spendMuchLess:  { value: 0.50, source: "Half as much: cooking at home, holidays closer and shorter" },
        travelLess:     { value: 0.30, unit: "share of distance travelled by train, bus, tram and metro",
          source: "Living closer to work or taking fewer long trips. Distance costs carbon in every mode — a train is far cleaner per kilometre, not free." },
        streamingCut:   { value: 1, unit: "hours of streaming per day kept",
          source: "Capping streaming at about an hour a day and not generating AI video" }
      },

      // ---------- MONEY: FINANCED EMISSIONS (shown separately, NEVER added to the total) ----------
      // Deliberately a RANGE, not a value, and deliberately outside calculate().
      // Two published reference points for the same idea disagree by a factor of ~6, which is
      // the honest finding: attributed-emission numbers depend enormously on method, so putting
      // one inside a bar that claims a ±20% range would be false precision. And adding them at
      // all would double-count: the emissions of the companies you part-own are already in the
      // footprint of whoever buys what those companies make. See METHOD.md, "Is your money
      // really that small?".
      financedEmissions: {
        low:  { value: 0.84, unit: "t CO2e per €10,000 invested per year",
                source: "ECB Climate change indicators (Nov 2025): euro-area banks' securities portfolios 84 tCO2e per €1m invested in 2024 (scope 1+2 of the companies held, attributed by enterprise value), down from 162 in 2018" },
        high: { value: 5.40, unit: "t CO2e per €10,000 invested per year",
                source: "Make My Money Matter / Aviva / Route2 (2021): moving an average £30,000 pension to a sustainable fund ≈ 19 t CO2e a year — a much broader scope and a different attribution; full methodology unpublished" },
        source: "Attributed, not consumed. Method: PCAF, Global GHG Accounting and Reporting Standard for the Financial Industry, Part A — Financed Emissions."
      },

      // ---------- COMPENSATION TYPES (shown separately, never subtracted) ----------
      offsetTypes: {
        avoidance:     { label: "Avoidance credits", examples: "renewable energy, efficient cookstoves, landfill methane capture", storage: "none — prevents emissions elsewhere", risk: "high: often over-credited, may have happened anyway" },
        forest:        { label: "Forest protection (REDD+)", examples: "paying to stop planned deforestation", storage: "keeps existing carbon in place", risk: "high: baselines often inflated, leakage, fires" },
        natureRemoval: { label: "Nature-based removal", examples: "tree planting, soil carbon, mangroves & peatland restoration", storage: "short-lived: decades, can be reversed by fire, drought, land-use change", risk: "medium" },
        biochar:       { label: "Biochar & long-lived biomass", examples: "biochar in soils, wood in buildings", storage: "medium: roughly 100+ years", risk: "low–medium" },
        durable:       { label: "Durable removal", examples: "direct air capture + storage (DACCS), BECCS, enhanced rock weathering, mineralisation", storage: "long-lived: 1,000+ years", risk: "low reversal risk; expensive (often €300–1,000/t)" },
        source: "Categories follow the Oxford Offsetting Principles (2024 revision): cut emissions first, shift to removals, shift to durable storage. Credit integrity: Probst et al. (2024), Nature Communications."
      },

      // Period conversions to "per year"
      perYear: { day: 365, workday: 230, week: 52, month: 12, year: 1 },

      // ---------- USER INPUT CONFIDENCE ----------
      inputConfidence: { exact: 0.05, estimate: 0.20, guess: 0.50 }
    };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.factors = defineFactors();
  G.sources["data/factors.js"] = defineFactors.toString();
})(typeof window !== "undefined" ? window : globalThis);
