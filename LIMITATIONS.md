# What is still wrong with this tool

Last reviewed: 22 September 2026.

This is the register of what the app gets wrong, what it cannot see, and what it
quietly implies that is not true. It is kept in the repository rather than in a
notebook because every other honesty claim in this project is checkable, and a
list of known problems that only the author can see is not one.

Two kinds of entry:

- **Systemic biases** — structural. They are properties of how the tool is
  built, and no better emission factor fixes them.
- **Open issues** — specific. A number, a source or a missing feature. Each one
  could be closed by work.

A third section records **things that look like problems and are not**, because
well-meant fixes to those would make the tool worse.

---

## Part 1 — Systemic biases

### 1.1 Every loop closes on individual consumption

The tool measures what one person buys, compares it against per-person averages
and a per-person budget, and offers changes that are all purchases or habits.
That is a complete, self-consistent circuit — and the two largest facts the app
has established sit outside it entirely:

- **32% of the footprint is decided collectively** and has to fall by roughly as
  much as the private part. No lever in the list moves it.
- **Money may finance more than the whole lifestyle footprint** — up to 16.2 t
  against a 9.9 t measured footprint at the top of the published range. It has
  no lever either.

Mitigated, not fixed: the Details tab now opens with all three numbers side by
side, and "Reach the 1.5 °C goal" states what it does not reach. The structure
is unchanged. A reader who only uses the Potential tab still learns that their
carbon problem is a shopping problem.

**This is the bias the tool was most at risk of, and it is the one to keep
watching.** It is also the reason the planned handprint section must not become
a second scoreboard — see the note at the end.

### 1.2 Attention is allocated inversely to leverage

A 48 kg shorter-shower lever gets a checkbox, a named alternative, a mechanism
and a saving. €30,000 of invested money, worth 2.5–16.2 t a year, gets a
paragraph. The granularity of the lever list implies these are comparable kinds
of thing. They are not.

### 1.3 Every number on the Potential tab is an upper bound

Savings are computed as if the money freed up is never spent again. Rebound is
now stated beside the figures and scales with how much is ticked, but it is
never subtracted, so the headline figure remains the optimistic one. Someone
reading only the big number reads the best case.

The size of what is left out: Norwegian households, 34 actions, EXIOBASE — a
58% cut became 24–35% once re-spending was counted.

### 1.4 Comparing against national averages normalises high consumption

The bars are You / Austria / World. A reader at 9.9 t sees "1.3× the Austrian
average", which reads as a mild deviation. It is roughly four times the
1.5 °C-aligned budget and places them far into the top decile globally. The app
never says so, because it has no income question and no global distribution.

Averages are a comfortable reference class. That is exactly why they are the
wrong one for a rich-country reader, and the tool currently uses them
unaccompanied.

### 1.5 Housing levers ignore the carbon cost of the new equipment

Transport is handled properly: car manufacturing is amortised per kilometre and
appears as its own row, and the electric-car lever explicitly waits for
replacement because scrapping a working car wastes the carbon already in it.

Housing is not. The only housing rows are operational — space heating, hot
water, electricity. A heat pump, insulation, or a rooftop PV system therefore
shows its full operational saving with **zero** embodied cost. The asymmetry is
invisible to a reader and makes housing levers look better than transport ones
for no defensible reason.

### 1.6 A single year, presented as a rate

Everything is measured over one year and reported as though it were a standing
rate. A year with a new car, a renovation or the trip of a lifetime in it is not
representative, and the app gives no way to say so. The levers inherit the same
shape — "a no-buy year", "one flight fewer a year" — which reads oddly for
someone who flies once in five years.

The deeper version: an annual snapshot cannot see a life. Two people at 9.9 t
today, one of whom has flown every month for twenty years and one of whom is on
a first flight, get an identical result and an identical target. Between
generations the difference in lifetime budgets is already enormous — roughly
275 t CO₂ for someone born before 1946 against 56 t for someone born after 2012
— and the app's single 2.5 t line hides all of it.

Partly addressed: the Details tab now shows the path (2.5 → 1.1 → 0.3) and the
remaining stock, and explains why the app does not score anyone's past. Not
addressed: nothing marks an unusual year, and nothing adjusts for age or history.

### 1.7 No distinction between a decision and a habit

A heat pump is a twenty-year commitment; a shorter shower is five minutes. Both
appear as annual tonnes in the same list, ranked by size. Nothing tells a reader
which changes are durable, which need to be made once, and which have to be
maintained daily forever.

### 1.8 Austria-only, served worldwide

Factors, benchmarks, levers and subsidies are Austrian. The header says so; the
World bar invites everyone else to use it anyway. For a non-Austrian the
electricity mix alone makes the result wrong by a wide margin.

### 1.9 The lever list cannot contain bad news

By construction every lever has a positive saving — the audit enforces it. There
is no lever that increases emissions, and no representation of a trade-off. A
reader cannot discover from the list that some changes have a payback period, or
that some choices are worse than they look.

---

## Part 2 — Open issues

### Data that is not good enough yet

