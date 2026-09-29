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
       * track: "propaganda" above the axis, "movement" below it, "landmark" on it.
       * kind:  optional. "knew" marks an entry that is evidence about the industry rather
       *        than an act of persuasion by it — a column called propaganda must not quietly
       *        relabel a research finding as a campaign.
       * delay: which discourse in `delay` below this is an instance of, where the
       *        source supports saying so. Absent where it would be a guess.
       * at:    a sort key. Events inside a year are ordered by it, so a year with
       *        several entries does not depend on array order to read correctly.
       */
      /* ---------- the two tracks ----------
       * track: "propaganda" above the axis, "movement" below it, "landmark" on it.
       * kind:  optional. "knew" marks an entry that is evidence about the industry rather
       *        than an act of persuasion by it — a column called propaganda must not quietly
       *        relabel a research finding as a campaign.
       * at:    a sort key. Events inside a year are ordered by it, so a year with
       *        several entries does not depend on array order to read correctly.
       *
       * ONE STANDARD FOR EVERY ENTRY, and the audit checks it:
       *   label  — who did what. A full clause that means something read on its own.
       *            Not a bare name ("The Global Climate Coalition"), not a slogan
       *            ("Beyond Petroleum"), not a figure with no subject ("Nearly $16 million
       *            to 43 groups"). Each of those three was here, and each told a reader
       *            nothing unless they already knew the story.
       *   detail — what it consisted of, and then why it matters. Never only the first.
       *   source — plus a url wherever one exists, shown inside the card, not only in a
       *            list at the bottom, so the citation sits with the claim it supports.
       */
      timeline: [
        {
          year: 1977, at: "1977", track: "propaganda", kind: "knew",
          label: "Exxon's own scientists tell management that burning fossil fuels will warm the planet",
          detail: "Internal projections made between 1977 and 2003 put the warming at 0.20 °C per decade, give or take 0.04. Researchers scored them in 2023 against what actually happened: they averaged 72%, which is better than the projections James Hansen put before the US Congress in 1988. Why it matters: the company had this in-house, at this accuracy, before every campaign below it. Nothing that follows can be explained as an honest mistake.",
          source: "Supran, Rahmstorf & Oreskes, ‘Assessing ExxonMobil’s global warming projections’, Science 379 (2023).",
          url: "https://www.science.org/doi/10.1126/science.abk0063"
        },
        {
          year: 1985, at: "1985", track: "landmark",
          label: "Scientists meeting in Villach, Austria agree for the first time that greenhouse gases will warm the planet",
          detail: "October 1985, convened by the UN Environment Programme, the World Meteorological Organization and the International Council of Scientific Unions. They concluded that the warming could be greater than any in human history, and that treating the climate as stable was “no longer a good assumption”. They also asked, for the first time, that scientists and policymakers work together on what to do about it. Why it matters: this is the starting line. It produced the Advisory Group on Greenhouse Gases, which the IPCC replaced in 1988 — and it happened in Austria, four years before the lobby in the next entry was founded.",
          source: "International Science Council, ‘The origins of the IPCC: how the world woke up to climate change’, on the 1985 Villach conference and the Advisory Group on Greenhouse Gases.",
          url: "https://council.science/blog/the-origins-of-the-ipcc-how-the-world-woke-up-to-climate-change/"
        },
        {
          year: 1988, at: "1988", track: "landmark",
          label: "The IPCC is founded, and a NASA scientist tells the US Senate the warming is already detectable",
          detail: "James Hansen's testimony in June 1988 put it on the front pages; the World Meteorological Organization and UNEP set up the Intergovernmental Panel on Climate Change the same year. Why it matters: from this point on, nobody making a public argument about climate can claim the science was not available to them.",
          source: "IPCC, history of the organisation; Hansen testimony to the US Senate Committee on Energy and Natural Resources, 23 June 1988.",
          url: "https://www.ipcc.ch/about/history/"
        },
        {
          year: 1989, at: "1989", track: "propaganda", delay: "denial",
          label: "Oil and coal companies set up a lobby called “Global Climate Coalition” that fights against climate policy",
          detail: "Funded and staffed by Exxon, Mobil, Chevron, BP, Shell, car makers and coal and utility trade bodies. What it did: advertising and briefings against binding emissions limits, right through the negotiations that led to Kyoto. Why it matters: the name is the first product. A lobby against climate policy, titled so that any headline quoting it reads as though a climate body said it. Members began leaving in the late 1990s.",
          source: "Union of Concerned Scientists, timeline of fossil fuel industry climate deception.",
          url: "https://www.ucs.org/resources/tweet-story-fossil-fuel-industrys-climate-deception"
        },
        {
          year: 1991, at: "1991", track: "propaganda", delay: "denial", technique: "thirdParty",
          label: "A coal and electricity campaign sets out, in writing, to “reposition global warming as theory (not fact)”",
          detail: "The Information Council for the Environment, funded by the National Coal Association, the Western Fuels Association and the Edison Electric Institute. What it did: newspaper and radio advertising in selected test markets, fronted by a small number of contrarian scientists rather than by the funders. Why it matters: the quoted line is not a critic's characterisation — it is the campaign's own stated objective, from strategy documents that leaked. It ran from February to August 1991 and collapsed once they became public.",
          source: "Leaked ICE strategy documents, 1991; summarised by the Union of Concerned Scientists and DeSmog.",
          url: "https://en.wikipedia.org/wiki/Information_Council_for_the_Environment"
        },
        {
          year: 1997, at: "1997", track: "landmark",
          label: "The Kyoto Protocol sets the first binding emissions targets, and the United States does not ratify it",
          detail: "Adopted on 11 December 1997. Why it matters: this is the treaty the campaigns above and below were written against. The 1998 plan in the next entry names it.",
          source: "UNFCCC, history of the Convention; Kyoto Protocol adopted 11 December 1997.",
          url: "https://unfccc.int/process/the-convention/history-of-the-convention"
        },
        {
          year: 1998, at: "1998", track: "propaganda", delay: "denial", technique: "thirdParty",
          label: "The oil industry writes a plan to make the public feel unsure about the science, and defines that as winning",
          detail: "The American Petroleum Institute's Global Climate Science Communications Action Plan, drafted by a team from oil companies and allied groups, in the year after Kyoto. What it proposed: recruit and train scientists who could brief journalists and teachers, set up a media centre to place them, and target science teachers and the press directly. How it defined success, in its own words: “victory will be achieved when average citizens ‘understand’ (recognize) uncertainties in climate science.” Why it matters: the goal is not to win the scientific argument or to change any measurement. It is to leave the public unsure enough that policy has no constituency. Doubt is the product, and the plan says so.",
          source: "American Petroleum Institute, ‘Global Climate Science Communications Action Plan’, 1998; leaked and reproduced in full by Climate Files.",
          url: "https://www.climatefiles.com/trade-group/american-petroleum-institute/1998-global-climate-science-communications-team-action-plan/"
        },
        {
          year: 2000, at: "2000-07", track: "propaganda", delay: "fossilSolutionism",
          label: "BP spends about $200 million advertising itself as an energy company rather than an oil company",
          detail: "Under chief executive John Browne, with the agency Ogilvy & Mather: a new sun logo, a green-and-yellow palette, and the line “Beyond Petroleum” — for a company whose business stayed oil and gas. Why it matters: the slogan is an advertising claim, not a description of what the company did, which is why it sits here in quotation marks and not in the headline. Inside the same campaign, the agency pitched the idea of a personal carbon calculator.",
          source: "OpenMind Magazine, ‘Are You a Climate Culprit?’, on BP's rebrand and the origin of the personal carbon footprint.",
          url: "https://www.openmindmag.org/articles/deconstructing-the-carbon-footprint"
        },
        {
          year: 2004, at: "2004", track: "propaganda", delay: "individualism",
          label: "BP promotes the concept of the carbon footprint to move the responsibility for action from organisations to individuals",
          detail: "An oil company put a personal carbon footprint calculator at the centre of its advertising and invited the public to work out their own. What changed: the question a reader is left holding moves from “who is producing this?” to “how much of it is mine?”. Why it matters: BP did not invent the phrase — it descends from the ecological footprint of William Rees and Mathis Wackernagel in the early 1990s, and Wackernagel has said he was “shocked about how they (craftily) slightly twisted our work”. What the money bought was not the word but the idea that the unit of the problem is one person. It worked well enough that it is now the default way the whole subject is discussed, including on this page.",
          source: "OpenMind Magazine, ‘Are You a Climate Culprit?’; Conservation Law Foundation, ‘The Truth About Carbon Footprints’. Ecological footprint: Rees & Wackernagel, early 1990s.",
          url: "https://www.openmindmag.org/articles/deconstructing-the-carbon-footprint"
        },
        {
          year: 2006, at: "2006", track: "movement",
          label: "Al Gore's film An Inconvenient Truth brings climate change to a mass audience for the first time",
          detail: "A filmed version of a slideshow Gore had given for years, released in May 2006 after premiering at Sundance in January. Why it matters: it made the subject sayable in ordinary conversation — and, in the United States, party-political at the same time. Both effects outlast the film.",
          source: "An Inconvenient Truth (2006), directed by Davis Guggenheim; released May 2006.",
          url: "https://en.wikipedia.org/wiki/An_Inconvenient_Truth"
        },
        {
          year: 2007, at: "2007-a", track: "movement",
          label: "The Nobel Peace Prize goes jointly to the IPCC and Al Gore",
          detail: "Awarded in the same year as the IPCC's Fourth Assessment Report. Why it matters: it is the high-water mark of the argument being settled in public by evidence — and, as the next entry shows, the same year in which the funding of organisations paid to unsettle it was being documented.",
          source: "Norwegian Nobel Committee, Nobel Peace Prize 2007, press release; IPCC Fourth Assessment Report, 2007.",
          url: "https://www.nobelprize.org/prizes/peace/2007/press-release/"
        },
        {
          year: 2007, at: "2007-b", track: "propaganda", delay: "denial", technique: "thirdParty",
          label: "ExxonMobil is found to have paid nearly $16 million to 43 organisations that cast doubt on climate science",
          detail: "Researchers at the Union of Concerned Scientists tracked the company's funding between 1998 and 2005 to think tanks and advocacy groups publishing and briefing against the science. Why it matters: this is the third-party messenger technique doing its work. The argument reaches a reader from an institute with a neutral-sounding name, not from an oil company, so it arrives looking independent. The method was borrowed from the tobacco industry.",
          source: "Union of Concerned Scientists, ‘Smoke, Mirrors & Hot Air’ (2007), on ExxonMobil's funding of climate contrarian organisations 1998–2005.",
          url: "https://www.ucs.org/resources/tweet-story-fossil-fuel-industrys-climate-deception"
        },
        {
          year: 2008, at: "2008", track: "movement",
          label: "Bill McKibben and a group of students found 350.org and name a movement after a number",
          detail: "350 parts per million of CO₂, the level the movement argued was the safe upper bound. Why it matters: a target you can say out loud in one breath travels further than an assessment report. It is the same reasoning behind the 2.5 t figure this app compares you against — and the same risk, that a single number gets treated as the whole argument.",
          source: "350.org, founded 2008 by Bill McKibben with students at Middlebury College.",
          url: "https://en.wikipedia.org/wiki/Bill_McKibben"
        },
        {
          year: 2009, at: "2009", track: "movement",
          label: "The Copenhagen summit ends without a binding agreement, three weeks after “Climategate” breaks",
          detail: "Stolen emails from the University of East Anglia were published in November 2009 and presented as evidence that the science was fixed. Multiple independent inquiries afterwards found no evidence of scientific misconduct — but they reported after the summit had ended. Why it matters: it is the clearest demonstration on this page of how much cheaper doubt is than agreement. The story needed three weeks; the rebuttals needed a year.",
          source: "COP15, Copenhagen, 7–19 December 2009 (IISD Earth Negotiations Bulletin summary); independent reviews in 2010 cleared the scientists involved.",
          url: "https://enb.iisd.org/copenhagen-climate-change-conference-cop15/summary-report"
        },
        {
          year: 2014, at: "2014", track: "landmark",
          label: "George Marshall names the meta-silence: we do not talk about it, and we do not talk about not talking about it",
          detail: "In Don't Even Think About It (2014), Marshall reports that about a quarter of people have never discussed climate change with anyone at all, and argues that the most influential climate narrative is the absence of one. He calls the second layer a “meta-silence” — the silence about the silence. Why it matters: none of the campaigns in the left-hand column had to manufacture this. They only had to protect it. And it is what the wave of 2018 and 2019 actually broke. The card below the timeline has the rest.",
          source: "George Marshall, Don't Even Think About It: Why Our Brains Are Wired to Ignore Climate Change (2014), chapter 17.",
          url: "https://theclimatecenter.org/wp-content/uploads/2017/03/final_Dont-Even-Think-About-It-Notes.pdf"
        },
        {
          year: 2015, at: "2015", track: "landmark",
          label: "The Paris Agreement is adopted, and contains no figure for any individual person",
          detail: "Adopted on 12 December 2015, with a goal expressed as degrees of global warming. Why it matters: every personal “Paris target” you will ever be shown — including the 2.5 t this app measures you against — is somebody's modelling of what the agreement implies for one person. It is a derived number, not a treaty obligation, and anyone presenting it as the latter is overstating it.",
          source: "UNFCCC, Paris Agreement, adopted 12 December 2015; history of the Convention.",
          url: "https://unfccc.int/process/the-convention/history-of-the-convention"
        },
        {
          year: 2015, at: "2015-b", track: "propaganda", delay: "denial",
          label: "ExxonMobil's chief executive tells shareholders that climate models “simply are not that good”",
          detail: "Rex Tillerson at the company's annual meeting, on the reliability of model predictions — thirty-eight years after his own company's scientists produced projections that would later be scored at 72% against observed warming. Why it matters: by 2015 flat denial had mostly stopped working in public, but doubt about the models was still worth asserting, by the company that had built some of the best ones.",
          source: "Rex Tillerson, ExxonMobil annual meeting, 2015; cited in the Union of Concerned Scientists deception timeline.",
          url: "https://www.ucs.org/resources/tweet-story-fossil-fuel-industrys-climate-deception"
        },
        {
          year: 2018, at: "2018-08", track: "movement",
          label: "Greta Thunberg begins the school strike that becomes Fridays for Future",
          detail: "From 20 August 2018 she sat outside the Swedish parliament during school hours, at first alone, then every Friday — which is where the movement's name comes from. Why it matters: it needed no organisation, no budget and no permission, and within seven months it had produced the largest climate demonstrations in history. See the 2019 entries.",
          source: "Fridays for Future: first strike 20 August 2018, Stockholm.",
          url: "https://en.wikipedia.org/wiki/Fridays_for_Future"
        },
        {
          year: 2018, at: "2018-10a", track: "landmark",
          label: "The IPCC's special report on 1.5 °C turns a distant target into a deadline",
          detail: "Published on 8 October 2018, it set out what separates 1.5 °C from 2 °C and what staying below it would require by 2030. Why it matters: almost everything after this date, in both columns, is an argument about that report. The 2030 date this app uses comes from the same framing.",
          source: "IPCC, Special Report on Global Warming of 1.5 °C, 8 October 2018.",
          url: "https://www.ipcc.ch/sr15/"
        },
        {
          year: 2018, at: "2018-10b", track: "movement",
          label: "Extinction Rebellion launches with a Declaration of Rebellion outside the UK parliament",
          detail: "Founded in May 2018 and declared publicly on 31 October. Its three demands are: tell the truth, act now, and be led by a citizens' assembly. Why it matters: the first demand is not a policy. It is a demand about the silence.",
          source: "Extinction Rebellion, Declaration of Rebellion, 31 October 2018.",
          url: "https://en.wikipedia.org/wiki/Extinction_Rebellion"
        },
        {
          year: 2019, at: "2019-03", track: "movement",
          label: "Fridays for Future puts 1.4 million people on the street in 125 countries in a single day",
          detail: "15 March 2019, about 2,200 events. By 20 September the figure was over four million people in 4,500 places across 150 countries. Why it matters: these are the largest climate demonstrations ever held, and they were organised by school students seven months after one of them sat down alone.",
          source: "Fridays for Future participation figures for 15 March and 20 September 2019.",
          url: "https://en.wikipedia.org/wiki/Fridays_for_Future"
        },
        {
          year: 2019, at: "2019-04", track: "movement",
          label: "Extinction Rebellion blocks five sites in central London and 1,130 people are arrested",
          detail: "Eleven days in April 2019 at Piccadilly Circus, Oxford Circus, Marble Arch, Waterloo Bridge and Parliament Square. Why it matters: the arrests were the point, not a side-effect — the tactic is to make the silence expensive enough to end. Whether it recruits or repels is genuinely contested, and this page does not settle it.",
          source: "Extinction Rebellion, April 2019 London protests; Metropolitan Police arrest figures.",
          url: "https://en.wikipedia.org/wiki/Extinction_Rebellion"
        },
        {
          year: 2019, at: "2019-05", track: "movement", technique: "framing",
          label: "The Guardian rewrites its style guide so that “climate change” becomes “climate emergency”, and the wider language follows",
          detail: "On 17 May 2019 the paper told its journalists to prefer “climate emergency, crisis or breakdown” to “climate change”, “global heating” to “global warming”, and “climate science denier” to “climate sceptic”. Editor-in-chief Katharine Viner's stated reason: “The phrase ‘climate change’ … sounds rather passive and gentle when what scientists are talking about is a catastrophe for humanity.” The vocabulary spread quickly — Oxford Dictionaries made “climate emergency” its word of the year for 2019, reporting that the phrase was about a hundred times as common in September 2019 as a year earlier, and other newsrooms and institutions moved the same way. Why it matters: this is a framing decision, the same kind of act that fills the column on the left — made in the open, by a newspaper, for a stated reason. Words do decide what a reader is left holding; that is the argument of this entire page, and it does not stop being true when the words are chosen by people you agree with. Whether this counts as precision or as advocacy is a judgement, and the honest thing is to put it on the timeline rather than only naming framing when the other side does it.",
          source: "Nieman Lab, 17 May 2019, on the Guardian's style guide change and Katharine Viner's stated reasons; Oxford Dictionaries, word of the year 2019.",
          url: "https://www.niemanlab.org/2019/05/from-climate-change-to-climate-emergency-crisis-or-breakdown-the-guardian-is-changing-the-environmental-language-it-uses/"
        },
        {
          year: 2019, at: "2019-12", track: "movement",
          label: "The Dutch Supreme Court orders its own government to cut emissions faster",
          detail: "The Urgenda judgment of 20 December 2019 upheld an order requiring the Netherlands to cut emissions by at least 25% by 2020 against 1990. Why it matters: it is the first time a court anywhere required a state to raise its climate ambition, and it did so on human-rights grounds — the route the 2024 and 2025 entries below then take.",
          source: "State of the Netherlands v Stichting Urgenda, Supreme Court of the Netherlands, 20 December 2019 (19/00135).",
          url: "https://en.wikipedia.org/wiki/Urgenda_Foundation_v_State_of_the_Netherlands"
        },
        {
          year: 2020, at: "2020-06", track: "movement",
          label: "380,590 people in Austria sign the Klimavolksbegehren",
          detail: "Signed during the registration week of 22–29 June 2020: 5.96% of the electorate, the 21st-largest of all Austrian Volksbegehren. Why it matters: parliament responded in March 2021 by asking the government to act on it and setting up a citizens' climate council, whose recommendations covered energy, consumption, food, housing and mobility. It is the clearest Austrian example on this page of the route that does not run through anybody's shopping.",
          source: "Klimavolksbegehren, registration week 22–29 June 2020: 380,590 signatures, 5.96% of eligible voters; Nationalrat resolution, March 2021.",
          url: "https://de.wikipedia.org/wiki/Klimavolksbegehren"
        },
        {
          year: 2021, at: "2021-08", track: "movement",
          label: "Activists occupy Vienna motorway construction sites for five months as “Lobau bleibt”",
          detail: "Camps from 27 August 2021 on sites for the S1 Lobau motorway and the Stadtstraße. On 1 December 2021 the transport minister cancelled the S1 Lobau motorway. The camps were cleared on 1 February and 5 April 2022, and the approval and expropriation proceedings continue. Why it matters: a cancelled motorway is a large, permanent, collective emissions decision — the kind no lever on the Potential tab can reach.",
          source: "partizipation.at case study, ‘Lobau bleibt!’; ministerial decision on the S1 Lobau-Autobahn, 1 December 2021.",
          url: "https://partizipation.at/praxisbeispiele/lobau-bleibt/"
        },
        {
          year: 2021, at: "2021-b", track: "propaganda", delay: "individualism",
          label: "Exxon's public language is shown to have moved from “fossil fuels” to “consumers”, and researchers measure the switch",
          detail: "Supran and Oreskes ran a computational analysis of 180 ExxonMobil documents spanning fifty years. What they found: internal documents discuss fossil fuels; public ones discuss “consumers”, “demand” and “energy efficiency”, and speak of risk rather than harm. Why it matters: this is the shift from denial to deflection, measured rather than asserted — an individualised framing of both who caused the problem and who is supposed to fix it.",
          source: "Supran & Oreskes, ‘Rhetoric and frame analysis of ExxonMobil’s climate change communications’, One Earth 4 (2021).",
          url: "https://www.cell.com/one-earth/fulltext/S2590-3322(21)00233-5"
        },
        {
          year: 2023, at: "2023-12", track: "propaganda", delay: "fossilSolutionism",
          label: "COP28 is presided over by the chief executive of the United Arab Emirates' state oil company",
          detail: "Sultan Al Jaber, head of ADNOC, chaired the summit in Dubai from 30 November to 13 December 2023. Why it matters: analyses of industry and OPEC messaging around the summit describe an argument that has left the science entirely alone and moved onto pace, cost and who should go first. That is the whole of the delay taxonomy below, in place of denial.",
          source: "COP28, Dubai, 30 November – 13 December 2023. Climate Action Against Disinformation, analysis of fossil fuel industry and OPEC messaging at COP28.",
          url: "https://caad.info/analysis/briefings/analysis-of-fossil-fuel-industry-opec-disinformation-strategy-at-cop28/"
        },
        {
          year: 2024, at: "2024-04", track: "movement",
          label: "The European Court of Human Rights rules that inadequate climate policy can breach human rights",
          detail: "KlimaSeniorinnen v Switzerland, decided by the Grand Chamber on 9 April 2024 and brought by an association of older Swiss women who argued that heatwaves put them specifically at risk. Why it matters: it binds 46 countries, Austria included, and it turns climate policy into something a citizen can litigate rather than only vote on.",
          source: "Verein KlimaSeniorinnen Schweiz and Others v Switzerland, European Court of Human Rights, Grand Chamber, 9 April 2024.",
          url: "https://en.wikipedia.org/wiki/Verein_KlimaSeniorinnen_Schweiz_v._Switzerland"
        },
        {
          year: 2024, at: "2024-04b", track: "propaganda", technique: "placement",
          label: "Saudi Aramco pays for climate content published inside the Financial Times and Reuters",
          detail: "Sponsored material carrying the oil company's framing ran in both outlets until they withdrew it in April 2024. Why it matters: sponsored content is built to be read with the credibility of the publication carrying it, which is exactly what separates it from an advertisement. This entry is citable only because it had to be pulled — the placements that are never withdrawn leave no trace like this one.",
          source: "DeSmog, 23 April 2024: ‘Financial Times, Reuters Pull Saudi Aramco-sponsored Climate Content’.",
          url: "https://www.desmog.com/2024/04/23/financial-times-reuters-pull-saudi-aramco-sponsored-climate-content/"
        },
        {
          year: 2024, at: "2024-05", track: "movement",
          label: "Greenpeace and Fridays for Future Österreich file a formal complaint against OMV",
          detail: "Lodged on 21 May 2024 under the OECD Guidelines for Multinational Enterprises, arguing that OMV's expansion of gas production and exploration — the Neptun Deep project in the Black Sea in particular — fails the environmental due diligence the Guidelines require. OMV's climate lobbying is separately tracked on InfluenceMap's LobbyMap. Why it matters: the left-hand column of this timeline is not only American history.",
          source: "OECD Watch: Greenpeace in Central and Eastern Europe and Fridays for Future Austria vs OMV Aktiengesellschaft, filed 21 May 2024; InfluenceMap LobbyMap entry for OMV.",
          url: "https://www.oecdwatch.org/complaint/greenpeace-in-zentral-und-osteuropa-and-fridays-for-future-austria-vs-omv-aktiengesellschaft/"
        },
        {
          year: 2024, at: "2024-08", track: "movement",
          label: "Letzte Generation Österreich ends its protests, saying it sees no prospect of success",
          detail: "Announced on 6 August 2024 after two years of road blockades, paint actions and marches. The group said the government had shown “complete incompetence” and that society had decided for fossil denial. Why it matters: it is the one entry in this column that goes backwards, and it is here for that reason. Movements are not a ratchet. What this one gave up on was not the physics.",
          source: "ORF, 6 August 2024: ‘Letzte Generation’ beendet Klimaproteste.",
          url: "https://orf.at/stories/3365771/"
        },
        {
          year: 2025, at: "2025-07", track: "landmark",
          label: "The International Court of Justice rules unanimously that states are legally obliged to limit warming to 1.5 °C",
          detail: "The advisory opinion of 23 July 2025 — only the fifth unanimous opinion in the court's 88-year history — found that states can be held responsible for climate harm, that 1.5 °C rather than 2 °C is the reference point, and that the obligation arises from customary international law and human rights law, not only from the Paris Agreement. It began as a campaign by Pacific Island law students, taken up by Vanuatu and put to the General Assembly with 105 co-sponsors. Why it matters: forty years after Villach, the same conclusion is now a legal obligation rather than a recommendation.",
          source: "International Court of Justice, Obligations of States in respect of Climate Change, advisory opinion, 23 July 2025; requested by UN General Assembly resolution of 29 March 2023.",
          url: "https://www.carbonbrief.org/icj-what-the-world-courts-landmark-opinion-means-for-climate-change"
        }
      ],

      /* ---------- the taxonomy ----------
       * Lamb et al. (2020). Four questions a delay argument answers "no" to, and
       * the twelve moves that do it. This is the part worth learning: it is a
       * classifier, not a list of claims, so it still works on next year's claim.
       */
      delay: {
        source: "Lamb, W.F., Mattioli, G., Levi, S., Roberts, J.T., Capstick, S., Creutzig, F., Minx, J.C., Müller-Hansen, F., Culhane, T. & Steinberger, J.K. (2020). ‘Discourses of climate delay’. Global Sustainability 3, e17.",
        url: "https://www.cambridge.org/core/journals/global-sustainability/article/discourses-of-climate-delay/7B11B722E3E3454BB6212378E32985A7",
        why: "Why a taxonomy and not a chronology: technique-based inoculation generalises to claims a reader has never seen, and fact-by-fact debunking does not.",
        whySource: "Roozenbeek, van der Linden et al., ‘Psychological inoculation improves resilience against misinformation on social media’, Science Advances 8 (2022).",
        whyUrl: "https://www.science.org/doi/10.1126/sciadv.abo6254",
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
        /* Techniques the taxonomy does not cover, because it classifies what is said and
         * these are about where it is said and who appears to be saying it. Kept separate
         * rather than folded into the nearest discourse, which would be a guess. */
        other: [
          { id: "placement", label: "Paid placement",
            note: "Buying space inside a publication so the argument is read with that publication's credibility rather than as an advertisement." },
          { id: "framing", label: "Reframing",
            note: "Choosing the words that decide what a reader is left holding. Used on both sides of this timeline, and by this page. Naming it only when the other side does it would be one of the moves in the taxonomy above." },
          { id: "thirdParty", label: "Third-party messengers",
            note: "Funding institutes and coalitions to make the argument, so that it does not arrive with the producer's name on it." }
        ],
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
          sources: [
            { text: "International Council on Clean Transportation, ‘Life-cycle greenhouse gas emissions from passenger cars in the European Union: a 2025 update’, July 2025 — the source of every figure in the paragraph above.",
              url: "https://theicct.org/publication/electric-cars-life-cycle-analysis-emissions-europe-jul25/" },
            { text: "The same report as published, if you want the method rather than the summary (PDF).",
              url: "https://theicct.org/wp-content/uploads/2025/07/ID-392-%E2%80%93-Life-cycle-GHG_report_final.pdf" },
            { text: "Carbon Brief, ‘Factcheck: 21 misleading myths about electric vehicles’ — for the claim that this is a recurring argument rather than a one-off.",
              url: "https://www.carbonbrief.org/factcheck-21-misleading-myths-about-electric-vehicles" }
          ]
        },
        {
          id: "hundred",
          claim: "“100 companies are responsible for 71% of emissions.”",
          status: "half", statusLabel: "true as published, usually read wrong",
          truth: "The Carbon Majors work is real: 100 fossil fuel producers are linked to 71% of global industrial greenhouse gas emissions since 1988.",
          rest: "Those are overwhelmingly the emissions from burning the products those companies sold — the petrol in your car, the gas in your boiler. They are the same molecules this app counts in your footprint. Read as “so it is not us”, the number quietly double-counts, which is exactly why this app refuses to add the emissions your money finances to your footprint. What the figure does establish is concentration: a hundred decision-makers, not eight billion.",
          move: "whataboutism",
          moveNote: "This one comes from the climate side, and it is on this page for that reason. The test of a taxonomy is whether you are willing to apply it to your own arguments.",
          sources: [
            { text: "CDP and the Climate Accountability Institute, Carbon Majors Report, 10 July 2017 — the original, which says “linked to”, counts 1988–2015, and is about industrial emissions, not all emissions.",
              url: "https://climateaccountability.org/pdf/CarbonMajorsUpdate%20CAI%20PR%2010Jul17.pdf" },
            { text: "CDP's own press release, which is where the headline version of the number comes from.",
              url: "https://www.cdp.net/en/press-releases/new-report-shows-just-100-companies-are-source-of-over-70-of-emissions" },
            { text: "PolitiFact, ‘No, 100 corporations do not produce 70% of total greenhouse gases’, 22 July 2022 — the source for the second half of what is written above, not just the first.",
              url: "https://www.politifact.com/factchecks/2022/jul/22/instagram-posts/no-100-corporations-do-not-produce-70-total-greenh/" },
            { text: "Bon Pote, ‘Are 100 companies responsible for 71% of global emissions?’ — a longer walk through the scope-1/scope-3 arithmetic.",
              url: "https://bonpote.com/en/are-100-companies-responsible-for-71-of-global-emissions/" }
          ]
        },
        {
          id: "toolate",
          claim: "“It is too late anyway.”",
          status: "false", statusLabel: "not supported, and nobody had to pay for it",
          truth: "Warming tracks the total ever emitted, so every tonne not emitted is warming that does not happen. There is no threshold past which further emissions stop mattering — which is the same physics that makes the situation urgent.",
          rest: "The remaining budget for 1.5 °C being nearly spent is an argument for speed, not for stopping. Doomism is the one discourse on this page with no funder behind it: it spreads among people who accept the science completely, and it produces the same result as denial did.",
          move: "doomism",
          moveNote: "Worth knowing that this is a category in the peer-reviewed taxonomy, sitting in the same box as “change is impossible”.",
          sources: [
            { text: "Lamb et al. (2020), ‘Discourses of climate delay’ — doomism is category 4, Surrender, alongside ‘change is impossible’.",
              url: "https://www.cambridge.org/core/journals/global-sustainability/article/discourses-of-climate-delay/7B11B722E3E3454BB6212378E32985A7" },
            { text: "Indicators of Global Climate Change — the annual update behind the 130 Gt remaining-budget figure this app uses, and the source for ‘nearly spent’ rather than ‘spent’.",
              url: "https://indicators.climate.copernicus.eu/" },
            { text: "IPCC, Special Report on Global Warming of 1.5 °C (2018) — for the cumulative-budget framing: warming is proportional to total CO₂ emitted, with no step change at any particular level.",
              url: "https://www.ipcc.ch/sr15/" }
          ]
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
            source: "Kari Marie Norgaard, Living in Denial: Climate Change, Emotions, and Everyday Life (MIT Press, 2011).",
            url: "https://mitpress.mit.edu/9780262515856/living-in-denial/" },
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
