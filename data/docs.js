/*
 * The method, in words — the single source of truth for the documentation.
 *
 * This file is DATA, not calculation. It is shown in the app under
 * "</> View the code" → "Method", and the same text is written to METHOD.md by
 * `node tools/make-method.js`, so the document and the app can never drift apart.
 *
 * Each section has:
 *   title   – the heading
 *   body    – paragraphs of plain prose
 *   formula – the arithmetic, written the way the code does it (optional)
 *   code    – where in the code it happens (optional)
 *   check   – how a reader can verify the section for themselves (optional)
 *   sources – what the numbers come from (optional)
 */
(function (root) {
  function defineDocs() {
    return {
      version: "2026-09-v1",
      intro: [
        "This calculator has no AI in it and sends nothing anywhere. The chat fills a fixed profile object, and one function — engine.calculate(profile) — turns that profile into tonnes of CO₂e. The same answers always give the same number, which is what makes it checkable.",
        "Everything below describes exactly what the code does, with the source of every number. If a section and the code disagree, the code is what runs — please report it."
      ],

      sections: [
        {
          id: "scope",
          title: "What is being counted (and what is not)",
          body: [
            "This is a consumption-based lifestyle footprint: the greenhouse gases caused by what one person buys and uses in a year, wherever in the world those gases are released. A T-shirt sewn in Bangladesh counts here, not in Bangladesh's national total. That is the opposite of a territorial inventory, which is what countries report under the Paris Agreement.",
            "The scope is household consumption only: what you buy. About 3.5 tonnes per person in Austria are caused on your behalf by someone else and are deliberately left out of every bar, because the 1.5 °C lifestyle target is defined the same way — the exclusion is in the numerator AND the denominator, which is what keeps the comparison fair. The Results tab draws where those 3.5 t actually go instead of asserting it, because the common assumption is wrong: two thirds of it is investment — new buildings, roads, railways, machinery, vehicles — and only about a quarter is public services. International shipping and aviation are the small remainder.",
            "Who did the buying is measured for Austria rather than assumed: households 68%, investment 21%, government 8%, global transport 3% (Steininger et al. 2018). The app previously used a global 72/28 rule of thumb, which is a world average applied to one country; the Austrian split moves the national average from 7.9 to 7.4 t.",
            "Inside the public 8%, health and social care is 49% — the one functional number that exists for Austria. It is left as its own block because it carries a point worth making: Eurostat classes health and education as INDIVIDUAL consumption and prefers Actual Individual Consumption to household spending when comparing countries, precisely because a country that provides care publicly moves those emissions out of its citizens' personal footprints, while a country that does not leaves them in. A low household footprint can therefore mean a strong public system rather than a lighter life. The remaining 51% of public services is drawn as one unbroken block: no measurement of Austrian public emissions by function exists that this app could cite, and splitting it by departmental spending would assume a kilometre of motorway and an hour of school carry the same carbon per euro. The gap in the picture is the gap in the data.",
            "The embodied carbon of buildings sits in that investment block, not in your housing figure — housing counts the energy you use, not the concrete you live in. Renovation and furniture you buy yourself are already counted, under Housing and Goods.",
            "All greenhouse gases are included, expressed as CO₂e using 100-year global warming potentials: methane from cattle and rice, nitrous oxide from fertiliser, refrigerants, and for flights the non-CO₂ warming effects.",
            "The unit everywhere is tonnes of CO₂e per person per year. Household quantities (heating, electricity, a shared car) are divided by the number of people who share them."
          ],
          sources: [
            "Hot or Cool Institute (2021 and 2025 update) — 1.5 °C-aligned lifestyle footprint targets; household consumption scope, explicitly excluding public spending and investment.",
            "Steininger et al. (2018), ‘Austria’s consumption-based greenhouse gas emissions: Identifying sectoral sources and destinations’, Global Environmental Change — GTAP, 2011, 123.6 Mt: households 68%, investments 21%, government 8%, global transport 3%; health and social work 49% of public-sector emissions.",
            "Eurostat, Actual Individual Consumption — household purchases plus government services for individual consumption (health and education), preferred over household consumption for comparing countries.",
            "Health Care Without Harm / Arup — Austrian health care 0.59 t CO₂e per person, 5.2% of national emissions (2014); Weisz et al. (2020) 6.8 Mt. Cross-check on the health block.",
            "IPCC AR6 GWP-100 values for converting gases to CO₂e."
          ]
        },

        {
          id: "map",
          title: "How to read the code",
          body: [
            "Seven files, no build step, no dependencies. Open index.html in a browser and it runs; open the files in any text editor and you have read the whole program.",
            "data/factors.js — every emission factor, each one an object with value, unc (uncertainty), unit and source. Nothing is hard-coded anywhere else. If you disagree with a number, this is the only file you need to change.",
            "data/benchmarks.js — the Austrian average, the world average, the 2030 target, and the colour of each area.",
            "data/docs.js — this text.",
            "js/engine.js — the arithmetic. calculate() for the central number, simulate() for the range, sources() for the Sankey, levers() for the Potential tab. It has no access to the DOM and does not know the app exists.",
            "js/questions.js — the 36 chat steps and how each answer is written into the profile. No arithmetic beyond unit conversion.",
            "js/chart.js, js/sankey.js — drawing, in plain SVG.",
            "js/app.js — the interface, and nothing else. Every number it shows comes from engine.js.",
            "The data flow only ever goes one way: questions.js → profile → engine.js → app.js. Nothing writes back."
          ],
          check: "Everything in the app goes through engine.calculate(). To convince yourself, open the browser console on the Results tab and run GreenApp.engine.calculate(<your profile>) — it returns the number on screen."
        },

        {
          id: "housing",
          title: "Home & energy",
          body: [
            "Two routes, depending on the answer to \"do you know how much your household uses per year?\".",
            "If you know it, the figure from the bill is converted to kWh (gas ≈ 10.5 kWh/m³, heating oil ≈ 10 kWh/l, pellets ≈ 4.8 kWh/kg, mixed firewood ≈ 1,800 kWh per stacked cubic metre), then split 80% space heating / 20% hot water. This is the accurate route and the question is marked \"big effect\" for that reason.",
            "If you don't, the app estimates: heated floor area × the typical demand of a building of that age (170 kWh/m²/yr before 1980, 120 for 1980–2000, 75 for 2000–2015, 45 after 2015, 15 for a passive house), plus 700 kWh of hot water per person.",
            "That useful heat is divided by the efficiency of the system (gas 0.90, oil 0.85, pellets 0.85, firewood 0.75, district heat 1.00, heat pump: a seasonal COP of 3.2) and multiplied by the fuel's emission factor. A heat pump or electric heating uses the electricity factor instead.",
            "Household electricity is asked separately and multiplied by the same electricity factor. If the home is heated electrically, the electricity question explicitly asks for the figure without the heating part, so nothing is counted twice.",
            "Heating and electricity are household quantities, so the total is divided by the number of people living there. That is why household size is the very first question and is marked \"big effect\"."
          ],
          formula: "((space heat × renovation factor × temperature factor + hot water) ÷ system efficiency × fuel factor + electricity kWh × electricity factor) ÷ people in the household",
          code: "engine.js → housing()",
          sources: [
            "Umweltbundesamt Österreich, Emissionsfaktoren (REP-0948, 2025): Austrian electricity mix 0.209 kg CO₂e/kWh (data year 2022), natural gas 0.249, heating oil 0.342, district heat 0.172, pellets 0.026, firewood 0.025 kg/kWh of fuel.",
            "Certified renewable tariff 0.030 kg/kWh — an estimate for the life-cycle emissions of hydro, wind and PV. This is market-based accounting and is genuinely contested: it is why that factor carries the widest uncertainty (±60%) of any in the housing section.",
            "Heat demand bands: typical ranges from Austrian energy performance certificates (OIB), simplified.",
            "Seasonal COP 3.2 for an air-to-water heat pump: typical field value.",
            "1 °C lower room temperature ≈ 6% less heating energy: rule of thumb (BUND, Verbund and others)."
          ],
          check: "80 m², built 1980–2000, gas, two people: 80 × 120 = 9,600 kWh of heat + 2 × 700 = 1,400 hot water = 11,000 ÷ 0.90 × 0.249 = 3,043 kg, ÷ 2 people = 1,522 kg. tests/engine.test.js checks exactly this."
        },

        {
          id: "transport",
          title: "Car, train, bus & tram",
          body: [
            "A car's emissions are split into two rows that appear separately in the Sankey, because they happen in different places: the fuel you burn on the road, and the factory that built the car.",
            "Fuel: litres per 100 km × the energy in a litre × the emission factor of that fuel, including the upstream emissions of producing and delivering it. Petrol is assumed at 7.0 l/100 km, diesel 6.0, a hybrid 5.0, an electric car 19 kWh/100 km including charging losses.",
            "Building the car is spread over its life as 0.035 kg CO₂e per km for a combustion car (roughly 6 tonnes over 180,000 km) and 0.055 for an electric one (roughly 10 tonnes including the battery). This is why an electric car is not zero in the app, and why \"drive less\" saves more than \"drive electric\" for many people.",
            "The whole car total is divided by how many people are usually in it. Two people sharing every trip halve it.",
            "Trains, buses, trams and the metro are asked in time, not distance, because people know how long they sit on a train and not how far it went. Time × an average door-to-door speed (train 80 km/h, city transit 18 km/h) × a per-passenger-kilometre factor. Both the speeds and the factors are estimates with ±30–50% uncertainty, which is why these questions are marked \"small effect\": even a large error here moves the total very little."
          ],
          formula: "km × (litres/100 ÷ 100 × kWh per litre × fuel factor + manufacturing per km) ÷ people in the car   +   hours × km/h × per-passenger-km factor",
          code: "engine.js → transport()",
          sources: [
            "Umweltbundesamt Österreich REP-0948 (2025): petrol 0.327, diesel 0.330 kg CO₂e per kWh of fuel, including upstream.",
            "Vehicle manufacturing: ~6 t CO₂e for a mid-size combustion car, ~10 t including the battery for an electric one, amortised over 180,000 km — an order-of-magnitude figure from published life-cycle studies.",
            "Austrian rail 0.020 kg/passenger-km (ÖBB runs largely on hydro power), city transit 0.050 — estimates, deliberately carrying ±50% uncertainty.",
            "Average speeds are estimates: a mix of regional trains (~50 km/h) and Railjet (~120 km/h); Vienna U-Bahn ~32 km/h, tram ~15 km/h."
          ]
        },

        {
          id: "flights",
          title: "Flights",
          body: [
            "Flights are counted ONE WAY, per leg. This is deliberate: people mix modes — fly out, take the train back — and a calculator that only understands return trips cannot represent that. A normal holiday return trip is two flights, and the app says so in the question.",
            "Each leg uses a typical one-way great-circle distance for its category (short 1,100 km, medium 2,800 km, long 7,500 km), multiplied by 1.08 for detours and holding patterns, then by a per-passenger-kilometre factor, then by a class multiplier (business long-haul 2.9×, because a business seat takes the floor space of roughly three economy seats).",
            "The factors include radiative forcing — the extra warming from contrails and nitrogen oxides at altitude, which roughly doubles the effect of the CO₂ alone. This choice is the single biggest reason a flight looks large here compared with calculators that count only CO₂. It is also the least settled science in the whole model, which is why the flight factors carry ±35% uncertainty."
          ],
          formula: "legs × distance × 1.08 × kg per passenger-km × class multiplier",
          code: "engine.js → flights()",
          sources: [
            "UK DESNZ/DEFRA greenhouse gas conversion factors 2025, the \"with RF\" set. Long-haul business class 0.411 kg/pkm ÷ the 2.9 class ratio gives the economy value; short and medium haul are approximated in the same style.",
            "The 1.08 distance uplift is the DESNZ method for indirect routing.",
            "Lee et al. (2021), Atmospheric Environment — the standard reference for aviation's non-CO₂ warming."
          ],
          check: "One return long-haul trip in economy: 2 × 7,500 × 1.08 × 0.142 = 2,300 kg = 2.3 t. That is already more than nine tenths of the 2.5 t budget for 2030."
        },

        {
          id: "food",
          title: "Food",
          body: [
            "You pick which foods you eat and how often; each is portions per week × 52 × portion size × a per-kilo footprint. On top of that sits a plant-based base of 380 kg CO₂e per year for everything nobody is asked about — bread, potatoes, pasta, vegetables, fruit, oils, sugar, drinks — so the model does not reward someone for simply not mentioning what they eat.",
            "Waste is asked per category, because what you throw away matters far more than how much: meat and dairy carry ten times the footprint of bread per kilo. The rate is applied to what was bought, not what was eaten (2% rarely, 8% a few times a month, 20% every week), plus a small extra for cooked leftovers.",
            "Air freight is asked as three product groups — winter berries, overseas vegetables, delicate exotic fruit — each with a number of purchases per year, because only a handful of fresh products actually fly. Bananas, citrus, apples, grapes, avocados, pineapple, dates and nuts travel by ship or truck and are not counted here. Flying adds about 8 kg CO₂e per kilo of food, which is 10–25× what the food itself cost to grow.",
            "Two things are deliberately NOT adjusted for. Organic: ifeu finds no clear per-kilo advantage, because lower inputs are offset by lower yields. Local and seasonal: cold-stored Austrian apples in April (0.4 kg/kg) are still better than New Zealand apples (0.8), and the winter-tomato question (Spanish field 0.4 vs. heated Austrian greenhouse 1.1–1.4) is real but worth only 5–15 kg a year at typical amounts — not worth a question."
          ],
          formula: "Σ (portions per week × 52 × portion kg × kg CO₂e per kg) + 380 kg base + waste + air freight",
          code: "engine.js → food()",
          sources: [
            "ifeu (2020), Ökologische Fußabdrücke von Lebensmitteln und Gerichten in Deutschland, for the German Umweltbundesamt. Boundary: to the supermarket checkout, including land-use change. Beef & lamb 13.6, butter 7.0, cheese 5.7, chicken 5.5, pork 4.6, chocolate 4.1, eggs 3.0, fish 3.0, rice 3.1, coffee 5.6, milk 1.5, tofu & pulses 1.1, oat drink 0.35 kg CO₂e per kg.",
            "Air freight: ifeu gives strawberries in season 0.3 vs. air-freighted 3.4 kg CO₂e/kg; pineapple by air 15.1 vs. by ship 0.6.",
            "Seasonal storage and greenhouse comparisons: Theurl et al., tomato production systems.",
            "The 380 kg base, the pack sizes, the purchase counts and the waste rates are our own estimates built from the ifeu per-kilo values and typical Austrian consumption amounts. They are the weakest numbers in this section."
          ],
          check: "Beef once or twice a week: 1.5 × 52 × 0.15 kg × 13.6 = 159 kg a year. Swapping all of it for tofu at the same frequency: 1.5 × 52 × 0.125 × 1.1 = 11 kg. The difference, 148 kg, is what the \"swap beef\" lever shows."
        },

        {
          id: "goods",
          title: "Stuff you buy",
          body: [
            "Goods are the one area where the model works from money rather than physical quantities, because nobody knows the weight of what they bought. Euros spent per year × an intensity in kg CO₂e per euro: 0.30 for clothes, electronics and furniture, 0.25 for hobby and other goods.",
            "Second-hand is applied per category, as a multiplier: mostly new 1.0, mixed 0.85, mostly used 0.60. It is not zero, because a used item still has to be transported, refurbished and sold, and because buying used only avoids production if it actually displaces a new purchase.",
            "These intensities are the roughest numbers in the whole calculator — an order of magnitude from European input-output data, not an Austrian figure. They carry ±45–50% uncertainty and the honest upgrade would be Austrian EXIOBASE values. Spending answers are also systematically unreliable: people under-report by a lot.",
            "One thing worth knowing: your phones, laptops and TVs are in HERE, not in the digital section. See \"Is digital really that small?\"."
          ],
          formula: "Σ euros per year × kg CO₂e per euro × second-hand factor",
          code: "engine.js → goods()",
          sources: [
            "Order of magnitude from EU multi-regional input-output data (EXIOBASE) for consumer goods, simplified."
          ]
        },

        {
          id: "services",
          title: "Going out, leisure & digital",
          body: [
            "Hotels (0.25 kg/€) and events, gym, culture and courses (0.12 kg/€) work the same way as goods.",
            "Eating out is different and was corrected during the audit. It is charged at 0.15 kg per euro, which is the restaurant's OWN share — kitchen energy, premises, dishwashing, staff, kitchen waste — and not the food. The food questions ask what you eat \"at home or out\", so the meal itself is already counted there. A full food-service intensity of 0.4–0.5 kg/€ would charge the same steak twice.",
            "Digital is usage only: streaming at 55 g CO₂e per hour, an AI text prompt at 0.3 g, a generated image at 1 g, a generated short video at 350 g. The app also shows this on its own line under the results, because people ask about it."
          ],
          code: "engine.js → services(), digital()",
          sources: [
            "Carbon Trust (2021), Carbon impact of video streaming: ~55 g CO₂e per hour in Europe, including the viewing device. This replaced much larger earlier estimates that turned out to be wrong by an order of magnitude.",
            "AI: Google (2025) reports a median Gemini text prompt at 0.24 Wh and 0.03 g CO₂e; independent estimates for ChatGPT-class models sit at 0.1–0.3 g (Hannah Ritchie, 2025). Images ~0.3–1.2 Wh. A generated five-second video is roughly 1 kWh. All four carry ±100% uncertainty — this is the least settled data in the app.",
            "Service intensities: EXIOBASE order of magnitude, simplified."
          ]
        },

        {
          id: "uncertainty",
          title: "The range, and why it is wide",
          body: [
            "A single number would be a lie. Every factor in data/factors.js carries an uncertainty, and every answer you give carries one too, depending on whether you said it was exact (±5%), an estimate (±20%) or a guess (±50%).",
            "The app runs the whole calculation 4,000 times. Each run draws every uncertain quantity from a log-normal distribution whose median is the central value and whose 90% interval is × or ÷ (1 + uncertainty). Log-normal, not normal, because emission factors cannot be negative and are right-skewed. On top of everything there is a further ±10% for model simplification, because a calculator that asks 36 questions can never be exact.",
            "The 10th to 90th percentile of those 4,000 totals is the bracket shown next to your bar: eight times out of ten the true value is inside it, given these factors. The bracket sits ON the bar, centred, the way an error bar normally does. An earlier version stood it beside the bar with a dotted tie and a tick at the central value; that was three marks doing one job and it read as a box with a line through it. The bar's own top edge already IS the central estimate, so the two caps sitting at unequal distances from it show the skew without extra ink — the bracket usually reaches further above the bar than below, because these uncertainties multiply rather than add. The bracket is keyed in the legend beside the colours, with its actual numbers, because it is the one mark people ask about and it used to be the only one with no key.",
            "It is an uncertainty interval, not a box plot, and the difference is not cosmetic. A box plot summarises a distribution of observations — a median, quartiles, outliers, a sample of many things. There is one of you and one footprint here; the spread is how unsure the calculator is about a single value, not variation between people. Drawing quartiles and whiskers would invite the reader to look for outliers that cannot exist and to read a sample size that is not there. The honest idiom for \"we do not know this exactly\" is an interval with the estimate marked on it.",
            "One detail matters more than it looks. Inside a single run, each quantity is drawn ONCE and then reused everywhere it appears. The Austrian electricity mix is one number: the same value has to apply to your fridge, your heat pump, your train and your electric car. An earlier version drew it afresh at every use, which quietly averaged the uncertainty away and made the range look tighter than it is. The audit caught this; tests/audit.js now checks it directly.",
            "The seed is fixed, so the same answers always give the same range — the range is a property of the model, not of the dice."
          ],
          code: "engine.js → simulate(), randomDrawer()",
          check: "node tests/audit.js checks that the range brackets the central value, that the median sits on top of it, that the same seed gives the same answer, and that one factor keeps one value within a sample."
        },

        {
          id: "sankey",
          title: "The Sankey diagram",
          body: [
            "The Potential tab draws four columns, read left to right: what causes the emissions → what you do → which area → your whole footprint. Every band's height is exactly its tonnes times one scale — the same scale for the smallest row and for the trunk — and no column has gaps, so the picture is literally the arithmetic.",
            "Nothing has a minimum height. An earlier version gave every row at least enough height to fit its label, which quietly made small things look bigger than they were; in a diagram whose whole claim is that the picture is the arithmetic, that is the one distortion you cannot afford. What gets dropped instead is the label: a band too thin to hold a line of text is drawn at its true size without one, and hovering or clicking it says what it is. Bands under a finger's width also get an invisible strip to point at, so being small never means being unreachable.",
            "The cause column is grouped by where the emission physically happens: fuel you burn yourself, power stations, and farms, factories and supply chains that are largely abroad. Consumption-based accounting counts all three wherever they happen, which is why \"car: fuel\" and \"car: building it\" are two separate rows.",
            "Scope 1/2/3 is deliberately not used. Those categories are defined for organisations, and for a private person almost everything — food, goods, services, flights — would land in scope 3, which tells you nothing. The cause column carries the same information in words people recognise.",
            "The diagram is drawn bottom-up, so the 1.5 °C budget line sits on top: anything above the line is over budget. When you tick a change, the layout stays frozen on today's footprint and what you removed stays behind as a dashed ghost, so before and after can be compared directly instead of the whole picture jumping.",
            "Small rows are merged per area and per cause, and the merged row is named after what is actually in it (\"Cheese, pork & 3 more\"), never \"other\".",
            "Hovering anything follows the whole path it belongs to, left to right — the cause that produced it, the band into the activity, the activity, the band into its area, the area, and the trunk — and dims everything else. Every drawn shape carries the row numbers it is part of, so the highlight is the actual connectivity rather than the shapes that happen to touch. Hovering the trunk is the one exception: it belongs to every row, so lighting up its path would light up the whole picture, and it highlights only itself.",
            "Clicking holds a path open and fills a panel underneath it: where the emission physically happens, what is inside a merged row, everyday anchors for the size (kilometres in a petrol car, short-haul flights, share of the 2030 budget), how the area compares with the Austrian average, and — the useful part — which of the changes you have not yet ticked would shrink that particular thing, measured on top of the ones you have. The panel is built from engine.sources() on the same scenario the diagram shows, so it cannot disagree with the picture above it.",
            "On a phone the same diagram is turned a quarter. Four columns of labels cannot fit across 390 pixels — scaled down to fit, every word in it rendered about four pixels tall — so it becomes three stages read top to bottom: your whole footprint split into areas, then what you do, then what causes it. Overview first, detail as you scroll, which is the way a thumb moves. It is a transpose, not a second diagram: the same code decides what exists and what each row is worth, and only the axis changes, so widths there play the part heights play here. The rule is the same one — every block's width is exactly its tonnes times one scale, no minimum, and a block too narrow for its label goes without one rather than being fattened to fit. The audit checks that both orientations report the same rows, causes and areas, because the analysis panel reads that model and must not say different things depending on the width of a window. One thing is deliberately dropped on a phone: the dashed ghosts of what your changes remove. The bar pinned to the top of the screen already shows that, and far better than a dashed outline three pixels wide could.",
          ],
          code: "engine.js → sources(); js/sankey.js",
          check: "Open the browser console on the Potential tab: every band's height divided by its tonnes gives the same number, for every row and for the trunk. The diagram is built from engine.sources(), which returns one row per individual source. tests/audit.js checks on 3,000 random profiles that those rows add up to exactly the same numbers as engine.calculate() — per area, per column and in total, to within 10⁻⁹ tonnes. If the diagram and the number ever disagreed, that test would fail."
        },

        {
          id: "levers",
          title: "What you could change",
          body: [
            "Every lever works the same way: copy your profile, change one thing, run the whole calculation again. Nothing is a stored \"typical saving\". That is why a heat pump saves more in a badly insulated house, and why an electric car saves more if you are on a green tariff.",
            "Each one is written as three pieces: the change named as something you DO rather than something you stop; the concrete alternative that takes its place, in enough detail to act on; and the mechanism, with the number, so the size can be checked instead of taken on trust. A saving with no alternative attached is just a reproach, and people act on alternatives — so \"stop flying\" is \"take the night train instead\", with the Nightjet routes and the 0.19 t against 0.02 t that makes it worth doing. The audit enforces this: a lever with no alternative, no explanation, or a name beginning with stop, avoid or cut fails the test run.",
            "Some levers deliberately overlap — a year without flying contains the night-train swap, and buying almost nothing contains buying half as much. Rather than hiding the smaller ones, the app recalculates: once you tick something, every remaining change shows what it would add on top, and anything your ticked changes already cover is marked and struck through. The ladder stays visible, so you can see both the small step and the big one.",
            "Ticking several changes recalculates them together, never adds them up — and the difference goes in both directions. Two flight levers overlap, because they remove the same flight, so together they save less than the sum of their parts. A green tariff and a heat pump reinforce each other, because clean electricity makes the new system cleaner, so together they save MORE than the sum. The app shows the real combined figure and says which of the two is happening.",
            "Each lever is tagged with who actually decides: in your hands, needs the other owners, needs the landlord, when you replace it anyway, or hard for you. That comes from your answers about owning or renting, whether the electricity contract is in your name, how dependent you are on the car, and whether you fly for work or for holidays. A calculator that tells a tenant to replace the boiler is not being helpful.",
            "A sixth tag, \"a big change, but yours\", marks the levers that change how you live rather than what you buy: a no-buy year, a quarter less living space, travelling shorter distances, or bringing your spending down to what an average Austrian spends. They are listed separately at the bottom, and \"Reach the 1.5 °C goal\" only reaches for them once the ordinary changes have run out. Nobody should be told to move house before they have been told to switch electricity tariff.",
            "Two of those deserve explaining, because their size comes from your own answers rather than from a fixed percentage. \"Buy no more than an average Austrian\" and \"Go out and travel no more than an average Austrian\" only appear if you are above the Austrian average in that area, and they bring you down to it — so the lever is meaningful for a big spender and simply absent for everyone else. They stack with the ordinary ones: average first, then half of that, then mostly second-hand.",
            "Above the list sits a bar whose full width is the footprint you have today. It never changes width. Ticking a change subtracts it from its own area, so the coloured part shrinks and stays left-aligned, and the hatched part that opens up on the right is exactly the tonnes you removed — one picture for how far you have come and how far there is left to go, with the 2.5 t mark drawn on it. Every width is a plain percentage of today's total, taken from a real recalculation and never rounded, so the coloured segments add up to what is left and the hatch adds up to what went: the same rule the Sankey follows. Where a change moves emissions rather than removing them — a night train instead of a flight — one area grows while another shrinks, and the legend says so in red.",
            "The analysis panel on the Details tab ends each \"what would shrink this\" list with a button that opens the Potential tab with the list of changes and the diagram both narrowed to the same selection — so the answer to \"what do I do about my flights\" is one click from the question. Whether that button appears is decided by running the Potential tab's OWN calculation, not the panel's: this page describes the footprint you measured and names every change that would shrink the selection, while the Potential list is computed on the scenario you have ticked and drops what is already done or no longer saves anything there. When there is nothing left to offer, the panel says which of the two it is — already ticked, or already removed entirely — instead of showing a button that leads to an empty list.",
            "\"Reach the 1.5 °C goal\" takes the levers one at a time, ordinary before drastic and biggest first, until you are under the 2.5 t goal. The audit checks that this works for every one of 3,000 random profiles and for a deliberately absurd one (a 220 m² oil-heated house lived in alone, 24 business-class flights, meat twice a day and €44,000 a year on things and going out: 82 t down to 2.0 t). An earlier version of the lever list could not do this — see \"What the audit found\"."
          ],
          code: "engine.js → levers(), combined(), pathToTarget()",
          check: "tests/audit.js recalculates every lever from scratch on 400 random profiles and checks the claimed saving; it checks that ticking changes in a different order never changes the total, which was a real bug found in the audit; and it checks that every single one of the 3,000 random profiles has a route to the goal — and it reads that goal out of data/benchmarks.js rather than repeating the number, so changing the target re-tests the whole lever list instead of quietly bypassing the check. It also reads the widths back out of the bar's own markup on 300 profiles and checks that each area's width is its tonnes, that the hatched part is exactly the saving, and that the track is full to within a billionth of a percent."
        },

        {
          id: "compensation",
          title: "Compensation",
          body: [
            "Carbon credits are recorded by type and never subtracted from the footprint. This is the one place where the app takes a position: a tonne bought is not a tonne not emitted, and showing a smaller number would be a lie told with arithmetic.",
            "The types follow the Oxford Offsetting Principles: avoidance credits, forest protection, nature-based removal, biochar and long-lived biomass, and durable removal. Each is shown with how long the carbon actually stays out of the atmosphere and how reliable the credit type has proven to be.",
            "They are drawn as a ladder, and the choice of picture is the argument. A bar of tonnes bought, set against your footprint, would say the two cancel — the exact claim this app refuses to make. So the bar is scaled to the MIX you bought, never to the footprint, and it runs left to right from “prevents emissions elsewhere” to “locked away for 1,000+ years”. It answers what kind, not how much of my footprint is gone, because the answer to the second question is none of it.",
            "Two figures are read off that mix, and both are the Oxford Principles’ own shifts rather than a quality score invented here: how much of what you bought REMOVES carbon rather than preventing emissions somewhere else, and how much is stored for a century or more. The first separates the bottom two rungs from the top three; the second separates biochar and durable removal from the rest. Both come straight from the storage line recorded against each type.",
            "The colours are a sequential ramp whose lightness falls with every rung, so the order survives greyscale and colour-blindness — the ramp is the axis, not decoration. The audit checks that monotonicity, because a ramp that stops being ordered stops being an argument.",
            "Buying nothing is the common case, and the card draws the same ladder faint and evenly spaced instead of an empty chart: the rungs are worth knowing before spending, not after. A climate contribution — money given without claiming any tonnes — is named but never drawn, because no tonnes were claimed.",
            "The audit runs the whole footprint before and after loading a profile with credits of every type and checks the number does not move. It is a one-line test for the position the whole section rests on.",
            "They are drawn as a ladder, and the choice of picture is the argument. A bar of tonnes bought, set against your footprint, would say the two cancel — the exact claim this app refuses to make. So the bar is scaled to the MIX you bought, never to the footprint, and it runs left to right from “prevents emissions elsewhere” to “locked away for 1,000+ years”. It answers what kind, not how much of my footprint is gone, because the answer to the second question is none of it.",
            "Two figures are read off that mix, and both are the Oxford Principles’ own shifts rather than a quality score invented here: how much of what you bought REMOVES carbon rather than preventing emissions somewhere else, and how much is stored for a century or more. The first separates the bottom two rungs from the top three; the second separates biochar and durable removal from the rest. Both come straight from the storage line recorded against each type.",
            "The colours are a sequential ramp whose lightness falls with every rung, so the order survives greyscale and colour-blindness — the ramp is the axis, not decoration. The audit checks that monotonicity, because a ramp that stops being ordered stops being an argument.",
            "Buying nothing is the common case, and the card draws the same ladder faint and evenly spaced instead of an empty chart: the rungs are worth knowing before spending, not after. A climate contribution — money given without claiming any tonnes — is named but never drawn, because no tonnes were claimed.",
            "The audit runs the whole footprint before and after loading a profile with credits of every type and checks the number does not move. It is a one-line test for the position the whole section rests on."
          ],
          check: "tests/audit.js buys credits of all five types on 200 profiles and checks the footprint does not move; that each rung's width is its share of the mix and never of the footprint; that the two shares are the rungs they claim; and that the colour ramp gets darker with every rung.",
          sources: [
            "Oxford Offsetting Principles (2024 revision): cut emissions first, shift to removals, shift to durable storage.",
            "Probst et al. (2024), Nature Communications — a systematic assessment finding that a large majority of issued credits did not represent real reductions."
          ]
        },

        {
          id: "money",
          title: "Is your money really that small?",
          body: [
            "No — and the app does not say it is. It says something more specific: money does not belong in the same bar.",
            "The savings, pension and bank questions are marked \"not in the number\", and that is a scope decision, not a judgement about size. A consumption footprint counts the emissions of what YOU consume. The emissions of a cement company you part-own through a pension fund are already counted in the footprint of whoever buys that cement. Adding your share on top would count the same tonnes twice — this is why no consumption-based framework in use adds financed emissions to a personal footprint.",
            "The size is not small. Two honest reference points, using completely different methods. The European Central Bank reports that the securities portfolios of euro-area banks carried about 84 tonnes of CO₂ per million euros invested in 2024 — scope 1 and 2 of the companies held, attributed by enterprise value — which is 0.84 t per €10,000. Make My Money Matter and Route2 put the saving from moving a £30,000 pension (≈ €35,000) to a sustainable fund at about 19 tonnes a year, which is 5.4 t per €10,000, using a much broader scope and a different attribution.",
            "The same €10,000 therefore finances 0.8 tonnes or 5.4 tonnes depending on who does the sum — a factor of six and a half. That is the real finding: attributed-emission figures depend enormously on method, and a number that can move six-fold depending on who calculates it has no business sitting inside a bar that claims a ±20% range. The app shows both ends, as a range, beside your footprint.",
            "So the honest treatment is the one the app uses: leverage, not tonnes. Where your money sits is one of the few decisions a single person makes that moves capital rather than consumption, and the effect runs through the companies that get funded, not through your own kitchen. It is worth doing, and it is not measured in the same currency as your heating bill."
          ],
          sources: [
            "European Central Bank, Climate change indicators (November 2025): carbon footprint of euro-area banks' securities portfolios fell from 162 to 84 tCO₂e per million EUR between 2018 and 2024.",
            "Make My Money Matter / Aviva / Route2 (2021): switching an average £30,000 pension to a sustainable fund ≈ 19 t CO₂e a year. The methodology behind this figure has not been published in full.",
            "PCAF, The Global GHG Accounting and Reporting Standard for the Financial Industry, Part A: Financed Emissions — the standard method, and the reason attribution choices change the answer so much."
          ]
        },

        {
          id: "digital",
          title: "Is digital really that small?",
          body: [
            "The streaming and AI line is small — usually 30 to 60 kg a year — and that is correct, but it is only half the story, and the half people usually mean is somewhere else in the app.",
            "Your devices are in \"Stuff you buy\", not in the digital line. Making a smartphone is roughly 55–70 kg CO₂e and a laptop 150–300 kg, and for both, around 80% of the lifetime footprint is manufacturing, not use. Someone spending €500 a year on electronics is carrying about 150 kg in the goods section. That is three to four times their streaming.",
            "So a realistic full digital footprint for one person in Austria is roughly 0.2 tonnes: about 0.15 t of devices, sitting in goods, and about 0.05 t of use, sitting in the digital line. Against a 7.9 t Austrian average that is about 2–3%, which is exactly what the sector-level research finds: the ITU and World Bank put the whole ICT sector at 1.5–4% of global emissions.",
            "Two things make it feel bigger. Absolute numbers sound enormous — data centres burn terawatt-hours — but divided by billions of users they are small per person. And an early estimate of streaming, about 3.2 kg per hour, circulated very widely before being corrected to roughly 0.055 kg; the retraction never travelled as far as the original.",
            "What is genuinely uncertain is the AI side, which is why those factors carry ±100%. Per prompt it is small — a text prompt is roughly one hundredth of a minute of streaming. Generated video is different: at about 0.35 kg each, a hundred of them is comparable to a short flight, and the app counts them. The honest summary is that digital is small per person today, is growing fast, and is the part of the model most likely to need revising next year."
          ],
          sources: [
            "ITU / World Bank (2024), Measuring the Emissions & Energy Footprint of the ICT Sector: the sector is 1.5–4% of global greenhouse gas emissions.",
            "Carbon Trust (2021): ~55 g CO₂e per hour of video streaming in Europe, including the device — a correction of much larger earlier figures.",
            "Manufacturer life-cycle reports (Apple and others): a smartphone ≈ 55–70 kg CO₂e, a laptop ≈ 150–300 kg, with roughly 80% in manufacturing.",
            "Hannah Ritchie (2025) and Google (2025) for per-prompt AI energy and emissions."
          ]
        },

        {
          id: "doublecount",
          title: "Double counting we had to avoid",
          body: [
            "A calculator that asks about the same thing in two different units will happily count it twice, and the result still looks plausible. Three places where this nearly happened:",
            "Restaurant meals. The food questions ask what you eat \"at home or out\", and eating out was also charged at a full food-service intensity of 0.35 kg per euro. The audit caught it; eating out is now 0.15 kg/€, the venue's own share only.",
            "Electric heating. A household electricity bill includes the heat pump. The electricity question therefore asks explicitly for the figure without the heating part, for anyone who heats electrically.",
            "Money. Adding your share of the emissions of the companies you part-own to a footprint that already counts the goods those companies make would count the same tonnes twice — see \"Is your money really that small?\".",
            "And one that is not double counting but looks like it: the same electricity factor appearing in housing, transport and digital is correct. It is one factor used in three places, which is exactly why it must be drawn once per simulation run."
          ]
        },

        {
          id: "missing",
          title: "What is missing",
          body: [
            "An honest list of what a 36-question calculator does not reach. Roughly ordered by how much it would move a typical Austrian result.",
            "Building the building. The concrete, steel and insulation in your home, spread over its life, is something like 0.3–0.8 t per person per year. It is not asked because almost nobody can answer it, and because it barely responds to anything you decide — but it is a real gap, and it means the renovation lever also does not count the emissions of doing the renovation.",
            "New appliances have a carbon debt. The heat pump and electric-car levers show the steady-state saving once installed. Manufacturing a heat pump or a battery is a real up-front cost that takes roughly one to three years to pay back. The app does not show that payback.",
            "Household waste. The app counts food bought and thrown away, but not the collection, incineration and landfill of everything else — around 0.1–0.2 t per person.",
            "Water and wastewater: roughly 0.03–0.06 t.",
            "Pets. A medium-sized dog is roughly 0.3–0.6 t a year, almost all of it food. Two dogs can outweigh a small car.",
            "Second homes, holiday cottages, boats, motorbikes, e-scooters, a second household car. Only one car is asked about.",
            "Ferries, cruises and long-distance coaches. A cruise is in the order of 0.2 t per person per day and is not in the model at all.",
            "Rebound. Money saved by driving less gets spent on something, and that something has a footprint. Every lever in the app ignores this, so the savings are upper bounds. Published rebound estimates run from 10% to 30%.",
            "Public services, deliberately: about 3 t per person in Austria, shown as a note rather than in the bar.",
            "Financed emissions, deliberately: see \"Is your money really that small?\".",
            "Austrian data. The food factors are German (ifeu) and the goods and services intensities are European averages, not Austrian EXIOBASE values. This is the single biggest quality upgrade available.",
            "Taken together the deliberate exclusions and the gaps mean a real lifestyle footprint is probably somewhat higher than what this app reports — by perhaps half a tonne to a tonne for a typical person, on top of the ±20% range it already shows."
          ]
        },

        {
          id: "benchmarks",
          title: "The three comparisons",
          body: [
            "Austria 7.9 t per person is a derived estimate: roughly 100 Mt of consumption-based emissions divided by 9.16 million people, times the ~72% that is household rather than public consumption. The world average of 5.1 t is derived the same way. Both are estimates, and both are flagged as such in the code.",
            "The split of the Austrian average across the six areas is illustrative: it is scaled to be consistent with the bottom-up food model rather than measured independently. Use it to see roughly where you sit, not as a precise per-area benchmark.",
            "The 1.5 °C line is 2.5 t per person by 2030, from the Hot or Cool Institute. Two things about it. It is a lifestyle target on the same household-consumption scope as everything else in the app, which is what makes the comparison fair — the public share is outside the bars AND outside the target, not missing from one of them. And it is a globally unified number: the remaining budget divided equally among everyone alive, so Austria and Bangladesh are held to the same 2.5 t. What differs by country is the distance: Austria has to fall by about two thirds, while the poorest half of the world could consume more and still be inside it. A target weighted by historical responsibility would put Austria below 2.5 t, not above.",
            "There is no per-area 2030 target. Splitting 2.5 t across housing, food and travel would pretend to know how each person should live; one person can fly and eat plants, another can be vegan and drive. The goal applies to the total."
          ],
          sources: [
            "Hot or Cool Institute (2021), 1.5-Degree Lifestyles: Towards A Fair Consumption Space for All, Figure C: globally unified lifestyle carbon footprint targets of 2.5 t CO₂e per person per year by 2030 and 0.7 t by 2050. The 2025 update, A Climate for Sufficiency, carries the same trajectory and states 1.1 t by 2035 and 0.3 t by 2050.",
            "Consumption-based national totals: Global Carbon Project / OECD-style footprint accounts, applied to Austrian population and household share."
          ]
        },

        {
          id: "verify",
          title: "How to check this yourself",
          body: [
            "node tests/engine.test.js — 59 assertions against two profiles worked out by hand, with the arithmetic written in the comments so you can follow it on paper. It also checks the things that are easy to get wrong: that flights are one-way, that periods convert correctly, that every question is labelled.",
            "node tests/audit.js — the independent audit. It generates 3,000 random profiles and checks the properties that must hold for all of them: that the Sankey's rows add up to the calculation in every column, that every lever's claimed saving survives a recalculation from scratch, that ticking changes in a different order gives the same answer, that the uncertainty range brackets the central value, and that a shared factor keeps one value within a sample. About 145,000 checks.",
            "Both are plain Node scripts with no dependencies. If you change a factor in data/factors.js, the hand-calculated tests will fail and tell you which number moved — that is intentional.",
            "Every factor with its source is also listed in the app under \"</> View the code\" → \"Data sources\"."
          ]
        },

        {
          id: "audit",
          title: "What the audit found and changed",
          body: [
            "The audit in tests/audit.js was written after the app was finished, to attack it rather than confirm it. Four things came out of it.",
            "Fixed — restaurant food was counted twice. Eating out went from 0.35 to 0.15 kg per euro, the venue's own share. For someone spending €1,200 a year this removes about 0.24 t.",
            "Fixed — shared factors were drawn independently. In the uncertainty simulation the electricity factor was drawn afresh at each use, so several uses averaged each other out and the range came out too narrow. Each quantity is now drawn once per run.",
            "Fixed — levers were order-dependent. \"Stop flying\" and \"train instead of short flights\" both wrote the replacement train kilometres, one adding and one overwriting, so the total depended on the order you clicked. Same for the meals that replace meat. Every lever now writes a target state rather than a change, so order cannot matter.",
            "Not a bug — savings that are more than the sum of their parts. A green tariff plus a heat pump saves more together than separately, because clean electricity makes the new system cleaner. The app's wording said \"they overlap\" in both cases; it now says which of the two is happening.",
            "Fixed — the 1.5 °C goal was not reachable for heavy profiles. A deliberately extreme profile bottomed out at 5.0 t with every lever ticked, because whole areas had weak levers or none at all: services could only be cut by a third, goods by half, and household electricity, hot water, living space, the plant-based food base and digital use had no lever whatsoever. Eleven levers were added — less electricity, solar on your own roof, less hot water, a quarter less living space, a heat pump for district heating too, insulation for wood and pellet heating (previously hidden, but it was the single biggest thing left in a large firewood-heated house), travelling shorter distances, cutting drinks and snacks, a no-buy year, halving going out, less streaming and no AI video, plus the two \"down to the Austrian average\" levers. Every one of the 3,000 audit profiles can now reach the goal, and so can the absurd one — including after the target was tightened from 3.0 to 2.5 t (the absurd profile bottoms out at 2.0 t).",
            "Unchanged and confirmed: the Sankey's four columns reconcile exactly with the calculation on all 3,000 test profiles, every lever's claimed saving survives an independent recalculation, and nothing produces a negative, infinite or missing value."
          ]
        }
      ]
    };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.docs = defineDocs();
  G.sources["data/docs.js"] = defineDocs.toString();
})(typeof window !== "undefined" ? window : globalThis);