| # | Issue | Why it matters |
|---|---|---|
| 2.1 | **Financed emissions span 6×** — 0.8 t (ECB 2025) to 5.4 t (Make My Money Matter 2021) per €10,000. No Austrian figure, no methodology the app can defend, no lever. | The largest single number in the tool is also the least certain. A reader cannot act on "somewhere between 2.5 and 16.2 tonnes", and the app gives no guidance on what switching a bank or a pension actually achieves. **This is the biggest open data problem.** |
| 2.2 | **EXIOBASE Austria is still not done.** | Three things depend on it: the per-area split of the Austrian average (illustrative, but load-bearing for the "down to the Austrian average" levers), the functional composition of the public share, and the composition of the investment block. |
| 2.3 | **2011 shares applied to a 2023 total.** | The 68/21/8/3 final-demand split is GTAP 2011; the 10.9 t national total is 2023. Documented in `benchmarks.js`, not hidden, but it is a mix of vintages. |
| 2.4 | **The Steininger figures were read from a fetch of the article page, not verified against the paper.** | They are now load-bearing for the Austrian average and the whole excluded-share card. The percentages reconcile against the stated 123.6 Mt, but the units in the fetched table were mislabelled, which is not reassuring. |
| 2.5 | **Flight factors not verified against DESNZ 2025.** | Flights are often the largest single line in a result. |
| 2.6 | **EU figures disagree slightly with the Austrian ones** — SEI 2024 puts EU households at 65% of the consumption footprint against Austria's 68%. | Not a contradiction, but the app does not explain the difference. |
| 2.7 | **No uncertainty on the public share or the derived target.** | Every other number in the app carries a range. These two do not, which makes them look more certain than the ones that do. |

### Modelling gaps

| # | Issue |
|---|---|
| 2.8 | **Embodied carbon of the building you live in** (~0.3–0.8 t/yr amortised) sits in the investment block and is never personalised — a 40 m² flat and a 300 m² house carry the same zero. |
| 2.9 | **Carbon debt of a new heat pump, battery or PV system** is not modelled at all (see 1.5). |
| 2.10 | **Household waste treatment, pets, second homes, cruises** are not modelled. |
| 2.11 | **Rebound is not personalised.** It is a caveat on the page, not a property of the levers ticked, so someone who saves money and puts it into a labelled fund is told the same thing as someone who books a flight with it. |
| 2.12 | **Compensation quality is recorded by type, not by credit.** Two "nature-based removal" purchases of very different integrity are indistinguishable. |

### Interface and reach

| # | Issue |
|---|---|
| 2.13 | **The Potential tab is 10.4 screens on a phone.** Shortening it further means hiding levers, which trades the honest full ladder for brevity. Not obviously the right trade. |
| 2.14 | **No offline or installable version.** The app is fully static and would make a trivial PWA; a service worker brings a cache-invalidation failure mode on a site published by pushing. |
| 2.15 | **No second language.** An Austrian tool that exists only in English excludes much of its own audience. |
| 2.16 | **Nothing marks an unusual year.** A new car or a one-off renovation inflates a result with no way to flag it (see 1.6). |
| 2.17 | **Nothing is ever re-measured.** There is no way to see whether last year's ticked changes actually happened. Saved results support it; nothing in the interface uses them that way. |

### Process

| # | Issue |
|---|---|
| 2.18 | **Documentation drifts from the data.** On 22 September the method text still said "Austria 7.9 t ... times the ~72%" a day after both numbers changed. Fixed, but nothing prevents a recurrence: the prose in `data/docs.js` is not checked against `data/benchmarks.js` by anything. |
| 2.19 | **Two audit checks written in one session were tautological** (`x - x < 1e-12`, and a `\|\| true`). Both removed. A check that cannot fail reads as coverage, which is worse than an absent check. |

---

## Part 3 — Things that look like problems and are not

Changing any of these would make the tool less honest, not more. They are listed
so that a future reader does not "fix" them.

- **Compensation is never subtracted.** A tonne bought is not a tonne not
  emitted. The ladder shows the mix bought, scaled to itself and never to the
  footprint.
- **Financed emissions are never added.** They are attributed, not consumed, and
  already counted in the footprint of whoever buys what those companies make.
- **Rebound is never subtracted.** It depends on what a person does with the
  money, not on the lever; discounting would swap a measurable upper bound for
  an unmeasurable point estimate.
- **The public share is excluded from the bars.** It is also excluded from the
  2.5 t target. The exclusion is in the numerator *and* the denominator, which
  is what keeps the comparison fair.
- **Blocks with no measured breakdown are drawn hatched.** The gap in the
  picture is the gap in the data. A plausible-looking split of public spending
  would be worse than none.
- **No minimum bar height or width anywhere.** A small thing must look small.
- **The world bar keeps the global 72% household share** while Austria uses its
  own 68%. These are different quantities, not an inconsistency.

---

## A note on the planned handprint section

The intended next feature is "increase your handprint", not only reduce your
footprint. The failure mode is obvious and worth writing down before the work
starts: **a handprint expressed in avoided tonnes is offsetting logic with a
friendlier name**, and it would undo most of what Part 3 protects.

The defensible version keeps influence in its own units — what changes beyond
your own consumption — and never sums it into, or subtracts it from, the
footprint. Same treatment compensation and financed emissions already get:
shown, real, and never added.
