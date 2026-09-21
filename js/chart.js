/*
 * Comparison chart as plain SVG (no library).
 * Stacked bars: You / Austria / World, dashed line = 1.5 °C goal,
 * bracket next to "You" = uncertainty range.
 */
(function (root) {
  function defineChart() {
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    function render(opts) {
      var domains = opts.domains, bars = opts.bars, target = opts.target, range = opts.range;
      var W = 360, H = 320, top = 24, bottom = 250, left = 18, right = 300;
      var maxVal = Math.max(target.value, range ? range.high : 0);
      bars.forEach(function (b) { maxVal = Math.max(maxVal, b.total); });
      maxVal = Math.ceil(maxVal * 1.08);
      var y = function (v) { return bottom - (v / maxVal) * (bottom - top); };

      // The bar is clipped to a shape with rounded corners on TOP only — it sits on the baseline,
      // so rounding the bottom would lift it off the axis. The segments inside touch each other:
      // no separator line, no outline. The colours and the legend do the separating.
      var topRounded = function (x, w, yTop, yBottom) {
        var r = Math.min(10, w / 2, Math.max(0, yBottom - yTop));
        return "M" + x + "," + yBottom +
          "L" + x + "," + (yTop + r) +
          "Q" + x + "," + yTop + " " + (x + r) + "," + yTop +
          "L" + (x + w - r) + "," + yTop +
          "Q" + (x + w) + "," + yTop + " " + (x + w) + "," + (yTop + r) +
          "L" + (x + w) + "," + yBottom + "Z";
      };

      var barW = 70, slot = (right - left) / bars.length;
      var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Footprint comparison chart" class="chart-svg">'];
      svg.push("<defs>");
      bars.forEach(function (b, i) {
        var x = left + slot * i + (slot - barW) / 2;
        svg.push('<clipPath id="clip' + i + '"><path d="' + topRounded(x, barW, y(b.total), bottom) + '"/></clipPath>');
      });
      svg.push("</defs>");

      bars.forEach(function (b, i) {
        var x = left + slot * i + (slot - barW) / 2, acc = 0;
        svg.push('<g clip-path="url(#clip' + i + ')">');
        domains.forEach(function (d) {
          var v = b.byDomain[d.id] || 0;
          if (v <= 0) return;
          var y1 = y(acc + v), y0 = y(acc);
          svg.push('<rect x="' + x + '" y="' + y1 + '" width="' + barW + '" height="' + (y0 - y1) + '" fill="' + d.color + '"><title>' + esc(b.label + " · " + d.label + ": " + v.toFixed(1) + " t") + "</title></rect>");
          acc += v;
        });
        svg.push("</g>");
        svg.push('<text x="' + (x + barW / 2) + '" y="' + (bottom + 26) + '" class="bar-label">' + esc(b.label) + "</text>");
        svg.push('<text x="' + (x + barW / 2) + '" y="' + (bottom + 46) + '" class="bar-value">' + b.total.toFixed(1) + " t</text>");

        if (b.isYou && range) { // uncertainty bracket
          var wx = x + barW + 9;
          svg.push('<g class="range"><title>' + esc("80% likely between " + range.low.toFixed(1) + " and " + range.high.toFixed(1) + " t") + "</title>" +
            '<line x1="' + wx + '" x2="' + wx + '" y1="' + y(range.high) + '" y2="' + y(range.low) + '"/>' +
            '<line x1="' + (wx - 4) + '" x2="' + (wx + 4) + '" y1="' + y(range.high) + '" y2="' + y(range.high) + '"/>' +
            '<line x1="' + (wx - 4) + '" x2="' + (wx + 4) + '" y1="' + y(range.low) + '" y2="' + y(range.low) + '"/></g>');
        }
      });

      var ty = y(target.value);
      svg.push('<line x1="' + (left - 6) + '" x2="' + (right + 6) + '" y1="' + ty + '" y2="' + ty + '" class="target-line"/>');
      svg.push('<text x="' + (right + 10) + '" y="' + (ty - 3) + '" class="target-label">' + target.value.toFixed(1) + " t</text>");
      svg.push('<text x="' + (right + 10) + '" y="' + (ty + 11) + '" class="target-sub">2030</text>');
      svg.push('<text x="' + (right + 10) + '" y="' + (ty + 23) + '" class="target-sub">goal</text>');
      svg.push("</svg>");
      return svg.join("");
    }

    /* ---------- Potential tab: what is left of your footprint ----------
     * The full width of the track is ALWAYS the footprint you have today, so the bar
     * can only ever get shorter. Every ticked change subtracts from its own area, the
     * coloured part shrinks left-aligned, and the hatched remainder on the right is
     * exactly the tonnes removed. Widths are plain percentages of the baseline total
     * and the segments touch with no gaps, so the picture is the arithmetic — the same
     * rule the Sankey follows. A change that moves emissions rather than removing them
     * (a night train instead of a flight) makes one area grow while another shrinks;
     * that shows up honestly, because the bar is redrawn from a real recalculation and
     * never from the sum of the individual savings.
     */
    function horizontal(opts) {
      var domains = opts.domains, now = opts.now || {}, after = opts.after || {};
      var base = opts.baseTotal, left = opts.total;
      if (!(base > 0)) return "";
      var pct = function (t) { return (t / base) * 100; };

      // Widths are never rounded and the hatched remainder is whatever the colours leave
      // over, so the track is exactly full and the hatch is exactly the tonnes removed.
      // A bar that rounds its way to a tidy picture would be telling a small lie.
      var TINY = 1e-6; // below this a width is invisible anyway; keep it out of the markup
      var segs = [], keys = [], filled = 0;
      domains.forEach(function (d) {
        var a = after[d.id] || 0, n = now[d.id] || 0, diff = n - a, w = pct(a);
        if (a > 0) filled += w;
        if (w >= TINY) {
          segs.push('<div class="pb-seg" style="width:' + w + '%;background:' + d.color + '" title="' +
            esc(d.label + ": " + a.toFixed(2) + " t" + (Math.abs(diff) > 0.005 ? " (was " + n.toFixed(2) + " t)" : "")) + '"></div>');
        }
        keys.push('<span class="pb-key' + (a <= 0.005 ? " pb-gone" : "") + '"><i style="background:' + d.color + '"></i>' +
          esc(d.label) + " <b>" + a.toFixed(1) + " t</b>" +
          (diff > 0.005 ? '<em class="pb-down">\u2212' + diff.toFixed(1) + "</em>"
            : (diff < -0.005 ? '<em class="pb-up">+' + (-diff).toFixed(1) + "</em>" : "")) + "</span>");
      });

      // whatever the coloured part does not use is, by construction, what the changes removed
      var gone = Math.max(0, 100 - filled), saved = Math.max(0, base - left);
      if (gone >= TINY) {
        segs.push('<div class="pb-shadow" style="width:' + gone + '%" title="' +
          esc("Removed by your changes: " + saved.toFixed(2) + " t of " + base.toFixed(2) + " t") + '">' +
          (gone >= 11 ? "\u2212" + saved.toFixed(1) + " t" : "") + "</div>");
      }

      var goalMark = "";
      if (opts.goal && opts.goal.value > 0 && opts.goal.value < base) {
        var g = Number(pct(opts.goal.value).toFixed(3)); // a marker, not a quantity
        var shift = g > 86 ? "translateX(-100%)" : (g < 9 ? "translateX(0)" : "translateX(-50%)");
        goalMark = '<div class="pb-goal" style="left:' + g + "%;transform:" + shift + '">' +
          esc(opts.goal.label || "goal") + "</div>";
        segs.push('<div class="pb-goal-line" style="left:' + g + '%"></div>');
      }

      // A compact readout of the same two numbers, always in the markup but only shown once the
      // bar sticks to the top of the window — by then the hero figure has scrolled out of sight.
      var readout = '<div class="pb-now" aria-hidden="true"><b>' + left.toFixed(1) + " t</b>" +
        (saved > 0.005 ? '<em class="pb-down">−' + saved.toFixed(1) + " t</em>"
                       : '<em class="pb-none">nothing ticked</em>') + "</div>";

      return '<div class="pb-wrap">' + readout +
        '<div class="pb-bar">' + goalMark +
          '<div class="pb-track" role="img" aria-label="' +
            esc("Of " + base.toFixed(1) + " t today, " + left.toFixed(1) + " t remain after the changes you ticked") + '">' +
            segs.join("") + "</div>" +
        "</div>" +
        '<div class="pb-legend">' + keys.join("") + "</div>" +
        '<p class="pb-caption small muted">' + (opts.caption ||
          "The full width is your <strong>" + base.toFixed(1) +
          " t</strong> today and never changes. Ticking a change subtracts it from its own area, so the coloured part shrinks; the hatched part is what you removed" +
          (saved > 0.005 ? " \u2014 <strong>" + saved.toFixed(1) + " t</strong> so far." : " \u2014 nothing yet.")) + "</p>" +
        "</div>";
    }

    function legend(domains) {
      return domains.map(function (d) {
        return '<span class="legend-item"><i style="background:' + d.color + '"></i>' + esc(d.label) + "</span>";
      }).join("");
    }

    return { render: render, horizontal: horizontal, legend: legend };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.chart = defineChart();
  G.sources["js/chart.js"] = defineChart.toString();
})(typeof window !== "undefined" ? window : globalThis);
