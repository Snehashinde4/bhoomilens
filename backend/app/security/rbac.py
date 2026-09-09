"""Role and permission model shared with the frontend RBAC layer."""

from __future__ import annotations

from typing import Dict, List

ALL_PERMISSIONS: List[str] = [
    "overview.view", "project.view", "project.edit", "project.intervene", "risk.view",
    "risk.simulate", "document.view", "document.upload", "document.process",
    "validation.view", "validation.decide", "parcel.view", "graph.view", "fraud.view",
    "fraud.investigate", "gis.view", "gis.edit", "watershed.view", "compensation.view",
    "compensation.approve", "review.view", "review.assign", "research.view", "citizen.view",
    "reports.view", "reports.export", "integrations.view", "integrations.manage",
    "governance.view", "audit.view", "settings.manage", "pii.unmask",
]

BASE = ["overview.view", "project.view", "risk.view", "reports.view"]

ROLES: Dict[str, Dict[str, object]] = {
    "national_admin": {"label": "National Administrator", "scope": "national", "permissions": ALL_PERMISSIONS},
    "state_admin": {
        "label": "State Administrator",
        "scope": "state",
        "permissions": [p for p in ALL_PERMISSIONS if p not in {"settings.manage", "integrations.manage"}],
    },
    "district_collector": {
        "label": "District Collector",
        "scope": "district",
        "permissions": BASE + [
            "project.edit", "project.intervene", "risk.simulate", "document.view",
            "validation.view", "validation.decide", "parcel.view", "graph.view", "fraud.view",
            "gis.view", "watershed.view", "compensation.view", "compensation.approve",
            "review.view", "review.assign", "reports.export", "audit.view", "integrations.view",
            "governance.view", "research.view",
        ],
    },
    "acquisition_officer": {
        "label": "Land Acquisition Officer",
        "scope": "project",
        "permissions": BASE + [
            "project.edit", "project.intervene", "document.view", "document.upload",
            "validation.view", "parcel.view", "gis.view", "compensation.view", "review.view",
            "reports.export", "graph.view",
        ],
    },
    "revenue_officer": {
        "label": "Revenue Officer",
        "scope": "district",
        "permissions": BASE + [
            "document.view", "document.upload", "document.process", "validation.view",
            "validation.decide", "parcel.view", "graph.view", "gis.view", "review.view",
        ],
    },
    "verification_officer": {
        "label": "Document Verification Officer",
        "scope": "district",
        "permissions": [
            "overview.view", "document.view", "document.upload", "document.process",
            "validation.view", "validation.decide", "review.view", "parcel.view", "reports.view",
        ],
    },
    "gis_analyst": {
        "label": "GIS Analyst",
        "scope": "state",
        "permissions": BASE + ["gis.view", "gis.edit", "parcel.view", "watershed.view", "validation.view", "fraud.view", "reports.export"],
    },
    "legal_reviewer": {
        "label": "Legal Reviewer",
        "scope": "state",
        "permissions": BASE + ["document.view", "validation.view", "validation.decide", "parcel.view", "graph.view", "fraud.view", "review.view", "audit.view"],
    },
    "compensation_officer": {
        "label": "Compensation Officer",
        "scope": "district",
        "permissions": BASE + ["compensation.view", "compensation.approve", "parcel.view", "document.view", "reports.export"],
    },
    "rr_officer": {
        "label": "R&R Officer",
        "scope": "district",
        "permissions": BASE + ["compensation.view", "parcel.view", "document.view", "reports.export"],
    },
    "auditor": {
        "label": "Auditor",
        "scope": "national",
        "permissions": [
            "overview.view", "project.view", "risk.view", "document.view", "validation.view",
            "parcel.view", "fraud.view", "compensation.view", "review.view", "reports.view",
            "reports.export", "audit.view", "governance.view", "integrations.view",
        ],
    },
    "researcher": {
        "label": "Researcher",
        "scope": "national",
        "permissions": ["overview.view", "research.view", "reports.view", "reports.export", "watershed.view", "risk.view"],
    },
    "field_officer": {
        "label": "Field Officer",
        "scope": "district",
        "permissions": ["overview.view", "project.view", "document.view", "document.upload", "parcel.view", "gis.view", "watershed.view", "review.view"],
    },
    "citizen": {"label": "Citizen", "scope": "citizen", "permissions": ["citizen.view"]},
}


def has_permission(role: str, permission: str) -> bool:
    definition = ROLES.get(role)
    if not definition:
        return False
    return permission in definition["permissions"]  # type: ignore[operator]
