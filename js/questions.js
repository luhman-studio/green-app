/*
 * The guided chat script.
 * Each step asks one thing and writes the answer into the profile.
 * No AI: the same answers always produce the same profile.
 * (Later, an AI chat could fill exactly this profile structure.)
 *
 * Step types:
 *   number   – one number, with quick-pick chips
 *   amount   – number + unit/period dropdown, converted to a yearly value
 *   choice   – pick one
 *   multi    – pick several, then "Continue"
 *   freqGrid – for each selected item: how often
 *   form     – several amounts, each with its own period
 *   text     – free text (optional)
 */
(function (root) {
  function defineQuestions(F) {
    function blankProfile() {
      return {
        household: { size: 2 },
        home: { type: "flat", tenure: "unknown", area: { v: null, c: "guess" }, building: "average", heating: "gas", heatKnows: false, heatKnown: { v: null, c: "guess" },
                electricity: { v: null, c: "guess" }, electricityKnows: false, electricityChoice: "unknown", greenTariff: false },
        car: { type: "none", km: { v: 0, c: "estimate" }, people: 1, dependence: "unknown" },
        transit: { trainHours: { v: 0, c: "estimate" }, cityHours: { v: 0, c: "estimate" } },
        flights: { short: 0, medium: 0, long: 0, cls: "economy", purpose: "unknown" },
        food: { selected: [], portions: {}, airFreight: {}, waste: {} },
        goods: { clothes: 0, electronics: 0, furniture: 0, other: 0, secondHand: { clothes: "new", electronics: "new", furniture: "new", other: "new" } },
        services: { eatingOut: 0, hotels: 0, leisure: 0 },
        digital: { streamingHoursDay: 0, aiPromptsDay: 0, aiImagesMonth: 0, aiVideosMonth: 0 },
        money: { bankType: "unknown", savings: "unknown", amount: 0 },
        offsets: { any: false, types: [], avoidance: 0, forest: 0, natureRemoval: 0, biochar: 0, durable: 0, contributionEur: 0, certification: null }
      };
    }

    // Convert an amount to a yearly value. kind: "min" (→ hours), "h", "km", "eur", "count"
    function toYear(value, kind, period) {
      var v = kind === "min" ? value / 60 : value;
      return v * F.perYear[period];
    }

    var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
    var confLabel = { exact: "exact", estimate: "estimate", guess: "rough guess" };
    var FG = F.foodGroups;
    var foodIds = Object.keys(FG).filter(function (k) { return k !== "source"; });
    var freqOptions = [["1–3× a month", "monthly"], ["1–2× a week", "weekly"], ["3–5× a week", "often"], ["Daily", "daily"], ["2+ times a day", "twiceDaily"]];
    var freqLabel = {}; freqOptions.forEach(function (o) { freqLabel[o[1]] = o[0]; });
    var eurPeriods = [["per week", "week"], ["per month", "month"], ["per year", "year"]];
    var offsetIds = ["avoidance", "forest", "natureRemoval", "biochar", "durable"];
    var SH = { label: "second-hand", options: [["new", "new"], ["mixed", "mix"], ["mostly used", "mostly"]] };


    // Section label, how much the answer moves the result, and the word to highlight.
    // weight: "high" = look it up if you can · "medium" = a good estimate is enough
    //         "low" = a guess is fine · "none" = not in the number at all (advice or context only)
    var META = {
      householdSize:    ["Home & energy", "high", "how many people"],
      area:             ["Home & energy", "high", "How big"],
      homeType:         ["Home & energy", "none", "house or a flat"],
      tenure:           ["Home & energy", "none", "own it or rent"],
      heating:          ["Home & energy", "high", "heated"],
      heatKnows:        ["Home & energy", "high", "know"],
      heatAmount:       ["Home & energy", "high", "How much"],
      building:         ["Home & energy", "high", "energy-efficient"],
      electricityKnows: ["Home & energy", "medium", "know"],
      electricity:      ["Home & energy", "medium", "kWh"],
      electricityChoice:["Home & energy", "none", "in your household’s name"],
      greenTariff:      ["Home & energy", "high", "100% renewable"],
      carType:          ["Getting around", "high", "car"],
      carKm:            ["Getting around", "high", "How much"],
      carPeople:        ["Getting around", "medium", "how many people"],
      carDependence:    ["Getting around", "none", "differently"],
      trainTime:        ["Getting around", "low", "trains"],
      cityTime:         ["Getting around", "low", "buses, trams or the metro"],
      flightsShort:     ["Flights", "medium", "SHORT"],
      flightsMedium:    ["Flights", "high", "MEDIUM"],
      flightsLong:      ["Flights", "high", "LONG"],
      flightClass:      ["Flights", "medium", "class"],
      flightPurpose:    ["Flights", "none", "holidays"],
      foodSelect:       ["Food", "high", "do you eat"],
      foodFreq:         ["Food", "high", "how often"],
      airFreight:       ["Food", "low", "came by plane"],
      foodWaste:        ["Food", "medium", "in the bin"],
      goodsSpend:       ["Stuff you buy", "medium", "how much do you personally spend"],
      leisureSpend:     ["Going out & leisure", "medium", "how much"],
      digital:          ["Going out & leisure", "low", "streaming and AI"],
      bankType:         ["Your money", "none", "bank account"],
      savings:          ["Your money", "none", "invested"],
      savingsAmount:    ["Your money", "none", "how much"],
      offsetsAny:       ["Compensation", "none", "carbon credits"],
      offsetsTypes:     ["Compensation", "none", "What kind"],
      offsetsAmounts:   ["Compensation", "none", "How much"],
      offsetsCert:      ["Compensation", "none", "certified"]
    };
    var WEIGHT = {
      high:   { label: "Big effect", hint: "Worth looking this one up — it moves your result a lot." },
      medium: { label: "Medium effect", hint: "A good estimate is enough here." },
      low:    { label: "Small effect", hint: "A rough guess is fine — this hardly moves your result." },
      none:   { label: "Not in the number", hint: "Used for the advice and context, not for your tonnes." }
    };

    var steps = [
      // ---------- HOUSING ----------
      { id: "householdSize", domain: "housing", type: "number", unit: "people", min: 1, max: 30, integer: true,
        ask: "Let’s start at home. How many people live in your household, including you?",
        presets: [["Just me", 1], ["2", 2], ["3", 3], ["4", 4], ["5", 5]],
        apply: function (p, a) { p.household.size = a.v; },
        summary: function (p) { return p.household.size + (p.household.size === 1 ? " person" : " people") + " in household"; } },

      { id: "area", domain: "housing", type: "number", unit: "m²", min: 10, max: 1000,
        ask: "How big is your home (heated living area)?",
        help: "Used to estimate heating if you don’t know your consumption — and to see how much space is heated per person.",
        presets: [["40 m²", 40], ["70 m²", 70], ["100 m²", 100], ["140 m²", 140]],
        dontKnow: true, askConfidence: true,
        apply: function (p, a) { p.home.area = a; },
        summary: function (p) {
          return p.home.area.v == null ? "Home size: typical (" + F.defaultAreaM2[Math.min(5, p.household.size)] + " m², assumed)"
                                       : "Home: " + fmt(p.home.area.v) + " m² (" + confLabel[p.home.area.c] + ")";
        } },

      { id: "homeType", domain: "housing", type: "choice",
        ask: "Is that a house or a flat?",
        options: [["House", "house"], ["Flat", "flat"]],
        apply: function (p, v) { p.home.type = v; },
        summary: function (p) { return p.home.type === "house" ? "Lives in a house" : "Lives in a flat"; } },

      { id: "tenure", domain: "housing", type: "choice",
        ask: "Do you own it or rent it?",
        help: "This decides which changes are in your hands: an owner of a house can replace the heating, a flat owner needs the other owners, a tenant needs the landlord.",
        options: [["Own it", "own"], ["Rent it", "rent"], ["Something else", "other"]],
        apply: function (p, v) { p.home.tenure = v; },
        summary: function (p) { return { own: "Owns it", rent: "Rents it", other: "Other living situation" }[p.home.tenure]; } },

      { id: "heating", domain: "housing", type: "choice",
        ask: "How is your home heated?",
        options: [["Natural gas", "gas"], ["Heating oil", "oil"], ["District heating", "district"], ["Heat pump", "heatpump"], ["Wood pellets", "pellets"], ["Firewood", "wood"], ["Electric heaters", "electric"]],
        apply: function (p, v) { p.home.heating = v; },
        summary: function (p) { return "Heating: " + { gas: "natural gas", oil: "heating oil", district: "district heating", heatpump: "heat pump", pellets: "wood pellets", wood: "firewood", electric: "electric heaters" }[p.home.heating]; } },

      { id: "heatKnows", domain: "housing", type: "choice", resets: ["heatAmount"],
        ask: function (p) { return "Do you know how much " + { gas: "gas", oil: "heating oil", district: "district heating", heatpump: "electricity for the heat pump", pellets: "pellets", wood: "firewood", electric: "electricity for heating" }[p.home.heating] + " your household uses per year?"; },
        help: "It’s on the yearly bill (Jahresabrechnung) — or on the delivery notes for oil, pellets and firewood.",
        options: [["Yes, I know it", true], ["No", false]],
        apply: function (p, v) { p.home.heatKnows = v; if (!v) p.home.heatKnown = { v: null, c: "guess" }; },
        summary: function (p) { return p.home.heatKnows ? "Knows yearly heating energy" : "Heating energy estimated from home size"; } },

      { id: "heatAmount", domain: "housing", type: "amount", min: 0, max: 1000000,
        skip: function (p) { return !p.home.heatKnows; },
        ask: "How much per year? Pick the unit from your bill.",
        help: "If the same system also heats your water, just enter the total — I assume about 80% of it is space heating.",
        units: function (p) { return F.energyUnits[p.home.heating].map(function (u) { return [u[0], u[1], "energy"]; }); },
        defaultUnit: 0,
        askConfidence: true,
        apply: function (p, a) { p.home.heatKnown = a; },
        summary: function (p) { return "Heating energy: " + fmt(p.home.heatKnown.v) + " kWh/year (" + confLabel[p.home.heatKnown.c] + ")"; } },

      { id: "building", domain: "housing", type: "choice",
        ask: "Roughly how energy-efficient is the building?",
        options: ["old", "average", "modern", "efficient", "passive"].map(function (k) { return [F.heatDemand[k].label, k]; }),
        apply: function (p, v) { p.home.building = v; },
        summary: function (p) { return "Building: " + F.heatDemand[p.home.building].label; } },

      { id: "electricityKnows", domain: "housing", type: "choice", resets: ["electricity"],
        ask: "Do you know your household’s yearly electricity use (kWh on the electricity bill)?",
        options: [["Yes, I know it", true], ["No — use a typical value", false]],
        apply: function (p, v) { p.home.electricityKnows = v; if (!v) p.home.electricity = { v: null, c: "guess" }; },
        summary: function (p) { return p.home.electricityKnows ? "Knows yearly electricity" : "Electricity: typical (" + fmt(F.defaultElectricityKwh[Math.min(5, p.household.size)]) + " kWh, assumed)"; } },

      { id: "electricity", domain: "housing", type: "amount", min: 0, max: 100000,
        skip: function (p) { return !p.home.electricityKnows; },
        ask: function (p) {
          return "How many kWh per year?" + (p.home.heating === "heatpump" || p.home.heating === "electric" ? " Without the heating part — you already told me that." : "");
        },
        units: [["kWh per year", 1, "kWh"], ["kWh per month", 12, "kWh"]],
        askConfidence: true,
        apply: function (p, a) { p.home.electricity = a; },
        summary: function (p) { return "Electricity: " + fmt(p.home.electricity.v) + " kWh/year (" + confLabel[p.home.electricity.c] + ")"; } },

      { id: "electricityChoice", domain: "housing", type: "choice",
        ask: "Is the electricity contract in your household’s name?",
        help: "If yes, you can switch supplier yourself — it usually takes about 10 minutes online.",
        options: [["Yes, our own contract", "own"], ["No, it’s included in rent / operating costs", "included"], ["Not sure", "unknown"]],
        apply: function (p, v) { p.home.electricityChoice = v; },
        summary: function (p) { return { own: "Own electricity contract", included: "Electricity included in rent", unknown: "Electricity contract: not sure" }[p.home.electricityChoice]; } },

      { id: "greenTariff", domain: "housing", type: "choice",
        ask: "Is it a certified 100% renewable tariff?",
        help: "In Austria: Ökostrom with the Umweltzeichen UZ 46, or a supplier that sells only renewable electricity. Your yearly bill shows the electricity label (Stromkennzeichnung).",
        options: [["Yes", true], ["No", false], ["Not sure", false]],
        apply: function (p, v) { p.home.greenTariff = v; },
        summary: function (p) { return p.home.greenTariff ? "Green electricity tariff" : "Standard Austrian electricity mix"; } },

      // ---------- CAR & TRANSIT ----------
      { id: "carType", domain: "transport", type: "choice",
        ask: "Now getting around. Do you use a car regularly? If so, what kind?",
        options: [["No car", "none"], ["Petrol", "petrol"], ["Diesel", "diesel"], ["Hybrid", "hybrid"], ["Electric", "ev"]],
        apply: function (p, v) { p.car.type = v; if (v === "none") { p.car.km = { v: 0, c: "exact" }; p.car.people = 1; } },
        summary: function (p) { return p.car.type === "none" ? "No car" : "Car: " + { petrol: "petrol", diesel: "diesel", hybrid: "hybrid", ev: "electric" }[p.car.type]; } },

      { id: "carKm", domain: "transport", type: "amount", min: 0, max: 200000,
        skip: function (p) { return p.car.type === "none"; },
        ask: "How much do you travel by car — as driver or passenger? Kilometres or hours, whatever is easier.",
        help: "For scale: the Austrian average is about 12,000 km per car per year. The odometer or the last service invoice helps.",
        units: [["km per week", 52, "km"], ["km per month", 12, "km"], ["km per year", 1, "km"], ["hours per week", 52 * F.averageSpeedKmh.car.value, "h"]],
        defaultUnit: 2,
        askConfidence: true,
        apply: function (p, a) { p.car.km = a; },
        summary: function (p) { return "Car: " + fmt(p.car.km.v) + " km/year (" + confLabel[p.car.km.c] + ")"; } },

      { id: "carPeople", domain: "transport", type: "choice",
        skip: function (p) { return p.car.type === "none"; },
        ask: "On those trips, how many people are usually in the car, including you?",
        help: "Emissions are split between everyone in the car, so a shared ride counts less per person.",
        options: [["Mostly just me", 1], ["Usually 2", 2], ["3 or more", 3]],
        apply: function (p, v) { p.car.people = v; },
        summary: function (p) { return "Car occupancy: " + p.car.people + (p.car.people === 1 ? " person" : " people"); } },

      { id: "carDependence", domain: "transport", type: "choice",
        skip: function (p) { return p.car.type === "none"; },
        ask: "Could you do some of those trips differently — public transport, bike, car-sharing, carpooling?",
        help: "Only used to sort your levers into “in your hands” and “hard for you right now”.",
        options: [["Yes, quite a few", "easy"], ["Some of them", "partly"], ["Hardly — I depend on the car", "dependent"]],
        apply: function (p, v) { p.car.dependence = v; },
        summary: function (p) { return { easy: "Could replace many car trips", partly: "Could replace some car trips", dependent: "Depends on the car" }[p.car.dependence]; } },

      { id: "trainTime", domain: "transport", type: "amount", min: 0, max: 100000,
        ask: "How much time do you spend on trains? Pick whatever period fits.",
        help: "For scale: Vienna–Linz ≈ 1¼ h, Vienna–Salzburg ≈ 2½–3 h. I turn time into kilometres with an average speed of 80 km/h.",
        presets: [["Never", 0]],
        units: [["hours per week", 52, "h"], ["hours per month", 12, "h"], ["hours per year", 1, "h"], ["minutes per workday", 230 / 60, "min"]],
        defaultUnit: 1,
        apply: function (p, a) { p.transit.trainHours = a; },
        summary: function (p) { return "Train: " + fmt(p.transit.trainHours.v) + " hours/year"; } },

      { id: "cityTime", domain: "transport", type: "amount", min: 0, max: 100000,
        ask: "And time on buses, trams or the metro?",
        help: "A rough guess is fine: this part is usually 0.1–0.3 t a year, so even a 30% error hardly moves your result.",
        presets: [["Never", 0]],
        units: [["minutes per day", 365 / 60, "min"], ["hours per week", 52, "h"], ["hours per month", 12, "h"]],
        defaultUnit: 0,
        apply: function (p, a) { p.transit.cityHours = a; },
        summary: function (p) { return "Bus/tram/metro: " + fmt(p.transit.cityHours.v) + " hours/year"; } },

      // ---------- FLIGHTS ----------
      { id: "flightsShort", domain: "flights", type: "number", unit: "flights / year", min: 0, max: 200, integer: true,
        ask: "Flights next. In a typical year, how many SHORT flights do you take?",
        help: "Count every flight separately, in each direction: flying there and back is 2. Under 3 hours — e.g. Vienna–London, Vienna–Rome, Vienna–Berlin. That way you can count a trip where you fly out and take the train home as 1.",
        presets: [["0", 0], ["1", 1], ["2 (there & back)", 2], ["4", 4], ["8", 8]],
        apply: function (p, a) { p.flights.short = a.v; },
        summary: function (p) { return "Short flights: " + p.flights.short + " one-way / year"; } },

      { id: "flightsMedium", domain: "flights", type: "number", unit: "flights / year", min: 0, max: 200, integer: true,
        ask: "And MEDIUM flights?",
        help: "3–6 hours — e.g. Canary Islands, Egypt, Dubai. Again one-way: there and back is 2.",
        presets: [["0", 0], ["1", 1], ["2 (there & back)", 2], ["4", 4]],
        apply: function (p, a) { p.flights.medium = a.v; },
        summary: function (p) { return "Medium flights: " + p.flights.medium + " one-way / year"; } },

      { id: "flightsLong", domain: "flights", type: "number", unit: "flights / year", min: 0, max: 200, integer: true,
        ask: "And LONG flights?",
        help: "Over 6 hours — e.g. New York, Bangkok, Johannesburg. One-way again: there and back is 2.",
        presets: [["0", 0], ["1", 1], ["2 (there & back)", 2], ["4", 4]],
        apply: function (p, a) { p.flights.long = a.v; },
        summary: function (p) { return "Long flights: " + p.flights.long + " one-way / year"; } },

      { id: "flightClass", domain: "flights", type: "choice",
        skip: function (p) { return !(p.flights.short || p.flights.medium || p.flights.long); },
        ask: "Which class do you usually fly?",
        help: "Bigger seats take up more of the plane, so they carry a bigger share of its fuel: business is counted about 2.9× economy on long flights.",
        options: [["Economy", "economy"], ["Premium economy", "premium"], ["Business / First", "business"]],
        apply: function (p, v) { p.flights.cls = v; },
        summary: function (p) { return "Class: " + { economy: "economy", premium: "premium economy", business: "business" }[p.flights.cls]; } },

      { id: "flightPurpose", domain: "flights", type: "choice",
        skip: function (p) { return !(p.flights.short || p.flights.medium || p.flights.long); },
        ask: "Are these flights mostly for holidays and visits, or for work?",
        options: [["Holidays & visits", "leisure"], ["A mix", "mix"], ["Mostly work", "work"]],
        apply: function (p, v) { p.flights.purpose = v; },
        summary: function (p) { return { leisure: "Flights mostly private", mix: "Flights: private & work", work: "Flights mostly for work" }[p.flights.purpose]; } },

      // ---------- FOOD ----------
      { id: "foodSelect", domain: "food", type: "multi", resets: ["foodFreq", "foodWaste"],
        ask: "Food. Which of these do you eat — at home or out? Select all that apply.",
        help: "Bread, vegetables, fruit, potatoes, pasta, oils, sweets and drinks are already included for everyone, so they’re not listed.",
        options: foodIds.map(function (k) { return [FG[k].label, k]; }),
        noneLabel: "None of these",
        apply: function (p, list) {
          p.food.selected = list;
          var portions = {};
          list.forEach(function (k) { portions[k] = p.food.portions[k] || "weekly"; });
          p.food.portions = portions;
        },
        summary: function (p) { return p.food.selected.length ? "Eats: " + p.food.selected.map(function (k) { return FG[k].label.toLowerCase(); }).join(", ") : "None of the listed foods"; } },

      { id: "foodFreq", domain: "food", type: "freqGrid",
        skip: function (p) { return !p.food.selected.length; },
        ask: "Roughly how often do you have each?",
        help: "One portion = a normal serving: a piece of meat ≈ 125–150 g, a slice of cheese ≈ 40 g, a glass of milk ≈ 200 ml, one cup of coffee.",
        rows: function (p) { return p.food.selected.map(function (k) { return { id: k, label: FG[k].label, hint: FG[k].portionG + " g portion", value: p.food.portions[k] || "weekly" }; }); },
        options: freqOptions,
        apply: function (p, values) { Object.keys(values).forEach(function (k) { p.food.portions[k] = values[k]; }); },
        summary: function (p) { return p.food.selected.map(function (k) { return FG[k].label + ": " + freqLabel[p.food.portions[k]].toLowerCase(); }).join(" · "); } },

      { id: "airFreight", domain: "food", type: "freqGrid",
        ask: "Fresh food that came by plane. How often do you buy these?",
        help: "These fly all year round — that’s the point of flying them — so just count how often they land in your basket. Air freight is 10–25× the CO₂ of the same food by ship or truck. How to tell: look at the country of origin (it must be on the label for fresh fruit & veg) and ask whether that food could survive 2–4 weeks on a ship. Berries, asparagus, beans, fresh figs, papaya and passion fruit from overseas are flown; bananas, citrus, apples, grapes, avocados, pineapple, melons, dates and nuts travel by ship or truck. Dry goods — nuts, coffee, rice, snacks — are never flown, and they are already in your food base. Inside Europe everything comes by truck, including Spanish tomatoes in winter. Some shops label air freight (“Flugware”, “by air”), and anything cheap and in season locally is not flown.",
        rows: function (p) {
          return Object.keys(F.airFreight.items).map(function (k) {
            var it = F.airFreight.items[k];
            return { id: k, label: it.label, hint: it.hint, value: (p.food.airFreight || {})[k] || null };
          });
        },
        options: [["Never", "never"], ["A few times a year", "rare"], ["About monthly", "monthly"], ["About weekly", "weekly"], ["Several times a week", "often"]],
        apply: function (p, values) { p.food.airFreight = values; },
        summary: function (p) {
          var w = p.food.airFreight || {}, names = { berries: "berries", vegetables: "overseas veg", exotic: "exotic fruit" };
          var parts = Object.keys(w).filter(function (k) { return w[k] && w[k] !== "never"; })
            .map(function (k) { return names[k] + " " + { rare: "a few times a year", monthly: "monthly", weekly: "weekly", often: "several times a week" }[w[k]]; });
          return parts.length ? "Flown-in food: " + parts.join(", ") : "No air-freighted food";
        } },

      { id: "foodWaste", domain: "food", type: "freqGrid",
        ask: "How often does each of these end up in the bin at your place?",
        help: "Food that is bought but not eaten still causes all its emissions. Throwing away meat or cheese costs much more than throwing away bread.",
        rows: function (p) {
          var r = [["bread", "Bread & baked goods"], ["fruitVeg", "Fruit & vegetables"]];
          var sel = p.food.selected;
          if (sel.some(function (k) { return FG[k].group === "dairy"; })) r.push(["dairy", "Dairy & eggs"]);
          if (sel.some(function (k) { return FG[k].group === "meat"; })) r.push(["meatFish", "Meat & fish"]);
          r.push(["leftovers", "Cooked leftovers"]);
          return r.map(function (x) { return { id: x[0], label: x[1], hint: "", value: p.food.waste[x[0]] || null }; });
        },
        options: [["Rarely", "rarely"], ["A few times a month", "sometimes"], ["Every week", "often"]],
        apply: function (p, values) { p.food.waste = values; },
        summary: function (p) {
          var names = { bread: "bread", fruitVeg: "fruit & veg", dairy: "dairy", meatFish: "meat & fish", leftovers: "leftovers" };
          var w = p.food.waste, parts = Object.keys(w).filter(function (k) { return w[k] !== "rarely"; })
            .map(function (k) { return names[k] + " " + (w[k] === "often" ? "weekly" : "monthly"); });
          return parts.length ? "Thrown away: " + parts.join(", ") : "Hardly any food waste";
        } },

      // ---------- GOODS ----------
      { id: "goodsSpend", domain: "goods", type: "form",
        ask: "Stuff you buy. Roughly how much do you personally spend on each, and is it mostly new or second-hand?",
        help: "Choose the period that fits: if you buy clothes once a year in one big shop, enter that as “per year”. Leave a field empty for nothing.",
        rows: [
          { id: "clothes", label: "Clothes & shoes", unit: "€", periods: eurPeriods, defaultPeriod: 1, extra: SH },
          { id: "electronics", label: "Phones, computers, TV, appliances", unit: "€", periods: eurPeriods, defaultPeriod: 2, extra: SH },
          { id: "furniture", label: "Furniture & household items", unit: "€", periods: eurPeriods, defaultPeriod: 2, extra: SH },
          { id: "other", label: "Hobby, sports gear, toys & other", unit: "€", periods: eurPeriods, defaultPeriod: 1, extra: SH }
        ],
        apply: function (p, v) {
          ["clothes", "electronics", "furniture", "other"].forEach(function (k) { p.goods[k] = v[k] || 0; p.goods.secondHand[k] = v[k + "__extra"] || "new"; });
        },
        summary: function (p) {
          var sh = p.goods.secondHand, used = ["clothes", "electronics", "furniture", "other"].filter(function (k) { return p.goods[k] && sh[k] !== "new"; }).length;
          return "Goods: €" + fmt(p.goods.clothes + p.goods.electronics + p.goods.furniture + p.goods.other) + " / year" + (used ? " · partly second-hand" : "");
        } },

      // ---------- SERVICES & LEISURE ----------
      { id: "leisureSpend", domain: "services", type: "form",
        ask: "Going out and free time. How much do you spend on these?",
        rows: [
          // Per week by default: people know what they spend on eating out in a week far better
          // than in a month, because it follows a weekly rhythm rather than a bill.
          { id: "eatingOut", label: "Restaurants, cafés & takeaway", unit: "€", periods: eurPeriods, defaultPeriod: 0 },
          { id: "hotels", label: "Hotels & holiday stays", unit: "€", periods: eurPeriods, defaultPeriod: 2 },
          { id: "leisure", label: "Events, gym, sports club, culture, courses", unit: "€", periods: eurPeriods, defaultPeriod: 1 }
        ],
        apply: function (p, v) { ["eatingOut", "hotels", "leisure"].forEach(function (k) { p.services[k] = v[k] || 0; }); },
        summary: function (p) { return "Going out & leisure: €" + fmt(p.services.eatingOut + p.services.hotels + p.services.leisure) + " / year"; } },

      { id: "digital", domain: "services", type: "form",
        ask: "Digital life: streaming and AI.",
        help: "These get a lot of attention — let’s see what they really add up to. An hour of video streaming is about 55 g CO₂e; a text prompt to an AI assistant about 0.3 g.",
        rows: [
          { id: "streamingHoursDay", label: "Video streaming (Netflix, YouTube…)", unit: "hours", periods: [["per day", "day"], ["per week", "week"]], defaultPeriod: 0, per: "day" },
          { id: "aiPromptsDay", label: "AI chat prompts (ChatGPT, Claude…)", unit: "prompts", periods: [["per day", "day"], ["per week", "week"]], defaultPeriod: 0, per: "day" },
          { id: "aiImagesMonth", label: "AI-generated images", unit: "images", periods: [["per week", "week"], ["per month", "month"]], defaultPeriod: 1, per: "month" },
          { id: "aiVideosMonth", label: "AI-generated videos", unit: "videos", periods: [["per week", "week"], ["per month", "month"]], defaultPeriod: 1, per: "month" }
        ],
        apply: function (p, v) { Object.keys(p.digital).forEach(function (k) { p.digital[k] = v[k] || 0; }); },
        summary: function (p) { var d = p.digital; return "Streaming " + (+d.streamingHoursDay.toFixed(1)) + " h/day · AI " + Math.round(d.aiPromptsDay) + " prompts/day"; } },

      // ---------- INSURANCE & MONEY ----------
      { id: "bankType", domain: "money", type: "choice",
        ask: "Your money. Which describes your bank account best?",
        help: "Not part of your tonnes: what a bank finances is other people’s consumption, and there is no reliable per-bank data for Austria. It is shown separately because switching can matter more than most lifestyle changes.",
        options: [["Ethical / sustainability bank", "ethical"], ["Normal bank, sustainable account or products", "greenProduct"], ["Normal bank account", "conventional"], ["Don’t know", "unknown"]],
        apply: function (p, v) { p.money.bankType = v; },
        summary: function (p) { return { ethical: "Ethical bank", greenProduct: "Sustainable products at a normal bank", conventional: "Conventional account", unknown: "Bank type unknown" }[p.money.bankType]; } },

      { id: "savings", domain: "money", type: "choice",
        ask: "Do you have savings, funds or a private pension? If so, how are they invested?",
        help: "In Austria, sustainable financial products can carry the Umweltzeichen UZ 49, which excludes coal and oil companies, among others.",
        options: [["No savings/investments", "none"], ["Labelled sustainable (e.g. Umweltzeichen UZ 49)", "labelled"], ["Normal funds / pension", "conventional"], ["Don’t know", "unknown"]],
        apply: function (p, v) { p.money.savings = v; if (v === "none") p.money.amount = 0; },
        summary: function (p) { return { none: "No investments", labelled: "Sustainable-labelled investments", conventional: "Conventional investments", unknown: "Investments: unknown" }[p.money.savings]; } },

      // Optional, and explicitly NOT in the tonnes. It exists so the app can show a real number
      // for the emissions your money finances, next to the footprint rather than inside it.
      { id: "savingsAmount", domain: "money", type: "amount", min: 0, max: 100000000, optional: true,
        skip: function (p) { return p.money.savings === "none"; },
        ask: "Roughly how much do you have in savings, funds or a pension altogether?",
        help: "Optional, and it does not change your tonnes. It lets the app put a number on the emissions your money finances — which is a different kind of number, shown on its own.",
        units: [["€ in total", 1, "eur"]],
        apply: function (p, a) { p.money.amount = a.v || 0; },
        summary: function (p) { return p.money.amount ? "Invested: €" + fmt(p.money.amount) + " (not in the tonnes)" : "Investment amount not given"; } },

      // ---------- COMPENSATION ----------
      { id: "offsetsAny", domain: "offsets", type: "choice", resets: ["offsetsTypes", "offsetsAmounts", "offsetsCert"],
        ask: "Last part: do you pay for carbon credits or climate projects?",
        help: "Whatever you buy is shown separately and never subtracted from your footprint — the climate goals assume real reductions.",
        options: [["No", false], ["Yes", true]],
        apply: function (p, v) { p.offsets.any = v; if (!v) { p.offsets.types = []; offsetIds.forEach(function (k) { p.offsets[k] = 0; }); p.offsets.contributionEur = 0; } },
        summary: function (p) { return p.offsets.any ? "Buys compensation" : "No compensation"; } },

      { id: "offsetsTypes", domain: "offsets", type: "multi", resets: ["offsetsAmounts"],
        skip: function (p) { return !p.offsets.any; },
        ask: "What kind? Select all that apply.",
        help: "If you’re not sure, the provider’s certificate or website usually names the project type.",
        options: offsetIds.map(function (k) { return [F.offsetTypes[k].label + " — " + F.offsetTypes[k].examples, k]; })
          .concat([["Climate contribution without an offset claim (donation to climate projects)", "contribution"]]),
        apply: function (p, list) { p.offsets.types = list; },
        summary: function (p) { return "Types: " + (p.offsets.types.length ? p.offsets.types.map(function (k) { return k === "contribution" ? "contribution" : F.offsetTypes[k].label.toLowerCase(); }).join(", ") : "none selected"); } },

      { id: "offsetsAmounts", domain: "offsets", type: "form",
        skip: function (p) { return !p.offsets.any || !p.offsets.types.length; },
        ask: "How much per year?",
        rows: function (p) {
          return p.offsets.types.map(function (k) {
            return k === "contribution"
              ? { id: "contributionEur", label: "Climate contribution", unit: "€", periods: [["per year", "year"], ["per month", "month"]], defaultPeriod: 0 }
              : { id: k, label: F.offsetTypes[k].label, unit: "t CO₂e", periods: [["per year", "year"]], defaultPeriod: 0 };
          });
        },
        apply: function (p, v) { offsetIds.concat(["contributionEur"]).forEach(function (k) { p.offsets[k] = v[k] || 0; }); },
        summary: function (p) {
          var t = offsetIds.reduce(function (s, k) { return s + (p.offsets[k] || 0); }, 0);
          return (t ? t + " t/year credits" : "No tonnes") + (p.offsets.contributionEur ? " · €" + fmt(p.offsets.contributionEur) + " contribution" : "");
        } },

      { id: "offsetsCert", domain: "offsets", type: "choice",
        skip: function (p) { return !p.offsets.any; },
        ask: "Is it certified?",
        help: "Look for the standard’s name on your certificate or on the provider’s project page.",
        options: [["Gold Standard", "gold"], ["Verra (VCS)", "verra"], ["Puro.earth / Isometric (removals)", "removalStandard"], ["ICVCM ‘CCP’ label", "ccp"], ["Other / don’t know", "unknown"]],
        apply: function (p, v) { p.offsets.certification = v; },
        summary: function (p) { return "Certification: " + { gold: "Gold Standard", verra: "Verra", removalStandard: "Puro.earth / Isometric", ccp: "ICVCM CCP", unknown: "unknown" }[p.offsets.certification]; } }
    ];

    steps.forEach(function (st) {
      var m = META[st.id] || ["", "medium", ""];
      st.section = m[0];
      st.weight = m[1];
      st.keyword = m[2];
    });

    return { blankProfile: blankProfile, steps: steps, toYear: toYear, WEIGHT: WEIGHT };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.questions = defineQuestions(G.factors);
  G.sources["js/questions.js"] = defineQuestions.toString();
})(typeof window !== "undefined" ? window : globalThis);
