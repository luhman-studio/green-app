/*
 * Sankey diagram, four columns, reading left → right:
 *
 *     what causes it  →  what you do  →  area  →  your whole footprint
 *
 * Nothing between the bands: every column is one continuous stack, so the picture
 * is the arithmetic. Plain SVG, no library.
 *
 * With a baseline (your footprint as you live today) the layout is frozen on that
 * baseline: the scenario is drawn inside the same slots and what you save is left
 * as a dashed "ghost", so before and after can be compared without anything moving.
 */
(function (root) {
  function defineSankey() {
    // The model of the last diagram drawn (see the end of render()). One diagram is on screen
    // at a time, so a single slot is enough, and it saves the app re-deriving the merge.
    var lastModel = null;
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function shorten(t, n) { return t.length > n ? t.slice(0, n - 1) + "…" : t; }
    // the bracket on the far left: short enough to read sideways
    var SHORT_GROUP = { direct: "Fuel you burn", electricity: "Power stations", upstream: "Farms & factories" };

    // one flow band from (x0, y0 … y0+h0) to (x1, y1 … y1+h1)
    function band(x0, y0, h0, x1, y1, h1) {
      var mx = (x0 + x1) / 2;
      return "M" + x0 + "," + y0 +
        "C" + mx + "," + y0 + " " + mx + "," + y1 + " " + x1 + "," + y1 +
        "L" + x1 + "," + (y1 + h1) +
        "C" + mx + "," + (y1 + h1) + " " + mx + "," + (y0 + h0) + " " + x0 + "," + (y0 + h0) + "Z";
    }

    // small items of the same area and cause become one row, named after what is in it
    function mergeSmall(list, limit) {
      var keep = [], small = {};
      list.forEach(function (s) {
        if (s.t >= limit) { keep.push(s); return; }
        var k = s.domain + "|" + s.cause;
        small[k] = small[k] || { domain: s.domain, id: "other-" + s.cause, t: 0, parts: [], cause: s.cause,
          causeLabel: s.causeLabel, causeGroup: s.causeGroup, causeGroupLabel: s.causeGroupLabel };
        small[k].t += s.t;
        small[k].parts.push(s);
      });
      Object.keys(small).forEach(function (k) {
        var g = small[k];
        if (g.t < 0.004) return;
        g.parts.sort(function (a, b) { return b.t - a.t; });
        var names = g.parts.map(function (x) { return x.label.toLowerCase(); });
        g.label = g.parts.length === 1 ? g.parts[0].label
          : g.parts.length === 2 ? g.parts[0].label + " & " + names[1]
          : g.parts[0].label + ", " + names[1] + " & " + (g.parts.length - 2) + " more";
        g.detail = g.parts.map(function (x) { return x.label + " " + x.t.toFixed(2) + " t"; }).join(", ");
        keep.push(g);
      });
      return keep;
    }

    /*
     * opts: domains [{id,label,color}], sources [...], total,
     *       baseline [...] & baselineTotal (optional — freezes the layout and draws the ghost),
     *       goal {value,label}
     */
    /* ---------- the model, shared by both orientations ----------
     * Which rows exist, which area each belongs to, and what each is worth — everything
     * that is true about the diagram before anything is positioned. The horizontal and
     * vertical renderers lay the SAME rows out along different axes, so extracting this
     * is what stops the two pictures ever disagreeing about the arithmetic.
     */
    function buildRows(opts) {
      var domains = opts.domains, total = opts.total;
      var hasBase = !!opts.baseline;
      var baseTotal = hasBase ? opts.baselineTotal : total;

      // the layout follows the baseline, so nothing jumps when a change is ticked
      var limit = baseTotal * 0.012;
      var layoutList = mergeSmall(hasBase ? opts.baseline : opts.sources, limit);
      var nowList = mergeSmall(opts.sources, limit);
      var nowBy = {};
      nowList.forEach(function (s) { nowBy[s.domain + "-" + s.id] = s.t; });
      // The diagram's HEIGHT is a property of today's footprint, so it is counted here —
      // before the scenario gets to add anything. The app reserves a row for everything each
      // lever can add, but a COMBINATION of levers can still produce a merged row no single
      // lever does, and counting those would make the card resize when you tick things.
      var baseRowCount = layoutList.length;
      var known = {};
      layoutList.forEach(function (s) { known[s.domain + "-" + s.id] = true; });
      // anything the scenario adds (e.g. train instead of flights) joins the layout with a 0 baseline
      nowList.forEach(function (s) {
        if (!known[s.domain + "-" + s.id]) {
          var copy = JSON.parse(JSON.stringify(s));
          copy.t = 0;
          layoutList.push(copy);
        }
      });

      var byDomain = {};
      domains.forEach(function (d) { byDomain[d.id] = []; });
      layoutList.forEach(function (s) { if (byDomain[s.domain]) byDomain[s.domain].push(s); });
      var used = domains.filter(function (d) { return byDomain[d.id].length; });
      var sizeOf = function (s) { return Math.max(s.t, nowBy[s.domain + "-" + s.id] || 0); };
      used.forEach(function (d) { byDomain[d.id].sort(function (a, b) { return sizeOf(b) - sizeOf(a); }); });

      var rows = [];
      used.forEach(function (d) {
        byDomain[d.id].forEach(function (s) {
          var key = d.id + "-" + s.id;
          rows.push({ dom: d, src: s, key: key, base: s.t, now: nowBy[key] || 0 });
        });
      });
      if (!rows.length) { lastModel = null; return '<svg viewBox="0 0 10 10" class="sankey"></svg>'; }
      if (!rows.length) return null;
      rows.forEach(function (r, i) { r.i = i; });
      return { rows: rows, used: used, byDomain: byDomain, nowBy: nowBy,
               hasBase: hasBase, baseTotal: baseTotal, baseRowCount: baseRowCount };
    }

    /* Causes, grouped by where the emission physically happens. Ordering needs each row's
     * position along whatever axis it was laid out on, so this runs AFTER positioning and
     * takes `pos` from the rows — which is why it is not part of buildRows().
     */
    function groupCauses(rows) {
      var causes = {};
      rows.forEach(function (r) {
        var c = causes[r.src.cause] = causes[r.src.cause] || { id: r.src.cause, label: r.src.causeLabel,
          group: r.src.causeGroup, groupLabel: r.src.causeGroupLabel, now: 0, base: 0, slot: 0, h: 0, pos: 0, rows: [] };
        c.now += r.now; c.base += r.base; c.slot += r.slot; c.h += r.h; c.pos += r.pos * r.slot; c.rows.push(r);
      });
      var order = { direct: 0, electricity: 1, upstream: 2 };
      var list = Object.keys(causes).map(function (k) { return causes[k]; });
      list.forEach(function (c) { c.pos /= Math.max(c.slot, 1); });
      list.sort(function (a, b) { return ((order[a.group] || 0) - (order[b.group] || 0)) || (a.pos - b.pos); });
      return list;
    }

    // What was drawn, in data form, so the app can build the analysis panel for whatever is
    // picked without re-deriving the merge. Identical for both orientations.
    function buildModel(total, baseTotal, hasBase, rows, causeList, used) {
      return {
        total: total, baseTotal: baseTotal, hasBase: hasBase,
        rows: rows.map(function (r) {
          return { key: r.key, domain: r.dom.id, domainLabel: r.dom.label, color: r.dom.color,
            label: r.src.label, now: r.now, base: r.base, cause: r.src.cause, causeLabel: r.src.causeLabel,
            causeGroup: r.src.causeGroup, causeGroupLabel: r.src.causeGroupLabel, detail: r.src.detail || null,
            srcIds: r.src.parts ? r.src.parts.map(function (x) { return x.id; }) : [r.src.id] };
        }),
        causes: causeList.map(function (c) {
          return { id: c.id, label: c.label, group: c.group, groupLabel: c.groupLabel, now: c.now, base: c.base,
            rowKeys: c.rows.map(function (r) { return r.key; }) };
        }),
        areas: used.map(function (d) {
          return { id: d.id, label: d.label, color: d.color, now: d._now, base: d._base,
            rowKeys: rows.filter(function (r) { return r.dom.id === d.id; }).map(function (r) { return r.key; }) };
        })
      };
    }

    function render(opts) {
      var domains = opts.domains, total = opts.total, goal = opts.goal;
      // Drawn narrower (beside the analysis panel) the whole picture is scaled down, so the
      // labels shrink with it. labelScale enlarges the type in user units to compensate — and
      // enlarges the height a label needs by exactly the same factor, so the rule "a band too
      // thin to hold its label doesn't get one" keeps meaning what it says.
      var lblScale = opts.labelScale || 1;
      var W = 1130, padTop = 46, padBottom = 30 + Math.round((lblScale - 1) * 26);
      var groupX = 20, causeLabelR = 252, causeX = 260, nodeW = 15, actX = 470, areaX = 690, trunkX = 910, trunkW = 26;
      var L = buildRows(opts);
      if (!L) { lastModel = null; return '<svg viewBox="0 0 10 10" class="sankey"></svg>'; }
      var rows = L.rows, used = L.used, nowBy = L.nowBy, hasBase = L.hasBase,
          baseTotal = L.baseTotal, baseRowCount = L.baseRowCount;

      // Every drawn thing carries the row numbers it is part of, so hovering or selecting
      // anything can light up the WHOLE path it belongs to — cause → activity → area →
      // footprint — and not just the two shapes that happen to touch it.
      var keysAttr = function (list) { return ' data-keys="' + list.map(function (r) { return r.i; }).join(" ") + '"'; };
      var pickAttr = function (kind, id) { return ' data-pick="' + kind + ":" + esc(id) + '"'; };

      // EVERY height is exactly its tonnes times one scale. Nothing has a minimum height:
      // a minimum makes a small thing look bigger than it is, and the whole point of this
      // diagram is that the picture IS the arithmetic. What gets dropped instead is the
      // LABEL — a band too thin to hold a line of text is drawn at its true size without one,
      // and hovering or clicking it says what it is.
      var plot = Math.max(360, Math.min(900, baseRowCount * 30));
      var H = plot + padTop + padBottom;   // fixed by the baseline: ticking a change never resizes it

      // Slots are frozen on the baseline, so nothing moves when a change is ticked. A row that
      // shrinks keeps its slot and leaves the difference as a dashed ghost; a row a change makes
      // BIGGER (train instead of flights) gets a slot large enough for its scenario value.
      var slotT = rows.reduce(function (a, r) { return a + Math.max(r.base, r.now); }, 0);
      var scale = plot / Math.max(slotT, 0.001);

      var y = padTop;
      rows.forEach(function (r) {
        r.slot = Math.max(r.base, r.now) * scale;   // tonnes → pixels, one rate for everything
        r.y = y;
        r.h = r.now * scale;                        // and the drawn band is exactly its value
        y += r.slot;
      });
      used.forEach(function (d) {
        var mine = rows.filter(function (r) { return r.dom.id === d.id; });
        d._y = mine[0].y;
        d._slot = mine.reduce(function (a, r) { return a + r.slot; }, 0);
        d._h = mine.reduce(function (a, r) { return a + r.h; }, 0);
        d._now = mine.reduce(function (a, r) { return a + r.now; }, 0);
        d._base = mine.reduce(function (a, r) { return a + r.base; }, 0);
      });
      var trunkY = padTop;
      var trunkH = rows.reduce(function (a, r) { return a + r.h; }, 0);
      var trunkSlot = rows.reduce(function (a, r) { return a + r.slot; }, 0);

      // cause column: one block per cause, grouped by where the emission happens
      var causes = {}, groupsSeen = [];
      rows.forEach(function (r) {
        var c = causes[r.src.cause] = causes[r.src.cause] || { id: r.src.cause, label: r.src.causeLabel, group: r.src.causeGroup,
          groupLabel: r.src.causeGroupLabel, now: 0, base: 0, slot: 0, h: 0, pos: 0, rows: [] };
        c.now += r.now; c.base += r.base; c.slot += r.slot; c.h += r.h; c.pos += r.y * r.slot; c.rows.push(r);
      });
      var order = { direct: 0, electricity: 1, upstream: 2 };
      var causeList = Object.keys(causes).map(function (k) { return causes[k]; });
      causeList.forEach(function (c) { c.pos /= Math.max(c.slot, 1); });
      causeList.sort(function (a, b) { return ((order[a.group] || 0) - (order[b.group] || 0)) || (a.pos - b.pos); });
      var cy = padTop;
      causeList.forEach(function (c) {
        c.y = cy; cy += c.slot;
        var g = groupsSeen[groupsSeen.length - 1];
        if (!g || g.id !== c.group) groupsSeen.push({ id: c.group, label: c.groupLabel || "", y: c.y, h: c.slot });
        else g.h += c.slot;
      });

      // Drawn flipped: the stacks grow upwards from the bottom, so the budget line and
      // the ghost of what you remove sit on top. fy() mirrors a block, ty() a text baseline.
      var fy = function (yTop, h) { return H - padBottom - (yTop - padTop) - h; };
      var ty = function (yy) { return H - padBottom - (yy - padTop); };

      var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" class="sankey' + (hasBase ? " has-ghost" : "") +
        '" style="--lbl:' + lblScale + ";--lbl-dom:" + (1 + (lblScale - 1) * 0.55).toFixed(3) + '" tabindex="0" role="application" aria-roledescription="flow diagram" ' +
        'aria-label="Where your emissions come from. Use the arrow keys to move between bands, Enter to open one in the analysis panel, Escape to let go.">'];
      svg.push('<text class="col-head" x="' + causeLabelR + '" y="18" text-anchor="end">What causes it</text>');
      svg.push('<text class="col-head" x="' + (actX + nodeW + 8) + '" y="18">What you do</text>');
      svg.push('<text class="col-head" x="' + (areaX + nodeW + 8) + '" y="18">Area</text>');
      svg.push('<text class="col-head" x="' + (trunkX + trunkW) + '" y="18" text-anchor="end">Your footprint</text>');

      // where it happens: a bracket per group, left of the cause labels
      groupsSeen.forEach(function (g) {
        if (g.h < 70) return;
        var gy0 = fy(g.y, g.h);
        svg.push('<path class="group-bracket" d="M' + (groupX + 10) + "," + (gy0 + 2) + "H" + groupX + "V" + (gy0 + g.h - 2) + "H" + (groupX + 10) + '"/>');
        svg.push('<text class="group-label" transform="translate(' + (groupX - 3) + "," + (gy0 + g.h / 2) + ') rotate(-90)" text-anchor="middle">' + esc(SHORT_GROUP[g.id] || shorten(g.label.split(" — ")[0], 20)) + "</text>");
      });

      // A line of text needs about this much room. Below it the band is still drawn at its
      // true height — only the label is left off, because a label that overlaps its neighbours
      // is worse than no label, and the tooltip and the insights panel cover it.
      var LABEL_MIN = 13 * lblScale;
      // The gutters between the columns are fixed. Bigger type therefore has to mean fewer
      // characters, or a label walks into the column next to it.
      var chars = function (n) { return Math.max(14, Math.round(n / lblScale)); };
      // the activity column has the tightest gutter (197 units, shared with the value)
      var actChars = lblScale > 1.05 ? 18 : 32;
      // A 0.75 px outline around a 0.3 px band would double its apparent size, which is exactly
      // the distortion this diagram is trying not to commit. Below 2 px, no outline.
      var thin = function (h) { return h < 2 ? " thin" : ""; };
      var pct = function (t) { return Math.round(t / Math.max(total, 0.001) * 100) + "%"; };
      var tipFor = function (name, base, now) {
        return name + ": " + now.toFixed(2) + " t" + (hasBase && base - now > 0.005 ? " — was " + base.toFixed(2) + " t, saves " + (base - now).toFixed(2) + " t" : "");
      };

      // ghosts first: the part of today's footprint the changes remove
      if (hasBase) {
        rows.forEach(function (r) {
          if (r.slot - r.h <= 1.5) return;
          svg.push('<rect class="ghost" x="' + actX + '" y="' + fy(r.y + r.h, r.slot - r.h) + '" width="' + nodeW + '" height="' + (r.slot - r.h) + '" rx="2"/>');
          svg.push('<path class="ghost-band" d="' + band(actX + nodeW, fy(r.y + r.h, r.slot - r.h), r.slot - r.h, areaX, fy(r.y + r.h, r.slot - r.h), r.slot - r.h) + '"/>');
        });
        causeList.forEach(function (c) {
          if (c.slot - c.h <= 1.5) return;
          svg.push('<rect class="ghost" x="' + causeX + '" y="' + fy(c.y + c.h, c.slot - c.h) + '" width="' + nodeW + '" height="' + (c.slot - c.h) + '" rx="2"/>');
        });
        used.forEach(function (d) {
          if (d._slot - d._h <= 1.5) return;
          svg.push('<rect class="ghost" x="' + areaX + '" y="' + fy(d._y + d._h, d._slot - d._h) + '" width="' + nodeW + '" height="' + (d._slot - d._h) + '" rx="2"/>');
        });
        if (trunkSlot - trunkH > 1.5) {
          svg.push('<rect class="ghost ghost-total" x="' + trunkX + '" y="' + fy(trunkY + trunkH, trunkSlot - trunkH) + '" width="' + trunkW + '" height="' + (trunkSlot - trunkH) + '" rx="4" data-tip="' +
            esc("Removed by your changes: " + (baseTotal - total).toFixed(2) + " t of " + baseTotal.toFixed(1) + " t") + '"/>');
        }
      }

      // cause → activity (the one crossing layer: one cause feeds several areas)
      causeList.forEach(function (c) {
        var cursor = c.y;
        var tip = esc(tipFor(c.label, c.base, c.now) + " · " + pct(c.now));
        var cKeys = keysAttr(c.rows), cPick = pickAttr("cause", c.id);
        svg.push('<rect class="nd' + thin(c.h) + " cause-" + c.id + '" x="' + causeX + '" y="' + fy(c.y, Math.max(c.h, 1)) + '" width="' + nodeW + '" height="' + Math.max(c.h, 1) + '" rx="3" fill="#4A463C"' + cKeys + cPick + ' data-tip="' + tip + '"/>');
        if (c.slot >= LABEL_MIN) svg.push('<text class="cause-label cause-' + c.id + (c.now <= 0 ? " gone" : "") + '" x="' + causeLabelR + '" y="' + (ty(c.y + c.slot / 2) + 4) + '" text-anchor="end"' + cKeys + cPick + ' data-tip="' + tip + '">' +
          esc(shorten(c.label, chars(30))) + ' <tspan class="val">' + c.now.toFixed(2) + " t</tspan></text>");
        c.rows.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (r) {
          if (r.h <= 0) return;
          svg.push('<path class="rb' + thin(r.h) + " cause-" + c.id + " src-" + r.key + '" d="' + band(causeX + nodeW, fy(cursor, r.h), r.h, actX, fy(r.y, r.h), r.h) + '" fill="' + r.dom.color +
            '"' + keysAttr([r]) + pickAttr("src", r.key) + ' data-tip="' + esc(r.src.label + " ← " + c.label + ": " + r.now.toFixed(2) + " t") + '"/>');
          cursor += r.h;
        });
      });

      // activity → area (rows stack inside their area block)
      var areaCursor = {};
      rows.forEach(function (r) {
        if (areaCursor[r.dom.id] === undefined) areaCursor[r.dom.id] = r.dom._y;
        var cls = "dom-" + r.dom.id + " src-" + r.key + " cause-" + r.src.cause;
        var tip = esc(tipFor(r.src.label, r.base, r.now) + " · " + pct(r.now) + " · " + r.src.causeLabel +
          (r.src.detail ? " · " + r.src.detail : ""));
        var rKeys = keysAttr([r]), rPick = pickAttr("src", r.key);
        if (r.h > 0) {
          svg.push('<rect class="nd' + thin(r.h) + " " + cls + '" x="' + actX + '" y="' + fy(r.y, r.h) + '" width="' + nodeW + '" height="' + r.h + '" rx="3" fill="' + r.dom.color +
            '"' + rKeys + rPick + ' data-tip="' + tip + '"/>');
          svg.push('<path class="rb' + thin(r.h) + " " + cls + '" d="' + band(actX + nodeW, fy(r.y, r.h), r.h, areaX, fy(areaCursor[r.dom.id], r.h), r.h) + '" fill="' + r.dom.color +
            '"' + rKeys + rPick + ' data-tip="' + tip + '"/>');
          areaCursor[r.dom.id] += r.h;
        }
        if (r.slot >= LABEL_MIN) svg.push('<text class="src-label ' + cls + (r.h <= 0 ? " gone" : "") + '" x="' + (actX + nodeW + 8) + '" y="' + (ty(r.y + r.slot / 2) + 4) + '"' + rKeys + rPick + ' data-tip="' + tip + '">' +
          esc(shorten(r.src.label, actChars)) + ' <tspan class="val">' + (r.h <= 0 ? "gone" : r.now.toFixed(2) + " t") + "</tspan></text>");
      });

      // area → footprint (the trunk stays one solid bar: areas stack inside it)
      var trunkCursor = trunkY;
      used.forEach(function (d) {
        var tip = esc(tipFor(d.label, d._base, d._now) + " · " + pct(d._now));
        var mine = rows.filter(function (r) { return r.dom.id === d.id; });
        var dKeys = keysAttr(mine), dPick = pickAttr("dom", d.id);
        if (d._h > 0) {
          svg.push('<rect class="nd' + thin(d._h) + " dom-" + d.id + '" x="' + areaX + '" y="' + fy(d._y, d._h) + '" width="' + nodeW + '" height="' + d._h + '" rx="3" fill="' + d.color +
            '"' + dKeys + dPick + ' data-tip="' + tip + '"/>');
          svg.push('<path class="rb' + thin(d._h) + " dom-" + d.id + '" d="' + band(areaX + nodeW, fy(d._y, d._h), d._h, trunkX, fy(trunkCursor, d._h), d._h) + '" fill="' + d.color +
            '"' + dKeys + dPick + ' data-tip="' + tip + '"/>');
          trunkCursor += d._h;
        }
        if (d._slot >= LABEL_MIN) svg.push('<text class="dom-label dom-' + d.id + (d._h <= 0 ? " gone" : "") + '" x="' + (areaX + nodeW + 8) + '" y="' + (ty(d._y + d._slot / 2) + 4) + '"' + dKeys + dPick + ' data-tip="' + tip + '">' +
          esc(d.label) + ' <tspan class="val">' + d._now.toFixed(1) + " t</tspan></text>");
      });

      // A band drawn at its true height can be a fraction of a pixel, which is honest but
      // impossible to point at. So each row also gets an invisible strip in the activity column,
      // at least a finger's worth tall, carrying the same tooltip and the same selection. It
      // changes nothing about what you see — only what you can reach.
      rows.forEach(function (r) {
        if (r.slot <= 0 || r.slot >= 10) return;
        var hit = Math.max(r.slot, 10), mid = r.y + r.slot / 2;
        svg.push('<rect class="hit" x="' + (actX - 4) + '" y="' + fy(mid - hit / 2, hit) + '" width="' + (nodeW + 8) + '" height="' + hit + '" fill="transparent"' +
          keysAttr([r]) + pickAttr("src", r.key) + ' data-tip="' + esc(tipFor(r.src.label, r.base, r.now) + " · " + pct(r.now) + " · " + r.src.causeLabel + (r.src.detail ? " · " + r.src.detail : "")) + '"/>');
      });

      // the footprint itself: one solid bar
      // The trunk belongs to every row, so it lights up as the end of whichever path you follow.
      // Hovering the trunk ITSELF is the one exception (see light() in attach): lighting up the
      // whole picture says nothing, so it highlights only itself and opens the overview.
      svg.push('<rect class="nd trunk" x="' + trunkX + '" y="' + fy(trunkY, Math.max(trunkH, 1)) + '" width="' + trunkW + '" height="' + Math.max(trunkH, 1) + '" rx="4"' + keysAttr(rows) + pickAttr("total", "all") + ' data-tip="' +
        esc("Your footprint: " + total.toFixed(1) + " t CO₂e per year" + (hasBase && baseTotal - total > 0.05 ? " — down from " + baseTotal.toFixed(1) + " t" : "")) + '"/>');
      svg.push('<text class="trunk-label" x="' + (trunkX + trunkW) + '" y="' + (H - padBottom + 16 * lblScale) + '" text-anchor="end">' + total.toFixed(1) + " t in total" +
        (hasBase && baseTotal - total > 0.05 ? " · was " + baseTotal.toFixed(1) + " t" : "") + "</text>");

      // the 1.5 °C budget, marked on the total bar, caption in the right gutter
      if (goal) {
        var gy = ty(trunkY + Math.min(goal.value * scale, trunkSlot)); // the same tonnes-to-pixels rate as everything else
        svg.push('<line class="goal-line" x1="' + (trunkX - 16) + '" x2="' + (trunkX + trunkW + 10) + '" y1="' + gy + '" y2="' + gy + '"/>');
        // the gutter right of the trunk is 180 units wide whatever the type size
        var gLabel = lblScale > 1.05 ? (goal.short || goal.label) : goal.label;
        var gSub = total > goal.value
          ? (lblScale > 1.05 ? "over budget" : "above the line: over budget")
          : (lblScale > 1.05 ? "inside the budget" : "you fit inside the budget");
        svg.push('<text class="goal-label" x="' + (trunkX + trunkW + 14) + '" y="' + (gy - 4) + '">' + esc(gLabel + " " + goal.value.toFixed(1) + " t") + "</text>");
        svg.push('<text class="goal-sub" x="' + (trunkX + trunkW + 14) + '" y="' + (gy + 12) + '">' + gSub + "</text>");
      }

      // What was drawn, in data form, so the app can build the insights panel for whatever the
      // person clicks without re-deriving the merge and the stacking. Read it right after render().
      lastModel = buildModel(total, baseTotal, hasBase, rows, causeList, used);

      var notes = ["stacks grow upwards · every band's height is exactly its tonnes — thin ones carry no label, hover or click them"];
      if (hasBase && baseTotal - total > 0.05) notes.unshift("dashed = what your ticked changes remove");
      svg.push('<text class="foot-note" x="' + groupX + '" y="' + (H - 6) + '">' + esc(notes.join(" · ")) + "</text>");

      svg.push("</svg>");
      return svg.join("");
    }

    // one flow band running DOWNWARDS, from (x0 … x0+w0) at y0 to (x1 … x1+w1) at y1
    function vband(x0, w0, y0, x1, w1, y1) {
      var my = (y0 + y1) / 2;
      return "M" + x0 + "," + y0 +
        "C" + x0 + "," + my + " " + x1 + "," + my + " " + x1 + "," + y1 +
        "L" + (x1 + w1) + "," + y1 +
        "C" + (x1 + w1) + "," + my + " " + (x0 + w0) + "," + my + " " + (x0 + w0) + "," + y0 + "Z";
    }

    /* ---------- the same diagram, turned for a phone ----------
     * Read top to bottom: your whole footprint, split into areas → what you do → what causes
     * it. Overview first, detail as you scroll, which is the way a thumb moves.
     *
     * It is a transpose, not a second diagram. buildRows() decides what exists and what each
     * row is worth; only the axis changes. Widths here play the part heights play on a wide
     * screen, and the rule is the same one: every block's width is exactly its tonnes times
     * one scale, no minimum, and a block too narrow for its label goes without one rather
     * than being fattened to fit. Tapping it says what it is.
     *
     * One deliberate simplification: no baseline ghosts. On a phone the "what you removed"
     * story is carried by the sticky area bar above, which shows it far more clearly than a
     * dashed outline three pixels wide ever could.
     */
    function renderVertical(opts) {
      var L = buildRows(opts);
      if (!L) { lastModel = null; return '<svg viewBox="0 0 10 10" class="sankey"></svg>'; }
      var rows = L.rows, used = L.used, total = opts.total;
      var domains = opts.domains;

      /* Deliberately about a screen tall. The first version was 250 units high and tried to
       * fit labels ACROSS blocks that are only as wide as their tonnes — so only the four
       * biggest ever got one. Turning the labels a quarter changes what limits them: a
       * rotated label needs the block to be about 13 units WIDE (one line of type) and reads
       * along its height, which is the axis there is room to spend. So the rows are deep and
       * the diagram takes a screen, which is also the right size for a thing you scroll to.
       */
      var W = 380, pad = 11, plot = W - pad * 2;
      /* The two ribbon bands are NOT the same depth, because they are not doing the same
       * work. Areas feed activities in the same order, so those ribbons run parallel and
       * need only enough depth to read as a join. Activities feed causes across the whole
       * diagram — that is where the crossings are, and crossings need room to be followed.
       * Spending the height where the information is.
       */
      var rowH = 150, bandTop = 64, bandBot = 330, titleH = 17, footH = 15;
      var yArea = titleH + 4, yAct = yArea + rowH + bandTop, yCause = yAct + rowH + bandBot;
      var H = yCause + rowH + footH + 6;

      var slotT = rows.reduce(function (a, r) { return a + Math.max(r.base, r.now); }, 0);
      var scale = plot / Math.max(slotT, 0.001);
      var x = pad;
      rows.forEach(function (r) {
        r.slot = Math.max(r.base, r.now) * scale;
        r.pos = x;                       // left edge of the slot, the vertical twin of r.y
        r.h = r.now * scale;             // the drawn width IS the value
        x += r.slot;
      });
      used.forEach(function (d) {
        var mine = rows.filter(function (r) { return r.dom.id === d.id; });
        d._x = mine[0].pos;
        d._h = mine.reduce(function (a, r) { return a + r.h; }, 0);
        d._now = mine.reduce(function (a, r) { return a + r.now; }, 0);
        d._base = mine.reduce(function (a, r) { return a + r.base; }, 0);
      });
      var causeList = groupCauses(rows);
      var cx = pad;
      causeList.forEach(function (c) { c.x = cx; cx += c.slot; });

      var keysAttr = function (list) { return ' data-keys="' + list.map(function (r) { return r.i; }).join(" ") + '"'; };
      var pickAttr = function (kind, id) { return ' data-pick="' + kind + ":" + esc(id) + '"'; };
      var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" class="sankey sankey-v" role="img" tabindex="0" aria-label="' +
        esc("Your footprint " + total.toFixed(1) + " t, from area down to cause") + '">'];

      var stage = function (yy, txt) {
        svg.push('<text class="v-stage" x="' + pad + '" y="' + yy + '">' + esc(txt) + "</text>");
      };
      /* Labels read bottom-to-top, turned with the diagram. Two limits, and they are
       * different limits: the block must be wide enough for one line of type to sit in
       * (else there is nowhere to put it), and the text is truncated to the block's height,
       * which is what it reads along. Same rule as the wide view in spirit — a block too
       * small for its label is drawn at its true size without one and says what it is when
       * tapped. Nothing is ever widened to make a label fit.
       */
      var blockLabel = function (xx, w, yTop, h, txt, cls) {
        if (w < 13) return;
        var fits = Math.floor((h - 14) / 5.6);
        if (fits < 4) return;
        var cxx = xx + w / 2, cyy = yTop + h / 2;
        svg.push('<text class="' + cls + '" x="' + cxx + '" y="' + cyy + '" transform="rotate(-90 ' +
          cxx.toFixed(2) + " " + cyy.toFixed(2) + ')">' + esc(shorten(txt, fits)) + "</text>");
      };

      stage(titleH - 4, "YOUR FOOTPRINT · " + total.toFixed(1) + " t");
      used.forEach(function (d) {
        var mine = rows.filter(function (r) { return r.dom.id === d.id; });
        if (d._h <= 0) return;
        svg.push('<rect class="v-node" x="' + d._x + '" y="' + yArea + '" width="' + d._h + '" height="' + rowH +
          '" fill="' + d.color + '"' + keysAttr(mine) + pickAttr("dom", d.id) + '><title>' +
          esc(d.label + ": " + d._now.toFixed(2) + " t") + "</title></rect>");
        blockLabel(d._x, d._h, yArea, rowH, d.label, "v-lab-on");
      });

      stage(yAct - 6, "WHAT YOU DO");
      rows.forEach(function (r) {
        if (r.h <= 0) return;
        svg.push('<path class="v-band" d="' + vband(r.pos, r.h, yArea + rowH, r.pos, r.h, yAct) + '" fill="' + r.dom.color +
          '"' + keysAttr([r]) + pickAttr("src", r.key) + "/>");
        svg.push('<rect class="v-node" x="' + r.pos + '" y="' + yAct + '" width="' + r.h + '" height="' + rowH +
          '" fill="' + r.dom.color + '"' + keysAttr([r]) + pickAttr("src", r.key) + '><title>' +
          esc(r.src.label + ": " + r.now.toFixed(2) + " t") + "</title></rect>");
        blockLabel(r.pos, r.h, yAct, rowH, r.src.label, "v-lab-on");
      });

      stage(yCause - 6, "WHAT CAUSES IT");
      causeList.forEach(function (c) {
        if (c.h <= 0) return;
        var off = 0;
        c.rows.forEach(function (r) {
          if (r.h <= 0) return;
          svg.push('<path class="v-band" d="' + vband(r.pos, r.h, yAct + rowH, c.x + off, r.h, yCause) + '" fill="' +
            r.dom.color + '"' + keysAttr([r]) + pickAttr("cause", c.id) + "/>");
          off += r.h;
        });
        svg.push('<rect class="v-node v-cause" x="' + c.x + '" y="' + yCause + '" width="' + c.h + '" height="' + rowH +
          '"' + keysAttr(c.rows) + pickAttr("cause", c.id) + '><title>' +
          esc(c.label + ": " + c.now.toFixed(2) + " t · " + c.groupLabel) + "</title></rect>");
        blockLabel(c.x, c.h, yCause, rowH, c.label, "v-lab-off");
      });

      svg.push('<text class="foot-note" x="' + pad + '" y="' + (H - 4) + '">' +
        esc("every block's width is exactly its tonnes — tap a thin one to see what it is") + "</text>");
      svg.push("</svg>");

      lastModel = buildModel(total, L.baseTotal, L.hasBase, rows, causeList, used);
      return svg.join("");
    }

    /*
     * Hover and click.
     *
     * Highlighting follows the WHOLE path, not the shapes that happen to touch. Every element
     * carries the row numbers it belongs to (data-keys), so hovering an activity lights up the
     * cause that produced it, the band into it, the band out of it, its area and the trunk —
     * the complete left-to-right route — and everything else dims.
     *
     * Clicking pins that path and tells the app what was picked, so it can open the insights
     * panel below. Clicking the same thing again, or the empty space, lets go.
     *
     * opts: { selected: "<kind>:<id>" | null, onSelect: function (pick | null) }
     */
    function attach(container, tooltip, opts) {
      opts = opts || {};
      var svg = container.querySelector(".sankey");
      if (!svg) return;
      var nodes = Array.prototype.slice.call(svg.querySelectorAll("[data-keys]"));
      var keysOf = nodes.map(function (n) {
        var v = n.getAttribute("data-keys"), set = {};
        if (v) v.split(" ").forEach(function (k) { set[k] = true; });
        return set;
      });
      var indexOf = function (el) { return nodes.indexOf(el); };

      var selected = opts.selected || null;
      var tell = typeof opts.onSelect === "function" ? opts.onSelect : function () {};

      var strip = function () {
        svg.classList.remove("active");
        Array.prototype.forEach.call(svg.querySelectorAll(".hi, .sel"), function (n) { n.classList.remove("hi", "sel"); });
      };
      // light up everything that shares a row with this element (and the element itself)
      var light = function (el, pinned) {
        strip();
        svg.classList.add("active");
        var i = indexOf(el);
        // the trunk is part of every path, so following ITS path would light up everything
        var whole = (el.getAttribute("data-pick") || "").indexOf("total:") === 0;
        var mine = (i >= 0 && !whole) ? keysOf[i] : {};
        var any = false;
        Object.keys(mine).forEach(function () { any = true; });
        nodes.forEach(function (n, j) {
          var hit = n === el;
          if (!hit && any) {
            for (var k in keysOf[j]) { if (mine[k]) { hit = true; break; } }
          }
          if (hit) n.classList.add("hi");
        });
        if (pinned) {
          var pick = el.getAttribute("data-pick");
          Array.prototype.forEach.call(svg.querySelectorAll('[data-pick="' + pick + '"]'), function (n) { n.classList.add("sel"); });
        }
      };
      var pinnedEl = function () {
        return selected ? svg.querySelector('[data-pick="' + selected + '"]') : null;
      };
      // back to whatever is pinned, or to nothing
      var restore = function () {
        var el = pinnedEl();
        if (el) light(el, true); else strip();
        tooltip.hidden = true;
      };

      // show the tooltip at a point in the container, or centred on an element
      var showTip = function (el, x, y) {
        tooltip.textContent = el.getAttribute("data-tip");
        tooltip.hidden = false;
        var box = container.getBoundingClientRect();
        if (x == null) { var r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
        tooltip.style.left = Math.min(Math.max(8, x - box.left + 12), Math.max(8, box.width - 260)) + "px";
        tooltip.style.top = Math.max(4, y - box.top + 12) + "px";
      };

      svg.addEventListener("mousemove", function (ev) {
        var el = ev.target.closest("[data-tip]");
        if (!el) { restore(); return; }
        light(el, el.getAttribute("data-pick") === selected);
        showTip(el, ev.clientX, ev.clientY);
      });
      svg.addEventListener("mouseleave", restore);

      var byMouse = false;
      svg.addEventListener("mousedown", function () { byMouse = true; setTimeout(function () { byMouse = false; }, 0); });
      svg.addEventListener("click", function (ev) {
        var el = ev.target.closest("[data-pick]");
        var pick = el ? el.getAttribute("data-pick") : null;
        selected = (!pick || pick === selected) ? null : pick;   // click again to let go
        if (pick) syncIndex(pick);                               // so the arrow keys carry on from here
        restore();
        tell(selected);
      });

      /* ---------- keyboard ----------
       * The diagram is one tab stop, not two hundred. Inside it the arrow keys walk the
       * picture the way it reads: up and down within a column, left and right between the
       * four columns, landing on whatever sits nearest the height you were already at.
       * Enter opens it in the analysis panel, Escape lets go. Every move speaks its label
       * through the same live region the rest of the page uses, so this works unseen.
       */
      var ORDER = ["cause", "src", "dom", "total"];
      var cols = ORDER.map(function (kind) {
        var seen = {}, out = [];
        Array.prototype.forEach.call(svg.querySelectorAll('[data-pick^="' + kind + ':"]'), function (n) {
          var p = n.getAttribute("data-pick");
          if (seen[p]) return;
          if (n.classList.contains("hit") && svg.querySelector('rect.nd[data-pick="' + p + '"]')) return;
          seen[p] = true; out.push(n);
        });
        return out.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      });
      var mid = function (el) { var r = el.getBoundingClientRect(); return r.top + r.height / 2; };
      var ci = 1, ri = 0;   // start on "what you do" — the column the changes act on
      var cur = function () { return (cols[ci] || [])[ri] || null; };
      var speak = function (el) {
        if (opts.live && el) opts.live.textContent = el.getAttribute("data-tip") || "";
      };
      var goTo = function (el) {
        if (!el) return;
        light(el, el.getAttribute("data-pick") === selected);
        showTip(el);
        speak(el);
      };
      var syncIndex = function (pick) {
        cols.forEach(function (list, k) {
          list.forEach(function (n, i) { if (n.getAttribute("data-pick") === pick) { ci = k; ri = i; } });
        });
      };
      // pick up wherever the app left us (the SVG is rebuilt on every change)
      if (opts.focus) syncIndex(opts.focus);

      svg.addEventListener("focus", function () {
        if (byMouse) return;                       // a click already said where we are
        if (!cur()) { ci = 1; ri = 0; }
        goTo(cur());
        if (typeof opts.onFocus === "function") opts.onFocus(cur() && cur().getAttribute("data-pick"));
      });
      svg.addEventListener("blur", function () { restore(); });

      svg.addEventListener("keydown", function (ev) {
        var k = ev.key, list = cols[ci] || [], el = cur();
        if (k === "Escape") {
          if (!selected) return;
          selected = null; restore(); tell(null);
          if (el) goTo(el);
          ev.preventDefault(); return;
        }
        if (k === "Enter" || k === " " || k === "Spacebar") {
          if (!el) return;
          var pick = el.getAttribute("data-pick");
          selected = pick === selected ? null : pick;
          restore(); tell(selected); goTo(el);
          ev.preventDefault(); return;
        }
        if (k === "ArrowDown" || k === "ArrowUp") {
          if (!list.length) return;
          ri = Math.min(list.length - 1, Math.max(0, ri + (k === "ArrowDown" ? 1 : -1)));
        } else if (k === "ArrowRight" || k === "ArrowLeft") {
          var want = el ? mid(el) : 0;
          var next = ci + (k === "ArrowRight" ? 1 : -1);
          while (next >= 0 && next < cols.length && !cols[next].length) next += (k === "ArrowRight" ? 1 : -1);
          if (next < 0 || next >= cols.length) return;
          ci = next;
          ri = 0;                                   // land nearest the height we were at
          cols[ci].forEach(function (n, i) { if (Math.abs(mid(n) - want) < Math.abs(mid(cols[ci][ri]) - want)) ri = i; });
        } else if (k === "Home") { ri = 0; }
        else if (k === "End") { ri = Math.max(0, list.length - 1); }
        else return;
        ev.preventDefault();
        goTo(cur());
        if (typeof opts.onFocus === "function") opts.onFocus(cur() && cur().getAttribute("data-pick"));
      });

      restore();
    }

    // what the app needs to describe whatever was clicked (see the end of render())
    function model() { return lastModel; }

    return { render: render, renderVertical: renderVertical, attach: attach, model: model, mergeSmall: mergeSmall };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.sankey = defineSankey();
  G.sources["js/sankey.js"] = defineSankey.toString();
})(typeof window !== "undefined" ? window : globalThis);
