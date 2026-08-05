# 09 — Content Spec: what the owner has to produce

Everything the code needs is built. What is missing is **content and five
decisions**. This doc is the complete list, the shape it has to arrive in, and the
pipeline that loads it — so a full curriculum can be written outside the app and
imported in one command instead of typed into `/admin` lesson by lesson.

## 1. Decisions only you can make

All five now live as `TODO(owner)` fields in **`src/config/site.ts`** — edit that
file, nothing else, to clear them:

| # | Field in `siteConfig` | Blocks | Notes |
|---|------------------------|--------|-------|
| 1 | `guidePrice` | every buy button, LS product | See docs/07 C1 first — at `insiderMonthlyPrice` = $7/mo (already set), a $27 guide has no reason to exist unless the ladder is fixed too |
| 2 | *(pricing ladder itself)* | product structure | Not a single field — docs/07 C1 recommends raising insider to $19–29/mo and keeping it "everything included"; changing `insiderMonthlyPrice`/`insiderYearlyPrice` in the same file is the only edit needed once you decide |
| 3 | `legalEntityName`, `contactEmail` | `/terms`, `/privacy`, `/refund-policy` | Lemon Squeezy checks these pages before activating a store |
| 4 | `refundWindowDays` | `/refund-policy` | Must match what you configure in LS — mismatched terms are a chargeback risk |
| 5 | *(no field — free text)* `/about` | `/about` | 200–400 words, written by hand. For a trust-dependent info product this converts; a placeholder does not |

Check what's still unset: `grep -n "TODO(owner)" src/config/site.ts`

## 2. Content inventory

### Course (the product itself)

Suggested shape for launch — 7 guide modules and 2 insider modules, 4–6 lessons
each, 800–1500 words per lesson. Adjust freely; the structure below is what the
portal and the `/guide` curriculum preview are built to display.

| # | Module | Tier | Lessons cover |
|---|--------|------|---------------|
| 1 | Getting Started | guide | What Paraguay residency is, who it suits, who it doesn't, how the process runs end to end, realistic timeline |
| 2 | Temporary Residency for Non-Mercosur Citizens | guide | The non-Mercosur route (Sweden, Spain, USA, Australia, New Zealand and other Hague Apostille + visa-free-to-Paraguay countries): requirements, bank deposit, apostille process, application timeline, costs, life after approval |
| 3 | The Paraguay Investor Pass | guide | The investment residency route: $150k tourism track vs. $200k real-estate/bolsa-de-valores/bonds track, requirements per track, application process, costs, benefits |
| 4 | Requirements & Documents | guide | Every required document, where each is obtained, apostilles, translations, common rejections |
| 5 | Money & Costs | guide | Government fees, professional fees, travel, living costs, total realistic budget ranges |
| 6 | On the Ground | guide | Arrival, appointments, what to expect at each office, local logistics, banking basics |
| 7 | After Residency | guide | Cédula, renewals, tax residency basics, keeping status valid, travel implications |
| 8 | Insider Vault | insider | Deeper material: negotiating with providers, edge cases, family/dependant scenarios |
| 9 | Templates & Scripts | insider | Filled-in examples of the templates in Resources, with commentary |

Modules 2 and 3 already have complete, ready-to-run generation prompts — see
chat history or regenerate from the templates in §5b below.

**Per-lesson structure that works** (also what the generation prompt produces):

```
# Lesson title
One-paragraph promise: what the reader will be able to do after this lesson.
## The short version
3-6 bullets — the answer for someone who reads nothing else.
## The detail
Body, 600-1000 words, with H2/H3 subheads.
## What to do next
Concrete action list.
> A closing note that this is general information, not legal advice.
```

### Resources (downloads)

Aim for 5–8 at launch. Each needs a real, publicly reachable `fileUrl` — the app
stores a URL, it does not host files. Put PDFs/spreadsheets anywhere stable (your
own domain, Drive with link sharing, S3). Suggested set: document checklist,
cost-breakdown spreadsheet, timeline planner, appointment-day checklist, and 2–3
insider-only templates.

### Updates feed (the retention engine)

This is what an insider subscription is *for*. Plan a cadence before launch —
monthly is the minimum that justifies a recurring charge. Seed 2–3 entries so the
feed isn't empty on day one. Each entry: what changed, when it takes effect, what
a member should do about it.

### Blog (the traffic engine)

