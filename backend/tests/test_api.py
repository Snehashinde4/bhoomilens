import pytest
from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())


def token(role: str = "national_admin") -> str:
    response = client.post(f"/api/v1/auth/token?role={role}")
    assert response.status_code == 200
    return response.json()["access_token"]


def auth(role: str = "national_admin") -> dict:
    return {"Authorization": f"Bearer {token(role)}"}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_openapi_document_is_published() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "BhoomiLens API"


def test_token_rejects_unknown_role() -> None:
    response = client.post("/api/v1/auth/token?role=nobody")
    assert response.status_code == 400


def test_protected_endpoint_requires_authentication() -> None:
    assert client.get("/api/v1/projects").status_code == 401


def test_permission_is_enforced_per_role() -> None:
    assert client.get("/api/v1/audit-events", headers=auth("citizen")).status_code == 403
    assert client.get("/api/v1/audit-events", headers=auth("auditor")).status_code == 200


def test_projects_are_paginated_and_searchable() -> None:
    response = client.get("/api/v1/projects?page=1&page_size=5", headers=auth())
    assert response.status_code == 200
    body = response.json()
    assert len(body["rows"]) == 5
    assert body["meta"]["total"] > 100

    search = client.get("/api/v1/projects?search=NH-48", headers=auth())
    assert search.json()["meta"]["total"] >= 1


def test_flagship_project_is_present() -> None:
    response = client.get("/api/v1/projects/PRJ-0001", headers=auth())
    assert response.status_code == 200
    project = response.json()
    assert project["name"] == "NH-48 Expansion Package 3"
    assert project["state"] == "Rajasthan"
    assert project["district"] == "Jaipur"
    assert project["proposedArea"] == 4820
    assert project["riskLevel"] in {"high", "critical"}


def test_reference_parcel_detail() -> None:
    response = client.get("/api/v1/parcels/BL-184", headers=auth())
    assert response.status_code == 200
    body = response.json()
    assert body["parcel"]["owner"] == "Ram Lal Meena"
    assert body["parcel"]["area"] == 2.48
    assert body["parcel"]["gisArea"] == 2.09
    assert len(body["ownership"]) == 4
    assert body["ownership"][0]["fromYear"] == 2000


def test_risk_prediction_carries_the_disclaimer() -> None:
    response = client.get("/api/v1/projects/PRJ-0001/risk", headers=auth())
    body = response.json()
    assert "Not a legal determination" in body["disclaimer"]
    assert len(body["contributors"]) == 10


def test_risk_simulation_reduces_score_with_capacity() -> None:
    worse = client.post(
        "/api/v1/risk/simulate",
        headers=auth(),
        json={
            "compensation_gap": 80, "legal_case_load": 20, "approval_aging_days": 500,
            "missing_documents": 300, "stakeholder_response": 30, "rr_gap": 80,
            "survey_discrepancy": 30, "gis_conflict": 120,
            "verification_capacity": 2, "field_team_capacity": 2,
        },
    ).json()
    better = client.post(
        "/api/v1/risk/simulate",
        headers=auth(),
        json={
            "compensation_gap": 5, "legal_case_load": 1, "approval_aging_days": 30,
            "missing_documents": 10, "stakeholder_response": 92, "rr_gap": 5,
            "survey_discrepancy": 2, "gis_conflict": 3,
            "verification_capacity": 14, "field_team_capacity": 12,
        },
    ).json()
    assert better["score"] < worse["score"]
    assert better["riskLevel"] == "low"


def test_document_pipeline_is_monotonic() -> None:
    rows = client.get("/api/v1/documents/pipeline", headers=auth()).json()["rows"]
    counts = [r["documents"] for r in rows]
    assert counts == sorted(counts, reverse=True)


def test_fraud_alerts_are_labelled_as_potential() -> None:
    body = client.get("/api/v1/fraud-alerts?page_size=5", headers=auth()).json()
    assert "potential anomaly" in body["note"].lower()


def test_gis_endpoint_returns_valid_geojson() -> None:
    body = client.get("/api/v1/gis/parcels.geojson?limit=20", headers=auth()).json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 20
    ring = body["features"][0]["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]


def test_compensation_summary_never_exceeds_assessment() -> None:
    body = client.get("/api/v1/compensation/summary", headers=auth()).json()
    assert body["paid"] <= body["assessed"]
    assert 0 <= body["progressPercent"] <= 100


def test_state_scope_filter_narrows_results() -> None:
    national = client.get("/api/v1/projects?page_size=1", headers=auth()).json()["meta"]["total"]
    rajasthan = client.get("/api/v1/projects?page_size=1&state=Rajasthan", headers=auth()).json()["meta"]["total"]
    assert 0 < rajasthan < national


@pytest.mark.parametrize("path", ["/api/v1/metrics/national", "/api/v1/metrics/monthly", "/api/v1/metrics/districts"])
def test_metric_endpoints_respond(path: str) -> None:
    assert client.get(path, headers=auth()).status_code == 200
