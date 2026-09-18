/*
 * User interface: tabs, guided chat, answer list, results and code viewer.
 * All maths lives in engine.js — this file only moves data around.
 */
(function (root) {
  function defineApp(G, doc) {
    var F = G.factors, B = G.benchmarks, Q = G.questions, E = G.engine;
    var STORE_KEY = "greenapp.v3"; // bump when the profile structure changes
    var $ = function (id) { return doc.getElementById(id); };

    function freshState() { return { profile: Q.blankProfile(), answered: {}, order: {}, seq: 0, finished: false, currentId: null }; }
    var state = freshState();
    var leverFilter = "all";
    var picked = {}; // lever ids ticked in the Potential tab
    var pinned = null; // "<kind>:<id>" — the band held open in the Sankey, survives redraws

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
    var TABS = { measure: ["panelMeasure", "tabMeasure"], results: ["panelResults", "tabResults"], potential: ["panelPotential", "tabPotential"] };
    function showTab(name) {
      Object.keys(TABS).forEach(function (k) {
        var on = k === name;
        $(TABS[k][0]).hidden = !on;
        $(TABS[k][1]).setAttribute("aria-selected", on ? "true" : "false");
      });
      if (name === "potential") renderPotential();
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
      var sim = E.simulate(p, { samples: 4000, seed: 42 });
      var tip = E.biggestUncertainty(p, { samples: 1500, seed: 7 });
      var at = B.austria, target = B.targets.y2030.value;

      $("headline").textContent = r.total.toFixed(1) + " t CO₂e per year";
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
      $("legend").innerHTML = G.chart.legend(B.domains);

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

      var o = E.compensation(p), oh = [];
      if (!o.tonnes && !o.contributionEur) {
        oh.push("<p>You don’t buy compensation. That’s fine: reducing emissions counts first. If you do, it’s shown here — not subtracted from your footprint.</p>");
      } else {
        oh.push("<p>Shown separately, never subtracted. Credits vary hugely in quality: research finds many avoidance credits deliver far less than they claim (Probst et al. 2024). The Oxford Offsetting Principles recommend moving towards removals with durable storage.</p>");
        oh.push('<table class="offsets"><tr><th>Type</th><th>t/yr</th><th>Storage</th><th>Risk</th></tr>');
        o.byType.forEach(function (x) {
          oh.push("<tr><td>" + esc(x.info.label) + "</td><td>" + x.tonnes + "</td><td>" + esc(x.info.storage) + "</td><td>" + esc(x.info.risk) + "</td></tr>");
        });
        if (o.contributionEur) oh.push("<tr><td>Climate contribution</td><td>–</td><td colspan=2>€" + Math.round(o.contributionEur).toLocaleString("en-US") + "/yr funding climate action without claiming to cancel your emissions — the most honest kind of claim.</td></tr>");
        oh.push("</table>");
      }
      $("resOffsets").innerHTML = oh.join("");

      var m = p.money, mt = [];
      var bankTxt = { ethical: "You bank with an ethical/sustainability bank — the strongest choice here.", greenProduct: "You use sustainable products at a normal bank — worth asking what the bank finances overall, not just your product.", conventional: "You have a normal bank account: your deposits help fund whatever the bank lends to, which can include fossil fuels.", unknown: "Bank type unknown." }[m.bankType];
      mt.push(bankTxt);
      var savTxt = { none: "", labelled: "Your investments carry a sustainability label — good. The Austrian Umweltzeichen UZ 49 excludes e.g. coal and oil companies.", conventional: "Your savings/pension are invested conventionally. Switching to labelled funds (e.g. Umweltzeichen UZ 49) is a lever many people overlook.", unknown: "Worth checking how your savings and pension are invested." }[m.savings];
      if (savTxt) mt.push(savTxt);
      // A real number for financed emissions — deliberately beside the footprint, never in it.
      var fin = E.financed(p);
      if (fin) {
        mt.push('<p class="money-figure">Your €' + Math.round(fin.eur).toLocaleString("en-US") + ' finances somewhere between <strong>' +
          fin.low.toFixed(1) + " and " + fin.high.toFixed(1) + " t CO₂e a year</strong>" +
          (fin.high > r.total ? " — the top of that range is more than everything else on this page put together." : ".") +
          (fin.labelled ? " A sustainability label pushes you towards the lower end, though labels vary." : "") + "</p>");
        mt.push('<p class="muted small">Why a range that wide, and why not in the bar: the two published reference points for the same idea disagree by a factor of six (ECB 2025: 0.8 t per €10,000 · Make My Money Matter 2021: 5.4 t). A number that moves 6× with the method has no business inside a bar claiming ±20%. And it is a different kind of number — the emissions of a company you part-own are already counted in the footprint of whoever buys what it makes, so adding it here would count the same tonnes twice. Where your money sits is leverage, not consumption: it moves capital, which is exactly why it is worth doing and why it is not measured in the same currency as your heating bill.</p>');
      } else {
        mt.push('<p class="muted small">Not in the footprint, and not because it is small. The emissions your money finances are attributed, not consumed — the companies you part-own are already counted in the footprint of whoever buys what they make, so adding them here would count the same tonnes twice. Published estimates also disagree by a factor of six for the same amount of money. Tell the app roughly how much you have invested and it will show the range, next to your footprint rather than inside it. Bank and insurance admin, separately, is roughly 0.1 t per person and nearly the same for everyone.</p>');
      }
      $("resMoney").innerHTML = mt.join(" ");

      $("resPublic").textContent = "Roughly " + B.publicShare.austria.toFixed(0) + " t more per person come from public services, infrastructure and investment in Austria (hospitals, roads, schools…). Everyone carries this share; you influence it through politics, not lifestyle — so it’s left out on all three bars.";
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
          (after.total <= target.value ? "that reaches the 2030 Paris goal of " + fmtT(target.value) + "." : (after.total / target.value).toFixed(1) + "× the 2030 Paris goal of " + fmtT(target.value) + ".")
        : "Nothing ticked yet — your footprint today is " + now.total.toFixed(1) + " t.";
      var gap = after.total - target.value;
      $("potGap").innerHTML = gap > 0.05
        ? "Still <strong>" + gap.toFixed(1) + " t</strong> above the 1.5 °C budget of " + fmtT(target.value) + "." +
          (all.some(function (l) { return !picked[l.id]; }) ? " Try “Reach the 1.5 °C goal” to see one way there." : " Even all the changes together don’t close the gap — the rest sits in things this calculator can’t change for you.")
        : "<strong>Within the 1.5 °C budget</strong> of " + fmtT(target.value) + " for 2030.";
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
      $("potChart").innerHTML = G.sankey.render({
        domains: B.domains,
        sources: E.sources(scenario),
        total: after.total,
        baseline: baseSources,           // frozen layout + the dashed ghost of today
        baselineTotal: now.total,
        goal: { value: target.value, label: "1.5 °C budget 2030:" }
      });
      G.sankey.attach($("potChartWrap"), $("potTip"), {
        selected: pinned,
        onSelect: function (pick) { pinned = pick; renderInsight(scenario, all); }
      });
      renderInsight(scenario, all);
      $("potChartState").textContent = chosen.length ? "· with your " + chosen.length + (chosen.length === 1 ? " change" : " changes") : "· as you live today";

      // Read the list easy first, drastic last: ordinary changes by saving, then the ones marked
      // "big" (a no-buy year, a smaller home, living like the average) by saving. engine.levers()
      // itself stays sorted purely by size — the kindness is a display choice, not arithmetic.
      var order = function (xs) {
        return xs.filter(function (l) { return l.control !== "big"; })
                 .concat(xs.filter(function (l) { return l.control === "big"; }));
      };
      var list = order(leverFilter === "yours" ? all.filter(function (l) { return l.control === "yours"; }) : all);
      var max = all.reduce(function (m, l) { return Math.max(m, l.saved); }, 0.001);
      // What each remaining change would add ON TOP of the ones already ticked. Several of these
      // overlap by design — a year without flying contains the night-train swap — and saying so
      // is better than letting someone tick two things and wonder why the total barely moved.
      var already = chosen.length ? E.combined(p, chosen) : 0;
      var extra = {};
      all.forEach(function (l) { if (!picked[l.id]) extra[l.id] = E.combined(p, chosen.concat([l])) - already; });
      var ul = $("levers");
      ul.innerHTML = "";
      if (!list.length) ul.appendChild(el("li", "muted", "Nothing to show for this filter."));
      var bigStarted = false;
      list.forEach(function (l) {
        if (l.control === "big" && !bigStarted && leverFilter !== "yours") {
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
          (l.why ? '<span class="lever-why">' + esc(l.why) + "</span>" : "") + note + "</label>" +
          '<div class="lever-save"><div class="save-num">−' + fmtSave(l.saved) + '</div><div class="save-bar"><span style="width:' + Math.max(4, Math.round(l.saved / max * 100)) + '%"></span></div></div>';
        li.querySelector("input").onchange = function () { picked[l.id] = this.checked; renderPotential(); };
        ul.appendChild(li);
      });
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
    function leversFor(scenario, all, pred) {
      var before = sumSources(scenario, pred);
      if (before <= 0.001) return [];
      return all.filter(function (l) { return !picked[l.id]; }).map(function (l) {
        var q = JSON.parse(JSON.stringify(scenario));
        l.change(q);
        return { label: l.label, control: l.control, saved: before - sumSources(q, pred) };
      }).filter(function (x) { return x.saved > 0.005; })
        .sort(function (a, b) { return b.saved - a.saved; }).slice(0, 4);
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
      out.push(Math.round(t / B.targets.y2030.value * 100) + "% of the 3.0 t budget for 2030");
      return out.join(" · ");
    }
    function insBox(title, body) { return '<div class="ins-box"><h4>' + title + "</h4>" + body + "</div>"; }

    function renderInsight(scenario, all) {
      var box = $("potInsight"), m = G.sankey.model();
      if (!m || !pinned) { box.hidden = true; box.innerHTML = ""; return; }
      var bits = pinned.split(":"), kind = bits[0], id = bits.slice(1).join(":");
      var total = m.total, html = "", head = "", sub = "", value = 0;

      if (kind === "src") {
        var row = m.rows.filter(function (r) { return r.key === id; })[0];
        if (!row) { pinned = null; box.hidden = true; box.innerHTML = ""; return; }
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
        html += insBox("What would shrink this", leverLines(leversFor(scenario, all,
          function (x) { return x.domain === dom && ids.indexOf(x.id) >= 0; }), row.now <= 0.001 && row.base > 0.001));

      } else if (kind === "cause") {
        var c = m.causes.filter(function (x) { return x.id === id; })[0];
        if (!c) { pinned = null; box.hidden = true; box.innerHTML = ""; return; }
        value = c.now; head = c.label; sub = c.groupLabel;
        var feeds = m.rows.filter(function (r) { return r.cause === id && r.now > 0; }).sort(function (a, b) { return b.now - a.now; });
        if (feeds.length) html += insBox("What this feeds",
          '<ul class="ins-list">' + feeds.slice(0, 7).map(function (r) {
            return "<li><span><i style=\"background:" + r.color + '"></i>' + esc(r.label) + ' <span class="muted">· ' + esc(r.domainLabel.toLowerCase()) + "</span></span><b>" + r.now.toFixed(2) + " t</b></li>";
          }).join("") + "</ul>" +
          (feeds.length > 7 ? '<p class="muted small">…and ' + (feeds.length - 7) + " more.</p>" : ""));
        html += insBox("How big that is", "<p>" + esc(anchors(c.now)) + "</p>");
        html += insBox("What would shrink this", leverLines(leversFor(scenario, all,
          function (x) { return x.cause === id; }), c.now <= 0.001 && c.base > 0.001));

      } else if (kind === "dom") {
        var a2 = m.areas.filter(function (x) { return x.id === id; })[0];
        if (!a2) { pinned = null; box.hidden = true; box.innerHTML = ""; return; }
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
        html += insBox("What would shrink this", leverLines(leversFor(scenario, all,
          function (x) { return x.domain === id; }), a2.now <= 0.001 && a2.base > 0.001));

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
        html += insBox("What would shrink it most", leverLines(leversFor(scenario, all, function () { return true; })));
      }

      box.innerHTML =
        '<div class="ins-head"><div><div class="eyebrow">Selected</div><div class="ins-title">' + esc(head) +
        '</div><div class="muted small">' + esc(sub) + "</div></div>" +
        '<div class="ins-num">' + value.toFixed(2) + ' t<span class="muted small"> · ' + (value / Math.max(total, 0.001) * 100).toFixed(1) + "% of your footprint</span></div>" +
        '<button type="button" class="seg-btn" id="insClose">Let go</button></div>' +
        '<div class="ins-grid">' + html + "</div>";
      box.hidden = false;
      $("insClose").onclick = function () { pinned = null; renderPotential(); };
    }

    // ---------- saving results ----------
    // 1) a list of snapshots in this browser (localStorage)  2) a downloadable JSON file  3) print / PDF
    var SAVED_KEY = "greenapp.saved.v1";
    function readSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch (e) { return []; } }
    function writeSaved(list) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

    function snapshot(name) {
      var r = E.calculate(state.profile), sim = E.simulate(state.profile, { samples: 4000, seed: 42 });
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
        else $("potHint").textContent = "This is the shortest way there: the biggest changes first, until you are under " + fmtT(B.targets.y2030.value) + ".";
      };
      Array.prototype.forEach.call(doc.querySelectorAll(".filter .seg-btn"), function (b) {
        b.onclick = function () {
          leverFilter = b.getAttribute("data-filter");
          Array.prototype.forEach.call(doc.querySelectorAll(".filter .seg-btn"), function (x) { x.classList.toggle("on", x === b); });
          renderPotential();
        };
      });
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
        $("tabPotential").disabled = true;
        picked = {};
        status("");
        $("headline").textContent = "What’s your carbon footprint?";
        showTab("measure");
        renderProfile(); intro();
      };
      var restored = load();
      renderProfile();
      if (restored && !nextStep()) {
        state.finished = true;
        $("tabResults").disabled = false;
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