8–12 posts of 1200–1800 words, each targeting a real search. Highest-value angles
for this niche: total cost breakdown, timeline reality-check, Paraguay vs Panama /
Uruguay / Paraguay-vs-staying, document checklist, tax-residency basics, common
rejection reasons, banking, cost of living by city. These are top-of-funnel: end
each with a link to `/guide`, not a hard sell.

## 3. Rules the content must follow

These are not style preferences — they protect the store and the buyer.

1. **Education/information product wording only.** No "we handle your residency",
   no "immigration services", no guaranteed outcomes or approval promises. Lemon
   Squeezy is the merchant of record and reviews this.
2. **Not legal advice.** Say so, once, at the end of each lesson.
3. **No invented facts.** This is the big one for AI-generated drafts: a language
   model will produce confident, specific, wrong fee amounts, office names,
   processing times, and law references. Every number, deadline, form name, and
   legal requirement must be checked against an official source (or your own
   first-hand experience) before it is published. Generate the *structure and
   prose*; supply the *facts* yourself.
4. **Date anything that can change.** Fees and processing times drift — write
   "as of <month year>" so a stale number reads as stale, and the updates feed has
   something to correct.
5. **No copied text.** Not from government sites, not from competitor guides.
6. **English**, plain and direct. The reader is an adult making an expensive
   decision.

## 4. The import pipeline

Write content into a JSON file, validate it, load it:

```bash
npx tsx scripts/import-content.ts content/curriculum.json --dry-run   # validate only
npx tsx scripts/import-content.ts content/curriculum.json             # write
```

- Validates the **whole file** first and reports every problem with its exact JSON
  path — nothing is written if anything is wrong.
- **Idempotent**: modules, lessons and blog posts match on `slug`; resources and
  updates on `title`. Re-running an edited file updates in place, so the loop
  "generate → import → fix → re-import" is safe.
- **Never deletes.** Removing content is done in `/admin`.
- Import as `"status": "draft"` if you want to review in `/admin` before anything
  is publicly visible. `"published"` goes live immediately.

`content/example-curriculum.json` is a working file of the right shape — copy it.

### Field reference

**Module**: `slug`* (lowercase-hyphens, unique), `title`*, `description`,
`sortOrder`, `minTier` (`guide`|`insider`, default guide), `status`
(`draft`|`published`, default draft), `lessons[]`.

**Lesson**: `slug`* (unique within its module), `title`*, `contentMd`* (markdown),
`videoUrl`, `sortOrder`, `status`.

**Resource**: `title`* (unique), `description`, `fileUrl`*, `minTier`,
`sortOrder`, `status`.

**Update**: `title`* (unique), `contentMd`*, `minTier`, `publishedAt` (ISO date),
`status`.

**Blog post**: `slug`* (unique), `title`*, `excerpt`, `contentMd`*, `metaTitle`
(≤255), `metaDescription` (≤500), `publishedAt`, `status`.

`*` = required. Markdown is rendered server-side and sanitised, so headings,
lists, links, tables, blockquotes and images all work; raw HTML and scripts are
stripped.

## 5. Generation prompt (generic — modules 1, 4–9)

Paste this into whichever model you're drafting with, one module at a time —
per-module runs produce better prose and are easier to fact-check than one giant
generation. Fill in the two bracketed lines from the table in §2.

> You are drafting one module of a paid information product about obtaining
> residency in Paraguay. The audience is adults researching relocation who have
> not started the process.
>
> Module: **[module title — e.g. "Money & Costs"]**
> It must cover: **[the "lessons cover" text from the table in §2]**
>
> Produce 4–6 lessons. Each lesson: 800–1500 words of markdown, structured as
> `# Title`, a one-paragraph promise, `## The short version` (3–6 bullets),
> `## The detail` (body with `##`/`###` subheads), `## What to do next` (action
> list), and a closing blockquote noting this is general information, not legal
> advice.
>
> Hard rules:
> - This is an education product, not a service. Never promise an outcome,
>   approval, or timeline guarantee. Never describe us as providing immigration
>   or legal services.
> - **Do not invent specifics.** Where a fee amount, processing time, office
>   name, form number, or legal requirement belongs, write
>   `[VERIFY: what needs checking]` instead of a number. I will fill these in
>   from official sources.
> - Anything time-sensitive gets an "as of [month year]" marker.
> - Plain, direct English. No hype, no filler, no "in today's fast-paced world".
>
> Output **only** a JSON object in exactly this shape, no prose around it:
>
> ```json
> {"modules":[{"slug":"kebab-case","title":"...","description":"...","sortOrder":1,
> "minTier":"guide","status":"draft","lessons":[{"slug":"kebab-case","title":"...",
> "contentMd":"# ...\n\n...","sortOrder":1,"status":"draft"}]}]}
> ```
>
> `contentMd` must be a single JSON string with `\n` escapes. Slugs are
> lowercase words separated by single hyphens, unique within the file.

