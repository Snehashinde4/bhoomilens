# BhoomiLens demonstration script

A twenty-four step walkthrough. Every screen shares the same project, parcel, document and
validation identifiers, so the narrative never breaks.

**Reference records**

| Entity | Identifier |
| --- | --- |
| Project | `PRJ-0001` — NH-48 Expansion Package 3, Jaipur, Rajasthan |
| Parcel | `BL-184` — Survey 184/2A · Khata KH-441 · Ram Lal Meena |
| Document | `DOC-000001` — Mutation Register, Hindi, handwritten, 4 pages |
| Mutation | `MUT-441` |

---

### Act 1 — the national picture

1. **Sign in as National Administrator.** The landing page is the National Land Governance
   Command Centre.
2. **Read the KPI band.** Eighteen indicators, each with a value, movement, comparison period,
   status colour, tooltip, sparkline and click-through.
3. **Scan the charts.** Throughput, acquisition by state, delay drivers, risk distribution,
   processing funnel, district heat map, compensation area chart, completion-versus-delay scatter,
   four gauges and a district ranking. Every one is live and exportable.
4. **Filter to Rajasthan** using the header state selector. Every KPI, chart and table updates.

### Act 2 — from portfolio to project

5. **Open the Priority Intervention Queue** at the bottom of the dashboard. Projects are ranked by
   risk with their primary delay driver and a recommended intervention.
6. **Click NH-48 Expansion Package 3** — or select it from the risk map scatter.
7. **Inspect the project profile.** Eight headline tiles and thirteen tabs.
8. **Open the Lifecycle tab.** The Gantt shows planned versus actual duration, delayed stages in
   red and the critical path outlined.
9. **Open the Risk analysis tab.** Score 78/100, HIGH. The waterfall decomposes the score factor by
   factor; the stage chart shows where slippage is most likely; the model card explains confidence
   and data completeness.
10. **Move the What-if sliders.** Raise compensation completion and verification capacity; the
    simulated score, the change in points and the projected completion date update immediately.

### Act 3 — down to the evidence

11. **Open the Documents tab** and select `DOC-000001`, the linked Mutation Register.
12. **Read the three-column workspace.** Page thumbnails on the left, the scan with OCR bounding
    boxes in the centre, extracted fields on the right.
13. **Click the low-confidence owner-name field (61.2%).** The region highlights on the scan in
    teal; low-confidence regions are outlined in red.
14. **Compare the sources.** OCR reads `Ram Lai Meena`; LRMS, registry and mutation all hold
    `Ram Lal Meena`. The mismatch is shown in red.
15. **Open the ownership conflict graph** from the header action to see how the owner, parcel,
    mutations, registrations, project and compensation connect.
16. **Correct the field.** Click *Use suggested value*, then *Save correction*. The decision is
    written to the audit trail with your name, role, old value, new value and timestamp.
17. **Re-run validation.** The rule engine executes all seven rules and reports the new
    blocking / review / informational / validated counts.

### Act 4 — the parcel and its geography

18. **Open the Land Digital Twin for BL-184.** Trust 91, health 87, with contributing signals,
    available evidence, missing evidence, confidence and a recommended follow-up.
19. **Compare recorded and calculated boundaries.** Recorded 2.48 ha versus GIS 2.09 ha — a 15.7%
    deviation, flagged as a blocking area-consistency conflict.
20. **Open the parcel in the GIS Explorer.** Toggle the *GIS mismatch parcels* layer, switch to
    satellite, draw a polygon and measure its area.
21. **Open Watershed Insights** for the linked catchment: NDVI trend, soil moisture, land-use mix,
    structure verification and erosion risk before and after treatment — every insight card states
    its source, observation date, confidence and verification status.

### Act 5 — decide, record, explain

22. **Return to the project and create an intervention.** Assign an officer, add a note, set the
    priority. The intervention appears on the project and in the audit trail.
23. **Open the Report Centre** and export the Project-risk or Intervention report as CSV, Excel,
    JSON or a print-ready PDF. The download is itself audited.
24. **Open the Research Hub** and ask the assistant:
    *"Show evidence on how compensation-verification delays affect highway acquisition timelines in
    Rajasthan."* The answer separates facts from model estimates and cites the records it used.

---

### Encore — the three differentiators

**National Scenario Simulator** (`/scenario`)
Move the compensation team from 5 to 10 officers and reduce pending cases by 50%. The portfolio
delay risk and the count of high/critical projects both drop, and the narrative panel explains why.

**LandGPT** (header, every page)
Ask *"Why is NH-48 Expansion Package 3 high-risk?"* — the copilot answers with facts, clearly
separated model estimates, the calculation used, and clickable citations. Switch to the Citizen
role and ask about compensation: the copilot refuses, because the role lacks the permission.

**Administrative Time Machine** (`/time-machine`)
Drag the slider from 2018 to 2026 and watch ownership, mutations, acquisition progress,
compensation status and vegetation observations reconstruct year by year for parcel BL-184.

---

### Role tour

| Role | What changes |
| --- | --- |
| District Collector | District-scoped dashboards, intervention and review-assignment powers |
| Document Verification Officer | Lands in the Digitization Studio; no project or audit modules |
| GIS Analyst | Lands in GIS Explorer; can edit geometry, cannot approve compensation |
| Auditor | Full read access, every mutating action hidden |
| Citizen | Only the public services portal, with owner names and identifiers masked |

Switch roles from the header at any time — the navigation, actions and copilot answers all change.
