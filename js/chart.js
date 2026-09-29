/*
 * Comparison chart as plain SVG (no library).
 * Stacked bars: You / Austria / World, dashed line = 1.5 °C goal,
 * bracket centred on "You" = the 80% uncertainty range.
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

        if (b.isYou && range) {
          /* The uncertainty range sits ON the bar, centred, the way an error bar normally does.
           * It used to stand beside it with a dotted tie and a tick at the central value; that
           * was three marks doing one job and it read as a box with a line through it. The bar's
           * own top edge already IS the central value, so the caps being unequal distances from
           * it is the skew, shown without extra ink.
           *
           * The lower half runs over the coloured segments, so every line is drawn twice: a wide
           * cream casing first, the ink line on top. That keeps it legible over any fill without
           * a halo filter.
           */
          var cx = x + barW / 2, yHi = y(range.high), yLo = y(range.low), cap = 7;
          var marks = function (cls) {
            return '<line class="' + cls + '" x1="' + cx + '" x2="' + cx + '" y1="' + yHi + '" y2="' + yLo + '"/>' +
              '<line class="' + cls + '" x1="' + (cx - cap) + '" x2="' + (cx + cap) + '" y1="' + yHi + '" y2="' + yHi + '"/>' +
              '<line class="' + cls + '" x1="' + (cx - cap) + '" x2="' + (cx + cap) + '" y1="' + yLo + '" y2="' + yLo + '"/>';
          };
          svg.push('<g class="range"><title>' + esc("Central estimate " + b.total.toFixed(1) + " t · 80% of runs between " +
              range.low.toFixed(1) + " and " + range.high.toFixed(1) + " t") + "</title>" +
            marks("range-casing") + marks("range-line") + "</g>");
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
                       : '<em class="pb-none">' + esc(opts.idleLabel || "nothing ticked") + "</em>") + "</div>";

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

    /* ---------- What the bars leave out ----------
     * Two aligned rows on one scale. The top row is where the excluded tonnes go; the
     * bottom row is how far the measurements actually reach into each of them.
     *
     * A flow diagram was the obvious first choice and it was wrong: nothing here flows
     * or transforms, it is a whole divided, and ribbons between equal-height blocks read
     * as blocks. Two rows say the same thing in less ink.
     *
     * The rule that matters: a block is only subdivided where a measurement exists to
     * subdivide it with. Everywhere else the bottom row says "not broken down" in plain
     * words. That gap in the picture is the gap in the data, and showing it is the point —
     * a plausible-looking split of public spending would be worse than no split at all.
     *
     * Widths are never rounded, so the segments sum to the whole exactly.
     */
    function flow(opts) {
      var parts = opts.parts, total = opts.total;
      if (!(total > 0) || !parts || !parts.length) return "";
      var pct = function (t) { return (t / total) * 100; };
      var TINY = 1e-6;

      var top = [], bottom = [], keys = [];
      parts.forEach(function (p) {
        var w = pct(p.t);
        if (w < TINY) return;
        top.push('<div class="fl-seg" data-kind="part" data-t="' + p.t + '" style="width:' + w + '%;background:' + p.color +
          '" title="' + esc(p.label + ": " + p.t.toFixed(2) + " t") + '">' +
          (w >= 17 ? '<span>' + esc(p.label) + " · " + p.t.toFixed(2) + " t</span>"
                   : w >= 5 ? "<span>" + p.t.toFixed(2) + " t</span>" : "") + "</div>");

        var kids = p.parts && p.parts.length ? p.parts : null;
        if (!kids) {
          // no measurement reaches inside this one — say so rather than inventing a split
          bottom.push('<div class="fl-seg fl-unknown" data-kind="leaf" data-t="' + p.t + '" style="width:' + w +
            '%" title="' + esc(p.label + ": not broken down — no measurement to cite") + '">' +
            (w >= 20 ? "<span>not broken down</span>" : "") + "</div>");
          keys.push(keyRow(p, false));
        } else {
          kids.forEach(function (k) {
            var kw = pct(k.t);
            bottom.push('<div class="fl-seg" data-kind="leaf" data-t="' + k.t + '" style="width:' + kw + '%;background:' + k.color +
              '" title="' + esc(k.label + ": " + k.t.toFixed(2) + " t") + '">' +
              (kw >= 14 ? "<span>" + esc(k.label) + "</span>" : kw >= 5 ? "<span>" + k.t.toFixed(2) + " t</span>" : "") + "</div>");
            keys.push(keyRow(k, true));
          });
        }
      });

      function keyRow(n, nested) {
        return '<li class="flow-key' + (nested ? " nested" : "") + '">' +
          '<i style="background:' + n.color + '"></i>' +
          '<div><span class="flow-key-head">' + esc(n.label) + " <b>" + n.t.toFixed(2) + " t</b> " +
          '<span class="muted">· ' + Math.round(n.share * 100) + "% of everything you cause</span>" +
          (n.individual ? ' <span class="badge c-yours">inside your own footprint in other countries</span>' : "") + "</span>" +
          '<span class="flow-key-detail">' + esc(n.detail || "") + "</span></div></li>";
      }

      /* The dashed mark for what this share would have to come down to. It is DERIVED, not
       * published — no body sets a target for the part of a footprint nobody buys as a
       * household — so it is drawn dashed like the 1.5 °C line elsewhere but says "derived"
       * where that one says the year. Drawing it at all is worth it: without a mark, a bar
       * of 3.5 tonnes invites the reading that this share is fixed and someone else's
       * problem, when it has to fall by about as much as the lifestyle half does.
       */
      var goalMark = "", goalLine = "";
      if (opts.goal && opts.goal.value > 0 && opts.goal.value < total) {
        var g = Number((opts.goal.value / total * 100).toFixed(3));
        var shift = g > 86 ? "translateX(-100%)" : (g < 9 ? "translateX(0)" : "translateX(-50%)");
        goalMark = '<div class="fl-goal" style="left:' + g + "%;transform:" + shift + '">' +
          esc(opts.goal.label) + '</div><div class="fl-goal-tick" style="left:' + g + '%"></div>';
        goalLine = '<div class="fl-goal-line" style="left:' + g + '%"></div>';
      }

      return '<div class="fl-wrap">' +
        '<div class="fl-rowlabel">where it goes</div>' +
        (goalMark ? '<div class="fl-goalrow">' + goalMark + "</div>" : "") +
        '<div class="fl-track" role="img" aria-label="' + esc(opts.ariaLabel || "") + '">' + top.join("") + goalLine + "</div>" +
        '<div class="fl-rowlabel">how far the measurements reach</div>' +
        '<div class="fl-track fl-track-sub">' + bottom.join("") + "</div>" +
        '<ul class="flow-keys">' + keys.join("") + "</ul>" +
        "</div>";
    }

    /* ---------- The compensation ladder ----------
     * Deliberately NOT a chart of tonnes against the footprint. The Oxford Offsetting
     * Principles exist because a tonne of avoidance credit and a tonne of direct air capture
     * are not the same tonne; drawing them stacked against a footprint would make exactly the
     * claim this app refuses to make. So the scale here is the MIX — how the compensation
     * someone buys is distributed across the ladder — and the axis runs weakest to strongest.
     * The bar answers "what kind", never "how much of my footprint is cancelled", because the
     * answer to the second question is none of it.
     *
     * With nothing bought, the same ladder is drawn faint and evenly spaced as an explainer:
     * the rungs are worth knowing before buying, not after.
     */
    function ladder(opts) {
      var rungs = opts.rungs, total = opts.total || 0, empty = !(total > 0);
      if (!rungs || !rungs.length) return "";
      var segs = rungs.map(function (r) {
        var w = empty ? 100 / rungs.length : (r.t / total) * 100;
        if (w < 1e-6) return "";
        // ink on the pale end, white on the dark end — the ramp crosses over in the middle
        var dark = r.rank >= 4;
        return '<div class="lad-seg' + (empty ? " lad-ghost" : "") + '" data-t="' + (r.t || 0) +
          '" style="width:' + w + '%;background:' + r.color + '" title="' +
          esc(r.label + (empty ? "" : ": " + r.t.toFixed(2) + " t of " + total.toFixed(2) + " t")) + '">' +
          (w >= 24 || (empty && w >= 18)
            ? '<span style="color:' + (dark ? "#fff" : "#141414") + '">' + esc(r.short) +
              (empty ? "" : " · " + Math.round(w) + "%") + "</span>"
            : w >= 9 && !empty
              ? '<span style="color:' + (dark ? "#fff" : "#141414") + '">' + Math.round(w) + "%</span>"
              : "") + "</div>";
      }).join("");

      var keys = rungs.filter(function (r) { return empty || r.t > 0; }).map(function (r) {
        return '<li class="lad-key"><i style="background:' + r.color + '"></i>' +
          '<div><span class="lad-key-head">' + esc(r.label) +
          (empty ? "" : " <b>" + r.t.toFixed(2) + " t</b>") + "</span>" +
          '<span class="lad-key-detail">' + esc(r.examples) + " — <em>storage: " + esc(r.storage) +
          "</em>; risk: " + esc(r.risk) + "</span></div></li>";
      }).join("");

      return '<div class="lad-wrap">' +
        '<div class="lad-axis"><span>prevents emissions elsewhere</span><span>locked away for 1,000+ years</span></div>' +
        '<div class="lad-track" role="img" aria-label="' + esc(opts.ariaLabel || "") + '">' + segs + "</div>" +
        (empty ? "" :
          '<div class="lad-stats">' +
            '<div class="lad-stat"><b>' + Math.round(opts.removalShare * 100) + "%</b><span>removes carbon, rather than preventing emissions somewhere else</span></div>" +
            '<div class="lad-stat"><b>' + Math.round(opts.centuryShare * 100) + "%</b><span>stored for a century or more</span></div>" +
          "</div>") +
        '<ul class="lad-keys">' + keys + "</ul>" +
        "</div>";
    }

    /* The legend carries the bracket too. It used to be explained only in a paragraph under
     * the chart, which meant the one mark people actually ask about was the one mark with no
     * key beside it. A glyph in the legend answers "what is that line" where the question is
     * asked; the paragraph is still there for "how is it calculated", folded away.
     */
    function legend(domains, opts) {
      var out = domains.map(function (d) {
        return '<span class="legend-item"><i style="background:' + d.color + '"></i>' + esc(d.label) + "</span>";
      });
      if (opts && opts.range) {
        out.push('<span class="legend-item legend-range"><i class="legend-bracket" aria-hidden="true">' +
          '<svg viewBox="0 0 14 14" focusable="false"><line x1="7" x2="7" y1="2" y2="12"/>' +
          '<line x1="2.5" x2="11.5" y1="2" y2="2"/><line x1="2.5" x2="11.5" y1="12" y2="12"/></svg></i>' +
          esc(opts.rangeLabel || "80% likely range") + "</span>");
      }
      return out.join("");
    }

    /* ---------- The two-track timeline ----------
     * Fossil fuel propaganda on one side, the climate movement on the other, and the things
     * that happened to everybody on the rail between them.
     *
     * The left column is called what it is. An earlier version headed one row "The Global
     * Climate Coalition" — which is the name an oil and coal lobby gave itself precisely so
     * that anyone repeating it would sound like they were citing a climate body. Repeating a
     * campaign's own framing is not neutrality, it is distribution. The name still appears,
     * in the detail, because a reader has to be able to look it up; it is just no longer the
     * headline. `kind: "knew"` marks the one entry that is evidence about the industry
     * rather than persuasion by it, because a column titled "propaganda" must not quietly
     * relabel a research finding as a campaign.
     *
     * Deliberately NOT to scale. Real calendar spacing would put eleven empty years between
     * 1977 and 1988 and then pile six entries into 2018–2019, which makes the dense part
     * unreadable to buy an accuracy nobody is reading off the picture. One row per entry,
     * grouped under the year it happened, and the caption says so — a timeline that quietly
     * implies even spacing is the sort of thing this app exists to not do.
     *
     * Each row is a <details>: year and headline visible, the substance one tap away. Thirty
     * entries with their detail open is a wall nobody reads to the end of; thirty headlines
     * is a shape you can take in, which is the only thing a chronology is better at than the
     * taxonomy underneath it.
     */
    function timeline(opts) {
      var rows = opts.events.slice(), years = [], byYear = {};
      rows.forEach(function (e) {
        if (!byYear[e.year]) { byYear[e.year] = []; years.push(e.year); }
        byYear[e.year].push(e);
      });
      years.sort(function (a, b) { return a - b; });
      var TRACK = {
        propaganda: ["tl-fp", "fossil fuel propaganda"],
        movement: ["tl-mv", "climate movement"],
        landmark: ["tl-lm", "everyone"]
      };
      /* One <li> per YEAR, with its entries in a nested grid.
       * The first version put the year pills and the entries in one flat grid and let
       * auto-placement sort it out. It does not: an item with an explicit column lands in
       * the next row where that column is free, so every pill drifted away from the rows
       * it labelled and 1988 ended up beside the 1977 entry. Nesting removes the question.
       */
      var out = [];
      years.forEach(function (y) {
        var list = byYear[y].slice().sort(function (a, b) {
          return String(a.at || "").localeCompare(String(b.at || ""));
        });
        out.push('<li class="tl-year"><div class="tl-yearmark"><span>' + y + "</span></div>" +
          '<div class="tl-group">' + list.map(function (e) {
            var t = TRACK[e.track] || TRACK.landmark;
            var side = e.kind === "knew" ? "what they knew" : t[1];
            // The technique is named on the row itself, so the chronology and the taxonomy
            // below it are one argument rather than two lists that happen to share a page.
            var tech = opts.moveLabel
              ? [e.delay, e.technique].filter(Boolean).map(opts.moveLabel).join(" · ") : "";
            return '<div class="tl-row ' + t[0] + (e.kind ? " tl-knew" : "") +
              '" data-track="' + esc(e.track) + '" data-year="' + y + '">' +
              '<details class="tl-item">' +
              '<summary><span class="tl-side">' + esc(side) + "</span>" +
              '<span class="tl-label">' + esc(e.label) + "</span></summary>" +
              // "Why it matters" is the half a reader is actually here for, and buried at the
              // end of a 90-word block it is unreadable on a phone. Split into two paragraphs
              // and labelled, so the card can be skimmed for the point.
              (function () {
                var parts = String(e.detail).split(/\s*Why it matters:\s*/);
                var out = '<p class="tl-detail">' + esc(parts[0]) + "</p>";
                if (parts[1]) out += '<p class="tl-why"><span>why it matters</span> ' + esc(parts[1]) + "</p>";
                return out;
              })() +
              (tech ? '<p class="tl-tech"><span>technique</span> ' + esc(tech) + "</p>" : "") +
              // The citation sits with the claim it supports. There is still a full list
              // under the timeline, but a reader who opens one card should not have to go
              // looking for the one line that tells them where it came from.
              '<p class="tl-src"><span>source</span> ' +
              (opts.cite ? opts.cite(e.source, e.url) : esc(e.source)) + "</p>" +
              "</details></div>";
          }).join("") + "</div></li>");
      });
      return '<div class="tl">' +
        '<ol class="tl-list" aria-label="' + esc(opts.ariaLabel || "timeline") + '">' + out.join("") + "</ol></div>";
    }

    return { render: render, horizontal: horizontal, flow: flow, ladder: ladder,
             timeline: timeline, legend: legend };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.chart = defineChart();
  G.sources["js/chart.js"] = defineChart.toString();
})(typeof window !== "undefined" ? window : globalThis);
