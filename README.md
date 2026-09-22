# Green App – Carbon Footprint (local prototype)

## Open it
Double-click `index.html`. That's it: no install, no server, no internet needed. The font loads from Google Fonts when you're online and falls back to the system font otherwise.

## How it's built
| File | What it does |
|---|---|
| `data/factors.js` | Every emission factor, with its uncertainty and source. **Update these numbers yearly.** |
| `data/benchmarks.js` | Austria / world averages, Austria's final-demand split and the excluded share, the 1.5 °C target, domain colours |
| `data/docs.js` | The method in prose, with every source. Shown in the app and used to generate `METHOD.md` |
| `js/engine.js` | The maths: central result, Monte Carlo uncertainty range, biggest-uncertainty finder |
| `js/questions.js` | The guided chat script (questions → profile) |
| `js/chart.js` | Four pictures, all plain SVG or CSS: the comparison chart, the what's-left bar (Potential), the excluded-share bar and the compensation ladder (Details) |
| `js/sankey.js` | The four-column Sankey, drawn on both the Details and Potential tabs (plain SVG) |
| `js/app.js` | UI only: chat, answer list, the four tabs, the analysis panel, save/load and the code viewer |
| `tests/engine.test.js` | Hand-calculated test cases (59) |
| `tests/audit.js` | Independent audit: 3,000 random profiles, ~186,000 property checks in 11 sections |
| `tools/make-method.js` | Regenerates `METHOD.md` from `data/docs.js` |
| `METHOD.md` | The full method and sources — **start here if you want to check the numbers** |
| `LIMITATIONS.md` | What is still wrong: systemic biases, open issues, and the things that look like bugs but are deliberate |

The app has no AI. The chat fills a fixed profile object, and `engine.js` calculates from it, so the same answers always give the same result. A future AI chat would only need to fill the same profile.

## Saving results
Everything to do with saving lives behind one button — **Save & load** in the header, also reachable from the results — rather than a card sitting in the middle of the results page.

- **Save in this browser** keeps a named snapshot with the change since the previous one, for comparing before/after or year to year.
- **Download as a file** writes a `.json` with all answers and the result; **Open saved file** reads it back, on any computer. The result is recalculated with the current emission factors, and the app says so if the number moved since it was saved.
- **Print / PDF** switches to the results and prints only those. Choose "Save as PDF" in the print dialog.
- Saving, downloading and printing need a finished result and are disabled until then; opening a file works from the very first screen, which is the point — you can arrive with a file and no answers.

## The Potential tab
- `engine.sources()` returns every single source (space heating, hot water, electricity, car, train, each food group, each spending category, streaming & AI…). A test checks these add up to exactly the same numbers as `engine.calculate()`.
- **Hover follows the whole path** left to right — cause → activity → area → total — not just the shapes that touch; every element carries the row numbers it belongs to. **Click holds a path open** and fills an insights panel below the diagram: where the emission physically happens, what is inside a merged row, everyday anchors for the size, how the area compares with the Austrian average, and which of the changes you have *not* ticked would shrink that particular thing.
- `js/sankey.js` draws four columns, left to right: **what causes it** (natural gas, petrol, the Austrian electricity mix, jet fuel & contrails, farming, factories, service supply chains) → **what you do** (space heating, car fuel, building the car, each flight length, each food group…) → **area** → **your whole footprint**. **Every band's height is exactly its tonnes × one scale** — the same scale for the smallest row and for the trunk — and no column has gaps, so the picture is the arithmetic. Nothing has a minimum height: an earlier version padded thin rows so their labels would fit, which made small things look bigger than they were. Labels are what get dropped instead (below ~13 px a band carries none), and thin bands get an invisible strip so they can still be pointed at. Only the cause → activity layer crosses, which is the point: one electricity mix feeds your home, the train and your streaming.
- The cause column is bracketed by **where the emission happens**: fuel you burn yourself · power stations · farms, factories and supply chains, which are largely abroad. Consumption-based accounting counts all three wherever they happen, which is why "car: fuel" (burned here) and "car: building it" (a factory somewhere else) are two separate rows.
- The diagram is drawn **bottom-up**: the stacks grow upwards, so the 1.5 °C budget line and the ghost of what you remove both sit on top — anything above the line is over budget.
- Ticking a change keeps the **layout frozen on today's footprint**: rows keep their slot, the scenario is drawn inside it, and what the change removes stays as a dashed ghost — so the height never jumps and before/after can be compared directly. Rows a lever could add (e.g. train instead of flights) are reserved in the layout in advance.
- Small items are merged per area *and cause*, and the merged row is named after what is in it ("Cheese, pork & 3 more"), never "other".
- Scope 1/2/3 is deliberately not used: those are defined for organisations, and for a person almost everything (food, goods, services, flights) lands in scope 3. The cause column carries the same information in words people recognise. For food, goods and services the factors are aggregate life-cycle numbers, so the cause is named coarsely ("farming: methane, fertiliser, land") rather than invented in detail, with the 1.5 °C budget as a dashed line. Hovering highlights one path and shows its share. Ticking a change redraws it.
- **"Reach the 1.5 °C goal"** (`engine.pathToTarget`) ticks the biggest changes one by one until you are under the budget, and says so honestly if even all of them don't get there.
- **The 1.5 °C goal is reachable for everyone.** ~29 levers, split into ordinary changes and a separate group marked *“a big change, but yours”* (a no-buy year, a quarter less living space, travelling shorter distances, bringing your spending down to the Austrian average). “Reach the 1.5 °C goal” works through the ordinary ones first and only reaches for the drastic ones when it has to. `tests/audit.js` checks this holds for all 3,000 random profiles and for a deliberately absurd one (82 t → 2.0 t).

