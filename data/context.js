/*
 * The argument about this, and how it was shaped.
 *
 * This file is the evidence base for the Context tab. Three rules, and the audit
 * enforces all three:
 *
 *   1. Every event carries a `source`. No event is on the timeline because it is
 *      well known. If it cannot be cited it is not here.
 *   2. Nothing is attributed to a company that the source does not attribute to
 *      that company. There is a documented case that Exxon knew and said the
 *      opposite; there is a documented case that BP paid to make the personal
 *      footprint the frame. There is no documented case that any one firm ran a
 *      doomism campaign, so doomism appears as a discourse with no name on it.
 *   3. The worked examples include one from the climate side. A page about
 *      misleading claims that only takes apart the other side's claims is itself
 *      one of the moves it is describing.
 *
 * The spine is Lamb et al. (2020), not a chronology of villains. Technique-based
 * inoculation generalises to claims the reader has not seen yet; fact-by-fact
 * debunking does not (Roozenbeek & van der Linden, Science Advances 2022). The
 * timeline is there to show that the techniques changed when they stopped
 * working, which is the one thing a chronology says better than a taxonomy.
 */
(function (root) {
  function defineContext() {
    return {
      version: "2026-09-v1",

      /* ---------- the two tracks ----------
       * track: "obstruction" above the axis, "movement" below it, "landmark" on it.
       * delay: which discourse in `delay` below this is an instance of, where the
       *        source supports saying so. Absent where it would be a guess.
       * at:    a sort key. Events inside a year are ordered by it, so a year with
       *        several entries does not depend on array order to read correctly.
       */
      timeline: [
        {
          year: 1977, at: "1977", track: "obstruction",
          label: "Exxon's own scientists brief management",
          detail: "Internal projections made between 1977 and 2003 put warming at 0.20 °C per decade, ±0.04. Reassessed in 2023, they scored an average of 72% against what actually happened — better than the projections James Hansen put before the US Congress in 1988.",
          source: "Supran, Rahmstorf & Oreskes, ‘Assessing ExxonMobil’s global warming projections’, Science 379 (2023)."
        },
        {
          year: 1988, at: "1988", track: "landmark",
          label: "The IPCC is founded",
          detail: "The same year Hansen tells the US Senate that warming is detectable. From here on, nobody making a public argument about this can claim the science did not exist.",
          source: "IPCC, history. Hansen testimony to the US Senate Committee on Energy and Natural Resources, 23 June 1988."
        },
        {
          year: 1989, at: "1989", track: "obstruction",
          label: "The Global Climate Coalition",
          detail: "Exxon, Mobil, Chevron, BP, Shell and others form a body to resist limits on emissions.",
          source: "Union of Concerned Scientists, ‘The Climate Deception Dossiers’ / deception timeline."
        },
        {
          year: 1991, at: "1991", track: "obstruction", delay: "denial",
          label: "“Reposition global warming as theory (not fact)”",
          detail: "The stated goal of the Information Council for the Environment, funded by the National Coal Association, the Western Fuels Association and the Edison Electric Institute. The campaign ran from February to August 1991 and collapsed when its own memos leaked.",
          source: "Leaked ICE strategy documents, 1991; summarised by the Union of Concerned Scientists and DeSmog."
        },
        {
          year: 1997, at: "1997", track: "landmark",
          label: "The Kyoto Protocol",
          detail: "The first treaty with binding targets. The United States signs and does not ratify.",
          source: "UNFCCC, Kyoto Protocol, adopted 11 December 1997."
        },
        {
          year: 1998, at: "1998", track: "obstruction", delay: "denial",
          label: "“Victory will be achieved when average citizens ‘understand’ uncertainties”",
          detail: "From the American Petroleum Institute's Global Climate Science Communications plan. The target is not the science. The target is how sure you feel.",
          source: "American Petroleum Institute, ‘Global Climate Science Communications Action Plan’, 1998; leaked and widely reproduced."
        },
        {
          year: 2000, at: "2000-07", track: "obstruction",
          label: "BP becomes “Beyond Petroleum”",
          detail: "A rebrand of roughly $200 million under chief executive John Browne, with the agency Ogilvy & Mather. The creative team pitches the idea of a personal carbon calculator.",
          source: "OpenMind Magazine, ‘Are You a Climate Culprit?’, on the origin of the personal carbon footprint; BP campaign launched July 2000."
        },
        {
          year: 2004, at: "2004", track: "obstruction", delay: "individualism",
          label: "BP puts a personal carbon footprint calculator at the centre of its advertising",
          detail: "BP did not invent the phrase. It descends from the ecological footprint of William Rees and Mathis Wackernagel in the early 1990s, and Wackernagel has said he was “shocked about how they (craftily) slightly twisted our work”. What the money bought was not the word. It was the idea that the unit of the problem is one person.",
          source: "OpenMind Magazine, ‘Are You a Climate Culprit?’; Conservation Law Foundation, ‘The Truth About Carbon Footprints’. Ecological footprint: Rees & Wackernagel, early 1990s."
        },
        {
          year: 2006, at: "2006", track: "movement",
          label: "An Inconvenient Truth",
          detail: "Climate change gets a mass audience for the first time, and with it a politics.",
          source: "Released May 2006, following its Sundance premiere in January."
        },
        {
          year: 2007, at: "2007-a", track: "movement",
          label: "The Nobel Peace Prize goes to the IPCC and Al Gore",
          detail: "In the same year as the IPCC's Fourth Assessment Report. This is the high-water mark of the argument being settled in public by evidence.",
          source: "Norwegian Nobel Committee, Peace Prize 2007; IPCC Fourth Assessment Report, 2007."
        },
        {
          year: 2007, at: "2007-b", track: "obstruction", delay: "denial",
          label: "Nearly $16 million to 43 groups",
          detail: "ExxonMobil's funding of organisations producing public confusion about the science, documented while the prize was being awarded.",
          source: "Union of Concerned Scientists, ‘Smoke, Mirrors & Hot Air’ (2007)."
        },
        {
          year: 2008, at: "2008", track: "movement",
          label: "350.org",
          detail: "A movement named after a number — 350 parts per million — on the argument that a target you can say out loud is worth more than a report nobody reads.",
          source: "350.org founded 2008 by Bill McKibben and a group of students at Middlebury College."
        },
        {
          year: 2009, at: "2009", track: "movement",
          label: "Copenhagen ends without a binding agreement",
          detail: "Three weeks before it opens, stolen emails from the University of East Anglia are published as “Climategate”. Eight subsequent inquiries find no scientific misconduct. The story dominates the summit anyway.",
          source: "COP15, December 2009. Independent reviews 2010, including the Muir Russell and Oxburgh inquiries, found no evidence of scientific misconduct."
        },
        {
          year: 2015, at: "2015", track: "landmark",
          label: "The Paris Agreement",
          detail: "Adopted 12 December 2015. Note what it does not contain: any per-person figure. Every personal “Paris target” you will ever see, including the one this app uses, is somebody's modelling of what Paris implies.",
          source: "UNFCCC, Paris Agreement, adopted 12 December 2015."
        },
        {
          year: 2015, at: "2015-b", track: "obstruction", delay: "denial",
          label: "“The models simply are not that good”",
          detail: "ExxonMobil's chief executive, on the predictive reliability of climate models, thirty-eight years after his own company's scientists produced projections that would later score 72%.",
          source: "Rex Tillerson, ExxonMobil annual meeting, 2015; cited in the Union of Concerned Scientists deception timeline."
        },
        {
          year: 2018, at: "2018-08", track: "movement",
          label: "One schoolgirl, one sign, outside a parliament",
          detail: "Greta Thunberg begins striking outside the Swedish parliament on 20 August 2018, and keeps going on Fridays.",
          source: "Fridays for Future; first strike 20 August 2018."
        },
        {
          year: 2018, at: "2018-10a", track: "landmark",
          label: "The IPCC's 1.5 °C report",
          detail: "Published 8 October 2018. It is the document that turns a distant target into a deadline, and it is what most of what follows is arguing about.",
          source: "IPCC, Special Report on Global Warming of 1.5 °C, 8 October 2018."
        },
        {
          year: 2018, at: "2018-10b", track: "movement",
          label: "Extinction Rebellion declares",
          detail: "Founded in May 2018, XR reads its Declaration of Rebellion outside the UK parliament on 31 October. Its first demand is not a policy. It is “tell the truth”.",
          source: "Extinction Rebellion, Declaration of Rebellion, 31 October 2018."
        },
        {
          year: 2019, at: "2019-03", track: "movement",
          label: "1.4 million people, 125 countries",
          detail: "The first global school strike, 15 March 2019: about 2,200 events. By 20 September the figure is over four million people in 4,500 places across 150 countries.",
          source: "Fridays for Future participation figures, 15 March and 20 September 2019."
        },
        {
          year: 2019, at: "2019-04", track: "movement",
          label: "1,130 arrests in central London",
          detail: "XR occupies Piccadilly Circus, Oxford Circus, Marble Arch, Waterloo Bridge and Parliament Square for eleven days in April 2019.",
          source: "Extinction Rebellion April 2019 protests; Metropolitan Police arrest figures."
        },
        {
          year: 2019, at: "2019-12", track: "movement",
          label: "A supreme court orders a government to cut emissions",
          detail: "The Dutch Supreme Court upholds the Urgenda ruling on 20 December 2019 — the first time a court anywhere ordered a state to reduce emissions faster on human-rights grounds.",
          source: "State of the Netherlands v Stichting Urgenda, Supreme Court of the Netherlands, 20 December 2019 (19/00135)."
        },
        {
          year: 2020, at: "2020-06", track: "movement",
          label: "Austria: 380,590 signatures",
          detail: "The Klimavolksbegehren, 22–29 June 2020: 5.96% of the electorate, the 21st-largest of all Austrian Volksbegehren. Parliament responds in March 2021 by setting up a citizens' climate council.",
          source: "Klimavolksbegehren, Eintragungswoche 22–29 June 2020: 380,590 signatures, 5.96% of eligible voters; Nationalrat resolution, March 2021."
        },
        {
          year: 2021, at: "2021-08", track: "movement",
          label: "Austria: Lobau bleibt",
          detail: "Occupations of motorway construction sites in Vienna from 27 August 2021. On 1 December the transport minister cancels the S1 Lobau motorway. The camps are cleared on 1 February and 5 April 2022; the approval and expropriation proceedings continue.",
          source: "partizipation.at case study, ‘Lobau bleibt!’; ministerial decision on the S1 Lobau-Autobahn, 1 December 2021."
        },
        {
          year: 2021, at: "2021-b", track: "obstruction", delay: "individualism",
          label: "Denial becomes deflection, measured",
          detail: "A computational analysis of 180 ExxonMobil documents across fifty years finds the company using “fossil fuel” internally and “consumers”, “demand” and “energy efficiency” publicly — an individualised framing of both who caused this and who has to fix it.",
          source: "Supran & Oreskes, ‘Rhetoric and frame analysis of ExxonMobil’s climate change communications’, One Earth 4 (2021)."
        },
        {
          year: 2023, at: "2023-12", track: "obstruction", delay: "fossilSolutionism",
          label: "COP28 is chaired by an oil chief executive",
          detail: "The summit is presided over by the head of the United Arab Emirates' state oil company. Analyses of industry and OPEC messaging around it describe an argument that has moved off the science entirely and onto pace, cost and who else should go first.",
          source: "COP28, Dubai, 30 November – 13 December 2023. Climate Action Against Disinformation, analysis of fossil fuel industry and OPEC messaging at COP28."
        },
        {
          year: 2024, at: "2024-04", track: "movement",
          label: "A human-rights court rules on climate",
          detail: "In KlimaSeniorinnen v Switzerland, 9 April 2024, the European Court of Human Rights finds that inadequate climate policy can breach the Convention. Brought by a group of older Swiss women.",
          source: "Verein KlimaSeniorinnen Schweiz and Others v Switzerland, ECtHR Grand Chamber, 9 April 2024."
        },
        {
          year: 2024, at: "2024-05", track: "movement",
          label: "Austria: a complaint against OMV",
          detail: "Greenpeace in Central and Eastern Europe and Fridays for Future Österreich file an OECD Guidelines complaint against OMV on 21 May 2024 over gas expansion and environmental due diligence. OMV's lobbying is separately tracked on InfluenceMap's LobbyMap.",
          source: "OECD Watch: Greenpeace CEE and Fridays for Future Austria vs OMV Aktiengesellschaft, filed 21 May 2024; InfluenceMap LobbyMap entry for OMV."
        },
        {
          year: 2024, at: "2024-08", track: "movement",
          label: "Austria: Letzte Generation stops",
          detail: "After road blockades from 2022, the Austrian group ends its protests on 6 August 2024, saying it sees “keine Perspektive für Erfolg” — no prospect of success. Movements are not a ratchet. They can also stop.",
          source: "ORF, 6 August 2024: Letzte Generation Österreich beendet Klimaproteste."
        },
        {
          year: 2024, at: "2024-04b", track: "obstruction",
          label: "Two newspapers withdraw sponsored oil content",
          detail: "The Financial Times and Reuters pull Saudi Aramco-sponsored climate material. The argument has moved into the space where journalism is paid for.",
          source: "DeSmog, 23 April 2024: ‘Financial Times, Reuters Pull Saudi Aramco-sponsored Climate Content’."
        },
        {
          year: 2025, at: "2025-07", track: "landmark",
          label: "The World Court answers",
          detail: "On 23 July 2025 the International Court of Justice issues a unanimous advisory opinion — the fifth unanimous opinion in its 88-year history — finding that states have binding obligations to limit warming to 1.5 °C and can be liable for climate harm. It began as a campaign by Pacific Island students, taken up by Vanuatu.",
          source: "ICJ, Obligations of States in respect of Climate Change, advisory opinion, 23 July 2025; requested by UN General Assembly resolution of 29 March 2023 with 105 co-sponsors."
        }
      ],

      /* ---------- the taxonomy ----------
       * Lamb et al. (2020). Four questions a delay argument answers "no" to, and
       * the twelve moves that do it. This is the part worth learning: it is a
       * classifier, not a list of claims, so it still works on next year's claim.
       */
      delay: {
        source: "Lamb, W.F., Mattioli, G., Levi, S., Roberts, J.T., Capstick, S., Creutzig, F., Minx, J.C., Müller-Hansen, F., Culhane, T. & Steinberger, J.K. (2020). ‘Discourses of climate delay’. Global Sustainability 3, e17.",
        note: "Every one of these can be said in good faith, and often is. The taxonomy is not a way of deciding who is lying. It is a way of noticing what a sentence is doing.",
        groups: [
          {
            id: "redirect", label: "Redirect responsibility",
            question: "Is it ours to act on?",
            color: "#C9861C",
            moves: [
              { id: "individualism", label: "Individualism",
                says: "It comes down to the choices each of us makes.",
                does: "Moves the problem from systems to shopping, and out of sight of whoever has the power to change it." },
              { id: "whataboutism", label: "Whataboutism",
                says: "Austria is 0.2% of global emissions. Look at China.",
                does: "Makes every actor too small to be responsible, which leaves nobody who is." },
              { id: "freeRider", label: "The free-rider excuse",
                says: "If we go first, others will just take the advantage.",
                does: "Turns going first into a mistake, so nobody does." }
            ]
          },
          {
            id: "nonTransformative", label: "Push non-transformative solutions",
            question: "Does anything actually have to change?",
            color: "#2B7FD6",
            moves: [
              { id: "techOptimism", label: "Technological optimism",
                says: "Innovation will solve this without anyone being told what to do.",
                does: "Buys time by promising a solution whose arrival date nobody has to commit to." },
              { id: "fossilSolutionism", label: "Fossil fuel solutionism",
                says: "We are part of the solution — gas is a bridge, and we will capture the carbon.",
                does: "Keeps the producer inside the process that is meant to constrain it." },
              { id: "allTalk", label: "All talk, little action",
                says: "Look how far we have already come. Look at our 2050 target.",
                does: "Uses an announcement as evidence that the work is under way." },
              { id: "noSticks", label: "No sticks, just carrots",
                says: "Incentives, not bans. Nobody likes being lectured.",
                does: "Rules out the half of the policy toolkit that has deadlines in it." }
            ]
          },
          {
            id: "downsides", label: "Emphasise the downsides",
            question: "Is it worth what it costs?",
            color: "#D43C22",
            moves: [
              { id: "socialJustice", label: "Appeal to social justice",
                says: "This will fall hardest on people who can least afford it.",
                does: "A real objection, used to stop a policy rather than to fix its distribution." },
              { id: "wellBeing", label: "Appeal to well-being",
                says: "You would be taking away things people's lives are built on.",
                does: "Treats the current arrangement as the baseline of a good life." },
              { id: "perfectionism", label: "Policy perfectionism",
                says: "Not like this. We need to get it exactly right first.",
                does: "Sets a standard no policy meets, and calls waiting prudence." }
            ]
          },
          {
            id: "surrender", label: "Surrender",
            question: "Is it even possible?",
            color: "#5E5A4E",
            moves: [
              { id: "impossible", label: "Change is impossible",
                says: "Societies do not reorganise themselves like that. Better to adapt.",
                does: "Converts a political question into a fact about human nature." },
              { id: "doomism", label: "Doomism",
                says: "It is already too late. The feedbacks are locked in.",
                does: "Produces exactly the same inaction as denial, from people who accept the science. Nobody has to be paid to spread it, which is part of why it spreads." }
            ]
          }
        ],
        // Used by the timeline for the pre-delay era, which the taxonomy does not cover:
        // outright denial of the science is not a delay discourse, it is the thing that
        // came before them and stopped working.
        denial: { id: "denial", label: "Denial", color: "#8B5E3C",
          note: "Not one of the four — the taxonomy describes what replaced it. Outright denial of the science is the era from roughly 1989 to the mid-2000s, and it is over because it lost." }
      },

      /* ---------- three claims, taken apart ----------
       * One from each direction, plus one that nobody is paid to spread. The
       * middle one is the point of the card: a page about misleading claims that
       * only dismantles the other side's claims is performing one of the moves.
       */
      claims: [
        {
          id: "ev",
          claim: "“Electric cars are worse once you count the battery.”",
          status: "half", statusLabel: "true premise, sentence stopped early",
          truth: "Building a battery electric car does emit about 40% more than building a petrol one.",
          rest: "That is paid back after roughly 17,000 km — one to two years of normal driving. Over the whole life of a car registered in the EU in 2025, battery electric comes out 73% lower than petrol: 63 against 235 g CO₂e per km, or 78% lower on renewable electricity. Hybrids manage 20% and plug-in hybrids 30%.",
          move: "techOptimism",
          moveNote: "It is not a lie, which is what makes it effective. It is a true fact about manufacturing, delivered as though it were the conclusion.",
          source: "International Council on Clean Transportation, ‘Life-cycle greenhouse gas emissions from passenger cars in the European Union: a 2025 update’, July 2025."
        },
        {
          id: "hundred",
          claim: "“100 companies are responsible for 71% of emissions.”",
          status: "half", statusLabel: "true as published, usually read wrong",
          truth: "The Carbon Majors work is real: 100 fossil fuel producers are linked to 71% of global industrial greenhouse gas emissions since 1988.",
          rest: "Those are overwhelmingly the emissions from burning the products those companies sold — the petrol in your car, the gas in your boiler. They are the same molecules this app counts in your 9.9 t. Read as “so it is not us”, the number quietly double-counts, which is exactly why this app refuses to add the emissions your money finances to your footprint. What the figure does establish is concentration: a hundred decision-makers, not eight billion.",
          move: "whataboutism",
          moveNote: "This one comes from the climate side, and it is on this page for that reason. The test of a taxonomy is whether you are willing to apply it to your own arguments.",
          source: "CDP / Climate Accountability Institute, Carbon Majors Report, July 2017: 100 producers linked to 71% of global industrial GHG emissions, 1988–2015."
        },
        {
          id: "toolate",
          claim: "“It is too late anyway.”",
          status: "false", statusLabel: "not supported, and nobody had to pay for it",
          truth: "Warming tracks the total ever emitted, so every tonne not emitted is warming that does not happen. There is no threshold past which further emissions stop mattering — which is the same physics that makes the situation urgent.",
          rest: "The remaining budget for 1.5 °C being nearly spent is an argument for speed, not for stopping. Doomism is the one discourse on this page with no funder behind it: it spreads among people who accept the science completely, and it produces the same result as denial did.",
          move: "doomism",
          moveNote: "Worth knowing that this is a category in the peer-reviewed taxonomy, sitting in the same box as “change is impossible”.",
          source: "Lamb et al. (2020), ‘Discourses of climate delay’, category 4: Surrender. Cumulative-budget physics: see the trajectory card on the Details tab."
        }
      ],

      /* ---------- the silence ----------
       * The user asked for this specifically and it is the part that explains why
       * a chronology of adverts is not the whole story. The techniques worked on
       * top of something that was already there.
       */
      silence: {
        term: "meta-silence",
        quote: "there is also a “meta-silence,” where we don’t talk about the fact that we don’t talk about it",
        attribution: "George Marshall, Don’t Even Think About It: Why Our Brains Are Wired to Ignore Climate Change (2014), chapter 17.",
        points: [
          { label: "A quarter of people have never discussed it with anyone at all",
            text: "Not argued about it. Never raised it. Marshall calls the absence of any story the most influential climate narrative there is.",
            source: "Marshall (2014), chapter 17." },
          { label: "The silence is organised, not accidental",
            text: "Kari Norgaard spent a year in a Norwegian town where the winter had visibly changed, where people knew the science and where nobody talked about it. She called it socially organised denial: not ignorance, but a shared set of habits for keeping something known out of conversation.",
            source: "Kari Marie Norgaard, Living in Denial: Climate Change, Emotions, and Everyday Life (MIT Press, 2011)." },
          { label: "There is a name for the thing itself",
            text: "The sociologist Eviatar Zerubavel calls it socially constructed silence — where you would expect a conversation, there is instead an agreement not to have one.",
            source: "Eviatar Zerubavel, The Elephant in the Room: Silence and Denial in Everyday Life (2006)." },
          { label: "This is what the movements broke",
            text: "Read the timeline again with this in mind. 2006 to 2009 made it sayable; 2018 to 2019 made it unavoidable. Not one of those events won an argument about radiative physics — that argument was over by 1988. What a child with a sign outside a parliament did, and what four million people in the street did, was make the silence cost something. Marshall's own prediction was that breaking it would take “a prolonged struggle by dedicated social movements … with a central tactic of confronting a socially constructed silence”. It is the one prediction on this page that was tested and held.",
            source: "Marshall (2014), chapter 17; participation figures as on the timeline." }
        ],
        // Not a happy ending, and the page should not pretend otherwise.
        caveat: "A silence that has been broken can re-form. Letzte Generation Österreich stopped in August 2024 saying it saw no prospect of success, and the thing it gave up on was not the physics."
      },

      /* ---------- the part about this app ----------
       * The strongest available argument that this page is not point-scoring: the
       * app applies it to itself, with the numbers it already computes.
       */
      ourselves: {
        admission: "This app is built on the frame BP paid to make normal.",
        text: "It measures one person's footprint, compares it against a per-person budget and offers a list of changes that are almost all purchases. That is the individualism move, in structure, whatever the wording says.",
        defences: [
          "It says where individual action stops instead of implying it is enough.",
          "It shows the share nobody buys as a household — decided collectively, untouched by every change in the list — rather than quietly leaving it out.",
          "It never subtracts compensation, never adds financed emissions, and never discounts a saving by rebound. All three are shown beside the number and never inside it.",
          "It keeps a public register of what it still gets wrong."
        ],
        unresolved: "None of that fixes the structure. A reader who only uses the Potential tab still learns that their carbon problem is a shopping problem. That is recorded as bias 1.1 and it is the one to keep watching."
      }
    };
  }

  var G = (root.GreenApp = root.GreenApp || { sources: {} });
  G.context = defineContext();
  G.sources["data/context.js"] = defineContext.toString();
})(typeof window !== "undefined" ? window : globalThis);
