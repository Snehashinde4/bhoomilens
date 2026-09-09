# BhoomiLens API reference

Base URL: `http://localhost:8000/api/v1`
Interactive docs: `/docs` (Swagger UI) · `/redoc` · `/openapi.json`

All figures returned by this service are **synthetic**. Predictive fields carry the disclaimer
*"Simulated prediction for prototype demonstration. Not a legal determination."* Anomaly endpoints
describe every finding as a **potential anomaly**.

---

## Conventions

### Authentication

```http
POST /api/v1/auth/token?role=national_admin
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "role": "national_admin",
  "permissions": ["overview.view", "project.view", "..."],
  "note": "Prototype authentication. Production uses OAuth 2.0 / OpenID Connect."
}
```

Send the token on every subsequent request:

```http
Authorization: Bearer <access_token>
```

### List parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | integer ≥ 1 | `1` | 1-based page number |
| `page_size` | integer 1-500 | `25` | Rows per page |
| `search` | string | – | Free-text search across the main columns |
| `sort_by` | string | – | Field name to sort by |
| `sort_dir` | `asc` \| `desc` | `desc` | Sort direction |
| `state` | string | – | Restrict to one state |
| `district` | string | – | Restrict to one district |

### List response envelope

```json
{
  "rows": [ /* … */ ],
  "meta": { "total": 1500, "page": 1, "page_size": 25, "pages": 60 }
}
```

### Errors

```json
{ "code": "permission_denied", "message": "Role 'citizen' does not carry the 'audit.view' permission." }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `unknown_role` | Role does not exist |
| 401 | `not_authenticated` | Missing bearer token |
| 401 | `invalid_token` | Expired or malformed token |
| 403 | `permission_denied` | Role lacks the required permission |
| 404 | `not_found` | Record or report does not exist |
| 500 | `internal_error` | Unhandled server error |

### Response headers

| Header | Purpose |
| --- | --- |
| `X-Correlation-Id` | Echoed from the request or generated; used to join API and audit logs |
| `X-Response-Time-Ms` | Server-side processing time |

---

## Endpoints

### Authentication and identity

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/token` | – | Issue a prototype access token for a demo role |
| `GET` | `/auth/me` | authenticated | Current principal and its permissions |
| `GET` | `/auth/roles` | – | Every role with its permission list |

### Reference data

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/reference/states` | `overview.view` | All 28 states |
| `GET` | `/reference/districts?state=` | `overview.view` | Districts, optionally filtered by state |

### Projects and acquisition

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/projects` | `project.view` | Paginated project register; extra filters `projectType`, `riskLevel`, `stage` |
| `GET` | `/projects/{code}` | `project.view` | Single project by code or UUID |
| `GET` | `/projects/{code}/stages` | `project.view` | Eleven lifecycle stages with workload |
| `GET` | `/projects/{code}/parcels` | `parcel.view` | Parcels attached to the project |
| `GET` | `/projects/{code}/risk` | `risk.view` | Risk prediction with explainable contributors |
| `GET` | `/acquisition/stages` | `project.view` | Stage workload aggregated across the scope |

### Risk intelligence

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/risk/model` | `risk.view` | Model card: version, factor weights, risk bands, disclaimer |
| `POST` | `/risk/simulate` | `risk.simulate` | What-if simulation over the delay-risk model |

Request body for `/risk/simulate`:

```json
{
  "compensation_gap": 36.2,
  "legal_case_load": 18,
  "approval_aging_days": 300,
  "missing_documents": 260,
  "stakeholder_response": 62.5,
  "rr_gap": 62,
  "survey_discrepancy": 16,
  "gis_conflict": 96,
  "verification_capacity": 7.5,
  "field_team_capacity": 6
}
```

Response:

```json
{
  "score": 78,
  "level": "high",
  "riskLevel": "high",
  "delay_probability": 78,
  "contributors": [
    { "factor": "Legal disputes", "contribution": 17.3, "value": 18, "unit": "open cases", "direction": "increases" }
  ],
  "disclaimer": "Simulated prediction for prototype demonstration. Not a legal determination."
}
```

### Documents, validation and review

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/documents` | `document.view` | Document register; filters `documentType`, `status`, `language` |
| `GET` | `/documents/pipeline` | `document.view` | Seven-stage processing funnel |
| `GET` | `/documents/{code}` | `document.view` | Single document |
| `GET` | `/validations` | `validation.view` | Conflicts; filters `severity`, `category` |
| `GET` | `/review-tasks` | `review.view` | Priority-ordered review queue; filters `status`, `reason` |