## Test the maths
```
node tests/engine.test.js   # 59 hand-calculated assertions
node tests/audit.js         # 3,000 random profiles, ~186,000 property checks
node tools/make-method.js   # regenerate METHOD.md after editing data/docs.js
```
You need Node.js for this (https://nodejs.org). The app itself doesn't.

`engine.test.js` checks single cases worked out on paper, with the arithmetic in the comments.
`audit.js` checks the properties that must hold for *every* profile: that the Sankey's four
columns reconcile with `calculate()` to within 10⁻⁹ t, that every lever's claimed saving survives
a recalculation from scratch, that ticking changes in a different order gives the same total,
that the uncertainty range brackets the central value, and that a shared factor keeps one value
within a simulation sample. It found four real bugs — see “What the audit found”.

## The four tabs
1. **Measure** — the guided chat plus your answer list (newest on top, tap to change, ← to go back).
2. **Results** — your footprint, the comparison chart with its uncertainty bracket, and the table by area.
3. **Details** — the Sankey of where your emissions come from, with an analysis panel: click any band to hold it open and see where it physically happens, what is inside it, how it compares with the Austrian average, and which changes would shrink it. Each of those lists ends with a button that opens the Potential tab already narrowed to the same selection. Also on this tab: compensation drawn as the Oxford ladder, what your money finances, and what the bars leave out.
4. **Potential** — tick the changes you could make. A bar whose full width is your footprint today shows what is left and what you removed; the Sankey redraws; savings overlap, so ticking several is recalculated together, never added up.

## Method in short
- **Flights are counted one-way.** Each leg is asked separately, so a trip out by plane and back by train counts as one flight. The "skip a trip" lever removes 2 legs.
- **Scope:** lifestyle footprint, meaning consumption-based CO₂e from household consumption only. The other 32% of what an Austrian causes — investment and construction 21%, public services 8%, international shipping 3% — is left out of every bar, which is how the 1.5 °C lifestyle targets are defined too. The Details tab draws where it goes rather than asserting it, and marks the parts no measurement reaches.
- **Uncertainty:** each input and factor gets a log-normal distribution. 4,000 samples with a fixed seed give the 10th–90th percentile range. There's an extra ±10% for model simplification.
- **Measured or estimated heating:** if you know your yearly gas/oil/pellets/wood/district-heat/heat-pump use from the bill, the app uses it (unit conversions in `factors.energyUnits`, 80% space heating / 20% hot water). Otherwise it estimates from floor area × building standard.
- **Who decides:** home type (house/flat) and tenure (own/rent) decide whether heating and insulation are in your hands, need the co-owners, or need the landlord.
- **Levers:** each one is named as something you *do*, carries the concrete alternative that replaces it, and explains the mechanism with the number. Overlapping ones (a year without flying contains the night-train swap) are kept rather than hidden: once you tick something, the rest show what they'd add on top, and anything already covered is marked and struck through. `engine.levers()` copies your profile, changes one thing, and recalculates — no lever has a stored “typical saving”. Housing: green tariff, 1 °C lower, a third less electricity, less hot water, solar on your own roof, heat pump, insulation, a quarter less space. Travel: drive less, EV, car-free, skip a flight, train instead of short flights, stop flying, shorter distances overall. Food: beef swap, vegetarian, plant-based, less dairy, less waste, no air freight, no drinks/sweets/ready meals. Stuff: second-hand, half as much, a no-buy year, down to the Austrian average. Going out: a third less, half as much, down to the Austrian average. Digital: less streaming, no AI video. Each is tagged by who decides: in your hands / a big change but yours / co-owners / landlord / when you replace it / hard for you, based on the ownership, electricity-contract, car-dependence and flight-purpose answers.
- **Per-area goal:** the 2030 target of 2.5 t applies to the total; the per-area values scale Austria's split down to it and are only a guide. 2.5 t is a *globally unified* target — the remaining budget divided equally among everyone alive — not an Austrian one.
- **Time instead of distance:** trains, buses, trams and the metro are asked in time and converted with average speeds: train 80 km/h, city transit 18 km/h, car 40 km/h if given in hours.
- **Periods:** any amount can be entered per day, workday, week, month or year, and is converted to a yearly value.
- **Food:** you pick what you eat and how often. Each item is portions × portion size × a per-kg footprint (ifeu 2020, including land-use change), plus a plant-based base of 380 kg for bread, vegetables, oils, drinks and so on.
  - Food waste is asked per category and per frequency, with nothing preselected: rarely 2%, a few times a month 8%, every week 20% of what's bought; cooked leftovers add 0 / 3 / 8% of all food.
  - Air freight is asked for three product groups (berries, overseas veg, delicate exotic fruit), each with a frequency: purchases per year × pack size × 8 kg CO₂e/kg extra. Only those actually fly; bananas, citrus, apples, avocados, dates, nuts and other dry goods travel by ship or truck.
  - Cold storage adds little: local apples are 0.3 kg CO₂e/kg fresh and 0.4 after storage until April, vs. 0.8 from New Zealand.
  - Winter tomatoes from Spain vs. heated Austrian greenhouses do differ (≈0.4 vs 1.1–1.4 kg CO₂/kg, Theurl et al.), but at typical amounts that's only 5–15 kg a year, so it isn't asked.
  - Organic food isn't adjusted, because ifeu finds no clear per-kg advantage.
- **Digital:** streaming at 55 g per hour, text AI prompts at 0.3 g, images at 1 g, videos at 350 g — usage only. Devices are in **Goods**, not here: making a smartphone is ~60 kg and a laptop ~150–300 kg, about 80% of their lifetime footprint. The results page shows both halves, because the digital line alone is routinely misread as “digital is nothing”. Together they come to ~2–3% of a footprint, which matches the 1.5–4% the ITU and World Bank find for the whole ICT sector.
- **Eating out** is charged at 0.15 kg/€ — the *venue's* share (kitchen, premises, staff, waste), not the meal. The food questions ask what you eat “at home or out”, so the meal is already counted there; a full food-service intensity would count the same steak twice.
- **Money** is shown as a range in tonnes, *beside* the footprint and never inside it. €10,000 invested finances somewhere between 0.8 t (ECB 2025, euro-area bank securities portfolios) and 5.4 t (Make My Money Matter 2021) a year — the same money, a factor of six apart, depending on method. It stays out of the bar because it is attributed rather than consumed (the companies you part-own are already counted in the footprint of whoever buys what they make) and because a six-fold spread has no business inside a bar claiming ±20%. Bank and insurance names are not asked, because nothing could be done with them.
- **Insurance and banking are not in the footprint.** Running those companies is roughly 0.1 t per person and nearly the same for everyone, a premium mostly moves money around (claims, reserves) rather than buying goods, and the spending-based factor was the weakest number in the model.
- **Every question is labelled** with its section and how much the answer moves the result: big effect (look it up), medium (a good estimate is enough), small (a guess is fine), or not in the number (used for advice and context only). The labels live in `META` in `questions.js`.
- **No per-area goal.** The 1.5 °C goal applies to the whole footprint; splitting 2.5 t across housing, food and travel would pretend to know how each person should live. The by-area table shows your value with its range, the Austrian average and the difference in percent, and the goal appears once for the total.
- **Compensation** is recorded by type (Oxford Offsetting Principles: avoidance, forest protection, nature-based removal, biochar, durable removal, plus contribution claims) and never subtracted.

## Chart colours
The six area colours are checked with the dataviz palette validator against the cream surface (lightness band, chroma floor, normal-vision separation). Two warnings remain: blue↔violet under deutan CVD, and the amber's contrast against the background. The comparison bars have no separator lines and no outline — the segments touch — so the legend and the by-area table (which repeats every value in text) are what carry the distinction for anyone who can't separate those two hues. The Sankey does the same job with labels next to every band.

## What the audit found
`tests/audit.js` was written after the app was finished, to attack it rather than confirm it.

- **Fixed — restaurant food was counted twice.** Eating out went from 0.35 to 0.15 kg/€.
- **Fixed — shared factors were drawn independently.** In the Monte Carlo, the electricity factor was drawn afresh at each use, so several uses averaged each other out and the range came out too narrow. Each quantity is now drawn once per run and reused.
- **Fixed — the goal was out of reach for heavy profiles.** An extreme profile bottomed out at 5.0 t with *everything* ticked, because whole areas had weak levers or none: services could only be cut by a third, goods by half, and electricity, hot water, living space, the food base and digital use had no lever at all. Eleven levers were added; insulation was also un-hidden for wood and pellet heating, where it turned out to be the biggest remaining item in a large house.
- **Fixed — levers were order-dependent.** “Stop flying” and “train instead of short flights” both wrote the replacement train kilometres, one adding and one overwriting, so the total depended on click order. Same for the meals that replace meat. Every lever now writes a target state, not a change.
- **Not a bug — savings larger than the sum of their parts.** Green tariff + heat pump saves *more* together than separately, because clean electricity makes the new system cleaner. The wording said “they overlap” in both directions; it now says which is happening.
- **Confirmed unchanged:** the Sankey reconciles exactly with the calculation on all 3,000 test profiles, every lever survives independent recalculation, nothing produces a negative, infinite or missing value.

## What's missing
See `METHOD.md` → *What is missing* for the full list. The largest gaps: the embodied emissions of the building itself (~0.3–0.8 t/person/yr), the carbon debt of a new heat pump or battery (the levers show the steady-state saving, not the 1–3 year payback), household waste treatment (~0.1–0.2 t), pets (a medium dog ≈ 0.3–0.6 t), second homes, cruises and ferries, and rebound effects (money saved gets spent on something — every lever is an upper bound). Together with the deliberate exclusions, a real lifestyle footprint is probably somewhat higher than what the app reports.

## Numbers that need checking before any public release
- The Austria benchmark of 7.4 t is a derived estimate: about 100 Mt consumption-based ÷ population × the 68% household share measured for Austria by Steininger et al. (2018). Earlier versions used a global 72% rule of thumb. The split by area is still illustrative, rescaled with the total.
- The world benchmark of 5.1 t is derived the same way.
- The 2030 target of 2.5 t comes from Hot or Cool Institute (2021, Figure C: globally unified lifestyle targets), carried by the 2025 update. It excludes public spending and investment — the same scope as every bar here, which is what makes the comparison fair.
- The spending intensities for goods and services (kg per €) are rough orders of magnitude. The best upgrade would be Austrian EXIOBASE values.
- Short- and medium-haul flight factors are approximations of DESNZ 2025.
- The plant base (380 kg), out-of-season amounts, waste rates and average speeds are estimates.
