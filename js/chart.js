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

    function legend(domains) {
      return domains.map(function (d) {
        return '<span class="legend-item"><i style="background:' + d.color + '"></i>' + esc(d.label) + "</span>";
      }).join("");
    }

    return { render: render, legend: legend };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.chart = defineChart();
  G.sources["js/chart.js"] = defineChart.toString();
})(typeof window !== "undefined" ? window : globalThis);
