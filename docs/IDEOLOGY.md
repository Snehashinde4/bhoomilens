# BhoomiLens — Project Ideology

*The reasoning behind the product. Not what it does — [`README.md`](../README.md) covers that — but
why it is shaped the way it is, and what it deliberately refuses to become.*

---

## 1. The problem we are actually solving

Land is the most contested asset in India. It is also the most poorly recorded.

The visible symptom is delay: an infrastructure project is sanctioned, and then years pass before
possession is taken. The instinctive explanation is bureaucratic inertia. That explanation is
wrong, and acting on it produces the wrong interventions — more review meetings, more status
reports, more pressure on officers who are not the bottleneck.

The actual causes are structural and largely invisible to the people accountable for the outcome:

- **The record base is fragmented.** Ownership evidence is split across the record of rights, the
  mutation register, the sub-registrar's index and the cadastral map. These four sources are
  maintained by different offices, on different cycles, in different scripts, and they disagree
  more often than anyone admits.
- **Disagreement is discovered too late.** A mismatch between the recorded area and the surveyed
  polygon is cheap to fix at survey stage and ruinously expensive to fix after an award is
  declared and a claimant has gone to court.
- **Delay is attributed, not diagnosed.** A project is "delayed". Nobody can say whether it is
  delayed *because* compensation verification is stalled, *because* litigation is blocking
  possession, or *because* forty mutation registers were never digitised.
- **The evidence exists but is not connected.** Almost every fact needed to diagnose the delay is
  already recorded somewhere. It is simply not joined up.

So the problem is not "we need to scan documents". The problem is:

> **The state cannot see the causal structure of its own land records, and therefore intervenes
> late and generically instead of early and specifically.**

Everything in BhoomiLens follows from that sentence.

---

## 2. The central thesis

> **Digitisation is worthless unless it terminates in a decision.**

An OCR pipeline that produces a searchable archive has moved paper into a database and changed
nothing about how land is governed. The value appears only when extracted text is reconciled
against other sources, placed on a map, attached to a project, converted into a risk signal, and
put in front of an officer with a specific recommended action and a named accountable office.

This is why BhoomiLens is not organised as a document management system with reports bolted on. It
is organised as a **causal chain**, and every module is one link in it:

```
Fragmented evidence
    → structured extraction        (Digitization Studio)
    → cross-source reconciliation  (Validation Workspace)
    → spatial grounding            (GIS Explorer, Land Digital Twins)
    → project attribution          (Acquisition Monitor)
    → causal decomposition         (Risk Intelligence)
    → specific intervention        (Priority Intervention Queue)
    → durable accountability       (Audit Logs)
```

A feature that does not sit on this chain does not belong in the product. That test killed several
plausible ideas during construction — a document-similarity browser, a generic BI query builder, a
notifications inbox with its own workflow engine. Each was defensible in isolation. None of them
moved a record closer to a decision.

---

## 3. Ten principles

### 3.1 Explainability is an architectural constraint, not a feature

A risk score that an officer cannot interrogate is a score they will either obey blindly or ignore
entirely. Both are failures, and the second is more common.

So the delay-risk model in [`src/risk/model.ts`](../src/risk/model.ts) is a **transparent
weighted-factor model**, not a learned black box. Ten named factors, each with a declared weight
(22, 19, 14, 12, 10, 9, 8, 6, 6, 4), each normalised so that 1 always means "worse", each
contributing an integer number of risk points that sums to the total.

This is a deliberate accuracy trade. A gradient-boosted model would very likely score better on a
held-out set. It would also be unusable, because the output of this system is not a prediction —
it is **an argument that an administrator has to be able to defend to a superior, an auditor, and
eventually a court**. "The model said so" is not a defence. "Compensation is 36% undisbursed, which
contributes 11.3 of the 78 points, and here are the 2,418 affected families" is.

The constraint propagates. Because the score must decompose, the UI must show a waterfall rather
than a gauge. Because each factor must be defensible, each carries an `explain()` function that
renders it as a sentence. Because the recommendation must follow from the dominant factor,
`recommendIntervention()` maps factors to concrete administrative actions, not to platitudes.

Where a real model would be used in production, the same constraint applies: it must expose
per-feature attributions, or it does not ship.

### 3.2 The machine proposes; a human disposes

