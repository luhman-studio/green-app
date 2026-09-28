/*
 * User interface: tabs, guided chat, answer list, results and code viewer.
 * All maths lives in engine.js — this file only moves data around.
 */
(function (root) {
  function defineApp(G, doc) {
    var F = G.factors, B = G.benchmarks, Q = G.questions, E = G.engine;
    var STORE_KEY = "greenapp.v3"; // bump when the profile structure changes
    var $ = function (id) { return doc.getElementById(id); };

    // The uncertainty range is a 4,000-sample Monte Carlo — the most expensive thing the app
    // does, and identical until an answer changes. Keyed on the answers themselves, so it
    // cannot go stale: nothing has to remember to clear it.
    var simMemo = { key: null, value: null };
    function simulate(p) {
      var key = JSON.stringify(p);
      if (simMemo.key !== key) simMemo = { key: key, value: E.simulate(p, { samples: 4000, seed: 42 }) };
      return simMemo.value;
    }

    function freshState() { return { profile: Q.blankProfile(), answered: {}, order: {}, seq: 0, finished: false, currentId: null }; }
    var state = freshState();
    var leverFilter = "all";
    var picked = {}; // lever ids ticked in the Potential tab
    /* The "why this works" fold is now closed at every width, and the whole list is rebuilt
     * from innerHTML on every tick — so without this, opening one fold and then ticking any
     * change would slam it shut again. Remembering it per lever is what makes the fold a
     * place to read rather than a thing that keeps collapsing. */
    var whyOpen = {};
    // Two diagrams now exist — one per tab — so everything about "which band is held open"
    // is per page. On Details the pin opens the analysis; on Potential it narrows the list of
    // changes to the ones that shrink that band.
    var pinned = { det: null, pot: null };   // "<kind>:<id>", survives redraws
    var focusedBand = { det: null, pot: null };   // where the keyboard is inside each diagram
    var chartModel = { det: null, pot: null };    // what each diagram drew, captured at render
    // When a selection is carried from Details to Potential, the two diagrams are drawn from
    // different profiles — Details from what you measured, Potential from what you ticked — so
    // a merged row that exists in one may not exist in the other. This is where to land instead.
    var potPinFallback = null;

    // ---------- persistence (optional; silently skipped if blocked) ----------
    function save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ profile: state.profile, answered: state.answered, order: state.order, seq: state.seq })); } catch (e) {}
    }
    function load() {
      try {
        var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
        if (s && s.profile) { state.profile = s.profile; state.answered = s.answered || {}; state.order = s.order || {}; state.seq = s.seq || 0; return true; }
      } catch (e) {}
      return false;
    }

    // ---------- helpers ----------
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function stepById(id) { return Q.steps.filter(function (s) { return s.id === id; })[0]; }
    function isSkipped(s) { return s.skip && s.skip(state.profile); }
    function activeSteps() { return Q.steps.filter(function (s) { return !isSkipped(s); }); }
    function nextStep() { return activeSteps().filter(function (s) { return !state.answered[s.id]; })[0]; }
    function fmtT(v) { return v.toFixed(1) + " t"; }
    /* ---------- the three layers ----------
     * Everything on a card is one of three things, and the markup says which:
     *   1 the answer      — a number and a label, or a chip carrying a caveat (flagRow)
     *   2 the meaning     — one sentence, <p class="layer2">, and only one
     *   3 the reasoning   — a <details class="fold"> with a question for a summary (fold)
     * Nothing here deletes text. A caveat that used to be a clause is a chip in layer 1 and
     * the clause itself is still in layer 3, next to the number it qualifies rather than
     * moved to the method page, where a reader who wanted it would never find it.
     */
    function flagRow(list) {
      return list.map(function (f) { return '<li class="flag ' + (f[1] || "") + '">' + esc(f[0]) + "</li>"; }).join("");
    }
    function fold(question, html) {
      return '<details class="fold"><summary>' + esc(question) + "</summary>" + html + "</details>";
    }
    function val(x) { return typeof x === "function" ? x(state.profile) : x; }
    function button(label, cls, onclick, aria) {
      var b = el("button", cls || "chip", esc(label));
      b.type = "button"; b.onclick = onclick;
      if (aria) b.setAttribute("aria-label", aria);
      return b;
    }
    function parseNum(raw) { raw = String(raw).trim().replace(/\s/g, "").replace(",", "."); return raw === "" ? null : Number(raw); }

    function say(text, who) {
      var m = el("div", "msg new " + (who || "bot"));
      m.textContent = text;
      setTimeout(function () { m.classList.remove("new"); }, 300); // don't replay when switching tabs
      $("messages").appendChild(m);
      $("messages").scrollTop = $("messages").scrollHeight;
    }

    // ---------- tabs ----------
    var TABS = { measure: ["panelMeasure", "tabMeasure"], results: ["panelResults", "tabResults"],
                 details: ["panelDetails", "tabDetails"], potential: ["panelPotential", "tabPotential"] };
    function showTab(name) {
      Object.keys(TABS).forEach(function (k) {
        var on = k === name;
        $(TABS[k][0]).hidden = !on;
        $(TABS[k][1]).setAttribute("aria-selected", on ? "true" : "false");
      });
      if (name === "potential") renderPotential();
      if (name === "details") renderDetails();
      root.scrollTo({ top: 0, behavior: "smooth" });
    }

    // ---------- back button ----------
    function previousAnswered(currentId) {
      var steps = activeSteps(), idx = steps.findIndex(function (s) { return s.id === currentId; });
      if (idx < 0) idx = steps.length;
      for (var i = idx - 1; i >= 0; i--) if (state.answered[steps[i].id]) return steps[i];
      return null;
    }
    function backButton(step, sameStep) {
      var prev = sameStep ? step : previousAnswered(step.id);
      var b = button("←", "btn-back", function () {
        if (!sameStep) { delete state.answered[prev.id]; renderProfile(); save(); }
        say("Going back.");
        ask(prev);
      }, "Back to the previous question");
      if (!prev) { b.disabled = true; b.classList.add("invisible"); }
      return b;
    }

    // ---------- chat flow ----------
    function periodSelect(periods, def) {
      var s = el("select", "period");
      periods.forEach(function (o, i) {
        var opt = doc.createElement("option");
        opt.value = String(i); opt.textContent = o[0];
        if (i === def) opt.selected = true;
        s.appendChild(opt);
      });
      return s;
    }

    // highlight the key word so the question can be scanned instead of read
    function withKeyword(text, keyword) {
      var out = esc(text);
      if (!keyword) return out;
      var k = esc(keyword), i = out.toLowerCase().indexOf(k.toLowerCase());
      return i < 0 ? out : out.slice(0, i) + "<strong>" + out.slice(i, i + k.length) + "</strong>" + out.slice(i + k.length);
    }

    function askBubble(step) {
      var m = el("div", "msg new bot");
      var w = Q.WEIGHT[step.weight] || Q.WEIGHT.medium;
      var head = el("div", "q-head",
        '<span class="section">' + esc(step.section || "") + "</span>" +
        '<span class="pill w-' + step.weight + '" title="' + esc(w.hint) + '">' + esc(w.label) + "</span>");
      m.appendChild(head);
      m.appendChild(el("div", "q", withKeyword(val(step.ask), step.keyword)));
      var h = val(step.help);
      if (h) m.appendChild(el("div", "help", esc(h) + ' <span class="w-hint">' + esc(w.hint) + "</span>"));
      else m.appendChild(el("div", "help", '<span class="w-hint">' + esc(w.hint) + "</span>"));
      setTimeout(function () { m.classList.remove("new"); }, 300);
      $("messages").appendChild(m);
      $("messages").scrollTop = $("messages").scrollHeight;
    }

    function ask(step) {
      state.currentId = step.id;
      askBubble(step);
      var c = $("controls");
      c.innerHTML = "";
      var err = el("div", "error");

      if (step.type === "choice") {
        var chips = el("div", "chips");
        val(step.options).forEach(function (o) {
          chips.appendChild(button(o[0], "chip", function () { answer(step, o[1], o[0]); }));
        });
        c.appendChild(chips);
        var nav = el("div", "nav"); nav.appendChild(backButton(step)); c.appendChild(nav);

      } else if (step.type === "number" || step.type === "amount") {
        var chipsN = el("div", "chips");
        (step.presets || []).forEach(function (o) {
          chipsN.appendChild(button(o[0], "chip", function () {
            answer(step, { v: o[1], c: "estimate" }, o[0] + (step.unit && o[1] && !/[a-z²]/i.test(o[0]) ? " " + step.unit : ""));
          }));
        });
        if (step.dontKnow) chipsN.appendChild(button("I don’t know", "chip secondary", function () { answer(step, { v: null, c: "guess" }, "I don’t know"); }));
        if (chipsN.children.length) c.appendChild(chipsN);
        var row = el("form", "num-row");
        row.appendChild(backButton(step));
        var input = el("input"); input.type = "text"; input.inputMode = "decimal"; input.placeholder = "Type a number";
        input.setAttribute("aria-label", "Your answer");
        row.appendChild(input);
        var units = step.type === "amount" ? val(step.units) : null, sel = null;
        if (units) { sel = periodSelect(units, step.defaultUnit || 0); row.appendChild(sel); }
        else row.appendChild(el("span", "unit", esc(step.unit)));
        var send = el("button", "btn-primary", "Send"); send.type = "submit"; row.appendChild(send);
        row.onsubmit = function (ev) {
          ev.preventDefault();
          var v = parseNum(input.value);
          if (v == null || !isFinite(v) || v < 0) { err.textContent = "Please enter a number."; return; }
          var label, yearly;
          if (units) {
            var u = units[Number(sel.value)];
            yearly = v * u[1];
            label = v.toLocaleString("en-US") + " " + u[0];
          } else {
            if (v < step.min || v > step.max) { err.textContent = "Please enter a number between " + step.min + " and " + step.max.toLocaleString("en-US") + "."; return; }
            if (step.integer) v = Math.round(v);
            yearly = v; label = v.toLocaleString("en-US") + " " + step.unit;
          }
          if (step.askConfidence) askConfidence(step, yearly, label);
          else answer(step, { v: yearly, c: "estimate" }, label);
        };
        c.appendChild(row);
        focusSoon(input);

      } else if (step.type === "multi") {
        var chosen = {};
        var current = step.id === "foodSelect" ? state.profile.food.selected : step.id === "offsetsTypes" ? state.profile.offsets.types : [];
        current.forEach(function (k) { chosen[k] = true; });
        var opts = val(step.options), chipsM = el("div", "chips");
        opts.forEach(function (o) {
          var b = button(o[0], "chip toggle" + (chosen[o[1]] ? " on" : ""), function () {
            chosen[o[1]] = !chosen[o[1]];
            b.classList.toggle("on", !!chosen[o[1]]);
            b.setAttribute("aria-pressed", chosen[o[1]] ? "true" : "false");
          });
          b.setAttribute("aria-pressed", chosen[o[1]] ? "true" : "false");
          chipsM.appendChild(b);
        });
        c.appendChild(chipsM);
        var navM = el("div", "nav");
        navM.appendChild(backButton(step));
        var right = el("div", "nav-right");
        if (step.noneLabel) right.appendChild(button(step.noneLabel, "chip secondary", function () { answer(step, [], step.noneLabel); }));
        right.appendChild(button("Continue", "btn-primary", function () {
          var list = opts.map(function (o) { return o[1]; }).filter(function (k) { return chosen[k]; });
          if (!list.length) { err.textContent = step.noneLabel ? "Select at least one, or tap “" + step.noneLabel + "”." : "Select at least one."; return; }
          answer(step, list, opts.filter(function (o) { return chosen[o[1]]; }).map(function (o) { return o[0].split(" — ")[0]; }).join(", "));
        }));
        navM.appendChild(right);
        c.appendChild(navM);

      } else if (step.type === "freqGrid") {
        // with more than three options the buttons need their own line under the label
        var grid = el("div", "grid-form" + (step.options.length > 3 ? " stacked" : "")), picks = {};
        val(step.rows).forEach(function (r) {
          picks[r.id] = r.value;
          var line = el("div", "grid-row");
          line.appendChild(el("div", "grid-label", esc(r.label) + (r.hint ? "<small>" + esc(r.hint) + "</small>" : "")));
          var group = el("div", "seg");
          step.options.forEach(function (o) {
            var b = button(o[0], "seg-btn" + (o[1] === r.value ? " on" : ""), function () {
              picks[r.id] = o[1];
              err.textContent = "";
              Array.prototype.forEach.call(group.children, function (x) { x.classList.remove("on"); });
              b.classList.add("on");
            });
            group.appendChild(b);
          });
          line.appendChild(group);
          grid.appendChild(line);
        });
        c.appendChild(grid);
        var navG = el("div", "nav");
        navG.appendChild(backButton(step));
        navG.appendChild(button("Continue", "btn-primary", function () {
          var missing = Object.keys(picks).filter(function (k) { return !picks[k]; });
          if (missing.length) { err.textContent = "Please answer every line (" + missing.length + " left)."; return; }
          answer(step, picks, "Done");
        }));
        c.appendChild(navG);

      } else if (step.type === "form") {
        var form = el("form", "grid-form"), fields = [];
        val(step.rows).forEach(function (r) {
          var line = el("label", "grid-row");
          line.appendChild(el("div", "grid-label", esc(r.label)));
          var box = el("div", "amount");
          var inp = el("input");
          inp.type = "text";
          var cur = currentValue(r.id);
          if (r.type === "text") { inp.placeholder = r.placeholder || ""; if (cur) inp.value = cur; box.appendChild(inp); fields.push({ r: r, inp: inp }); }
          else {
            inp.inputMode = "decimal"; inp.placeholder = "0";
            var def = r.defaultPeriod || 0;
            // when changing an answer, show the stored value converted to the row's default period
            if (cur > 0) inp.value = +(cur * F.perYear[r.per || "year"] / F.perYear[r.periods[def][1]]).toFixed(2);
            box.appendChild(el("span", "unit", esc(r.unit)));
            box.appendChild(inp);
            var ps = r.periods.length > 1 ? periodSelect(r.periods, def) : null;
            if (ps) box.appendChild(ps); else box.appendChild(el("span", "unit", esc(r.periods[0][0])));
            var ex = null;
            if (r.extra) {
              ex = periodSelect(r.extra.options, 0);
              ex.classList.add("extra");
              ex.setAttribute("aria-label", r.label + " – " + r.extra.label);
              var curEx = state.profile.goods.secondHand && state.profile.goods.secondHand[r.id];
              r.extra.options.forEach(function (o, i) { if (o[1] === curEx) ex.value = String(i); });
              box.appendChild(ex);
            }
            fields.push({ r: r, inp: inp, ps: ps, ex: ex });
          }
          line.appendChild(box);
          form.appendChild(line);
        });
        var navF = el("div", "nav");
        navF.appendChild(backButton(step));
        var sendF = el("button", "btn-primary", "Continue"); sendF.type = "submit";
        navF.appendChild(sendF);
        form.appendChild(navF);
        form.onsubmit = function (ev) {
          ev.preventDefault();
          var out = {}, parts = [], bad = false;
          fields.forEach(function (f) {
            if (f.r.type === "text") { out[f.r.id] = f.inp.value.trim(); if (out[f.r.id]) parts.push(out[f.r.id]); return; }
            if (f.ex) out[f.r.id + "__extra"] = f.r.extra.options[Number(f.ex.value)][1];
            var v = parseNum(f.inp.value);
            if (v == null) { out[f.r.id] = 0; return; }
            if (!isFinite(v) || v < 0) { bad = true; return; }
            var period = f.ps ? f.r.periods[Number(f.ps.value)] : f.r.periods[0];
            // canonical unit: per year, unless the row says otherwise (e.g. hours per day)
            out[f.r.id] = v * F.perYear[period[1]] / F.perYear[f.r.per || "year"];
            if (v) parts.push(f.r.label.split(" (")[0] + ": " + v.toLocaleString("en-US") + " " + f.r.unit + " " + period[0] +
              (f.ex && out[f.r.id + "__extra"] !== "new" ? " (" + f.r.extra.options[Number(f.ex.value)][0] + ")" : ""));
          });
          if (bad) { err.textContent = "Please enter numbers only."; return; }
          answer(step, out, parts.length ? parts.join(" · ") : "Nothing");
        };
        c.appendChild(form);
        focusSoon(form.querySelector("input"));
      }
      c.appendChild(err);
    }

    function currentValue(id) {
      var p = state.profile, places = [p.goods, p.services, p.digital, p.offsets, p.money];
      for (var i = 0; i < places.length; i++) if (places[i] && id in places[i]) return places[i][id];
      return null;
    }

    function focusSoon(input) {
      setTimeout(function () { if (input && root.matchMedia && root.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true }); }, 0);
    }

    function askConfidence(step, v, label) {
      say(label, "user");
      say("How sure are you about that number?");
      var c = $("controls");
      c.innerHTML = "";
      var chips = el("div", "chips");
      [["Exact (from a bill or meter)", "exact"], ["Good estimate", "estimate"], ["Rough guess", "guess"]].forEach(function (o) {
        chips.appendChild(button(o[0], "chip", function () { answer(step, { v: v, c: o[1] }, o[0]); }));
      });
      c.appendChild(chips);
      var nav = el("div", "nav"); nav.appendChild(backButton(step, true)); c.appendChild(nav);
    }

    function answer(step, value, label) {
      say(label, "user");
      step.apply(state.profile, value);
      state.answered[step.id] = true;
      state.order[step.id] = ++state.seq;
      // answers that depend on this one must be asked again (e.g. new foods need a frequency)
      (step.resets || []).forEach(function (id) { delete state.answered[id]; });
      save();
      renderProfile();
      advance();
    }

    function advance() {
      $("controls").innerHTML = "";
      var s = nextStep();
      if (s) { ask(s); return; }
      state.currentId = null;
      var first = !state.finished;
      state.finished = true;
      $("tabResults").disabled = false;
      $("tabDetails").disabled = false;
      $("tabPotential").disabled = false;
      showResults();
      if (first) {
        say("Thanks — that’s everything! Your result is in the Results tab. You can come back here any time and tap an answer to change it.");
        showTab("results");
      } else {
        say("Updated your result.");
      }
      var nav = el("div", "nav");
      nav.appendChild(button("See my results →", "btn-primary", function () { showTab("results"); }));
      $("controls").appendChild(nav);
    }

    function edit(id) {
      var s = stepById(id);
      delete state.answered[id];
      showTab("measure");
      say("Sure, let’s change that.");
      renderProfile();
      ask(s);
    }

    // ---------- answer list (newest first) ----------
    function renderProfile() {
      var list = $("profileList");
      list.innerHTML = "";
      var colors = {};
      B.domains.forEach(function (d) { colors[d.id] = d.color; });
      var items = activeSteps().filter(function (s) { return state.answered[s.id]; })
        .sort(function (a, b) { return (state.order[b.id] || 0) - (state.order[a.id] || 0); });
      items.forEach(function (s) {
        var b = el("button", "answer", '<i style="background:' + (colors[s.domain] || "#fff") + '"></i><span class="txt">' + esc(s.summary(state.profile)) + '</span><span class="chg">change</span>');
        b.type = "button";
        b.onclick = function () { edit(s.id); };
        list.appendChild(b);
      });
      var all = activeSteps(), done = all.filter(function (s) { return state.answered[s.id]; }).length;
      $("progressBar").style.width = Math.round((done / all.length) * 100) + "%";
      $("progressText").textContent = done + " of " + all.length + " answered · newest on top · tap to change";
    }

    // ---------- results ----------
    var CONTROL = {
      yours: ["In your hands", "c-yours"], partly: ["Partly in your hands", "c-partly"], later: ["When you replace it", "c-partly"],
      shared: ["Needs co-owners", "c-shared"], landlord: ["Talk to your landlord", "c-shared"], hard: ["Hard for you right now", "c-hard"],
      // "big" is in your hands too — it is flagged separately because it changes how you live,
      // not because someone else decides. "Reach the goal" only uses these once the rest run out.
      big: ["A big change, but yours", "c-big"], unknown: ["", "c-hard"]
    };

    function showResults() {
      var p = state.profile;
      var r = E.calculate(p);
      var sim = simulate(p);
      var tip = E.biggestUncertainty(p, { samples: 1500, seed: 7 });
      var at = B.austria, target = B.targets.y2030.value;

      $("headline").textContent = r.total.toFixed(1) + " t CO₂e per year";
      // On a phone the hero repeats this number one line further down, so the header drops it.
      doc.body.classList.add("has-result");
      $("resTotal").textContent = r.total.toFixed(1) + " t CO₂e / year";
      $("printDate").textContent = "· " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + " · factors " + F.version;

      var diff = (r.total - at.total) / at.total;
      var cmp = Math.abs(diff) < 0.03 ? "About the same as the Austrian average"
              : "About " + Math.round(Math.abs(diff) * 100) + "% " + (diff < 0 ? "below" : "above") + " the Austrian average";
      var ratio = r.total / target;
      cmp += ratio <= 1 ? " — and within the 2030 Paris goal of " + fmtT(target) + "." : " — and " + ratio.toFixed(1) + "× the 2030 Paris goal of " + fmtT(target) + ".";
      $("resCompare").textContent = cmp;

      var pct = Math.round(((sim.high - sim.low) / 2 / r.total) * 100);
      $("resRange").innerHTML = "<strong>80% likely between " + sim.low.toFixed(1) + " and " + sim.high.toFixed(1) + " t</strong> (about ±" + pct + "%). The range comes from your “how sure” answers and the uncertainty of each emission factor.";

      var tipMap = {
        "input.heat": ["your heating energy", "heatAmount"], "input.area": ["your home size", "area"], "input.electricity": ["your electricity use", "electricity"],
        "input.carKm": ["your car travel", "carKm"], "input.trainHours": ["your time on trains", "trainTime"], "input.cityHours": ["your time on buses, trams & metro", "cityTime"]
      };
      $("resTip").innerHTML = "";
      if (tip && tipMap[tip.key]) {
        var t = el("div", "tip", "Biggest uncertainty: <strong>" + tipMap[tip.key][0] + "</strong>. A more exact number would narrow your range by about " + tip.gain.toFixed(1) + " t.<br>");
        t.appendChild(button("Refine this answer", "chip", function () { edit(tipMap[tip.key][1]); }));
        $("resTip").appendChild(t);
      }

      $("chart").innerHTML = G.chart.render({
        domains: B.domains,
        bars: [
          { label: "You", total: r.total, byDomain: r.byDomain, isYou: true },
          { label: at.label, total: at.total, byDomain: at.byDomain },
          { label: B.world.label, total: B.world.total, byDomain: B.world.byDomain }
        ],
        target: B.targets.y2030,
        range: sim
      });
      $("legend").innerHTML = G.chart.legend(B.domains, {
        range: true,
        rangeLabel: "80% likely range · " + sim.low.toFixed(1) + "–" + sim.high.toFixed(1) + " t"
      });

      // By area: your value with range, the Austrian average, and how each area compares
      var rows = ['<tr><th>Area</th><th>You <span class="th-sub">80% range</span></th><th>Austria</th><th>vs. average</th></tr>'];
      var above = [], below = [];
      B.domains.forEach(function (d) {
        var you = r.byDomain[d.id], rg = sim.byDomain[d.id], avg = at.byDomain[d.id];
        var rel = avg > 0 ? (you - avg) / avg : 0;
        if (rel > 0.15) above.push(d.label.toLowerCase()); else if (rel < -0.15) below.push(d.label.toLowerCase());
        rows.push('<tr><td><i style="background:' + d.color + '"></i>' + esc(d.label) + "</td>" +
          '<td><strong>' + you.toFixed(1) + '</strong><span class="rng">' + rg.low.toFixed(1) + "–" + rg.high.toFixed(1) + "</span></td>" +
          "<td>" + avg.toFixed(1) + "</td>" +
          '<td class="' + (rel > 0.05 ? "up" : rel < -0.05 ? "down" : "") + '">' + (rel > 0 ? "+" : "") + Math.round(rel * 100) + "%</td></tr>");
      });
      rows.push('<tr class="total"><td>Total</td><td><strong>' + r.total.toFixed(1) + '</strong><span class="rng">' + sim.low.toFixed(1) + "–" + sim.high.toFixed(1) + "</span></td><td>" + at.total.toFixed(1) +
        '</td><td class="' + (r.total > at.total ? "up" : "down") + '">' + (r.total > at.total ? "+" : "") + Math.round((r.total - at.total) / at.total * 100) + "%</td></tr>");
      rows.push('<tr class="total goal-row"><td>1.5 °C goal 2030</td><td colspan="2">' + fmtT(target) + " per person — for the whole footprint, not per area</td>" +
        '<td class="' + (r.total > target ? "up" : "down") + '">' + (r.total > target ? ratio.toFixed(1) + "×" : "✓") + "</td></tr>");
      $("breakdown").innerHTML = rows.join("");
      $("breakdownNote").innerHTML = (above.length ? "You are clearly <strong>above</strong> the Austrian average in: " + above.join(", ") + ". " : "") +
        (below.length ? "And clearly <strong>below</strong> in: " + below.join(", ") + ". " : "") +
        "A high value in one area can still add up to a below-average total, because housing, car and flights are the big blocks — food is only about a fifth of an average footprint. Area ranges don’t add up to the total range.";

      // "Digital" is usually assumed to be bigger than it is, because the devices — which are
      // the larger half — sit in Goods, not here. Show both halves so the line isn't misread.
      var digitalKg = E.details(p).digitalKg;
      var deviceKg = (p.goods.electronics || 0) * (p.goods.spendFactor || 1) * F.goodsIntensity.electronics.value *
                     F.secondHand[(p.goods.secondHand && p.goods.secondHand.electronics) || "new"];
      $("resDigital").innerHTML = "Streaming &amp; AI ≈ <strong>" + Math.round(digitalKg) + " kg</strong> a year (counted inside services). Your phones, laptops and TVs are not here — they're in Goods, at ≈ <strong>" +
        Math.round(deviceKg) + " kg</strong>, because making a smartphone (~60 kg) or a laptop (~200 kg) is about 80% of its lifetime footprint. Together ≈ " +
        (Math.round(digitalKg + deviceKg) / 1000).toFixed(2) + " t, which is the 2–3% of a footprint that matches what the ITU and World Bank find for the whole ICT sector (1.5–4% of global emissions).";

      var all = E.levers(p), mine = all.filter(function (l) { return l.control === "yours"; });
      $("leverTeaser").textContent = all.length
        ? "Your biggest lever: " + all[0].label.toLowerCase() + " (−" + all[0].saved.toFixed(1) + " t). Everything in your own hands together: −" + (mine.length ? E.combined(p, mine).toFixed(1) : "0.0") + " t. Tick and untick them in the Potential tab to see the bar move."
        : "No changes to suggest — your footprint is already very low.";

      renderNotes(p, r);
    }

    /* ---------- compensation, money and the public share ----------
     * Lives on the Details tab, but it is written here because it belongs to the measured
     * result, not to the diagram — and because the Results tab still fills it for printing.
     */
    function renderNotes(p, r) {
      /* Compensation: the ladder, not a scoreboard.
       * The bar is the MIX of what was bought, drawn on the Oxford axis from "prevents
       * emissions elsewhere" to "locked away for 1,000+ years". It is never scaled against
       * the footprint, because that would imply the tonnes cancel — they do not, and this
       * app has never subtracted them. Every rung, colour and share comes from
       * data/factors.js and engine.compensation(); nothing is typed in here.
       */
      var o = E.compensation(p), oh = [], oflags = [["never subtracted", "flag-warn"]];
      var rungs = o.byType.map(function (x) {
        return { rank: x.info.rank, short: x.info.short, label: x.info.label, color: x.info.color,
                 examples: x.info.examples, storage: x.info.storage, risk: x.info.risk, t: x.tonnes };
      });
      if (!o.tonnes && !o.contributionEur) {
        oh.push('<p class="layer2">You don’t buy compensation. Nothing bought here would come off your footprint anyway — this is the ladder, weakest to strongest.</p>');
      } else if (!o.tonnes) {
        oflags.push(["no tonnes claimed", "flag-ok"]);
        oh.push('<p class="layer2">You fund climate action without claiming any tonnes against your own footprint — the most honest form of the claim.</p>');
      } else {
        oflags.push(["avoidance ≠ removal", "flag-derived"]);
        oh.push('<p class="layer2">The bar is the mix you buy, not a dent in your <strong>' + r.total.toFixed(1) + " t</strong>.</p>");
      }
      $("resOffsetsFlags").innerHTML = flagRow(oflags);
      // With nothing bought, the same ladder is drawn faint and evenly spaced: an explainer.
      var emptyLadder = !o.tonnes;
      var allRungs = Object.keys(F.offsetTypes).filter(function (k) { return k !== "source"; })
        .map(function (k) { var i = F.offsetTypes[k];
          return { rank: i.rank, short: i.short, label: i.label, color: i.color, examples: i.examples,
                   storage: i.storage, risk: i.risk, t: 0 }; })
        .sort(function (a, b) { return a.rank - b.rank; });
      oh.push(G.chart.ladder({
        rungs: emptyLadder ? allRungs : rungs,
        total: o.tonnes,
        removalShare: o.removalShare, centuryShare: o.centuryShare,
        ariaLabel: emptyLadder
          ? "The five kinds of carbon credit, weakest to strongest"
          : "Your compensation by kind: " + rungs.map(function (r) { return r.label + " " + r.t.toFixed(2) + " tonnes"; }).join(", ")
      }));
      if (o.tonnes) {
        oh.push('<p class="muted small">Total bought: <strong>' + o.tonnes.toFixed(2) + " t</strong> a year" +
          (o.certification ? ", certified " + esc(o.certification) : "") + ".</p>");
      }
      if (o.contributionEur) {
        oh.push('<p class="muted small"><strong>€' + Math.round(o.contributionEur).toLocaleString("en-US") +
          "/yr</strong> as a climate contribution. No tonnes are claimed, so none are drawn.</p>");
      }
      /* Layer 3. This is the argument that used to run across the top of the card, before
       * anyone had seen the ladder it is about. It reads better after the picture, and the
       * two chips above already carry its conclusion. */
      oh.push(fold("Why a tonne bought is not a tonne cut",
        "<p>A tonne of avoidance credit and a tonne of direct air capture are not the same tonne, which is the whole reason the ladder exists. Many avoidance credits deliver far less than they claim (Probst et al. 2024).</p>" +
        "<p>So nothing here is taken off anything above. The Oxford Offsetting Principles put cutting emissions first, then removals, then storage that lasts — the ladder is that order, drawn. Funding climate action without claiming the tonnes is the most honest form of the claim.</p>"));
      $("resOffsets").innerHTML = oh.join("");

      var m = p.money, mt = [];
      var bankTxt = { ethical: "You bank with an ethical/sustainability bank — the strongest choice here.", greenProduct: "You use sustainable products at a normal bank — worth asking what the bank finances overall, not just your product.", conventional: "You have a normal bank account: your deposits help fund whatever the bank lends to, which can include fossil fuels.", unknown: "Bank type unknown." }[m.bankType];
      mt.push("<p>" + bankTxt + "</p>");
      var savTxt = { none: "", labelled: "Your investments carry a sustainability label — good. The Austrian Umweltzeichen UZ 49 excludes e.g. coal and oil companies.", conventional: "Your savings/pension are invested conventionally. Switching to labelled funds (e.g. Umweltzeichen UZ 49) is a lever many people overlook.", unknown: "Worth checking how your savings and pension are invested." }[m.savings];
      if (savTxt) mt.push("<p>" + savTxt + "</p>");
      // A real number for financed emissions — deliberately beside the footprint, never in it.
      var fin = E.financed(p);
      /* The two reasons this sits outside the bar are a chip each, because they are exactly
       * the kind of thing a reader needs before the number and not after two hundred words:
       * it is never added, and the published estimates for it disagree sixfold. The reasoning
       * behind both is unchanged, one fold down. */
      var mflags = [["never added", "flag-warn"], ["estimates disagree 6×", "flag-derived"]];
      if (fin) {
        mt.push('<p class="money-figure">Your €' + Math.round(fin.eur).toLocaleString("en-US") + ' finances somewhere between <strong>' +
          fin.low.toFixed(1) + " and " + fin.high.toFixed(1) + " t CO₂e a year</strong>" +
          (fin.high > r.total ? " — the top of that range is more than everything else on this page put together." : ".") +
          (fin.labelled ? " A sustainability label pushes you towards the lower end, though labels vary." : "") + "</p>");
      } else {
        mt.push('<p class="layer2">Not in the footprint, and not because it is small. Tell the app roughly how much you have invested and the range appears here.</p>');
      }
      mt.push(fold("Why this is beside your footprint and not in it",
        "<p>The two published reference points for the same idea disagree by a factor of six (ECB 2025: 0.8 t per €10,000 · Make My Money Matter 2021: 5.4 t). A number that moves 6× with the method has no business inside a bar claiming ±20%.</p>" +
        "<p>And it is a different kind of number. The emissions of a company you part-own are already counted in the footprint of whoever buys what it makes, so adding it here would count the same tonnes twice. Where your money sits is leverage, not consumption: it moves capital, which is exactly why it is worth doing and why it is not measured in the same currency as your heating bill.</p>" +
        "<p>Bank and insurance admin, separately, is roughly 0.1 t per person and nearly the same for everyone.</p>"));
      $("resMoneyFlags").innerHTML = flagRow(mflags);
      $("resMoney").innerHTML = mt.join("");

      /* What the bars leave out, drawn rather than asserted.
       * Every tonne below is a share from data/benchmarks.js multiplied by Austria's
       * national total — no number is typed in here, and the blocks sum to the trunk
       * because they are the trunk divided. The audit checks exactly that.
       */
      var ps = B.publicShare, nat = B.austria.nationalTotal;
      var flowParts = ps.parts.map(function (p) {
        var t = p.shareOfNational * nat;
        var out = { id: p.id, label: p.label, t: t, share: p.shareOfNational, color: p.color,
                    detail: p.detail, individual: p.individual };
        if (p.parts) out.parts = p.parts.map(function (k) {
          return { id: k.id, label: k.label, t: k.shareOfParent * t, share: k.shareOfParent * p.shareOfNational,
                   color: k.color, detail: k.detail, individual: k.individual };
        });
        return out;
      });
      var flowTotal = flowParts.reduce(function (a, p) { return a + p.t; }, 0);

      /* Two different numbers, and an earlier version printed the wrong one: this said "your
       * N t bar" while N was the AUSTRIAN AVERAGE. Your bar is your own footprint; the share
       * below it is an average, because nothing in the 37 questions can tell how much of a
       * country's hospitals and motorways is yours. Saying "an average of" is not hedging,
       * it is the difference between a measured number and an allocated one.
       */
      /* The path, and the stock behind it.
       * Showing 2.5 t alone let the app imply it is a destination. It is one point on a steep
       * descent, and the thing that physically matters is not the yearly rate at all but the
       * total ever emitted — warming tracks cumulative CO2. So: the waypoints, then the stock.
       *
       * The stock is deliberately NOT divided by anyone's footprint. The remaining budget is
       * CO2 only — non-CO2 warming sits inside the estimate by making it smaller — while this
       * app measures CO2e. A personal countdown would be arithmetic across two different
       * units, which is the sort of thing this app exists to not do.
       */
      var TR = B.targets.trajectory, rem = B.targets.remaining;
      var perPerson = rem.gtCO2 * 1e9 / rem.worldPopulation;
      $("detTraj").innerHTML = TR.map(function (t, i) {
        var pctOfNow = r.total > 0 ? Math.round(t.value / r.total * 100) : 0;
        return '<div class="traj-step' + (i === 0 ? " traj-now" : "") + '">' +
          '<div class="traj-year">' + t.year + "</div>" +
          '<div class="traj-val">' + t.value.toFixed(1) + " t</div>" +
          '<div class="traj-rel">' + pctOfNow + "% of your " + r.total.toFixed(1) + " t</div></div>";
      }).join('<div class="traj-arrow" aria-hidden="true">→</div>');

      /* The same three layers. The tiles above are the answer; this is the one sentence that
       * says what they mean, and the stock behind them — the part a reader has to want — is
       * the fold. The two chips are the qualifications that must survive skimming: the thing
       * that matters is a total rather than a yearly rate, and the budget below is CO₂ only.
       */
      $("detTrajFlags").innerHTML = flagRow([
        ["a stock, not a yearly rate", "flag-derived"],
        ["budget is CO₂ only, not CO₂e", "flag-warn"]
      ]);
      $("detTrajNote").innerHTML =
        '<p class="layer2">Staying at ' + fmtT(B.targets.y2030.value) + " after 2030 would not settle anything: the same work puts the path at " +
        fmtT(TR[1].value) + " by " + TR[1].year + " and " + fmtT(TR[2].value) + " by " + TR[2].year + ".</p>" +
        fold("Why the total ever emitted matters more than any yearly figure",
          "<p>Warming tracks cumulative CO₂, so a yearly figure is only a stand-in for staying inside a stock that is nearly spent. " +
          "The remaining budget for 1.5 °C is about <strong>" + rem.gtCO2 + " Gt CO₂</strong> from the start of " + rem.fromYear +
          ", a little over three years of world emissions — roughly <strong>" + perPerson.toFixed(0) +
          " tonnes per person alive today, in total, not per year</strong>.</p>" +
          "<p>That budget counts CO₂ only, while everything else here is CO₂e, so the two cannot be divided into a personal countdown. " +
          "The order of magnitude is the point: a rich-country footprint spends a lifetime share of it in a couple of years.</p>");

      /* Whether the past should count is a real question with a firm half and a contested
       * half, and the app should answer the firm half rather than dodge the whole thing.
       */
      $("detHistory").innerHTML =
        "<p><strong>No, and the difference is already enormous — but not in a way this app can measure for you.</strong></p>" +
        "<p>Lifetime budgets differ by <em>when you were born</em>, before anyone's choices come into it. On a 1.5 °C path, modelled lifetime budgets run at roughly 275 t CO₂ for someone born before 1946, 202 t for a millennial, 118 t for Gen Z and 56 t for someone born after 2012. Someone born in 2017 gets about an eighth of what someone born in 1950 did. That is not a moral allocation — it is what the models leave over once the earlier emissions have happened.</p>" +
        "<p>So differentiated responsibility is not a proposal here; it is already the arithmetic, between generations rather than between individuals.</p>" +
        "<p><strong>What this app deliberately does not do is score your past.</strong> It asks about one year, and it should not pretend otherwise. Reconstructing decades of flights, cars and homes from memory would produce a number with an error bar wider than the answer, and a personal carbon debt would do one of two useless things: tell someone already over their lifetime share that nothing they do now matters, or tell a frugal person they have credit to spend. Neither is true. The remaining budget is shared and nearly gone regardless of who spent the earlier part.</p>" +
        "<p class=\"muted\">Where the past does belong is in the argument about who pays for the change — between countries, and between generations within them. That is a question about policy and money, not about a household's shopping, and this tool does not try to settle it.</p>";

      /* The overview. Three quantities that the page already carries on three separate cards,
       * put side by side so the reader does not have to assemble them — and, more to the
       * point, so the number they measured stops being the only one in view.
       *
       * They are NOT interchangeable, and the tiles say which is which:
       *   · what you buy — measured from the answers, and the only one that is yours alone;
       *   · decided for you — an average, because nothing here can allocate a country's
       *     hospitals to one person. It adds to the first: different final demand, no overlap;
       *   · what your money finances — a different KIND of number. Attributed, not consumed,
       *     already inside somebody's footprint, and published estimates disagree sixfold.
       *     It must never be added, and the tile says so rather than leaving it to a caption.
       */
      var fin0 = E.financed(p);
      var tiles = [
        { k: "buy", n: r.total.toFixed(1) + " t", lab: "What you buy",
          note: "Measured from your answers. The part that is yours alone — and the only one any change on the Potential tab can move.",
          add: true },
        { k: "public", n: flowTotal.toFixed(1) + " t", lab: "Decided for you",
          note: "An average, not your figure. Hospitals, schools, roads, things built once and used for decades. Moves through what a country builds, not through what you buy.",
          add: true }
      ];
      tiles.push(fin0
        ? { k: "money", n: fin0.low.toFixed(1) + "–" + fin0.high.toFixed(1) + " t", lab: "What your money finances",
            note: "A different kind of number: attributed, not consumed, and already counted in the footprint of whoever buys what those companies make. Published estimates disagree sixfold.",
            add: false }
        : { k: "money", n: "—", lab: "What your money finances",
            note: "Not known: you have not said how much is invested. It is a different kind of number either way — attributed rather than consumed, and never added to the two on the left.",
            add: false });

      $("detOverview").innerHTML = tiles.map(function (t) {
        return '<div class="ov-tile ov-' + t.k + '"><div class="ov-num">' + esc(t.n) + "</div>" +
          '<div class="ov-lab">' + esc(t.lab) + "</div>" +
          '<div class="ov-flag">' + (t.add ? "adds to your total" : "never added") + "</div>" +
          '<p class="ov-note">' + esc(t.note) + "</p></div>";
      }).join("");
      $("detOverviewNote").innerHTML = "The first two add up: they are different parts of what gets bought, with no overlap, so together they come to about <strong>" +
        (r.total + flowTotal).toFixed(1) + " t</strong> a year. The third does not add to anything — adding it would count the same tonnes twice. " +
        "Only the first responds to the Potential tab; the second moves through public decisions and the third through where you keep your money.";

      /* Layer 1 and 2. What this card used to open with — your bar is what you buy, the
       * share adds to it, together they come to N — is now the card two above it, tile for
       * tile. Saying it twice cost 60 words and taught nothing the second time, so this card
       * now starts where it is the only one that can: at the number and where it goes.
       * The two qualifications it must not lose are chips, and their reasoning is the first
       * fold under the diagram.
       */
      $("resPublicFlags").innerHTML = flagRow([
        ["average, not your figure", "flag-warn"],
        ["outside every bar here", "flag-derived"],
        ["outside the " + fmtT(B.targets.y2030.value) + " goal too", "flag-derived"]
      ]);
      $("resPublic").innerHTML = "An average of <strong>" + flowTotal.toFixed(1) + " t</strong> a person is caused on your behalf by the state " +
        "and by the firms that build things — <strong>" + Math.round((1 - B.austria.finalDemand.households) * 100) +
        "%</strong> of what an average Austrian causes. Where it goes is usually guessed wrong:";
      /* Layer 3 for the chips above, directly under the sentence they qualify — a fold only
       * reads as an answer when it sits below the thing it is an answer about. */
      $("resPublicWhy").innerHTML = fold("Why it is an average, and why the goal leaves it out too",
        "<p>It is an average rather than your own figure: nothing you answered can say how much of a country's hospitals and motorways is yours.</p>" +
        "<p>It sits outside every bar here <em>and</em> outside the " + fmtT(B.targets.y2030.value) +
        " goal, which is defined the same way — so the comparison stays fair.</p>");

      $("resPublicFlow").innerHTML = G.chart.flow({
        parts: flowParts, total: flowTotal, base: nat,
        colorTrunk: ps.colorTrunk, trunkLabel: "Not in your bar",
        goal: { value: ps.target.value, label: ps.target.value.toFixed(1) + " t · derived share of the 1.5 °C budget" },
        ariaLabel: "Where the " + flowTotal.toFixed(1) + " t left out of your footprint goes"
      });

      // The keys in the diagram already carry the detail. What is left to say is what they
      // cannot: what the picture means for comparing one country with another, and what the
      // dashed mark is — "derived" is doing real work there, it is arithmetic from one
      // report and not a target anyone publishes. One sentence each, reasoning folded.
      var pt = ps.target, cutPublic = Math.round((1 - pt.value / flowTotal) * 100),
          cutLife = Math.round((1 - B.targets.y2030.value / B.austria.total) * 100);
      $("resPublicTarget").innerHTML =
        /* Layer 2 for the dashed mark: the answer, the number, and the one comparison that
         * stops a reader concluding this is somebody else's problem. The derivation is the
         * fold below it, because "derived" is already a chip and a word in this sentence. */
        '<p class="layer2"><strong>Is there a target for this part?</strong> Not a published one. The dashed mark is <strong>derived</strong>: about ' +
        fmtT(pt.value) + ", and Austria would have to cut this part by <strong>" + cutPublic + "%</strong> — almost exactly the " +
        cutLife + "% the lifestyle half has to cut.</p>" +
        fold("Where the " + fmtT(pt.value) + " comes from, and what Austria has actually committed to",
          "<p>No body sets a figure for the share of a footprint nobody buys as a household, and the " +
          fmtT(B.targets.y2030.value) + " lifestyle goal deliberately excludes it. " +
          "The mark is a share of the <em>global</em> budget rather than an Austrian figure \u2014 the same way the " +
          fmtT(B.targets.y2030.value) + " goal is.</p>" +
          "<p>From the arithmetic of the same report: if lifestyles are 72% of emissions " +
          "and their share of the budget is " + fmtT(B.targets.y2030.value) + ", the whole budget is about 3.5 t a person and what is left " +
          "for everything bought on your behalf is about <strong>" + fmtT(pt.value) + "</strong>. " +
          "Austria is at " + fmtT(flowTotal) + ". So this is not somebody else\u2019s problem that lifestyle change will not touch, " +
          "and it is not disproportionately worse either.</p>" +
          "<p>Austria\u2019s own commitments do cover it, measured differently: climate neutrality by 2040, and \u221248% by 2030 against 2005 " +
          "for the sectors under the EU Effort Sharing Regulation. Those are territorial, economy-wide targets rather than consumption-based per-person ones, " +
          "so they cannot be drawn on this bar.</p>");

      /* The one surprise in the picture, said once — then the argument it leads to, folded. */
      $("resPublicNote").innerHTML =
        '<p class="layer2">The usual guess is hospitals and schools. Investment is <strong>two and a half times</strong> the whole of public services — ' +
        "concrete, steel and machinery, bought once and used for decades.</p>" +
        fold("Why a low household footprint can mean a strong public system",
          "<p>The health block is the reason a household footprint is a poor way to rank countries. " +
          "Eurostat uses <em>Actual Individual Consumption</em> instead, precisely because a country that provides care publicly moves those emissions " +
          "off its citizens' personal accounts while a country that leaves people to pay for their own keeps them on. " +
          "A low household figure can mean a strong public system rather than a lighter life.</p>");
    }

    // ---------- Potential tab: tick changes, watch the bar move ----------
    function fmtSave(t) { return t >= 0.95 ? t.toFixed(1) + " t" : Math.round(t * 1000) + " kg"; }
    function applyPicked(levers) {
      var p = JSON.parse(JSON.stringify(state.profile));
      levers.filter(function (l) { return picked[l.id]; }).forEach(function (l) { l.change(p); });
      return p;
    }

    function renderPotential() {
      if (!state.finished) return;
      var p = state.profile, all = E.levers(p), target = B.targets.y2030;
      var now = E.calculate(p), after = E.calculate(applyPicked(all));
      var chosen = all.filter(function (l) { return picked[l.id]; });
      var saved = now.total - after.total;

      $("potTotal").textContent = after.total.toFixed(1) + " t CO₂e / year";
      var pct = now.total > 0 ? Math.round(saved / now.total * 100) : 0;
      var single = chosen.reduce(function (sum, l) { return sum + l.saved; }, 0);
      $("potCompare").innerHTML = chosen.length
        ? "<strong>−" + saved.toFixed(1) + " t (−" + pct + "%)</strong> compared with your " + now.total.toFixed(1) + " t — " +
          (after.total <= target.value
            ? "that reaches the 2030 Paris goal of " + fmtT(target.value) +
              (saved >= 0.3 ? " <span class=\"muted\">on paper — before any of it comes back as re-spending.</span>" : ".")
            : (after.total / target.value).toFixed(1) + "× the 2030 Paris goal of " + fmtT(target.value) + ".")
        : "Nothing ticked yet — your footprint today is " + now.total.toFixed(1) + " t.";
      var gap = after.total - target.value;
      $("potGap").innerHTML = gap > 0.05
        ? "Still <strong>" + gap.toFixed(1) + " t</strong> above the 1.5 °C budget of " + fmtT(target.value) + "." +
          (all.some(function (l) { return !picked[l.id]; }) ? " Try “Reach the 1.5 °C goal” to see one way there." : " Even all the changes together don’t close the gap — the rest sits in things this calculator can’t change for you.")
        : "<strong>Within the 1.5 °C budget</strong> of " + fmtT(target.value) + " for 2030" +
          (saved >= 0.3 ? ", as an upper bound." : ".");
      $("potSum").innerHTML = chosen.length
        ? chosen.length + (chosen.length === 1 ? " change ticked" : " changes ticked") + " · saves <strong>" + saved.toFixed(1) + " t</strong> of " + now.total.toFixed(1) + " t = <strong>" + pct + "%</strong>" +
          // Ticked changes are recalculated together, never added up. They can overlap
          // (two flight levers removing the same flight) or reinforce each other
          // (green electricity makes a heat pump or an electric car save more).
          (Math.abs(single - saved) > 0.05
            ? ' <span class="muted">(added up one by one they would be ' + single.toFixed(1) + " t; "
              + (saved < single
                  ? "but they overlap, so together they really save "
                  : "but they reinforce each other — clean electricity makes electric heating and driving save more — so together they really save ")
              + saved.toFixed(1) + " t)</span>"
            : "")
        : "";

      // The bar on "Pick your changes": full width = today's footprint, always.
      // Both numbers come from a real recalculation, so it can never disagree with the
      // Sankey above it or with the hero figure.
      $("potBar").innerHTML = G.chart.horizontal({
        domains: B.domains,
        now: now.byDomain,
        after: after.byDomain,
        baseTotal: now.total,
        total: after.total,
        goal: { value: target.value, label: "1.5 \u00b0C goal " + target.value.toFixed(1) + " t" }
      });

      /* Every figure on this tab is an upper bound, and the more is ticked the further from
       * the truth that gets — because the money not spent on fuel, flights and meat is real
       * money that goes somewhere, and where it goes has its own footprint. The app does not
       * subtract a guess for that: rebound is a property of the person, not of the lever, and
       * subtracting it would trade a measurable upper bound for an unmeasurable point
       * estimate. So it is said, beside the number, and said harder as the number grows.
       */
      var rb = F.rebound, rbEl = $("potRebound");
      if (saved < 0.3) {
        rbEl.hidden = true; rbEl.innerHTML = "";
      } else {
        var big = saved >= 2 || chosen.length >= 6;
        rbEl.hidden = false;
        rbEl.innerHTML = "<strong>Read this as an upper bound.</strong> The money you stop spending on fuel, flights or meat does not vanish — " +
          "it gets spent on something else, and that has its own footprint. " +
          (big
            ? "For a package this size that is the bigger effect, not a footnote: when Norwegian households' " +
              Math.round(rb.packageCutBefore * 100) + "% cut across 34 changes was recalculated with the re-spending included, it came out at " +
              Math.round(rb.packageCutAfterLow * 100) + "–" + Math.round(rb.packageCutAfterHigh * 100) + "%. " +
              "Between a third and a half of the saving came back, and the best of their scenarios was the one where the money went to the lowest-carbon things."
            : "Using the efficient thing more takes back perhaps " + Math.round(rb.directLow * 100) + "–" + Math.round(rb.directHigh * 100) +
              "% on its own; re-spending the money takes back more, and grows as you tick more.") +
          ' <span class="muted">Nothing here is reduced for it — that depends on what you do with the money, not on the change itself.</span>';
      }

      var scenario = applyPicked(all);
      // reserve a row for anything a lever could add (e.g. train instead of flights),
      // so the diagram keeps exactly the same height whatever is ticked
      var baseSources = E.sources(p), seen = {};
      baseSources.forEach(function (s) { seen[s.domain + "-" + s.id] = true; });
      all.forEach(function (l) {
        var probe = JSON.parse(JSON.stringify(p));
        l.change(probe);
        E.sources(probe).forEach(function (s) {
          var k = s.domain + "-" + s.id;
          if (seen[k]) return;
          seen[k] = true;
          var blank = JSON.parse(JSON.stringify(s));
          blank.t = 0;
          baseSources.push(blank);
        });
      });
      drawChart("pot", "potChart", "potChartWrap", "potTip", "chartLive", {
        domains: B.domains,
        sources: E.sources(scenario),
        total: after.total,
        baseline: baseSources,           // frozen layout + the dashed ghost of today
        baselineTotal: now.total,
        goal: { value: target.value, label: "1.5 °C budget 2030:", short: "2030 budget:" }
      }, function () { renderPotential(); });
      $("potChartState").textContent = chosen.length ? "· with your " + chosen.length + (chosen.length === 1 ? " change" : " changes") : "· as you live today";

      // Read the list easy first, drastic last: ordinary changes by saving, then the ones marked
      // "big" (a no-buy year, a smaller home, living like the average) by saving. engine.levers()
      // itself stays sorted purely by size — the kindness is a display choice, not arithmetic.
      var order = function (xs) {
        return xs.filter(function (l) { return l.control !== "big"; })
                 .concat(xs.filter(function (l) { return l.control === "big"; }));
      };
      var list = order(leverFilter === "yours" ? all.filter(function (l) { return l.control === "yours"; }) : all);

      // A band held open in the diagram narrows the list to what would shrink THAT part,
      // biggest first — "click the flights and see what to do about flights". The saving
      // shown against each one stays the whole-footprint saving; the ranking is by how much
      // it takes off the band, which is the question the click asked.
      // A pin carried over from Details may name a row this diagram does not have. Land on the
      // area instead of silently dropping the filter, which would look like the button did nothing.
      if (pinned.pot && potPinFallback && !bandLabel("pot", pinned.pot)) pinned.pot = potPinFallback;
      potPinFallback = null;
      var bandName = paintBandChip(all, scenario);
      if (pinned.pot) {
        var hits = {};
        leversFor(scenario, all, predicateFor("pot", pinned.pot), true, true)
          .forEach(function (x, i) { hits[x.id] = i; });
        list = list.filter(function (l) { return hits[l.id] != null; })
                   .sort(function (a, b) { return hits[a.id] - hits[b.id]; });
      }
      var max = all.reduce(function (m, l) { return Math.max(m, l.saved); }, 0.001);
      // What each remaining change would add ON TOP of the ones already ticked. Several of these
      // overlap by design — a year without flying contains the night-train swap — and saying so
      // is better than letting someone tick two things and wonder why the total barely moved.
      var already = chosen.length ? E.combined(p, chosen) : 0;
      var extra = {};
      all.forEach(function (l) { if (!picked[l.id]) extra[l.id] = E.combined(p, chosen.concat([l])) - already; });
      var ul = $("levers");
      // Rebuilding the list throws away the checkbox that has focus and — because the
      // "on top of what you've ticked" notes appear and vanish — moves everything below the
      // one you just ticked. Remember where the active element sat on screen; put both back.
      var keepId = doc.activeElement && doc.activeElement.id && ul.contains(doc.activeElement)
        ? doc.activeElement.id : null;
      var keepTop = keepId ? doc.activeElement.getBoundingClientRect().top : null;
      ul.innerHTML = "";
      if (!list.length) {
        // "Nothing here" has two very different causes and they deserve different sentences:
        // no lever exists for this band, or you have already ticked the ones that do.
        /* "Nothing here" has three different causes and each deserves its own sentence.
         * Getting this wrong tells someone their flights cannot be reduced when in fact
         * they have already ticked every change that does it.
         */
        var predHere = pinned.pot ? predicateFor("pot", pinned.pot) : null;
        var leftHere = predHere ? sumSources(scenario, predHere) : 0;
        var coveredByTicked = predHere && chosen.length &&
          leversFor(p, all, predHere, false, true).some(function (x) { return picked[x.id]; });
        ul.appendChild(el("li", "muted", !pinned.pot ? "Nothing to show for this filter."
          : leftHere <= 0.001
            ? "Your ticked changes have already removed " + bandName + " entirely — it is drawn as a dashed ghost above."
            : coveredByTicked
              ? "Your ticked changes already cover everything in the list that shrinks " + bandName +
                ". Clear the filter above to see the rest."
              : "Nothing in the list shrinks " + bandName + ". What is left there is the floor of how this calculator models it — clear the filter above to see everything."));
      }
      var bigStarted = false;
      list.forEach(function (l) {
        if (l.control === "big" && !bigStarted && leverFilter !== "yours" && !pinned.pot) {
          bigStarted = true;
          ul.appendChild(el("li", "lever-divider", "Bigger changes — still yours to make, but they change how you live"));
        }
        var c = CONTROL[l.control] || CONTROL.unknown;
        var add = extra[l.id];
        var covered = !picked[l.id] && chosen.length && add != null && add < Math.max(0.02, l.saved * 0.08);
        var li = el("li", "lever" + (picked[l.id] ? " picked" : "") + (covered ? " covered" : ""));
        var id = "lv-" + l.id;
        var note = covered
          ? '<span class="lever-extra">Your other changes already do this</span>'
          : (!picked[l.id] && chosen.length && add != null && Math.abs(add - l.saved) > 0.03
              ? '<span class="lever-extra">−' + fmtSave(add) + " on top of what you’ve ticked</span>"
              : "");
        li.innerHTML = '<input type="checkbox" id="' + id + '"' + (picked[l.id] ? " checked" : "") + '>' +
          '<label for="' + id + '" class="lever-main"><span class="lever-title">' + esc(l.label) + (c[0] ? ' <span class="badge ' + c[1] + '">' + c[0] + "</span>" : "") + "</span>" +
          '<span class="lever-do">' + esc(l.detail) + "</span>" +
          /* The mechanism is the most valuable text on this card and the longest: 26 of them
           * open at once is most of the words on the tab, on any screen, and none of it is
           * the answer to the question the tab asks. Folded at every width now, not just on
           * phones, with the open state remembered below. It is a <details> inside a
           * <label>, so the summary is a sibling of the checkbox's label text, not part of
           * it — tapping it must not tick.
           */
          (l.why ? '<details class="lever-why-fold"' + (whyOpen[l.id] ? " open" : "") + "><summary>why this works</summary>" +
                   '<span class="lever-why">' + esc(l.why) + "</span></details>" : "") + note + "</label>" +
          '<div class="lever-save"><div class="save-num">−' + fmtSave(l.saved) + '</div><div class="save-bar"><span style="width:' + Math.max(4, Math.round(l.saved / max * 100)) + '%"></span></div></div>';
        li.querySelector("input").onchange = function () { picked[l.id] = this.checked; renderPotential(); };
        var whyFold = li.querySelector(".lever-why-fold");
        if (whyFold) whyFold.addEventListener("toggle", function () { whyOpen[l.id] = whyFold.open; });
        ul.appendChild(li);
      });

      // focus back on the same checkbox, and the page nudged so that checkbox has not moved
      if (keepId) {
        var back = doc.getElementById(keepId);
        if (back) {
          back.focus({ preventScroll: true });
          var drift = back.getBoundingClientRect().top - keepTop;
          if (Math.abs(drift) > 0.5) root.scrollBy(0, drift);
        }
      }

      announce(after.total, saved, chosen.length);
    }

    /* ---------- the Details tab: the footprint you measured, explained ----------
     * Same shape as Potential — sticky result bar, diagram held on the left, a column that
     * scrolls beside it — but nothing here answers to the changes. The diagram is your
     * footprint as measured, and the panel beside it explains whichever band you hold open.
     */
    var leverMemo = { key: null, value: null };
    function detLevers(p) {
      var key = JSON.stringify(p);
      if (leverMemo.key !== key) leverMemo = { key: key, value: E.levers(p) };
      return leverMemo.value;
    }
    function renderDetails() {
      if (!state.finished) return;
      var p = state.profile, r = E.calculate(p), target = B.targets.y2030;

      $("detTotal").textContent = r.total.toFixed(1) + " t CO₂e / year";
      $("detCompare").innerHTML = r.total <= target.value
        ? "Inside the 1.5 °C budget of " + fmtT(target.value) + " for 2030."
        : "<strong>" + (r.total / target.value).toFixed(1) + "×</strong> the 1.5 °C budget of " +
          fmtT(target.value) + " for 2030, and " +
          (r.total >= B.austria.total
            ? (r.total / B.austria.total).toFixed(1) + "× the Austrian average."
            : Math.round((1 - r.total / B.austria.total) * 100) + "% below the Austrian average.");
      var sim = simulate(p);
      $("detRange").innerHTML = "Most likely between <strong>" + sim.low.toFixed(1) + " and " +
        sim.high.toFixed(1) + " t</strong> — the range your answers leave open.";

      // Same bar as on Potential, with nothing removed: it is the composition of today.
      $("detBar").innerHTML = G.chart.horizontal({
        domains: B.domains,
        now: r.byDomain, after: r.byDomain,
        baseTotal: r.total, total: r.total,
        goal: { value: target.value, label: "1.5 °C goal " + target.value.toFixed(1) + " t" },
        caption: "The full width is your <strong>" + r.total.toFixed(1) +
          " t</strong>, split by area. The dashed line is the 1.5 °C budget of " +
          target.value.toFixed(1) + " t for 2030.",
        // this page is not a what-if, so "nothing ticked" would be the wrong thing to say
        idleLabel: "as you measured it"
      });

      drawChart("det", "detChart", "detChartWrap", "detTip", "detChartLive", {
        domains: B.domains,
        sources: E.sources(p),
        total: r.total,
        goal: { value: target.value, label: "1.5 °C budget 2030:", short: "2030 budget:" }
      }, function () { renderInsight("det", p, detLevers(p)); });

      renderInsight("det", p, detLevers(p));
      renderNotes(p, r);
    }

    /* ---------- one diagram, drawn the same way on both tabs ----------
     * `which` is "det" or "pot". The SVG is thrown away and rebuilt on every change, so
     * whatever the keyboard was holding has to be handed back: which band it was on, and
     * whether the diagram itself was the focused element. The model of what was drawn is
     * captured here rather than read later, because two diagrams now exist and the module
     * only remembers the last one it drew.
     */
    function drawChart(which, chartId, wrapId, tipId, liveId, opts, redraw) {
      var hadFocus = $(chartId).contains(doc.activeElement);
      opts.labelScale = splitMode() ? 1.3 : 1;   // drawn narrower beside the panel: bigger type
      /* One diagram, every screen. A phone gets the same four columns at a readable size
       * inside a container that scrolls sideways — shrinking it to fit 390 px rendered every
       * label about four pixels tall, and turning it a quarter traded that for blocks only as
       * wide as their tonnes. Neither beat simply not shrinking it.
       */
      $(chartId).innerHTML = G.sankey.render(opts);
      chartModel[which] = G.sankey.model();
      G.sankey.attach($(wrapId), $(tipId), {
        selected: pinned[which],
        focus: focusedBand[which],
        live: $(liveId),
        onFocus: function (pick) { focusedBand[which] = pick; },
        onSelect: function (pick) {
          pinned[which] = pick;
          if (pick) focusedBand[which] = pick;
          redraw();
          bringPanelIntoView(which);
        }
      });
      if (hadFocus) { var sv = $(chartId).querySelector("svg"); if (sv) sv.focus(); }
    }

    function splitMode() { return !!(root.matchMedia && root.matchMedia("(min-width: 1240px)").matches); }

    // Clicking a band asks a question whose answer is in the column beside the diagram. If
    // that column starts above the window — you clicked while deep in it — bring its top
    // just under the sticky bar. It never scrolls when the top is already in view.
    function bringPanelIntoView(which) {
      var panel = $(which === "det" ? "detInsight" : "levers").closest(".pot-panel");
      if (!panel) return;
      var top = panel.getBoundingClientRect().top;
      var lid = ($(which === "det" ? "detBarWrap" : "potBarWrap").getBoundingClientRect().height || 0) + 12;
      if (top < lid) {
        root.scrollBy({ top: top - lid - 8, left: 0,
          behavior: root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }

    // The chip above the list of changes, naming the band the list is narrowed to.
    function paintBandChip(all, scenario) {
      var chip = $("bandChip"), n = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
      $("paneCount").textContent = n ? n : "";
      $("paneCount").hidden = !n;
      if (!pinned.pot) { chip.hidden = true; chip.innerHTML = ""; return ""; }
      var name = bandLabel("pot", pinned.pot);
      if (!name) { pinned.pot = null; chip.hidden = true; chip.innerHTML = ""; return ""; }
      chip.hidden = false;
      chip.innerHTML = '<span>Changes that shrink <strong>' + esc(name) + "</strong></span>" +
        '<button type="button" class="seg-btn" id="bandChipClear">Show all changes</button>';
      $("bandChipClear").onclick = function () { pinned.pot = null; renderPotential(); };
      return name;
    }

    // What a pick is called, and which sources it covers — the two things every consumer of
    // a held-open band needs. Both read the model of the diagram that was actually drawn.
    function bandLabel(which, pick) {
      var m = chartModel[which];
      if (!m || !pick) return "";
      var bits = pick.split(":"), kind = bits[0], id = bits.slice(1).join(":");
      if (kind === "total") return "your whole footprint";
      var from = kind === "src" ? m.rows.filter(function (r) { return r.key === id; })
               : kind === "cause" ? m.causes.filter(function (c) { return c.id === id; })
               : m.areas.filter(function (a) { return a.id === id; });
      return from.length ? from[0].label : "";
    }
    function predicateFor(which, pick) {
      var m = chartModel[which];
      var bits = pick.split(":"), kind = bits[0], id = bits.slice(1).join(":");
      if (kind === "total") return function () { return true; };
      if (kind === "cause") return function (x) { return x.cause === id; };
      if (kind === "dom") return function (x) { return x.domain === id; };
      var row = m && m.rows.filter(function (r) { return r.key === id; })[0];
      if (!row) return function () { return false; };
      return function (x) { return x.domain === row.domain && row.srcIds.indexOf(x.id) >= 0; };
    }

    /* ---------- keeping the result bar on screen ----------
     * The bar is `position: sticky` in the stylesheet, which is the right way to do it and
     * costs nothing while it works. This does two things on top of that.
     *
     * One: it keeps the page the same length. The bar sheds its legend and caption when it
     * sticks, and without compensation everything below would lurch up by that much at the
     * moment it does. #potBarSpacer takes up exactly the difference.
     *
     * Two: it does not take sticky on trust. The first time we scroll past the bar, it asks
     * whether the bar actually held its place. If it did, nothing else happens. If it slid
     * away — an engine that ignores sticky here — the bar is pinned by hand with
     * `position: fixed` and the spacer takes over its whole height instead.
     */
    function startStickWatch(sentinelId, barId, spacerId, panelId) {
      var bar = $(barId), sentinel = $(sentinelId), spacer = $(spacerId);
      var stickyWorks = null, queued = false, openH = 0;

      function measure() {
        queued = false;
        if ($(panelId).hidden) return;
        var past = sentinel.getBoundingClientRect().top < 0;

        // how much room the bar takes up in the flow right now (nothing, once it is fixed)
        var takes = function () {
          if (bar.classList.contains("pinned")) return 0;
          return bar.offsetHeight + (parseFloat(root.getComputedStyle(bar).marginBottom) || 0);
        };

        if (!past) {                      // at rest: remember the room it takes when open
          bar.classList.remove("stuck", "pinned");
          spacer.style.height = "";
          openH = takes();
          return;
        }

        bar.classList.add("stuck");
        // one honest test, the first time we scroll past it: did sticky hold?
        if (stickyWorks === null) stickyWorks = bar.getBoundingClientRect().top > -2;
        if (!stickyWorks) bar.classList.add("pinned");
        spacer.style.height = Math.max(0, openH - takes()) + "px";
      }
      function onScroll() {
        if (queued) return;
        queued = true;
        (root.requestAnimationFrame || function (f) { setTimeout(f, 16); })(measure);
      }
      root.addEventListener("scroll", onScroll, { passive: true });
      root.addEventListener("resize", onScroll);
      measure();
    }

    // One short sentence for screen readers whenever the number moves. The hero and the bar
    // re-render wholesale, so announcing them directly would read the whole card out again.
    var lastSaid = "";
    function announce(total, saved, count) {
      var msg = total.toFixed(1) + " tonnes" +
        (count ? ", " + count + (count === 1 ? " change" : " changes") + " ticked, saving " + saved.toFixed(1) + " tonnes" : ", nothing ticked");
      if (msg === lastSaid) return;
      lastSaid = msg;
      $("potLive").textContent = msg;
    }

    /* ---------- the insights panel under the Sankey ----------
     * Clicking a band pins it; this builds what the picture cannot say on its own:
     * where the emission physically happens, what is inside a merged row, how the area
     * compares with the Austrian average, a couple of everyday anchors for the size,
     * and — the useful part — which of the remaining changes would actually shrink THIS.
     *
     * Everything here is derived from engine.sources() on the scenario being shown, so the
     * panel can never disagree with the diagram above it.
     */
    function sumSources(profile, pred) {
      return E.sources(profile).filter(pred).reduce(function (a, s) { return a + s.t; }, 0);
    }
    // Which unticked changes would reduce the selected part, and by how much — measured on
    // top of the changes already ticked, because that is the question the person is asking.
    function leversFor(scenario, all, pred, skipTicked, keepAll) {
      var before = sumSources(scenario, pred);
      if (before <= 0.001) return [];
      var out = all.filter(function (l) { return !skipTicked || !picked[l.id]; }).map(function (l) {
        var q = JSON.parse(JSON.stringify(scenario));
        l.change(q);
        return { id: l.id, label: l.label, control: l.control, saved: before - sumSources(q, pred) };
      }).filter(function (x) { return x.saved > 0.005; })
        .sort(function (a, b) { return b.saved - a.saved; });
      return keepAll ? out : out.slice(0, 4);
    }
    function leverLines(list, gone) {
      if (gone) return '<p>Your ticked changes remove this completely — it is drawn as a dashed ghost above.</p>';
      if (!list.length) return '<p class="muted small">Nothing left in the list would shrink this further — what remains here is the floor of how this calculator models it.</p>';
      return '<ul class="ins-levers">' + list.map(function (x) {
        var c = CONTROL[x.control] || CONTROL.unknown;
        return "<li><span>" + esc(x.label) + (c[0] ? ' <span class="badge ' + c[1] + '">' + c[0] + "</span>" : "") +
          '</span><b>−' + (x.saved >= 0.95 ? x.saved.toFixed(1) + " t" : Math.round(x.saved * 1000) + " kg") + "</b></li>";
      }).join("") + "</ul>";
    }
    // Everyday anchors, so a number in tonnes means something. Both are derived from the same
    // factors the calculator uses, not looked up separately.
    function anchors(t) {
      var perKmPetrol = (F.car.petrol.litresPer100 / 100) * F.car.petrol.kWhPerLitre * F.car.petrol.fuelFactor + F.car.manufacturing.combustion.value;
      var km = Math.round(t * 1000 / perKmPetrol / 10) * 10;
      var legs = t * 1000 / (F.flights.distanceKm.short * F.flights.distanceUplift * F.flights.perPkm.short.value);
      var out = [km.toLocaleString("en-US") + " km in a petrol car"];
      if (legs >= 0.4) out.push(legs.toFixed(legs < 3 ? 1 : 0) + " short-haul flight" + (legs >= 1.95 ? "s" : ""));
      out.push(Math.round(t / B.targets.y2030.value * 100) + "% of the " + fmtT(B.targets.y2030.value) + " budget for 2030");
      return out.join(" · ");
    }
    function insBox(title, body) { return '<div class="ins-box"><h4>' + title + "</h4>" + body + "</div>"; }

    /* The bridge from "what would shrink this" to actually trying it.
     * The Potential tab already narrows its list to a held-open band — this just carries the
     * selection across, so the answer to "what do I do about my flights" is one click from the
     * question instead of a tab switch and a hunt. Offered only when changes were actually
     * proposed: no button under "nothing here would shrink this further".
     */
    function tryThereBtn(list, gone, fallback, pred, all) {
      if (gone || !list.length || !pred || !all) return "";
      /* Whether to offer the button is decided by running the DESTINATION'S OWN calculation,
       * not this panel's. The two differ in ways that would otherwise leak out as a broken
       * promise: this page describes the footprint you measured and lists every change that
       * would shrink the selection; the Potential list is computed on the scenario you have
       * ticked, drops the changes already ticked, and only keeps what still saves something
       * there. So a change worth 40 kg here can be worth nothing there once the heat pump is
       * on. No count is shown on the button for the same reason — a number that is right on
       * this page and wrong on the next one is worse than no number.
       */
      var note = function (t) { return '<p class="muted small ins-try-note">' + t + "</p>"; };
      var ticked = applyPicked(all);
      if (sumSources(ticked, pred) <= 0.001) return note("Your ticked changes already remove this entirely.");
      if (!leversFor(ticked, all, pred, true, true).length) {
        return note("You have already ticked everything on this list that still shrinks it.");
      }
      potPinFallbackNext = fallback || null;
      return '<button type="button" class="btn-primary ins-try" id="insToPotential">Show these on the Potential tab →</button>' +
        note("Opens the Potential tab with the list of changes and the diagram both narrowed to this.");
    }
    var potPinFallbackNext = null;

    // Nothing pinned: the panel says what clicking would get you, rather than going blank.
    function clearInsight(box) {
      box.hidden = true; box.innerHTML = "";
      $("detInsightEmpty").hidden = false;
      $("detLive").textContent = "";
    }
    // `which` is always "det" today — the analysis lives on the Details tab — but it reads
    // the same way either diagram is drawn, so nothing here assumes which page called it.
    function renderInsight(which, scenario, all) {
      var box = $("detInsight"), m = chartModel[which], held = pinned[which];
      if (!m || !held) { clearInsight(box); return; }
      var bits = held.split(":"), kind = bits[0], id = bits.slice(1).join(":");
      var total = m.total, html = "", head = "", sub = "", value = 0;

      if (kind === "src") {
        var row = m.rows.filter(function (r) { return r.key === id; })[0];
        if (!row) { pinned[which] = null; clearInsight(box); return; }
        var area = m.areas.filter(function (a) { return a.id === row.domain; })[0] || { now: row.now, label: row.domainLabel };
        value = row.now; head = row.label; sub = "in " + row.domainLabel;
        html += insBox("Where it actually happens",
          "<p><strong>" + esc(row.causeLabel) + "</strong> — " + esc(row.causeGroupLabel) + ".</p>" +
          '<p class="muted small">Consumption-based accounting counts this wherever in the world it is released, which is why it is yours even when the chimney is somewhere else.</p>');
        if (row.detail) html += insBox("What is inside this row",
          "<p>" + esc(row.detail) + '</p><p class="muted small">Items under 1.2% of your footprint are drawn as one row, named after what is in it.</p>');
        html += insBox(row.now <= 0.001 && row.base > 0.001 ? "How big it was" : "How big that is",
          "<p>" + esc(anchors(Math.max(row.now, row.base))) + "</p>" +
          '<p class="muted small">' + Math.round(row.now / Math.max(area.now, 0.001) * 100) + "% of your " + esc(area.label.toLowerCase()) +
          ", " + (row.now / Math.max(total, 0.001) * 100).toFixed(1) + "% of your whole footprint.</p>");
        var ids = row.srcIds, dom = row.domain;
        var lvSrc = leversFor(scenario, all, function (x) { return x.domain === dom && ids.indexOf(x.id) >= 0; }, false);
        var goneSrc = row.now <= 0.001 && row.base > 0.001;
        html += insBox("What would shrink this", leverLines(lvSrc, goneSrc) + tryThereBtn(lvSrc, goneSrc, "dom:" + dom, function (x) { return x.domain === dom && ids.indexOf(x.id) >= 0; }, all));

      } else if (kind === "cause") {
        var c = m.causes.filter(function (x) { return x.id === id; })[0];
        if (!c) { pinned[which] = null; clearInsight(box); return; }
        value = c.now; head = c.label; sub = c.groupLabel;
        var feeds = m.rows.filter(function (r) { return r.cause === id && r.now > 0; }).sort(function (a, b) { return b.now - a.now; });
        if (feeds.length) html += insBox("What this feeds",
          '<ul class="ins-list">' + feeds.slice(0, 7).map(function (r) {
            return "<li><span><i style=\"background:" + r.color + '"></i>' + esc(r.label) + ' <span class="muted">· ' + esc(r.domainLabel.toLowerCase()) + "</span></span><b>" + r.now.toFixed(2) + " t</b></li>";
          }).join("") + "</ul>" +
          (feeds.length > 7 ? '<p class="muted small">…and ' + (feeds.length - 7) + " more.</p>" : ""));
        html += insBox("How big that is", "<p>" + esc(anchors(c.now)) + "</p>");
        var lvCause = leversFor(scenario, all, function (x) { return x.cause === id; }, false);
        var goneCause = c.now <= 0.001 && c.base > 0.001;
        html += insBox("What would shrink this", leverLines(lvCause, goneCause) + tryThereBtn(lvCause, goneCause, null, function (x) { return x.cause === id; }, all));

      } else if (kind === "dom") {
        var a2 = m.areas.filter(function (x) { return x.id === id; })[0];
        if (!a2) { pinned[which] = null; clearInsight(box); return; }
        value = a2.now; head = a2.label; sub = "one of the six areas";
        var avg = B.austria.byDomain[id];
        var diff = avg ? Math.round((a2.now - avg) / avg * 100) : null;
        html += insBox("Against the Austrian average",
          "<p>Austria averages <strong>" + avg.toFixed(1) + " t</strong> here. You are at <strong>" + a2.now.toFixed(2) + " t</strong>" +
          (diff === null ? "" : " — " + (diff >= 0 ? "<strong>" + diff + "% above</strong>" : "<strong>" + Math.abs(diff) + "% below</strong>")) + ".</p>" +
          '<p class="muted small">The per-area split of the Austrian average is illustrative, not measured — use it to see roughly where you sit, not as a precise benchmark.</p>');
        var mine = m.rows.filter(function (r) { return r.domain === id && r.now > 0; }).sort(function (x, y) { return y.now - x.now; });
        if (mine.length) html += insBox("What makes it up",
          '<ul class="ins-list">' + mine.slice(0, 7).map(function (r) {
            return "<li><span>" + esc(r.label) + ' <span class="muted">· ' + esc(r.causeLabel.toLowerCase()) + "</span></span><b>" + r.now.toFixed(2) + " t</b></li>";
          }).join("") + "</ul>");
        var lvDom = leversFor(scenario, all, function (x) { return x.domain === id; }, false);
        var goneDom = a2.now <= 0.001 && a2.base > 0.001;
        html += insBox("What would shrink this", leverLines(lvDom, goneDom) + tryThereBtn(lvDom, goneDom, null, function (x) { return x.domain === id; }, all));

      } else { // the whole footprint
        value = total; head = "Your whole footprint"; sub = "everything in the diagram";
        var biggest = m.areas.slice().sort(function (x, y) { return y.now - x.now; })[0];
        var biggestRow = m.rows.slice().sort(function (x, y) { return y.now - x.now; })[0];
        html += insBox("Where you stand",
          "<p>Austria averages " + B.austria.total.toFixed(1) + " t, the world " + B.world.total.toFixed(1) + " t, and the 1.5 °C budget for 2030 is " + B.targets.y2030.value.toFixed(1) + " t.</p>" +
          "<p>You are at <strong>" + total.toFixed(1) + " t</strong> — " +
          (total <= B.targets.y2030.value ? "inside the budget." : (total / B.targets.y2030.value).toFixed(1) + "× the budget.") + "</p>");
        html += insBox("The two biggest things in it",
          '<ul class="ins-list"><li><span><i style="background:' + biggest.color + '"></i>' + esc(biggest.label) + "</span><b>" + biggest.now.toFixed(2) + " t</b></li>" +
          "<li><span>" + esc(biggestRow.label) + ' <span class="muted">· ' + esc(biggestRow.domainLabel.toLowerCase()) + "</span></span><b>" + biggestRow.now.toFixed(2) + " t</b></li></ul>");
        html += insBox("How big that is", "<p>" + esc(anchors(total)) + "</p>" +
          '<p class="muted small">Not included: about ' + B.publicShare.austria.toFixed(0) + " t per person of public services, left out of every bar here and out of the 1.5 °C target too.</p>");
        var lvAll = leversFor(scenario, all, function () { return true; }, false);
        html += insBox("What would shrink it most", leverLines(lvAll, false) + tryThereBtn(lvAll, false, null, function () { return true; }, all));
      }

      box.innerHTML =
        '<div class="ins-head"><div><div class="eyebrow">Selected</div><div class="ins-title">' + esc(head) +
        '</div><div class="muted small">' + esc(sub) + "</div></div>" +
        '<div class="ins-num">' + value.toFixed(2) + ' t<span class="muted small"> · ' + (value / Math.max(total, 0.001) * 100).toFixed(1) + "% of your footprint</span></div>" +
        '<button type="button" class="seg-btn" id="insClose">Let go</button></div>' +
        '<div class="ins-grid">' + html + "</div>";
      box.hidden = false;
      $("detInsightEmpty").hidden = true;
      $("detLive").textContent = "Analysis: " + head + ", " + value.toFixed(2) + " tonnes.";
      $("insClose").onclick = function () { pinned[which] = null; renderDetails(); };
      var tryBtn = $("insToPotential");
      if (tryBtn) tryBtn.onclick = function () {
        pinned.pot = pinned[which];
        potPinFallback = potPinFallbackNext;
        showTab("potential");
      };
    }

    // ---------- saving results ----------
    // 1) a list of snapshots in this browser (localStorage)  2) a downloadable JSON file  3) print / PDF
    var SAVED_KEY = "greenapp.saved.v1";
    function readSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch (e) { return []; } }
    function writeSaved(list) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

    function snapshot(name) {
      var r = E.calculate(state.profile), sim = simulate(state.profile);
      var now = new Date();
      return {
        format: "green-app-result", formatVersion: 1, factorsVersion: F.version,
        id: now.getTime().toString(36), name: name || "", savedAt: now.toISOString(),
        result: { total: r.total, low: sim.low, high: sim.high, byDomain: r.byDomain },
        answers: { profile: state.profile, answered: state.answered, order: state.order, seq: state.seq }
      };
    }
    function fmtDate(iso) {
      var d = new Date(iso);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    // The status line lives in the dialog; remember the last message so reopening still shows it.
    var lastStatus = "";
    function status(msg) { lastStatus = msg; $("saveStatus").textContent = msg; }

    function renderSaved() {
      var list = readSaved(), box = $("savedList");
      box.innerHTML = "";
      $("savedEmpty").hidden = !!list.length;
      if (!list.length) return;
      var table = el("table", "saved");
      table.innerHTML = "<tr><th>Saved</th><th>Name</th><th>Footprint</th><th>Change</th><th></th></tr>";
      list.forEach(function (snap, i) {
        var prev = list[i + 1]; // list is newest first
        var delta = prev ? snap.result.total - prev.result.total : null;
        var tr = el("tr");
        tr.innerHTML = "<td>" + esc(fmtDate(snap.savedAt)) + "</td><td>" + esc(snap.name || "–") + "</td>" +
          "<td><strong>" + snap.result.total.toFixed(1) + " t</strong> <span class=\"rng\">" + snap.result.low.toFixed(1) + "–" + snap.result.high.toFixed(1) + "</span></td>" +
          '<td class="' + (delta == null ? "" : delta > 0.05 ? "up" : delta < -0.05 ? "down" : "") + '">' + (delta == null ? "–" : (delta > 0 ? "+" : "") + delta.toFixed(1) + " t") + "</td>";
        var actions = el("td", "saved-actions");
        actions.appendChild(button("Open", "seg-btn", function () { loadSnapshot(snap, "Opened “" + (snap.name || fmtDate(snap.savedAt)) + "”."); }));
        actions.appendChild(button("Download", "seg-btn", function () { download(snap); }));
        var del = button("Delete", "seg-btn", function () {
          if (!del.classList.contains("confirm")) { del.classList.add("confirm"); del.textContent = "Sure?"; return; }
          writeSaved(readSaved().filter(function (x) { return x.id !== snap.id; }));
          renderSaved(); status("Deleted.");
        });
        actions.appendChild(del);
        tr.appendChild(actions);
        table.appendChild(tr);
      });
      box.appendChild(table);
    }

    function download(snap) {
      var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      var a = doc.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "green-app-result-" + snap.savedAt.slice(0, 10) + (snap.name ? "-" + snap.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "") + ".json";
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    function loadSnapshot(snap, msg) {
      closeSaveDialog();
      var a = snap.answers;
      state = freshState();
      state.profile = a.profile; state.answered = a.answered || {}; state.order = a.order || {}; state.seq = a.seq || 0;
      picked = {};
      save();
      renderProfile();
      $("messages").innerHTML = "";
      if (nextStep()) { // file from an older version with questions missing
        say("Loaded your saved answers. A few questions are new since then — let’s fill them in.");
        showTab("measure"); advance(); return;
      }
      state.finished = true;
      $("tabResults").disabled = false;
      $("tabDetails").disabled = false;
      $("tabPotential").disabled = false;
      say("Loaded saved answers from " + fmtDate(snap.savedAt) + ". Tap any answer to change it.");
      showResults();
      var nav = el("div", "nav");
      nav.appendChild(button("See my results →", "btn-primary", function () { showTab("results"); }));
      $("controls").appendChild(nav);
      showTab("results");
      var now = E.calculate(state.profile).total;
      status((msg || "Loaded.") + (Math.abs(now - snap.result.total) > 0.05 ? " Recalculated with today’s emission factors: " + now.toFixed(1) + " t (saved as " + snap.result.total.toFixed(1) + " t)." : ""));
    }

    /* The save-and-load page.
     * Saving, downloading, printing and opening all live in one dialog reached from the header,
     * instead of a card sitting in the middle of the results. Opening a file has to work before
     * any questions are answered, so only the three that need a finished result are disabled.
     */
    function openSaveDialog() {
      var ready = state.finished;
      ["saveBtn", "downloadBtn", "printBtn"].forEach(function (id) { $(id).disabled = !ready; });
      $("saveName").disabled = !ready;
      $("saveUnavailable").hidden = ready;
      renderSaved();
      if (!$("saveDialog").open) $("saveDialog").showModal();
      if (ready) $("saveName").focus();
    }
    function closeSaveDialog() { if ($("saveDialog").open) $("saveDialog").close(); }

    function openFile(file) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var snap = JSON.parse(reader.result);
          if (snap.format !== "green-app-result" || !snap.answers || !snap.answers.profile) throw new Error("not a Green App file");
          var list = readSaved();
          if (!list.some(function (x) { return x.id === snap.id; })) { list.push(snap); list.sort(function (a, b) { return b.savedAt < a.savedAt ? -1 : 1; }); writeSaved(list); }
          renderSaved();
          loadSnapshot(snap, "Opened file “" + file.name + "”.");
        } catch (e) {
          showTab(state.finished ? "results" : "measure");
          say("Sorry — that file doesn’t look like a saved Green App result.");
        }
      };
      reader.readAsText(file);
    }

    // ---------- code viewer ----------
    function highlight(src) {
      var re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(\d+(?:\.\d+)?)\b|\b(function|return|var|if|else|for|true|false|null|new|typeof)\b/g;
      var out = "", last = 0, m;
      while ((m = re.exec(src))) {
        out += esc(src.slice(last, m.index));
        var cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : "k";
        out += '<span class="' + cls + '">' + esc(m[0]) + "</span>";
        last = re.lastIndex;
      }
      return out + esc(src.slice(last));
    }
    function collectSources(obj, path, out) {
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if (k === "source" && typeof v === "string") out.push("• " + path.join(" › ") + "\n  " + v);
        else if (v && typeof v === "object") collectSources(v, path.concat(k), out);
      });
      return out;
    }
    // The method, rendered from data/docs.js — the same text that METHOD.md is generated from,
    // so what you read here and what is in the repository can never drift apart.
    function methodHtml(filter) {
      var D = G.docs, html = "";
      html += '<p class="doc-lead">' + D.intro.map(esc).join("</p><p class=\"doc-lead\">") + "</p>";
      var list = D.sections.filter(function (s) {
        if (!filter) return true;
        var hay = (s.title + " " + s.body.join(" ") + " " + (s.sources || []).join(" ") + " " + (s.check || "") + " " + (s.formula || "")).toLowerCase();
        return hay.indexOf(filter.toLowerCase()) >= 0;
      });
      if (!list.length) return html + '<p class="doc-lead">Nothing in the method matches that.</p>';
      html += '<nav class="doc-toc">' + list.map(function (s) {
        return '<a href="#doc-' + s.id + '">' + esc(s.title) + "</a>";
      }).join("") + "</nav>";
      list.forEach(function (s) {
        html += '<section class="doc-sec" id="doc-' + s.id + '"><h3>' + esc(s.title) + "</h3>";
        s.body.forEach(function (p) { html += "<p>" + esc(p) + "</p>"; });
        if (s.formula) html += '<div class="doc-formula">' + esc(s.formula) + "</div>";
        if (s.code) html += '<p class="doc-where"><strong>In the code:</strong> <code>' + esc(s.code) + "</code></p>";
        if (s.check) html += '<p class="doc-check"><strong>Check it:</strong> ' + esc(s.check) + "</p>";
        if (s.sources) html += "<p class=\"doc-src-title\"><strong>Sources</strong></p><ul class=\"doc-src\">" +
          s.sources.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
        html += "</section>";
      });
      return html;
    }

    function openCode() {
      var tabs = $("codeTabs"), files = Object.keys(G.sources), search = $("codeSearch");
      tabs.innerHTML = "";
      var current = null;
      var show = function (name, btn) {
        current = name;
        Array.prototype.forEach.call(tabs.children, function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var view = $("codeView");
        view.classList.toggle("doc-view", name === "Method & sources");
        search.hidden = name !== "Method & sources";
        if (name === "Method & sources") {
          view.innerHTML = methodHtml(search.value.trim());
        } else if (name === "Data sources") {
          var lines = collectSources(F, ["factors"], []).concat(collectSources(B, ["benchmarks"], []));
          view.textContent = "Every number the calculator uses, and where it comes from.\nFactor data version: " + F.version + "\n\n" + lines.join("\n\n");
        } else {
          view.innerHTML = '<span class="c">// ' + esc(name) + " — the function that defines this file (open the file itself for the full text)</span>\n\n" + highlight(G.sources[name]);
        }
        view.scrollTop = 0;
      };
      search.oninput = function () { if (current === "Method & sources") $("codeView").innerHTML = methodHtml(search.value.trim()); };
      ["Method & sources", "js/engine.js", "data/factors.js", "data/benchmarks.js", "data/docs.js", "js/questions.js", "js/sankey.js", "js/chart.js", "js/app.js", "Data sources"].forEach(function (name, i) {
        if (name !== "Data sources" && name !== "Method & sources" && files.indexOf(name) < 0) return;
        var b = el("button", "", esc(name));
        b.type = "button";
        b.onclick = function () { show(name, b); };
        tabs.appendChild(b);
        if (i === 0) show(name, b);
      });
      $("codeDialog").showModal();
    }

    // ---------- start ----------
    function start() {
      $("codeBtn").onclick = openCode;
      $("codeClose").onclick = function () { $("codeDialog").close(); };
      $("tabMeasure").onclick = function () { showTab("measure"); };
      $("tabResults").onclick = function () { if (state.finished) showTab("results"); };
      $("tabDetails").onclick = function () { if (state.finished) showTab("details"); };
      $("tabPotential").onclick = function () { if (state.finished) showTab("potential"); };
      $("toPotential").onclick = function () { showTab("potential"); };
      $("selectMine").onclick = function () {
        E.levers(state.profile).forEach(function (l) { if (l.control === "yours") picked[l.id] = true; });
        renderPotential();
      };
      $("clearLevers").onclick = function () { picked = {}; renderPotential(); };
      $("reachGoal").onclick = function () {
        var path = E.pathToTarget(state.profile, B.targets.y2030.value);
        picked = {};
        path.levers.forEach(function (l) { picked[l.id] = true; });
        renderPotential();
        if (!path.reached) $("potHint").textContent = "Even every change together stops at " + path.total.toFixed(1) + " t. The rest would need a smaller home, fewer people’s worth of stuff, or changes outside this list.";
        else $("potHint").innerHTML = "This is the shortest way there: the biggest changes first, until you are under " +
            fmtT(B.targets.y2030.value) + ". <strong>It closes the part of the gap that is yours to close.</strong> " +
            "The " + fmtT(B.publicShare.austria) + " decided collectively — hospitals, schools, roads, the things built once and used for decades — " +
            "is untouched by every change on this list, and has to fall by about " +
            Math.round((1 - B.publicShare.target.value / B.publicShare.austria) * 100) + "% too. " +
            "That part moves through what a country builds and buys, not through what you tick here.";
      };
      Array.prototype.forEach.call(doc.querySelectorAll(".filter .seg-btn"), function (b) {
        b.onclick = function () {
          leverFilter = b.getAttribute("data-filter");
          Array.prototype.forEach.call(doc.querySelectorAll(".filter .seg-btn"), function (x) { x.classList.toggle("on", x === b); });
          renderPotential();
        };
      });

      startStickWatch("potStickTop", "potBarWrap", "potBarSpacer", "panelPotential");
      startStickWatch("detStickTop", "detBarWrap", "detBarSpacer", "panelDetails");

      // Crossing into or out of the side-by-side layout changes how small the diagram is
      // drawn, and so how big its labels must be. Redraw — but only on the crossing.
      if (root.matchMedia) {
        var onCross = function () {
          if (!state.finished) return;
          if (!$("panelPotential").hidden) renderPotential();
          if (!$("panelDetails").hidden) renderDetails();
        };
        // one crossing matters now: into and out of the side-by-side layout, which changes
        // how small the diagram is drawn and so how big its labels have to be
        var mq = root.matchMedia("(min-width: 1240px)");
        if (mq.addEventListener) mq.addEventListener("change", onCross);
        else if (mq.addListener) mq.addListener(onCross);
      }
      $("saveForm").onsubmit = function (ev) {
        ev.preventDefault();
        if (!state.finished) return;
        var snap = snapshot($("saveName").value.trim());
        var list = readSaved(); list.unshift(snap);
        if (writeSaved(list)) { status("Saved" + (snap.name ? " “" + snap.name + "”" : "") + " — " + snap.result.total.toFixed(1) + " t. It’s in the list below."); $("saveName").value = ""; }
        else { status("This browser blocks saving here — use “Download as a file” instead."); }
        renderSaved();
      };
      $("downloadBtn").onclick = function () { download(snapshot($("saveName").value.trim())); status("Downloaded. Open it again here with “Open saved file”."); };
      // Print the results, not whichever tab happens to be open, and not through the dialog.
      $("printBtn").onclick = function () { closeSaveDialog(); showTab("results"); setTimeout(function () { root.print(); }, 60); };
      $("openFileBtn").onclick = function () { $("openFileInput").click(); };
      $("openFileInput").onchange = function () { if (this.files[0]) openFile(this.files[0]); this.value = ""; };
      $("savedBtn").onclick = openSaveDialog;
      $("saveThis").onclick = openSaveDialog;
      $("saveClose").onclick = closeSaveDialog;
      $("saveDialog").addEventListener("close", function () { $("saveStatus").textContent = lastStatus; });
      renderSaved();
      $("restartBtn").onclick = function () {
        try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        state = freshState();
        $("messages").innerHTML = "";
        $("tabResults").disabled = true;
        $("tabDetails").disabled = true;
        $("tabPotential").disabled = true;
        picked = {};
        status("");
        $("headline").textContent = "What’s your carbon footprint?";
        doc.body.classList.remove("has-result");
        showTab("measure");
        renderProfile(); intro();
      };
      var restored = load();
      renderProfile();
      if (restored && !nextStep()) {
        state.finished = true;
        $("tabResults").disabled = false;
        $("tabDetails").disabled = false;
        $("tabPotential").disabled = false;
        say("Welcome back! Your previous answers are loaded — change any of them on the right, or press “Start over”.");
        showResults();
        var nav = el("div", "nav");
        nav.appendChild(button("See my results →", "btn-primary", function () { showTab("results"); }));
        $("controls").appendChild(nav);
      } else if (restored && Object.keys(state.answered).length) {
        say("Welcome back — let’s continue where you left off.");
        advance();
      } else {
        intro();
      }
    }
    function intro() {
      say("Hi! I’ll walk you through your home, travel, food, spending and money — mostly taps, about 5 minutes. If you know exact numbers from your bills, great; if not, just guess — I’ll show how certain the result is.");
      advance();
    }

    return { start: start, state: function () { return state; }, showTab: showTab, snapshot: snapshot, loadSnapshot: loadSnapshot };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.sources["js/app.js"] = defineApp.toString();
  if (root.document) {
    G.app = defineApp(G, root.document);
    root.document.addEventListener("DOMContentLoaded", G.app.start);
  }
})(typeof window !== "undefined" ? window : globalThis);
