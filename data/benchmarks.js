/*
 * Comparison values. All are LIFESTYLE footprints:
 * consumption-based, CO2e, household consumption only.
 * Public services & infrastructure (~28% of a country's total) are excluded
 * — the same scope as the 1.5°C lifestyle targets, so the bars are comparable.
 */
(function (root) {
  function defineBenchmarks() {
    return {
      domains: [
        // Palette checked with the dataviz validator (light surface #FFFDF8):
        // lightness band, chroma floor and normal-vision separation all pass.
        { id: "housing",   label: "Housing & energy", color: "#C9861C" },
        { id: "transport", label: "Car & transit",    color: "#2B7FD6" },
        { id: "flights",   label: "Flights",          color: "#9B3BB0" },
        { id: "food",      label: "Food",             color: "#1C8B4B" },
        { id: "goods",     label: "Goods",            color: "#D43C22" },
        { id: "services",  label: "Services & leisure", color: "#00918D" }
      ],

      austria: {
        label: "Austria",
        // Everything one Austrian causes in a year, whoever did the buying.
        nationalTotal: 10.9,
        nationalSource: "Austrian consumption-based emissions ≈ 100 Mt CO2e (2023, Joanneum Research / CCCA) ÷ 9.16 M inhabitants ≈ 10.9 t.",

        /* Who did the buying. AUSTRIA-SPECIFIC, and it replaces the global 72/28
         * rule of thumb this file used before. The shares are measured for Austria;
         * the earlier number was a world average applied to a country.
         *
         * Reading the source table takes one step: it lists households' INDIRECT
         * emissions only (67,452 kt = 55% of the national total). The paper's text
         * adds the 13% households burn directly — heating and fuel — to reach the
         * 68% below. With that, the four categories sum to the stated 123.6 Mt.
         */
        finalDemand: { households: 0.68, government: 0.08, investment: 0.21, globalTransport: 0.03 },
        finalDemandSource: "Steininger et al. (2018), ‘Austria’s consumption-based greenhouse gas emissions: Identifying sectoral sources and destinations’, Global Environmental Change, GTAP, base year 2011, 123.6 Mt CO2e total: households 68% (55% indirect + 13% direct), government 8%, investments 21%, global transport 3%.",

        // 10.9 × 0.68. The lifestyle footprint — the scope of every bar and of the 2.5 t goal.
        total: 7.4,
        // Illustrative split — replace with EXIOBASE domain data when available.
        // Rescaled with the total; the proportions are unchanged and still illustrative.
        byDomain: { housing: 1.78, transport: 1.59, flights: 0.47, food: 1.41, goods: 1.03, services: 1.12 },
        source: "Derived: 10.9 t national consumption-based total (2023) × 68% household share (Steininger et al. 2018, Austria-specific). The share and the total are from different years — the best combination available, and stated rather than hidden."
      },

      world: {
        label: "World",
        total: 5.1,
        byDomain: { housing: 1.3, transport: 0.9, flights: 0.15, food: 1.6, goods: 0.6, services: 0.55 },
        // The world bar keeps the GLOBAL 72% household share on purpose: Austria's 68%
        // is measured for Austria and does not describe the planet.
        source: "Derived estimate: global GHG ≈ 57 Gt CO2e (UNEP Emissions Gap 2024) ÷ 8.05 bn people ≈ 7.1 t, × 72% household share (Hertwich & Peters 2009, global). Illustrative split."
      },

      targets: {
        y2030: { value: 2.5, label: "1.5 °C goal 2030" },
        // A GLOBALLY UNIFIED target, not an Austrian one: the remaining budget divided
        // equally across the world population. Austria and Bangladesh get the same 2.5 t;
        // what differs is the distance to it. A target weighted by historical responsibility
        // would put Austria BELOW 2.5, not above.
        source: "Hot or Cool Institute, ‘1.5-Degree Lifestyles: Towards A Fair Consumption Space for All’ (2021), Figure C: globally unified lifestyle carbon footprint targets of 2.5 t CO2e per person per year by 2030 and 0.7 t by 2050. The 2025 update (‘A Climate for Sufficiency’) states 1.1 t by 2035 and 0.3 t by 2050 and shows the same trajectory through 2030."
      },

      /* What the bars leave out: the 32% of Austria's footprint that nobody buys as a
       * household. Shown as its own diagram rather than a sentence, because the usual
       * assumption — that this is hospitals and schools — is wrong by a wide margin.
       * Two thirds of it is construction and machinery.
       *
       * Ordered largest first, so the picture tells that story on its own.
       * Every share below is measured and sourced. Nothing here is apportioned by
       * spending, assumed, or split evenly: where the data stops, the block stops
       * and says so.
       */
      publicShare: {
        austria: 3.5,                         // 10.9 × (1 − 0.68)
        colorTrunk: "#6B4A2F",
        parts: [
          {
            id: "investment", label: "Investment & construction",
            shareOfNational: 0.21, color: "#5A3A20",
            detail: "New buildings, roads, railways, power lines, machinery and vehicles. Bought by firms and the state, used for decades by everyone. The embodied carbon of the home you live in is here — not in your housing figure, which counts only the energy you use in it.",
            individual: false
          },
          {
            id: "government", label: "Public services",
            shareOfNational: 0.08, color: "#8C5A32",
            detail: "Everything the state runs on your behalf.",
            individual: null,
            parts: [
              {
                id: "health", label: "Health & social care",
                shareOfParent: 0.49, color: "#A87548", individual: true,
                detail: "Hospitals, doctors, care homes, medicines. Eurostat counts this as INDIVIDUAL consumption: it is consumed by one identifiable person. In a country where you pay for your own care, these same emissions land inside your personal footprint. Austria’s do not — which is why comparing household footprints across countries flatters whoever has the bigger public system."
              },
              {
                id: "otherGov", label: "The rest of public services",
                shareOfParent: 0.51, color: "#C9A87F", individual: null,
                detail: "Schools and universities, public administration, police, courts, defence, street lighting, waste and water. NOT broken down further here, because no measurement of Austrian public emissions by function exists that this app could cite. Splitting it by how many euros each department spends would assume a kilometre of motorway and an hour of school carry the same carbon, which is false. So it stays one block."
              }
            ]
          },
          {
            id: "globalTransport", label: "International shipping & aviation",
            shareOfNational: 0.03, color: "#A8896B",
            detail: "The ships and planes that move traded goods between countries. Counted separately in the national accounts because it happens in nobody’s territory and cannot be assigned to a single buyer.",
            individual: false
          }
        ],
        source: "Shares: Steininger et al. (2018), GTAP 2011, Austria — government 8%, investments 21%, global transport 3% of the national consumption-based total. Health & social work = 49% of public-sector emissions, same paper. Cross-check: Health Care Without Harm / Arup put Austrian health care at 0.59 t CO2e per person (5.2% of national emissions, 2014) and Weisz et al. (2020) at 6.8 Mt — consistent with 0.43 t of government-funded care plus the health spending households pay themselves, which the app already counts under Services.",
        aicSource: "Eurostat, Actual Individual Consumption: household purchases + NPISH + government services for individual consumption (health and education named explicitly). Eurostat states AIC ‘is usually preferred over the narrower concept of household consumption’ for comparing countries, precisely because governments provide different amounts."
      }
    };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.benchmarks = defineBenchmarks();
  G.sources["data/benchmarks.js"] = defineBenchmarks.toString();
})(typeof window !== "undefined" ? window : globalThis);