Extraction confidence below the acceptance threshold does not silently degrade the record. It
routes to a person. Every field carries `status: auto_accepted | needs_review | corrected |
rejected`, and the transition is made by a named officer whose decision is written to the audit
trail with the old value, the new value and a reason.

The reviewer is not a safety net bolted onto an automated system. They are the **authority** in the
system, and the automation exists to spend their attention well. This is why the Review Queue
prioritises rather than lists: priority combines confidence, conflict severity, project exposure
and ageing against SLA, because a reviewer working a FIFO queue of 20,000 items is being wasted.

Corollary: **the system never auto-approves anything that changes a legal position.** It can
auto-accept a high-confidence village name. It cannot auto-accept an owner name.

### 3.3 Never destroy the original evidence

The `ExtractedField` entity keeps five parallel representations: `originalText` (the source script,
verbatim), `transliterated`, `translated`, `normalizedValue` and `suggestedValue`. Corrections
append to `correctionHistory`; they never overwrite.

The database schema enforces the same discipline — see the comment on `extracted_fields` in
[`backend/sql/schema.sql`](../backend/sql/schema.sql).

This matters because normalisation is lossy and culturally opinionated. Transliterating
राम लाल मीणा into "Ram Lal Meena" makes a judgement about a name that belongs to a person, in a
system that may later be used to decide whether that person is compensated. The judgement must
remain reversible and inspectable, forever. A record whose provenance has been normalised away is
not evidence; it is a claim.

### 3.4 Say "potential anomaly" and mean it

The fraud engine detects fifteen categories of statistical and rule-based irregularity. Not one of
its outputs is called fraud.

Every alert, every export, every API response and every copilot answer describes a **potential
anomaly** and carries `appConfig.anomalyDisclaimer`. The API test suite asserts this
(`test_fraud_alerts_are_labelled_as_potential`) so the language cannot regress through a careless
refactor.

The reason is not legal caution. It is that these detections have real consequences for real
people. "Duplicate ownership claim on parcel BL-184" can mean a forged mutation. It can equally
mean an unrecorded partition between brothers, a clerical error in 1997, or a scanning artefact.
The system's job is to route a human to look. It is emphatically not to accuse.

The same restraint governs the trust and health scores. They are administrative indicators of
*record quality*, and they are labelled as explicitly not a certification of title
(`appConfig.scoreDisclaimer`). A parcel with a trust score of 41 has a weak paper trail. It does
not have a dishonest owner.

### 3.5 Predictions are labelled as predictions, everywhere, without exception

`appConfig.predictionDisclaimer` — *"Simulated prediction for prototype demonstration. Not a legal
determination."* — appears under every risk score, every simulator output, every predicted
completion date, every forecast chart, in the CSV exports, in the API payloads and in the copilot.

This is repetitive by design. Disclaimers that appear once on a landing page and nowhere else are
decoration. A figure that travels — screenshotted into a slide, pasted into a note, exported to a
spreadsheet — must carry its own caveat, because the context that qualified it will be stripped
long before the number stops being quoted.

### 3.6 Permission is enforced at every layer, including the AI

Fourteen roles, thirty-two named permissions. Access is checked in three independent places:

1. **Route** — `PermissionGuard` renders an explicit access notice, never a blank page.
2. **Action** — `<Can permission="...">` removes the control entirely rather than disabling it.
3. **Answer** — `askLandGpt()` checks the permission attached to the matched intent *before*
   running the query, and returns a refusal.

The third is the one most systems forget. A copilot that queries the underlying dataset with the
service account's privileges is a permission bypass wearing a friendly interface. Ask LandGPT to
summarise pending compensation as a Citizen and it declines — and the test suite asserts it.

Roles are also **data-scoped**, not just feature-scoped (`inScope()`): a District Collector holds
`validation.decide`, but only over their own district's records. Feature permission and data scope
are different questions and are answered separately.

### 3.7 The AI may not invent

The copilot answers only from records present in the environment. Its structure enforces this: a
matched intent runs a real query over real collections and returns real identifiers; an unmatched
query falls through to `fallbackSearch`, which returns a low-confidence "no matching records"
response rather than a fluent guess.

Every answer separates **facts from records** (things the system holds) from **model estimates**
(things the system inferred), renders them in visually distinct blocks, and cites the underlying
records as clickable links. It states the calculation used. It reports a confidence.