### Parcels, ownership and GIS

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/parcels` | `parcel.view` | Parcel register; filter `landType` |
| `GET` | `/parcels/{parcelId}` | `parcel.view` | Land digital twin: parcel, ownership chain, mutations, documents, validations, alerts, compensation |
| `GET` | `/gis/parcels.geojson` | `gis.view` | Parcel geometry as a GeoJSON `FeatureCollection` (rings closed) |

### Fraud, compensation and watershed

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/fraud-alerts` | `fraud.view` | Potential anomalies; filters `severity`, `status` |
| `GET` | `/compensation` | `compensation.view` | Compensation records; filter `status` |
| `GET` | `/compensation/summary` | `compensation.view` | Assessed, paid, outstanding and progress |
| `GET` | `/watersheds` | `watershed.view` | Watershed observations |

### Metrics, reports, integrations and audit

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/metrics/national` | `overview.view` | Headline KPI block for the current scope |
| `GET` | `/metrics/monthly` | `overview.view` | Rolling 24-month operational series |
| `GET` | `/metrics/districts` | `overview.view` | District scorecards |
| `GET` | `/reports` | `reports.view` | Report catalogue |
| `GET` | `/reports/{reportId}` | `reports.view` | Paginated report payload |
| `GET` | `/integrations` | `integrations.view` | Adapter health, latency and failure counts |
| `POST` | `/integrations/{system}/retry` | `integrations.manage` | Queue a retry of failed records |
| `GET` | `/audit-events` | `audit.view` | Audit trail; filter `action` |

---

## Worked example — the demonstration flow

```bash
BASE=http://localhost:8000/api/v1
TOKEN=$(curl -sX POST "$BASE/auth/token?role=national_admin" | jq -r .access_token)
H="Authorization: Bearer $TOKEN"

# 1. National position
curl -s -H "$H" "$BASE/metrics/national" | jq

# 2. Narrow to Rajasthan
curl -s -H "$H" "$BASE/metrics/national?state=Rajasthan" | jq

# 3. Open the flagship project and its explainable risk
curl -s -H "$H" "$BASE/projects/PRJ-0001" | jq '{code,name,riskScore,riskLevel,primaryDelayDriver}'
curl -s -H "$H" "$BASE/projects/PRJ-0001/risk" | jq '.contributors[:3]'

# 4. Inspect the linked mutation register and its conflicts
curl -s -H "$H" "$BASE/documents/DOC-000001" | jq
curl -s -H "$H" "$BASE/validations?search=BL-184" | jq '.rows[] | {title, ocrValue, lrmsValue, gisValue}'

# 5. Open the land digital twin and its ownership chain
curl -s -H "$H" "$BASE/parcels/BL-184" | jq '{parcel: .parcel.parcelId, owners: [.ownership[].ownerName]}'

# 6. Pull the cadastral geometry
curl -s -H "$H" "$BASE/gis/parcels.geojson?limit=5" | jq '.features[0].properties.parcelId'

# 7. Simulate the effect of clearing the compensation backlog
curl -s -X POST -H "$H" -H 'Content-Type: application/json' \
  -d '{"compensation_gap":5,"legal_case_load":4,"approval_aging_days":90,"missing_documents":40,"stakeholder_response":88,"rr_gap":15,"survey_discrepancy":4,"gis_conflict":10,"verification_capacity":13,"field_team_capacity":11}' \
  "$BASE/risk/simulate" | jq '{score, riskLevel, delay_probability}'

# 8. Export the intervention evidence
curl -s -H "$H" "$BASE/reports/project-risk?state=Rajasthan&page_size=10" | jq '.meta'
```

---

## Rate limiting, versioning and compatibility

- The prefix `/api/v1` is stable. Breaking changes ship under `/api/v2`.
- Additive fields are not breaking; clients must ignore unknown properties.
- Rate limiting, quota and mutual TLS are applied at the API gateway in production and are
  intentionally absent from the prototype container.
