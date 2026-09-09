"""BhoomiLens REST API v1.

Every router is permission-guarded and returns paginated, filterable payloads
matching the contracts consumed by the frontend service layer.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .config import get_settings
from .pagination import QueryParams, apply_scope, paginate
from .security.auth import create_access_token, current_principal, require
from .security.rbac import ROLES
from .synthetic import (
    DISCLAIMER,
    LIFECYCLE_STAGES,
    MODEL_VERSION,
    PROCESSING_STAGES,
    Dataset,
    get_dataset,
    risk_level,
    score_risk,
)

router = APIRouter()


def dataset() -> Dataset:
    settings = get_settings()
    return get_dataset(settings.data_seed, settings.data_scale)


# --------------------------------------------------------------------------- #
# Authentication and identity                                                 #
# --------------------------------------------------------------------------- #

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])


@auth_router.post("/token", summary="Issue a prototype access token for a demo role")
def issue_token(role: str = Query(..., description="One of the 14 BhoomiLens roles")) -> Dict[str, Any]:
    if role not in ROLES:
        raise HTTPException(status_code=400, detail={"code": "unknown_role", "message": f"Unknown role '{role}'."})
    token = create_access_token(subject=f"demo-{role}", role=role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role,
        "permissions": ROLES[role]["permissions"],
        "note": "Prototype authentication. Production uses OAuth 2.0 / OpenID Connect.",
    }


@auth_router.get("/me", summary="Return the current principal and its permissions")
def me(principal: Dict[str, Any] = Depends(current_principal)) -> Dict[str, Any]:
    return {"role": principal["role"], "permissions": ROLES[principal["role"]]["permissions"], "claims": principal}


@auth_router.get("/roles", summary="List every role and its permissions")
def roles() -> Dict[str, Any]:
    return {"roles": [{"id": key, **value} for key, value in ROLES.items()]}


# --------------------------------------------------------------------------- #
# Reference data                                                              #
# --------------------------------------------------------------------------- #

reference_router = APIRouter(prefix="/reference", tags=["Reference data"])


@reference_router.get("/states", summary="List states")
def states(_: Dict[str, Any] = Depends(require("overview.view"))) -> Dict[str, Any]:
    return {"rows": dataset().states}


@reference_router.get("/districts", summary="List districts")
def districts(
    state: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("overview.view")),
) -> Dict[str, Any]:
    rows = dataset().districts
    if state:
        rows = [d for d in rows if d["state"] == state]
    return {"rows": rows}


# --------------------------------------------------------------------------- #
# Projects and acquisition                                                    #
# --------------------------------------------------------------------------- #

projects_router = APIRouter(prefix="/projects", tags=["Projects"])


@projects_router.get("", summary="List acquisition projects")
def list_projects(
    params: QueryParams = Depends(),
    project_type: Optional[str] = None,
    risk_level_filter: Optional[str] = Query(None, alias="riskLevel"),
    stage: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("project.view")),
) -> Dict[str, Any]:
    rows = dataset().projects
    if project_type:
        rows = [p for p in rows if p["projectType"] == project_type]
    if risk_level_filter:
        rows = [p for p in rows if p["riskLevel"] == risk_level_filter]
    if stage:
        rows = [p for p in rows if p["currentStage"] == stage]
    return paginate(rows, params, ["code", "name", "state", "district", "implementingAgency"])


@projects_router.get("/{code}", summary="Get a single project")
def get_project(code: str, _: Dict[str, Any] = Depends(require("project.view"))) -> Dict[str, Any]:
    project = dataset().project_by_code(code)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"No project '{code}'."})
    return project


@projects_router.get("/{code}/stages", summary="Lifecycle stages for a project")
def project_stages(code: str, _: Dict[str, Any] = Depends(require("project.view"))) -> Dict[str, Any]:
    ds = dataset()
    project = ds.project_by_code(code)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"No project '{code}'."})
    return {"rows": [s for s in ds.project_stages if s["projectId"] == project["id"]]}


@projects_router.get("/{code}/parcels", summary="Parcels attached to a project")
def project_parcels(
    code: str,
    limit: int = Query(300, le=2000),
    _: Dict[str, Any] = Depends(require("parcel.view")),
) -> Dict[str, Any]:
    ds = dataset()
    project = ds.project_by_code(code)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"No project '{code}'."})
    return {"rows": [p for p in ds.parcels if p["projectId"] == project["id"]][:limit]}


@projects_router.get("/{code}/risk", summary="Risk prediction with explainable contributors")
def project_risk(code: str, _: Dict[str, Any] = Depends(require("risk.view"))) -> Dict[str, Any]:
    ds = dataset()
    project = ds.project_by_code(code)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"No project '{code}'."})
    prediction = next((r for r in ds.risk_predictions if r["projectId"] == project["id"]), None)
    return prediction or {}


acquisition_router = APIRouter(prefix="/acquisition", tags=["Acquisition"])


@acquisition_router.get("/stages", summary="Aggregate stage workload across projects")
def acquisition_stages(
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("project.view")),
) -> Dict[str, Any]:
    ds = dataset()
    projects = apply_scope(ds.projects, params)
    ids = {p["id"] for p in projects}
    rows = []
    for stage in LIFECYCLE_STAGES:
        stage_rows = [s for s in ds.project_stages if s["stage"] == stage and s["projectId"] in ids]
        rows.append(
            {
                "stage": stage,
                "projectsInStage": len([p for p in projects if p["currentStage"] == stage]),
                "completedCases": sum(s["completedCases"] for s in stage_rows),
                "pendingCases": sum(s["pendingCases"] for s in stage_rows),
                "delayedCases": sum(s["delayedCases"] for s in stage_rows),
            }
        )
    return {"rows": rows}


# --------------------------------------------------------------------------- #
# Risk and simulation                                                         #
# --------------------------------------------------------------------------- #

risk_router = APIRouter(prefix="/risk", tags=["Risk intelligence"])


@risk_router.get("/model", summary="Model card for the delay-risk model")
def risk_model(_: Dict[str, Any] = Depends(require("risk.view"))) -> Dict[str, Any]:
    from .synthetic import RISK_FACTORS

    return {
        "modelVersion": MODEL_VERSION,
        "factors": RISK_FACTORS,
        "bands": {"low": "<40", "medium": "40-64", "high": "65-79", "critical": ">=80"},
        "disclaimer": DISCLAIMER,
    }


@risk_router.post("/simulate", summary="What-if simulation over the delay-risk model")
def simulate(payload: Dict[str, float], _: Dict[str, Any] = Depends(require("risk.simulate"))) -> Dict[str, Any]:
    result = score_risk(payload)
    return {**result, "riskLevel": risk_level(result["score"]), "disclaimer": DISCLAIMER}


# --------------------------------------------------------------------------- #
# Documents, validation and review                                            #
# --------------------------------------------------------------------------- #

documents_router = APIRouter(prefix="/documents", tags=["Documents"])


@documents_router.get("", summary="List documents")
def list_documents(
    params: QueryParams = Depends(),
    document_type: Optional[str] = Query(None, alias="documentType"),
    status: Optional[str] = None,
    language: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("document.view")),
) -> Dict[str, Any]:
    rows = dataset().documents
    if document_type:
        rows = [d for d in rows if d["documentType"] == document_type]
    if status:
        rows = [d for d in rows if d["status"] == status]
    if language:
        rows = [d for d in rows if d["language"] == language]
    return paginate(rows, params, ["code", "fileName", "documentType", "village", "district"])


@documents_router.get("/pipeline", summary="Document processing funnel")
def pipeline(
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("document.view")),
) -> Dict[str, Any]:
    rows = apply_scope(dataset().documents, params)
    return {
        "rows": [
            {
                "stage": stage,
                "documents": len([d for d in rows if PROCESSING_STAGES.index(d["processingStage"]) >= index]),
            }
            for index, stage in enumerate(PROCESSING_STAGES)
        ]
    }


@documents_router.get("/{code}", summary="Get a document")
def get_document(code: str, _: Dict[str, Any] = Depends(require("document.view"))) -> Dict[str, Any]:
    document = dataset().document_by_code(code)
    if not document:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"No document '{code}'."})
    return document


validations_router = APIRouter(prefix="/validations", tags=["Validation"])


@validations_router.get("", summary="List validation conflicts")
def list_validations(
    params: QueryParams = Depends(),
    severity: Optional[str] = None,
    category: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("validation.view")),
) -> Dict[str, Any]:
    rows = dataset().validations
    if severity:
        rows = [v for v in rows if v["severity"] == severity]
    if category:
        rows = [v for v in rows if v["category"] == category]
    return paginate(rows, params, ["title", "parcelId", "ocrValue", "lrmsValue"])


review_router = APIRouter(prefix="/review-tasks", tags=["Review queue"])


@review_router.get("", summary="List prioritised review tasks")
def list_review(
    params: QueryParams = Depends(),
    status: Optional[str] = None,
    reason: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("review.view")),
) -> Dict[str, Any]:
    rows = dataset().review_queue
    if status:
        rows = [t for t in rows if t["status"] == status]
    if reason:
        rows = [t for t in rows if t["reason"] == reason]
    rows = sorted(rows, key=lambda t: t["priorityScore"], reverse=True)
    return paginate(rows, params, ["code", "reason", "district", "parcelId"])


# --------------------------------------------------------------------------- #
# Parcels, ownership and GIS                                                  #
# --------------------------------------------------------------------------- #

parcels_router = APIRouter(prefix="/parcels", tags=["Parcels"])


@parcels_router.get("", summary="List parcels")
def list_parcels(
    params: QueryParams = Depends(),
    land_type: Optional[str] = Query(None, alias="landType"),
    _: Dict[str, Any] = Depends(require("parcel.view")),
) -> Dict[str, Any]:
    rows = dataset().parcels
    if land_type:
        rows = [p for p in rows if p["landType"] == land_type]
    return paginate(rows, params, ["parcelId", "surveyNumber", "khasraNumber", "khataNumber", "owner", "village"])


@parcels_router.get("/{parcel_id}", summary="Land digital twin for one parcel")
def parcel_detail(parcel_id: str, _: Dict[str, Any] = Depends(require("parcel.view"))) -> Dict[str, Any]:
    ds = dataset()
    parcel = ds.parcel_by_id(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"No parcel '{parcel_id}'."})
    return {
        "parcel": parcel,
        "ownership": sorted(
            [o for o in ds.ownership_records if o["parcelId"] == parcel_id], key=lambda o: o["fromYear"]
        ),
        "mutations": [m for m in ds.mutations if m["parcelId"] == parcel_id],
        "documents": [d for d in ds.documents if d["parcelId"] == parcel_id],
        "validations": [v for v in ds.validations if v.get("parcelId") == parcel_id],
        "alerts": [a for a in ds.fraud_alerts if a["parcelId"] == parcel_id],
        "compensation": [c for c in ds.compensation if c["parcelId"] == parcel_id],
    }


gis_router = APIRouter(prefix="/gis", tags=["GIS"])


@gis_router.get("/parcels.geojson", summary="Parcel geometries as GeoJSON")
def parcels_geojson(
    params: QueryParams = Depends(),
    limit: int = Query(1000, le=20000),
    _: Dict[str, Any] = Depends(require("gis.view")),
) -> Dict[str, Any]:
    rows = apply_scope(dataset().parcels, params)[:limit]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": p["parcelId"],
                "geometry": {"type": "Polygon", "coordinates": [p["boundary"] + [p["boundary"][0]]]},
                "properties": {
                    k: v for k, v in p.items() if k not in {"boundary", "centroid"}
                },
            }
            for p in rows
        ],
    }


# --------------------------------------------------------------------------- #
# Fraud, compensation, watershed                                              #
# --------------------------------------------------------------------------- #

fraud_router = APIRouter(prefix="/fraud-alerts", tags=["Fraud intelligence"])


@fraud_router.get("", summary="List potential anomaly alerts")
def list_fraud(
    params: QueryParams = Depends(),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("fraud.view")),
) -> Dict[str, Any]:
    rows = dataset().fraud_alerts
    if severity:
        rows = [a for a in rows if a["severity"] == severity]
    if status:
        rows = [a for a in rows if a["status"] == status]
    result = paginate(rows, params, ["code", "category", "summary", "parcelId", "district"])
    result["note"] = "Every item is a potential anomaly, not a confirmed case of fraud."
    return result


compensation_router = APIRouter(prefix="/compensation", tags=["Compensation & R&R"])


@compensation_router.get("", summary="List compensation records")
def list_compensation(
    params: QueryParams = Depends(),
    status: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("compensation.view")),
) -> Dict[str, Any]:
    rows = dataset().compensation
    if status:
        rows = [c for c in rows if c["status"] == status]
    return paginate(rows, params, ["beneficiaryId", "parcelId", "district", "status"])


@compensation_router.get("/summary", summary="Assessed versus disbursed summary")
def compensation_summary(
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("compensation.view")),
) -> Dict[str, Any]:
    rows = apply_scope(dataset().compensation, params)
    assessed = sum(c["amountAssessed"] for c in rows)
    paid = sum(c["amountPaid"] for c in rows)
    return {
        "records": len(rows),
        "assessed": assessed,
        "paid": paid,
        "outstanding": assessed - paid,
        "progressPercent": round(paid / assessed * 100, 1) if assessed else 0.0,
    }


watershed_router = APIRouter(prefix="/watersheds", tags=["Watershed"])


@watershed_router.get("", summary="List watersheds")
def list_watersheds(
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("watershed.view")),
) -> Dict[str, Any]:
    return paginate(dataset().watersheds, params, ["code", "name", "district", "state"])


# --------------------------------------------------------------------------- #
# Metrics, reports, integrations, audit                                       #
# --------------------------------------------------------------------------- #

metrics_router = APIRouter(prefix="/metrics", tags=["Metrics"])


@metrics_router.get("/national", summary="National KPI block")
def national_metrics(
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("overview.view")),
) -> Dict[str, Any]:
    ds = dataset()
    projects = apply_scope(ds.projects, params)
    documents = apply_scope(ds.documents, params)
    comp = apply_scope(ds.compensation, params)
    assessed = sum(c["amountAssessed"] for c in comp)
    paid = sum(c["amountPaid"] for c in comp)
    high = [p for p in projects if p["riskLevel"] in {"high", "critical"}]
    return {
        "activeProjects": len(projects),
        "highRiskProjects": len(high),
        "criticalProjects": len([p for p in projects if p["riskLevel"] == "critical"]),
        "documentsReceived": len(documents),
        "documentsDigitized": len([d for d in documents if d["processingStage"] in {"fields_extracted", "validated", "human_reviewed", "approved"}]),
        "recordsPendingVerification": len([d for d in documents if d["status"] == "needs_review"]),
        "areaNotified": sum(p["proposedArea"] for p in projects),
        "areaAcquired": sum(p["acquiredArea"] for p in projects),
        "compensationAssessed": assessed,
        "compensationDisbursed": paid,
        "averageDelayProbability": round(sum(p["delayProbability"] for p in projects) / len(projects), 1) if projects else 0,
        "fraudAlerts": len(apply_scope(ds.fraud_alerts, params)),
        "disclaimer": DISCLAIMER,
    }


@metrics_router.get("/monthly", summary="Rolling 24-month operational series")
def monthly_metrics(_: Dict[str, Any] = Depends(require("overview.view"))) -> Dict[str, Any]:
    return {"rows": dataset().monthly_metrics}


@metrics_router.get("/districts", summary="District scorecards")
def district_metrics(
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("overview.view")),
) -> Dict[str, Any]:
    return paginate(dataset().district_metrics, params, ["district", "state"])


integrations_router = APIRouter(prefix="/integrations", tags=["Integrations"])


@integrations_router.get("", summary="Adapter health")
def list_integrations(_: Dict[str, Any] = Depends(require("integrations.view"))) -> Dict[str, Any]:
    return {"rows": dataset().integrations}


@integrations_router.post("/{system}/retry", summary="Queue a retry of failed records")
def retry_integration(system: str, principal: Dict[str, Any] = Depends(require("integrations.manage"))) -> Dict[str, Any]:
    return {
        "system": system,
        "queued": True,
        "requestedBy": principal["sub"],
        "message": "Retry queued. In production this publishes to the adapter retry topic.",
    }


audit_router = APIRouter(prefix="/audit-events", tags=["Audit"])


@audit_router.get("", summary="List audit events")
def list_audit(
    params: QueryParams = Depends(),
    action: Optional[str] = None,
    _: Dict[str, Any] = Depends(require("audit.view")),
) -> Dict[str, Any]:
    rows = dataset().audit_events
    if action:
        rows = [a for a in rows if a["action"] == action]
    return paginate(rows, params, ["actor", "action", "entityType", "entityId", "reason", "correlationId"])


reports_router = APIRouter(prefix="/reports", tags=["Reports"])

REPORTS: List[Dict[str, str]] = [
    {"id": "national", "title": "National progress report"},
    {"id": "state", "title": "State progress report"},
    {"id": "district", "title": "District performance report"},
    {"id": "project-risk", "title": "Project-risk report"},
    {"id": "lifecycle", "title": "Acquisition lifecycle report"},
    {"id": "compensation", "title": "Compensation report"},
    {"id": "digitization", "title": "Digitization quality report"},
    {"id": "fraud", "title": "Potential anomaly report"},
    {"id": "gis", "title": "GIS discrepancy report"},
    {"id": "backlog", "title": "Review-backlog report"},
    {"id": "watershed", "title": "Watershed insight report"},
    {"id": "audit", "title": "Audit report"},
]


@reports_router.get("", summary="List available reports")
def list_reports(_: Dict[str, Any] = Depends(require("reports.view"))) -> Dict[str, Any]:
    return {"rows": REPORTS}


@reports_router.get("/{report_id}", summary="Generate a report payload")
def generate_report(
    report_id: str,
    params: QueryParams = Depends(),
    _: Dict[str, Any] = Depends(require("reports.view")),
) -> Dict[str, Any]:
    ds = dataset()
    mapping = {
        "district": ds.district_metrics,
        "project-risk": ds.projects,
        "compensation": ds.compensation,
        "digitization": ds.documents,
        "fraud": ds.fraud_alerts,
        "backlog": ds.review_queue,
        "watershed": ds.watersheds,
        "audit": ds.audit_events,
        "lifecycle": ds.project_stages,
        "national": ds.monthly_metrics,
        "state": ds.projects,
        "gis": [p for p in ds.parcels if abs(p["area"] - p["gisArea"]) / p["area"] > 0.08],
    }
    if report_id not in mapping:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": f"Unknown report '{report_id}'."})
    return paginate(mapping[report_id], params)


for sub in (
    auth_router,
    reference_router,
    projects_router,
    acquisition_router,
    risk_router,
    documents_router,
    validations_router,
    review_router,
    parcels_router,
    gis_router,
    fraud_router,
    compensation_router,
    watershed_router,
    metrics_router,
    integrations_router,
    audit_router,
    reports_router,
):
    router.include_router(sub)