The system will never produce a policy citation, a legal provision, a judgement reference or a
statistic it cannot point at. In a land governance context, a plausible fabricated citation is not
a minor quality issue — it is the single most dangerous output the product could generate, because
it is exactly the kind of thing that gets quoted in a file note and never checked.

### 3.8 Privacy by construction, not by policy

- Bank identifiers are masked at generation and never held in full. The schema stores a
  `bank_account_token` plus `bank_account_last4`, never the account number.
- Identity numbers are stored as `identity_hash`.
- Citizen-facing views mask owner names to first name plus initials (`maskName`).
- Source IPs are masked in the audit UI.
- `pii.unmask` exists as a distinct permission held by exactly one role, so unmasking is an
  auditable event rather than an ambient capability.

A privacy rule written in a policy document is a hope. A privacy rule expressed as a column that
cannot hold the sensitive value is a guarantee. We chose the second wherever the choice existed.

### 3.9 Trust is engineered, not asserted

Four properties, each with a mechanism:

| Property | Mechanism |
| --- | --- |
| **Reproducible** | Seeded mulberry32 PRNG. The same seed always yields the same dataset — asserted by test. |
| **Deterministic** | Validation rules are pure functions; re-running on unchanged input yields identical issue IDs — asserted by test. |
| **Idempotent** | `documents.source_key` is unique, so an ingestion replay cannot duplicate records. |
| **Immutable** | `audit_events` rejects `UPDATE` and `DELETE` via a database trigger, not application convention. |

Reproducibility is the quiet one, and it matters more than it looks. A demonstration that shows
different numbers on every reload cannot be discussed, challenged or verified. A reviewer who
returns to `PRJ-0001` a week later and finds a risk score of 78 — the same 78 — can start asking
real questions about the model instead of wondering whether they misremembered.

### 3.10 Honest about scale, honest about limits

The GIS Explorer caps rendering at 1,200 parcels and **says so on screen**. It would have been
easy to silently sample and let the map look complete. The badge is there because a user who does
not know they are seeing a subset will draw conclusions from an absence that is an artefact of
rendering, not of the world.

The same instinct governs the document pipeline: field-level detail is materialised for the first
500 documents and generated deterministically on demand for the rest, seeded by document code. Any
of 50,000 documents opens correctly; memory stays bounded. The trade is stated rather than hidden.

---

## 4. What this product refuses to do

Refusals define a product more sharply than features. These are architectural, not deferred:

| Refusal | Why |
| --- | --- |
| **Determine title** | Only a competent authority can. The system surfaces evidence and disagreement between sources; it never adjudicates. |
| **Confirm fraud** | Detection is a signal for investigation. Confirmation is an official act. |
| **Auto-approve legally significant fields** | Ownership, area and compensation always terminate in a human decision. |
| **Produce legal citations** | The copilot cites records it holds and nothing else. |
| **Hide a model behind an API** | If it cannot be decomposed into named contributions, it does not inform an administrative decision. |
| **Claim live government connectivity** | The prototype ships mock adapters behind honest interfaces and says so on the Integrations page. |
| **Ship a public demo pointing at a live backend** | The deployed site runs fully client-side. An exposed API without a gateway, rate limiting and a real IdP would be a liability, not a feature. |
| **Present synthetic data as real** | A persistent badge, on every screen, in every export. |

---

## 5. Why the interface looks the way it does

The design system is a deliberate rejection of the consumer-analytics aesthetic: no gradients, no
glassmorphism, no celebratory micro-animation, no dark-mode-first drama.

The palette is drawn from the physical objects this system replaces — the warm off-white of a
register page (`--paper: #f6f1e8`), the deep navy of an administrative boundary
(`--ink: #102a43`), the fine ochre rule of a cadastral line (`--line: #c9bda9`), teal for water,
olive for vegetation. Headings are set in a serif; metrics in a monospace so that digits align in a
column the way they do on a ledger.

This is not nostalgia. It is three functional claims:

1. **Density is a requirement, not a compromise.** A District Collector comparing eleven lifecycle
   stages across forty projects needs information per square inch. Generous whitespace is a luxury
   afforded by products with three metrics.