Then: search the file for `[VERIFY:` and resolve every one before switching
`status` to `published`. That search is the quality gate for the whole product —
a residency guide with a wrong fee in it is worse than no guide.

## 5b. Ready-to-run prompts — modules 2 and 3

These two are pre-filled, no brackets left — copy straight into a model (Gemini
Flash 3.6 works well here; it's fast and cheap for first-draft prose, but still
needs the fact-check pass in §3 rule 3 like any other model).

### Module 2 — Temporary Residency for Non-Mercosur Citizens

```
You are drafting a module of a paid information product about obtaining temporary
residency in Paraguay. The audience is citizens of non-Mercosur countries that have
straightforward access to Paraguay — primarily Sweden, Spain, the USA, Australia,
and New Zealand, and by extension other Hague Apostille Convention member countries
with visa-free or easy entry to Paraguay. This module does NOT cover citizens of
countries with restricted entry to Paraguay or non-Hague-Convention document
legalization (e.g. Afghanistan, Pakistan) — that is a separate, harder path and
should only be mentioned as a brief contrast, not covered in depth.

Module: "Temporary Residency for Non-Mercosur Citizens"
Slug: temporary-residency-non-mercosur

It must cover, across 5-6 lessons:
1. Who this route is for: the distinction between Mercosur residency (fast, for
   Mercosur/associated-state citizens) and non-Mercosur temporary residency; confirm
   which readers qualify (Sweden, Spain, USA, Australia, New Zealand, and other
   Hague Apostille Convention + visa-free-to-Paraguay countries); realistic timeline
   overview.
2. Requirements: the minimum-wage bank deposit requirement, clean criminal record
   certificate, health/economic solvency proof, and how these differ from the
   Mercosur route.
3. Documents & the apostille process: the full document checklist, how Hague
   Apostille legalization works step by step, translation requirements, and the
   most common reasons documents get rejected.
4. The application process & timeline: SUACE/Dirección General de Migraciones
   steps in order, what happens at each appointment, what to expect in-country vs.
   what can be prepared before travel.
5. Costs: a full breakdown of every fee involved (government fees, apostille costs,
   translation costs, professional help if used).
6. After approval: obtaining the cédula, temporary-to-permanent residency timeline,
   renewal requirements, and what happens if the reader leaves Paraguay for extended
   periods during the temporary period.

Produce 5-6 lessons. Each lesson: 800-1500 words of markdown, structured as
`# Title`, a one-paragraph promise of what the reader will be able to do after this
lesson, `## The short version` (3-6 bullets), `## The detail` (body with `##`/`###`
subheads), `## What to do next` (action list), and a closing blockquote noting this
is general information, not legal advice.

Hard rules:
- This is an education product, not a service. Never promise an outcome, approval,
  or timeline guarantee. Never describe us as providing immigration or legal
  services.
- Do not invent specifics. Where a fee amount, processing time, office name, form
  number, or legal requirement belongs, write `[VERIFY: what needs checking]`
  instead of a number. I will fill these in from official sources.
- Anything time-sensitive gets an "as of [month year]" marker.
- Plain, direct English. No hype, no filler, no "in today's fast-paced world".

Output only a JSON object in exactly this shape, no prose around it:

{"modules":[{"slug":"temporary-residency-non-mercosur","title":"Temporary Residency for Non-Mercosur Citizens","description":"...","sortOrder":2,
"minTier":"guide","status":"draft","lessons":[{"slug":"kebab-case","title":"...",
"contentMd":"# ...\n\n...","sortOrder":1,"status":"draft"}]}]}

