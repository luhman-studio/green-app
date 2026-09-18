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
        total: 7.9,
        // Illustrative split — replace with EXIOBASE domain data when available.
        byDomain: { housing: 1.9, transport: 1.7, flights: 0.5, food: 1.5, goods: 1.1, services: 1.2 },
        source: "Derived estimate: Austrian consumption-based emissions ≈ 100 Mt CO2e (2023, Joanneum Research / CCCA) ÷ 9.16 M inhabitants ≈ 10.9 t, × 72% household share (Hot or Cool Institute). Germany in the same report: 8.1 t."
      },

      world: {
        label: "World",
        total: 5.1,
        byDomain: { housing: 1.3, transport: 0.9, flights: 0.15, food: 1.6, goods: 0.6, services: 0.55 },
        source: "Derived estimate: global GHG ≈ 57 Gt CO2e (UNEP Emissions Gap 2024) ÷ 8.05 bn people ≈ 7.1 t, × 72% household share. Illustrative split."
      },

      targets: {
        y2030: { value: 3.0, label: "1.5 °C goal 2030" },
        source: "Hot or Cool Institute, ‘A Climate for Sufficiency’ (2025): 1.5 °C-aligned lifestyle footprint ≈ 3.0 t CO2e per person in 2030, falling to ~1–1.5 t by 2035."
      },

      publicShare: {
        austria: 3.0,
        source: "≈ 28% of Austria’s consumption-based total (public services, infrastructure, investment). Not controllable by lifestyle; excluded from the comparison."
      }
    };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.benchmarks = defineBenchmarks();
  G.sources["data/benchmarks.js"] = defineBenchmarks.toString();
})(typeof window !== "undefined" ? window : globalThis);