2. **Status must never be carried by colour alone.** Every badge pairs colour with a word. Red-green
   colour vision deficiency affects roughly one in twelve men, a population heavily represented
   among the field officers who will use this on a phone in daylight.
3. **Visual seriousness is a form of honesty.** An interface that looks like a growth dashboard
   invites growth-dashboard reasoning — optimise the number, celebrate the trend. An interface that
   looks like a land record invites the caution the subject deserves.

The prohibition is written into the design brief as a hard rule: *do not make it look like a
generic fintech dashboard.*

---

## 6. The single-seam principle

Every screen reads through one function: `services/api.ts`. In `mock` mode it queries the
in-browser synthetic engine; in `api` mode it calls FastAPI and falls back to the engine if the
backend is unreachable. **No component embeds a data array.**

This is the highest-leverage decision in the codebase, and it was made on day one because it is
nearly impossible to retrofit.

It buys four things:
- Real mock data can replace seed data with **zero UI changes** — which is what the Settings
  importer does, validating every row against a Zod contract before it lands.
- The demo cannot break in front of an audience because a backend is down.
- The Python and TypeScript engines can mirror each other, so the API and the browser tell the
  same story about the same `PRJ-0001`.
- Swapping the synthetic layer for PostGIS is a change in one module.

The corresponding discipline on the analytics side: selectors in `services/analytics.ts` are pure
functions of `(dataset, scope)`. A chart cannot disagree with a table, because both derive from the
same selector. Dashboards that drift out of agreement with their own drill-downs do so because each
view computed its own numbers.

---

## 7. Why one story, told with the same identifiers

`PRJ-0001` → `DOC-000001` → `BL-184` → `MUT-441` appear together across every module, and the test
suite asserts their exact values — 4,820 ha proposed, 2,418 affected families, 2.48 ha recorded
against 2.09 ha surveyed, an owner-name field at 61.2% confidence reading "Ram Lai Meena" where
LRMS holds "Ram Lal Meena".

Disconnected demos are the standard failure of governance software. Twenty screens, twenty
unrelated datasets, no path from any screen to any other. They demonstrate that pages exist. They
demonstrate nothing about whether the system works.

A single thread that survives twenty-four steps demonstrates the only thing that matters: **the
causal chain in §2 actually closes.** A 15.7% area discrepancy on one parcel becomes a blocking
validation conflict, becomes a contributor to a project risk score, becomes a recommended
re-survey, becomes an audited intervention. That is the product. Everything else is chrome.

---

## 8. Where the ideology binds the roadmap

The principles are not aspirational; they constrain what can be built next.

- **Real OCR** must expose per-field confidence and bounding boxes, or the reviewer workspace loses
  its evidentiary link and §3.2 fails.
- **A learned risk model** must expose per-feature attributions (SHAP or equivalent) at prediction
  time, or §3.1 fails and it cannot ship.
- **Live integrations** must preserve idempotency and record provenance per source, or §3.9 fails.
- **A generative copilot** must be retrieval-grounded with citation enforcement and refusal
  behaviour, or §3.7 fails.

If a capability cannot be delivered under these constraints, the correct answer is to not deliver
it. A land governance system that is wrong quietly is worse than one that is silent.

---

## 9. The standard of success

Not adoption. Not documents processed. Not model accuracy.

> **A District Collector opens the platform on a Monday, learns something about a project that they
> did not already know, understands why it is true, can trace it to the specific records that make
> it true, acts on it — and six months later the project is not in the intervention queue.**

Everything in this repository is an attempt to make that sentence achievable, and to make it
verifiable when it is not.

---

## 10. A closing caution

This is a prototype containing entirely synthetic data. No name, parcel, coordinate, figure or
document in it corresponds to a real person, holding or transaction.

The ideology above is the more durable artefact. Software for land governance operates on the
single asset that most determines whether a family stays solvent, whether a village keeps its
commons and whether an infrastructure programme finishes within a decade. Built carelessly, such a
system does not merely fail — it launders bad records into authoritative-looking ones and lends
institutional weight to errors that used to be visible as errors.

That is the failure mode worth designing against, and it is what every refusal in §4 is protecting.

---

*See also: [`README.md`](../README.md) for architecture and modules · [`API.md`](API.md) for the
service contract · [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) for the walkthrough that exercises §7.*