contentMd must be a single JSON string with \n escapes. Slugs are lowercase words
separated by single hyphens, unique within the file.
```

### Module 3 — The Paraguay Investor Pass

```
You are drafting a module of a paid information product about Paraguay's Investor
Pass residency program — a newer investment-based route to Paraguayan residency
with two qualifying tracks: (A) a minimum $150,000 USD investment in tourism-sector
projects, or (B) a minimum $200,000 USD investment in real estate, or in Paraguay's
stock exchange (bolsa de valores) via bonds or shares. The audience is higher-net-
worth individuals evaluating residency-by-investment options globally, comparing
Paraguay against programs elsewhere.

Module: "The Paraguay Investor Pass"
Slug: paraguay-investor-pass

It must cover, across 5-6 lessons:
1. What the Investor Pass is and who it's for: overview of the program, how it
   differs from standard temporary/Mercosur residency, the two investment tracks
   at a glance ($150k tourism / $200k real estate or bolsa de valores/bonds/
   shares), and who this route makes sense for vs. the standard route covered
   elsewhere in this guide.
2. Track A — Tourism investment ($150,000): what kinds of tourism-sector projects
   qualify, how the investment is structured and verified, documentation required
   to prove the investment.
3. Track B — Real estate, bonds & bolsa de valores investment ($200,000): what
   qualifies as eligible real estate, how investing via Paraguay's stock exchange
   (bonds/shares) satisfies the requirement, documentation and verification
   process, and the tradeoffs between the sub-options within this track.
4. Application process, documentation & timeline: the full sequence from choosing
   an investment through to residency approval, which government bodies are
   involved, and realistic timeframes at each stage.
5. Costs & professional support: full fee breakdown (government fees, legal/
   notary costs, any investment-structuring costs) separate from the investment
   capital itself, and what kind of professional help (lawyer, investment advisor)
   is typically needed.
6. Benefits & considerations: path from temporary to permanent residency and
   eventually citizenship, whether family members can be included under the same
   investment, tax residency implications, and what happens to residency status if
   the investment is later sold or liquidated.

Produce 5-6 lessons. Each lesson: 800-1500 words of markdown, structured as
`# Title`, a one-paragraph promise of what the reader will be able to do after this
lesson, `## The short version` (3-6 bullets), `## The detail` (body with `##`/`###`
subheads), `## What to do next` (action list), and a closing blockquote noting this
is general information, not legal, tax, or investment advice.

Hard rules:
- This is an education product, not a service. Never promise an outcome, approval,
  citizenship timeline, or investment return. Never describe us as providing
  immigration, legal, or investment advisory services.
- The two investment thresholds ($150,000 for tourism, $200,000 for real estate/
  bolsa de valores/bonds/shares) are confirmed — use them as given. Everything
  else specific — exact qualifying project types, exact legal decree/law
  reference, exact fee amounts, exact processing times, exact documentation list
  — must be written as `[VERIFY: what needs checking]` instead of invented. I will
  fill these in from official sources.
- Anything time-sensitive gets an "as of [month year]" marker.
- Plain, direct English. No hype, no filler, no "in today's fast-paced world".

Output only a JSON object in exactly this shape, no prose around it:

{"modules":[{"slug":"paraguay-investor-pass","title":"The Paraguay Investor Pass","description":"...","sortOrder":3,
"minTier":"guide","status":"draft","lessons":[{"slug":"kebab-case","title":"...",
"contentMd":"# ...\n\n...","sortOrder":1,"status":"draft"}]}]}

contentMd must be a single JSON string with \n escapes. Slugs are lowercase words
separated by single hyphens, unique within the file.
```

Investor Pass content will need the most `[VERIFY:]` resolution of any module —
Paraguay's investment-residency rules are newer and change faster than the
standard route. Budget extra fact-checking time for it specifically.

## 6. Order of work

1. Decisions 1–5 above (§1) — unblocks the marketing copy and the LS store.
2. Draft modules 1, 4–7 (guide tier) with the generic prompt in §5, and modules 2–3
   with the ready prompts in §5b — one generation run per module.
3. Resolve every `[VERIFY:]`, upload resource files, get their URLs.
4. `--dry-run`, then import as drafts, review in `/admin`, publish.
5. Insider modules 8–9 and the first 2–3 updates entries.
6. Blog posts — these can land after launch, one or two a week.
7. Fill in every `TODO(owner)` in `src/config/site.ts`, then run the doc 04 launch
   checklist.

Only step 1 blocks the deploy. Everything else can land while the site is live, as
long as the guide modules are published before you take money for them.
