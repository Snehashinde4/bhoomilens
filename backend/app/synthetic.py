"""Deterministic synthetic data engine (Python mirror of the frontend engine).

The Python and TypeScript engines share the same catalogues, business codes and
reference records (PRJ-0001 / BL-184 / DOC-000001) so that the API and the
in-browser mock layer tell the same story.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

REFERENCE_NOW = datetime(2026, 9, 9, 9, 0, 0, tzinfo=timezone.utc)

STATE_SEEDS: List[Dict[str, Any]] = [
    {"code": "AP", "name": "Andhra Pradesh", "zone": "South", "center": [80.05, 15.91], "districts": ["Guntur", "Visakhapatnam", "Kurnool", "Anantapur", "Chittoor", "Nellore"]},
    {"code": "AR", "name": "Arunachal Pradesh", "zone": "North East", "center": [94.73, 28.22], "districts": ["Papum Pare", "Tawang", "Changlang", "West Siang"]},
    {"code": "AS", "name": "Assam", "zone": "North East", "center": [92.94, 26.20], "districts": ["Kamrup", "Dibrugarh", "Nagaon", "Cachar", "Sonitpur"]},
    {"code": "BR", "name": "Bihar", "zone": "East", "center": [85.31, 25.60], "districts": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Purnia"]},
    {"code": "CG", "name": "Chhattisgarh", "zone": "Central", "center": [81.86, 21.28], "districts": ["Raipur", "Bilaspur", "Durg", "Korba", "Bastar"]},
    {"code": "GA", "name": "Goa", "zone": "West", "center": [74.12, 15.30], "districts": ["North Goa", "South Goa"]},
    {"code": "GJ", "name": "Gujarat", "zone": "West", "center": [71.19, 22.26], "districts": ["Ahmedabad", "Surat", "Rajkot", "Vadodara", "Bhavnagar", "Kutch"]},
    {"code": "HR", "name": "Haryana", "zone": "North", "center": [76.09, 29.06], "districts": ["Gurugram", "Faridabad", "Hisar", "Karnal", "Rohtak", "Ambala"]},
    {"code": "HP", "name": "Himachal Pradesh", "zone": "North", "center": [77.17, 31.11], "districts": ["Shimla", "Kangra", "Mandi", "Solan"]},
    {"code": "JH", "name": "Jharkhand", "zone": "East", "center": [85.28, 23.61], "districts": ["Ranchi", "Dhanbad", "Jamshedpur", "Bokaro", "Hazaribagh"]},
    {"code": "KA", "name": "Karnataka", "zone": "South", "center": [75.71, 15.32], "districts": ["Bengaluru Rural", "Mysuru", "Belagavi", "Kalaburagi", "Tumakuru", "Dharwad"]},
    {"code": "KL", "name": "Kerala", "zone": "South", "center": [76.27, 10.85], "districts": ["Ernakulam", "Thrissur", "Kozhikode", "Palakkad", "Kollam"]},
    {"code": "MP", "name": "Madhya Pradesh", "zone": "Central", "center": [78.66, 22.97], "districts": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar"]},
    {"code": "MH", "name": "Maharashtra", "zone": "West", "center": [75.71, 19.75], "districts": ["Pune", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Ahmednagar", "Thane"]},
    {"code": "MN", "name": "Manipur", "zone": "North East", "center": [93.91, 24.66], "districts": ["Imphal West", "Imphal East", "Churachandpur"]},
    {"code": "ML", "name": "Meghalaya", "zone": "North East", "center": [91.37, 25.47], "districts": ["East Khasi Hills", "West Garo Hills", "Ri Bhoi"]},
    {"code": "MZ", "name": "Mizoram", "zone": "North East", "center": [92.94, 23.16], "districts": ["Aizawl", "Lunglei", "Champhai"]},
    {"code": "NL", "name": "Nagaland", "zone": "North East", "center": [94.56, 26.16], "districts": ["Kohima", "Dimapur", "Mokokchung"]},
    {"code": "OD", "name": "Odisha", "zone": "East", "center": [85.10, 20.95], "districts": ["Khordha", "Cuttack", "Sundargarh", "Ganjam", "Balasore", "Angul"]},
    {"code": "PB", "name": "Punjab", "zone": "North", "center": [75.34, 31.15], "districts": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"]},
    {"code": "RJ", "name": "Rajasthan", "zone": "North", "center": [74.22, 27.02], "districts": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Alwar", "Ajmer", "Bharatpur"]},
    {"code": "SK", "name": "Sikkim", "zone": "North East", "center": [88.51, 27.53], "districts": ["East Sikkim", "South Sikkim"]},
    {"code": "TN", "name": "Tamil Nadu", "zone": "South", "center": [78.66, 11.13], "districts": ["Coimbatore", "Madurai", "Salem", "Tiruchirappalli", "Vellore", "Thanjavur"]},
    {"code": "TG", "name": "Telangana", "zone": "South", "center": [79.02, 18.11], "districts": ["Rangareddy", "Warangal", "Karimnagar", "Nalgonda", "Khammam"]},
    {"code": "TR", "name": "Tripura", "zone": "North East", "center": [91.99, 23.94], "districts": ["West Tripura", "South Tripura"]},
    {"code": "UP", "name": "Uttar Pradesh", "zone": "North", "center": [80.95, 26.85], "districts": ["Lucknow", "Kanpur Nagar", "Varanasi", "Agra", "Meerut", "Gorakhpur", "Prayagraj", "Bareilly"]},
    {"code": "UK", "name": "Uttarakhand", "zone": "North", "center": [79.02, 30.07], "districts": ["Dehradun", "Haridwar", "Nainital", "Udham Singh Nagar"]},
    {"code": "WB", "name": "West Bengal", "zone": "East", "center": [87.86, 22.99], "districts": ["Bardhaman", "Nadia", "Murshidabad", "Hooghly", "Bankura", "Malda"]},
]

VILLAGES = [
    "Sanganer", "Bagru", "Chomu", "Amber", "Phulera", "Bassi", "Kotputli", "Shahpura",
    "Rampura", "Devgarh", "Nandgaon", "Kishanpur", "Madhopur", "Sultanpur", "Govindpur",
    "Lakshmipur", "Chandpur", "Hariharpur", "Bhagwanpur", "Kalyanpur", "Anandpur",
]

FIRST_NAMES = [
    "Ram Lal", "Shyam", "Mohan", "Suresh", "Ramesh", "Kailash", "Prakash", "Vijay",
    "Anil", "Sunil", "Rajesh", "Mahesh", "Dinesh", "Naresh", "Gopal", "Hari", "Kishan",
    "Laxman", "Madan", "Narayan", "Puran", "Raghu", "Sohan", "Tulsi", "Uday",
]

SURNAMES = [
    "Meena", "Sharma", "Verma", "Yadav", "Gupta", "Singh", "Chauhan", "Patel", "Reddy",
    "Naidu", "Gowda", "Rao", "Patil", "Deshmukh", "Jadhav", "Nair", "Das", "Mishra",
    "Tiwari", "Pandey", "Rathore", "Solanki", "Parmar", "Thakur",
]

AGENCIES = [
    "National Highways Authority of India",
    "Ministry of Railways",
    "State Water Resources Department",
    "Industrial Development Corporation",
    "Urban Development Authority",
    "State Public Works Department",
]

PROJECT_TYPES = ["highway", "railway", "irrigation", "industrial_corridor", "urban_development"]

LIFECYCLE_STAGES = [
    "proposal", "scrutiny", "approval", "notification", "objection_handling", "survey",
    "award", "compensation", "possession", "rehabilitation", "closure",
]

DOCUMENT_TYPES = [
    "Mutation Register", "Record of Rights", "Khasra Register", "Khata Register",
    "Sale Deed", "Registration Record", "Award File", "Compensation Register",
    "Possession Certificate", "R&R Register", "Survey Map", "Cadastral Map", "Field Report",
]

PROCESSING_STAGES = [
    "uploaded", "preprocessed", "ocr_completed", "fields_extracted",
    "validated", "human_reviewed", "approved",
]

FRAUD_CATEGORIES = [
    "Duplicate Survey Record", "Duplicate Registration", "Multiple Active Ownership Claims",
    "Inconsistent Mutation Entry", "Suspicious Transfer Chain", "Circular Ownership Transfer",
    "Missing Registration Reference", "Unusual Compensation Change", "Reused Document Identifier",
    "Area Mismatch", "GIS Boundary Overlap", "Parcel Geometry Duplication",
    "Sudden Record Modification", "Repeated Bank Account", "Unusual Approval Pattern",
]

REVIEW_REASONS = [
    "Owner Mismatch", "Area Conflict", "Low OCR Confidence", "Boundary Conflict",
    "Duplicate Suspicion", "Missing Registration", "Mutation Chain Break", "Compensation Mismatch",
]

SCALE_PROFILES: Dict[str, Dict[str, int]] = {
    "demo": {"projects": 400, "districts": 150, "parcels": 4_000, "documents": 2_500, "beneficiaries": 3_000, "review": 1_200, "fraud": 400, "watersheds": 40},
    "standard": {"projects": 1_500, "districts": 150, "parcels": 12_000, "documents": 8_000, "beneficiaries": 9_000, "review": 3_500, "fraud": 1_200, "watersheds": 90},
    "national": {"projects": 1_500, "districts": 150, "parcels": 100_000, "documents": 50_000, "beneficiaries": 50_000, "review": 20_000, "fraud": 6_000, "watersheds": 150},
}


class Rng:
    """mulberry32 - identical algorithm to the TypeScript generator."""

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF or 1

    def next(self) -> float:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t = (t ^ (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    def integer(self, low: int, high: int) -> int:
        return int(self.next() * (high - low + 1)) + low

    def number(self, low: float, high: float, digits: int = 2) -> float:
        return round(self.next() * (high - low) + low, digits)

    def boolean(self, probability: float = 0.5) -> bool:
        return self.next() < probability

    def pick(self, items: List[Any]) -> Any:
        return items[int(self.next() * len(items))]

    def weighted(self, items: List[Any], weights: List[float]) -> Any:
        total = sum(weights)
        r = self.next() * total
        for item, weight in zip(items, weights):
            r -= weight
            if r <= 0:
                return item
        return items[-1]

    def uuid(self) -> str:
        hexchars = "0123456789abcdef"
        out = []
        for i in range(36):
            if i in (8, 13, 18, 23):
                out.append("-")
            elif i == 14:
                out.append("4")
            elif i == 19:
                out.append(hexchars[(int(self.next() * 16) & 0x3) | 0x8])
            else:
                out.append(hexchars[int(self.next() * 16)])
        return "".join(out)


# --------------------------------------------------------------------------- #
# Risk model (mirrors src/risk/model.ts)                                       #
# --------------------------------------------------------------------------- #

MODEL_VERSION = "bhoomilens-delay-risk-v2.4.1"

RISK_FACTORS = [
    {"key": "compensation_gap", "label": "Compensation pending", "weight": 22, "unit": "% unpaid", "divisor": 70},
    {"key": "legal_case_load", "label": "Legal disputes", "weight": 19, "unit": "open cases", "divisor": 18},
    {"key": "approval_aging_days", "label": "Approval aging", "weight": 14, "unit": "days pending", "divisor": 400},
    {"key": "missing_documents", "label": "Incomplete documents", "weight": 12, "unit": "records", "divisor": 260},
    {"key": "stakeholder_response", "label": "Low stakeholder response", "weight": 8, "unit": "% response", "divisor": 55, "invert": 100},
    {"key": "rr_gap", "label": "R&R delays", "weight": 10, "unit": "% pending", "divisor": 75},
    {"key": "survey_discrepancy", "label": "Survey discrepancy", "weight": 6, "unit": "% parcels", "divisor": 28},
    {"key": "gis_conflict", "label": "GIS boundary conflict", "weight": 9, "unit": "parcels", "divisor": 90},
    {"key": "verification_capacity", "label": "Verification capacity", "weight": 6, "unit": "officers", "divisor": 11, "invert": 14},
    {"key": "field_team_capacity", "label": "Field-team capacity", "weight": 4, "unit": "teams", "divisor": 9, "invert": 12},
]

TOTAL_WEIGHT = sum(f["weight"] for f in RISK_FACTORS)

DISCLAIMER = "Simulated prediction for prototype demonstration. Not a legal determination."


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def score_risk(features: Dict[str, float]) -> Dict[str, Any]:
    contributors = []
    for factor in RISK_FACTORS:
        raw = float(features.get(factor["key"], 0))
        base = factor["invert"] - raw if "invert" in factor else raw
        normalised = clamp(base / factor["divisor"], 0, 1)
        contribution = round(normalised * factor["weight"] * 100 / TOTAL_WEIGHT, 1)
        contributors.append(
            {
                "factor": factor["label"],
                "contribution": contribution,
                "value": round(raw, 1),
                "unit": factor["unit"],
                "direction": "increases" if normalised > 0.5 else "reduces",
            }
        )
    score = round(sum(c["contribution"] for c in contributors))
    delay = round(100 / (1 + math.exp(-(score - 50) / 22)))
    contributors.sort(key=lambda c: c["contribution"], reverse=True)
    return {
        "score": int(clamp(score, 1, 99)),
        "level": risk_level(score),
        "delay_probability": int(clamp(delay, 2, 98)),
        "contributors": contributors,
    }


def risk_level(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def features_from_project(project: Dict[str, Any]) -> Dict[str, float]:
    assessed = project["compensationAssessed"]
    paid = project["compensationPaid"]
    gap = ((assessed - paid) / assessed * 100) if assessed else 0
    return {
        "compensation_gap": gap,
        "legal_case_load": project["openLegalCases"],
        "approval_aging_days": project["pendingDays"],
        "missing_documents": project["openDocumentConflicts"],
        "stakeholder_response": clamp(100 - project["pendingDays"] / 8, 25, 96),
        "rr_gap": 100 - project["rrProgressPercent"],
        "survey_discrepancy": clamp(project["gisDiscrepancies"] / 6, 0, 40),
        "gis_conflict": project["gisDiscrepancies"],
        "verification_capacity": clamp(14 - project["openDocumentConflicts"] / 40, 2, 14),
        "field_team_capacity": clamp(12 - project["openLegalCases"] / 3, 2, 12),
    }


# --------------------------------------------------------------------------- #
# Dataset                                                                      #
# --------------------------------------------------------------------------- #


@dataclass
class Dataset:
    generated_at: str
    seed: int
    scale: str
    states: List[Dict[str, Any]] = field(default_factory=list)
    districts: List[Dict[str, Any]] = field(default_factory=list)
    projects: List[Dict[str, Any]] = field(default_factory=list)
    project_stages: List[Dict[str, Any]] = field(default_factory=list)
    parcels: List[Dict[str, Any]] = field(default_factory=list)
    ownership_records: List[Dict[str, Any]] = field(default_factory=list)
    mutations: List[Dict[str, Any]] = field(default_factory=list)
    documents: List[Dict[str, Any]] = field(default_factory=list)
    validations: List[Dict[str, Any]] = field(default_factory=list)
    fraud_alerts: List[Dict[str, Any]] = field(default_factory=list)
    compensation: List[Dict[str, Any]] = field(default_factory=list)
    review_queue: List[Dict[str, Any]] = field(default_factory=list)
    watersheds: List[Dict[str, Any]] = field(default_factory=list)
    district_metrics: List[Dict[str, Any]] = field(default_factory=list)
    monthly_metrics: List[Dict[str, Any]] = field(default_factory=list)
    audit_events: List[Dict[str, Any]] = field(default_factory=list)
    integrations: List[Dict[str, Any]] = field(default_factory=list)
    risk_predictions: List[Dict[str, Any]] = field(default_factory=list)

    def project_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        return next((p for p in self.projects if p["code"] == code or p["id"] == code), None)

    def parcel_by_id(self, parcel_id: str) -> Optional[Dict[str, Any]]:
        return next((p for p in self.parcels if p["parcelId"] == parcel_id), None)

    def document_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        return next((d for d in self.documents if d["code"] == code or d["id"] == code), None)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_dataset(seed: int = 20260909, scale: str = "standard") -> Dataset:
    profile = SCALE_PROFILES.get(scale, SCALE_PROFILES["standard"])
    rng = Rng(seed)
    ds = Dataset(generated_at=_iso(REFERENCE_NOW), seed=seed, scale=scale)

    # Geography -------------------------------------------------------------
    for seed_state in STATE_SEEDS:
        district_names = []
        for name in seed_state["districts"]:
            center = [
                round(seed_state["center"][0] + rng.number(-1.4, 1.4, 4), 4),
                round(seed_state["center"][1] + rng.number(-1.2, 1.2, 4), 4),
            ]
            ds.districts.append(
                {
                    "id": rng.uuid(),
                    "code": f"{seed_state['code']}-{name[:3].upper()}",
                    "name": name,
                    "state": seed_state["name"],
                    "center": center,
                    "villages": [rng.pick(VILLAGES) for _ in range(6)],
                }
            )
            district_names.append(name)
        ds.states.append(
            {
                "id": rng.uuid(),
                "code": seed_state["code"],
                "name": seed_state["name"],
                "zone": seed_state["zone"],
                "center": seed_state["center"],
                "districts": district_names,
            }
        )

    index = 1
    while len(ds.districts) < profile["districts"]:
        state = rng.pick(ds.states)
        name = f"{state['name'].split(' ')[0]} Division {index}"
        ds.districts.append(
            {
                "id": rng.uuid(),
                "code": f"{state['code']}-D{index:02d}",
                "name": name,
                "state": state["name"],
                "center": [
                    round(state["center"][0] + rng.number(-1.6, 1.6, 4), 4),
                    round(state["center"][1] + rng.number(-1.4, 1.4, 4), 4),
                ],
                "villages": [rng.pick(VILLAGES) for _ in range(5)],
            }
        )
        state["districts"].append(name)
        index += 1

    # Projects --------------------------------------------------------------
    for i in range(1, profile["projects"] + 1):
        flagship = i == 1
        district = (
            next(d for d in ds.districts if d["name"] == "Jaipur" and d["state"] == "Rajasthan")
            if flagship
            else rng.pick(ds.districts)
        )
        project_type = "highway" if flagship else rng.weighted(PROJECT_TYPES, [30, 18, 20, 16, 16])
        proposed = 4820 if flagship else rng.integer(180, 9800)
        acquired = 3940 if flagship else int(proposed * rng.number(0.08, 0.98, 3))
        assessed = 1_850_000_000 if flagship else int(proposed * rng.integer(180_000, 900_000))
        paid = 1_180_000_000 if flagship else int(assessed * rng.number(0.05, 0.99, 3))
        stage_index = LIFECYCLE_STAGES.index("compensation") if flagship else rng.weighted(
            list(range(len(LIFECYCLE_STAGES))), [6, 7, 9, 11, 8, 10, 12, 14, 10, 8, 5]
        )
        start = datetime(2021, 6, 14, tzinfo=timezone.utc) if flagship else REFERENCE_NOW - timedelta(days=rng.integer(400, 2900))
        planned = start + timedelta(days=1980 if flagship else rng.integer(900, 2400))

        project = {
            "id": rng.uuid(),
            "code": f"PRJ-{i:04d}",
            "name": "NH-48 Expansion Package 3" if flagship else f"{district['name']} {project_type.replace('_', ' ').title()} Package {rng.integer(1, 9)}",
            "state": district["state"],
            "district": district["name"],
            "projectType": project_type,
            "implementingAgency": "National Highways Authority of India" if flagship else rng.pick(AGENCIES),
            "projectOfficer": f"{rng.pick(['A.', 'B.', 'K.', 'M.', 'R.', 'S.'])} {rng.pick(SURNAMES)}",
            "proposedArea": proposed,
            "acquiredArea": acquired,
            "affectedVillages": 27 if flagship else rng.integer(2, 48),
            "affectedFamilies": 2418 if flagship else max(24, int(proposed * rng.number(0.25, 0.9, 2))),
            "compensationAssessed": assessed,
            "compensationPaid": paid,
            "possessionPercent": 52 if flagship else rng.integer(0, 100),
            "rrProgressPercent": 38 if flagship else rng.integer(0, 100),
            "currentStage": LIFECYCLE_STAGES[stage_index],
            "completionPercent": int(clamp((stage_index + 1) / len(LIFECYCLE_STAGES) * 100 * rng.number(0.82, 1.06, 2), 2, 100)),
            "openLegalCases": 18 if flagship else rng.weighted([0, 1, 3, 6, 11, 17, 24], [22, 20, 18, 15, 12, 8, 5]),
            "pendingDays": 300 if flagship else rng.weighted([12, 45, 90, 180, 300, 450, 620], [18, 20, 18, 16, 14, 9, 5]),
            "openDocumentConflicts": 260 if flagship else rng.integer(0, 340),
            "gisDiscrepancies": 96 if flagship else rng.integer(0, 130),
            "responsibleOffice": f"{LIFECYCLE_STAGES[stage_index].replace('_', ' ').title()} Cell, {district['name']}",
            "startDate": _iso(start),
            "plannedCompletion": _iso(planned),
            "centroid": [
                round(district["center"][0] + rng.number(-0.25, 0.25, 4), 4),
                round(district["center"][1] + rng.number(-0.25, 0.25, 4), 4),
            ],
            "budgetCrore": round(assessed / 1e7 + rng.integer(50, 3200), 1),
            "createdAt": _iso(start),
            "updatedAt": _iso(REFERENCE_NOW),
            "createdBy": "system.seed",
            "version": rng.integer(1, 12),
        }

        scored = score_risk(features_from_project(project))
        project["riskScore"] = scored["score"]
        project["riskLevel"] = scored["level"]
        project["delayProbability"] = scored["delay_probability"]
        project["predictedCompletion"] = _iso(planned + timedelta(days=int(scored["delay_probability"] / 100 * 540)))
        project["primaryDelayDriver"] = scored["contributors"][0]["factor"]
        ds.projects.append(project)

        cursor = start
        for stage_pos, stage in enumerate(LIFECYCLE_STAGES):
            duration = rng.integer(40, 420)
            ds.project_stages.append(
                {
                    "id": rng.uuid(),
                    "projectId": project["id"],
                    "stage": stage,
                    "status": "completed" if stage_pos < stage_index else ("in_progress" if stage_pos == stage_index else "pending"),
                    "completedCases": rng.integer(0, 900) if stage_pos <= stage_index else 0,
                    "pendingCases": rng.integer(0, 620),
                    "delayedCases": rng.integer(0, 220),
                    "averageDurationDays": duration,
                    "plannedStart": _iso(cursor),
                    "plannedEnd": _iso(cursor + timedelta(days=duration)),
                    "onCriticalPath": stage in {"approval", "notification", "award", "compensation", "possession"},
                }
            )
            cursor += timedelta(days=duration)

        ds.risk_predictions.append(
            {
                "id": f"{project['id']}-risk",
                "projectId": project["id"],
                "riskScore": project["riskScore"],
                "riskLevel": project["riskLevel"],
                "delayProbability": project["delayProbability"],
                "predictedCompletion": project["predictedCompletion"],
                "modelVersion": MODEL_VERSION,
                "modelConfidence": int(clamp(72 + (100 - project["openDocumentConflicts"] / 5) * 0.22, 60, 95)),
                "dataCompleteness": int(max(40, 100 - project["openDocumentConflicts"] / 5)),
                "lastRunAt": _iso(REFERENCE_NOW),
                "contributors": scored["contributors"],
                "disclaimer": DISCLAIMER,
            }
        )

    projects_by_district: Dict[str, List[Dict[str, Any]]] = {}
    for project in ds.projects:
        projects_by_district.setdefault(f"{project['state']}::{project['district']}", []).append(project)

    # Parcels ---------------------------------------------------------------
    for i in range(1, profile["parcels"] + 1):
        flagship = i == 184
        district = (
            next(d for d in ds.districts if d["name"] == "Jaipur" and d["state"] == "Rajasthan")
            if flagship
            else rng.pick(ds.districts)
        )
        village = "Sanganer" if flagship else rng.pick(district["villages"])
        area = 2.48 if flagship else rng.number(0.12, 14.5, 2)
        gis_area = 2.09 if flagship else round(area * (rng.number(0.72, 1.28, 3) if rng.boolean(0.14) else rng.number(0.97, 1.03, 3)), 2)
        center = [75.7873, 26.8121] if flagship else [
            round(district["center"][0] + rng.number(-0.35, 0.35, 5), 5),
            round(district["center"][1] + rng.number(-0.32, 0.32, 5), 5),
        ]
        candidates = projects_by_district.get(f"{district['state']}::{district['name']}", [])
        linked = ds.projects[0] if flagship else (rng.pick(candidates) if candidates and rng.boolean(0.42) else None)
        disputed = False if flagship else rng.boolean(0.09)
        deviation = abs(area - gis_area) / area
        trust = 91 if flagship else int(clamp(96 - deviation * 120 - (22 if disputed else 0) - rng.integer(0, 14), 22, 99))
        owner = "Ram Lal Meena" if flagship else f"{rng.pick(FIRST_NAMES)} {rng.pick(SURNAMES)}"

        radius = math.sqrt(area * 10_000) / 111_320 / 1.6
        vertices = rng.integer(4, 7)
        boundary = []
        for v in range(vertices):
            angle = v / vertices * math.pi * 2 + rng.number(-0.18, 0.18, 4)
            r = radius * rng.number(0.78, 1.22, 4)
            boundary.append([round(center[0] + math.cos(angle) * r, 6), round(center[1] + math.sin(angle) * r * 0.92, 6)])

        parcel = {
            "id": rng.uuid(),
            "parcelId": f"BL-{i}",
            "surveyNumber": "184/2A" if flagship else f"{rng.integer(1, 899)}/{rng.integer(1, 9)}",
            "khasraNumber": "184" if flagship else str(rng.integer(1, 1499)),
            "khataNumber": "KH-441" if flagship else f"KH-{rng.integer(100, 999)}",
            "owner": owner,
            "area": area,
            "gisArea": gis_area,
            "village": village,
            "district": district["name"],
            "state": district["state"],
            "landType": "Agricultural" if flagship else rng.weighted(
                ["Agricultural", "Non-Agricultural", "Residential", "Commercial", "Government", "Forest", "Water Body"],
                [46, 14, 16, 8, 8, 5, 3],
            ),
            "legalStatus": "Clear" if not disputed else rng.weighted(["Under Dispute", "Stayed"], [72, 28]),
            "acquisitionStatus": rng.weighted(["Notified", "Awarded", "Compensated", "Possessed"], [30, 26, 24, 20]) if linked else "Not Notified",
            "possessionStatus": rng.weighted(["Not Taken", "Partial", "Complete"], [42, 30, 28]) if linked else "Not Taken",
            "projectId": linked["id"] if linked else None,
            "trustScore": trust,
            "healthScore": 87 if flagship else int(clamp(trust * rng.number(0.82, 1.12, 2), 20, 99)),
            "fraudRiskScore": int(clamp(100 - trust + rng.integer(-6, 10), 1, 99)),
            "disputeRiskScore": int(clamp((70 if disputed else 22) + deviation * 90 + rng.integer(-10, 14), 1, 99)),
            "centroid": center,
            "boundary": boundary,
        }
        ds.parcels.append(parcel)

        years = [2000, 2009, 2017, 2024] if flagship else sorted(
            [2000 + rng.integer(0, 4), 2009 + rng.integer(-2, 3), 2017 + rng.integer(-2, 3), 2024 - rng.integer(0, 4)]
        )
        names = [f"{rng.pick(FIRST_NAMES)} {rng.pick(SURNAMES)}" for _ in range(3)] + [owner]
        for pos, year in enumerate(years):
            ds.ownership_records.append(
                {
                    "id": rng.uuid(),
                    "parcelId": parcel["parcelId"],
                    "ownerName": names[pos],
                    "fromYear": year,
                    "toYear": None if pos == len(years) - 1 else years[pos + 1],
                    "acquisitionMode": "Government Allotment" if pos == 0 else rng.pick(["Inheritance", "Sale", "Gift", "Partition", "Court Decree"]),
                    "verified": rng.boolean(0.86),
                }
            )
            if pos > 0:
                ds.mutations.append(
                    {
                        "id": rng.uuid(),
                        "mutationNumber": "MUT-441" if flagship and pos == 2 else f"MUT-{rng.integer(100, 9999)}",
                        "parcelId": parcel["parcelId"],
                        "fromOwner": names[pos - 1],
                        "toOwner": names[pos],
                        "mutationDate": f"{year}-{rng.integer(1, 12):02d}-{rng.integer(1, 28):02d}T00:00:00Z",
                        "status": rng.weighted(["Approved", "Pending", "Under Objection"], [80, 14, 6]),
                        "anomalyFlag": rng.boolean(0.12),
                    }
                )

    # Documents and validations --------------------------------------------
    for i in range(1, profile["documents"] + 1):
        flagship = i == 1
        parcel = ds.parcel_by_id("BL-184") if flagship else rng.pick(ds.parcels)
        stage_index = PROCESSING_STAGES.index("validated") if flagship else rng.weighted(
            list(range(len(PROCESSING_STAGES))), [6, 8, 12, 16, 18, 16, 24]
        )
        handwritten = True if flagship else rng.boolean(0.38)
        confidence = 82.4 if flagship else round(clamp(rng.number(45, 99, 1), 42, 99.4), 1)
        issues = 4 if flagship else max(0, int((100 - confidence) / 8 + rng.integer(-1, 3)))
        document = {
            "id": rng.uuid(),
            "code": f"DOC-{i:06d}",
            "fileName": f"{parcel['village']}_{parcel['khasraNumber']}.pdf",
            "documentType": "Mutation Register" if flagship else rng.pick(DOCUMENT_TYPES),
            "language": "hi" if flagship else rng.pick(["hi", "en", "mr", "kn", "ta", "te", "gu", "pa", "bn", "or", "ur"]),
            "isHandwritten": handwritten,
            "pages": 4 if flagship else rng.integer(1, 9),
            "state": parcel["state"],
            "district": parcel["district"],
            "village": parcel["village"],
            "parcelId": parcel["parcelId"],
            "projectId": parcel["projectId"],
            "processingStage": PROCESSING_STAGES[stage_index],
            "status": "needs_review" if issues else "approved",
            "ocrConfidence": confidence,
            "imageQuality": rng.integer(35, 99),
            "validationIssues": issues,
            "uploadedAt": _iso(REFERENCE_NOW - timedelta(days=rng.integer(1, 700))),
        }
        ds.documents.append(document)

        if flagship:
            ds.validations.extend(
                [
                    {
                        "id": f"{document['id']}-v-owner",
                        "documentId": document["id"],
                        "parcelId": parcel["parcelId"],
                        "field": "ownerName",
                        "category": "master_data",
                        "severity": "review",
                        "title": "Owner name does not match the LRMS record",
                        "ocrValue": "Ram Lai Meena",
                        "lrmsValue": "Ram Lal Meena",
                        "gisValue": "—",
                        "confidence": 61.2,
                        "status": "open",
                    },
                    {
                        "id": f"{document['id']}-v-area",
                        "documentId": document["id"],
                        "parcelId": parcel["parcelId"],
                        "field": "plotArea",
                        "category": "area_consistency",
                        "severity": "blocking",
                        "title": "Recorded area differs from GIS-calculated area",
                        "ocrValue": "2.48",
                        "lrmsValue": "2.48",
                        "gisValue": "2.09",
                        "confidence": 94.1,
                        "status": "open",
                    },
                ]
            )
        elif issues and len(ds.validations) < 9000:
            for k in range(min(issues, 3)):
                ds.validations.append(
                    {
                        "id": f"{document['id']}-v{k}",
                        "documentId": document["id"],
                        "parcelId": parcel["parcelId"],
                        "field": rng.pick(["ownerName", "surveyNumber", "plotArea", "mutationNumber"]),
                        "category": rng.pick(["master_data", "duplicate", "area_consistency", "mutation_chain", "registration_record"]),
                        "severity": rng.weighted(["blocking", "review", "informational", "validated"], [14, 42, 30, 14]),
                        "title": "Extracted value does not reconcile with the reference source",
                        "ocrValue": parcel["owner"],
                        "lrmsValue": parcel["owner"],
                        "gisValue": str(parcel["gisArea"]),
                        "confidence": round(rng.number(48, 98, 1), 1),
                        "status": rng.weighted(["open", "in_progress", "resolved", "escalated"], [46, 22, 24, 8]),
                    }
                )

    # Compensation ----------------------------------------------------------
    acquiring = [p for p in ds.parcels if p["projectId"]] or ds.parcels
    for i in range(1, profile["beneficiaries"] + 1):
        parcel = rng.pick(acquiring)
        assessed = int(parcel["area"] * rng.integer(450_000, 3_200_000))
        status = rng.weighted(["Assessed", "Approved", "Partially Paid", "Paid", "Failed", "Withheld"], [16, 14, 22, 34, 8, 6])
        ratio = 1.0 if status == "Paid" else (rng.number(0.2, 0.85, 2) if status == "Partially Paid" else 0.0)
        ds.compensation.append(
            {
                "id": rng.uuid(),
                "beneficiaryId": f"BEN{i:06d}",
                "parcelId": parcel["parcelId"],
                "projectId": parcel["projectId"],
                "district": parcel["district"],
                "state": parcel["state"],
                "familySize": rng.integer(2, 9),
                "amountAssessed": assessed,
                "amountPaid": int(assessed * ratio),
                "status": status,
                "bankAccountMasked": "XXXXXXXX" + str(rng.integer(1000, 9999)),
                "disbursementDelayDays": rng.integer(5, 420),
            }
        )

    # Fraud, review, watersheds --------------------------------------------
    for i in range(1, profile["fraud"] + 1):
        parcel = rng.pick(ds.parcels)
        score = int(clamp(100 - parcel["trustScore"] + rng.integer(-8, 18), 12, 99))
        ds.fraud_alerts.append(
            {
                "id": rng.uuid(),
                "code": f"FA-{i:05d}",
                "category": rng.pick(FRAUD_CATEGORIES),
                "severity": risk_level(score),
                "anomalyScore": score,
                "parcelId": parcel["parcelId"],
                "district": parcel["district"],
                "state": parcel["state"],
                "summary": f"Potential anomaly detected on parcel {parcel['parcelId']}.",
                "status": rng.weighted(["new", "under_investigation", "resolved", "false_positive"], [38, 30, 22, 10]),
                "note": "Potential anomaly. Not a confirmed case of fraud.",
            }
        )

    for i in range(1, profile["review"] + 1):
        document = rng.pick(ds.documents)
        confidence = round(rng.number(38, 96, 1), 1)
        pending = rng.integer(1, 110)
        severity = rng.weighted(["blocking", "review", "informational", "validated"], [16, 46, 28, 10])
        sla = 3 if severity == "blocking" else (7 if severity == "review" else 14)
        ds.review_queue.append(
            {
                "id": rng.uuid(),
                "code": f"RVW-{i:06d}",
                "documentId": document["id"],
                "parcelId": document["parcelId"],
                "reason": rng.pick(REVIEW_REASONS),
                "severity": severity,
                "district": document["district"],
                "state": document["state"],
                "confidence": confidence,
                "pendingDays": pending,
                "slaDays": sla,
                "priorityScore": int(clamp((100 - confidence) * 0.5 + pending * 0.6 + (28 if severity == "blocking" else 12), 1, 100)),
                "status": rng.weighted(["unassigned", "assigned", "in_progress", "completed", "escalated"], [30, 26, 20, 18, 6]),
            }
        )

    for i in range(1, profile["watersheds"] + 1):
        district = rng.pick(ds.districts)
        before = rng.integer(45, 92)
        ds.watersheds.append(
            {
                "id": rng.uuid(),
                "code": f"WS-{i:04d}",
                "name": f"{district['name']} Micro-Watershed {rng.integer(1, 22)}",
                "district": district["name"],
                "state": district["state"],
                "areaHa": rng.integer(800, 12_000),
                "erosionRiskBefore": before,
                "erosionRiskAfter": int(clamp(before - rng.integer(2, 34), 8, 95)),
                "encroachmentAlerts": rng.integer(0, 28),
                "interventionCoveragePercent": rng.integer(12, 96),
                "confidence": rng.integer(62, 96),
                "verificationStatus": rng.weighted(["verified", "partially_verified", "unverified"], [42, 38, 20]),
            }
        )

    # Metrics ---------------------------------------------------------------
    upload_base = 42_000
    for offset in range(23, -1, -1):
        month = REFERENCE_NOW.month - offset
        year = REFERENCE_NOW.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        upload_base = clamp(upload_base * rng.number(0.99, 1.06, 3), 24_000, 190_000)
        uploaded = int(upload_base)
        processed = int(uploaded * rng.number(0.82, 0.97, 3))
        validated = int(processed * rng.number(0.74, 0.93, 3))
        assessed = int(rng.number(1.1, 3.4, 2) * 1e9)
        ds.monthly_metrics.append(
            {
                "period": f"{year}-{month:02d}",
                "documentsUploaded": uploaded,
                "documentsProcessed": processed,
                "documentsValidated": validated,
                "documentsSentForReview": processed - validated,
                "compensationAssessed": assessed,
                "compensationDisbursed": int(assessed * rng.number(0.48, 0.86, 3)),
                "digitizationAccuracy": round(rng.number(86, 97, 1), 1),
                "fraudAlerts": rng.integer(140, 620),
            }
        )

    for district in ds.districts:
        district_projects = [p for p in ds.projects if p["district"] == district["name"]]
        comp = [c for c in ds.compensation if c["district"] == district["name"]]
        assessed = sum(c["amountAssessed"] for c in comp) or 1
        ds.district_metrics.append(
            {
                "id": rng.uuid(),
                "district": district["name"],
                "state": district["state"],
                "digitizationProgress": round(rng.number(8, 99, 1), 1),
                "digitizationAccuracy": round(rng.number(74, 99, 1), 1),
                "fraudAlerts": len([a for a in ds.fraud_alerts if a["district"] == district["name"]]),
                "reviewBacklog": len([r for r in ds.review_queue if r["district"] == district["name"] and r["status"] != "completed"]),
                "compensationProgress": round(sum(c["amountPaid"] for c in comp) / assessed * 100, 1),
                "acquisitionProgress": round(
                    sum(p["acquiredArea"] for p in district_projects) / max(1, sum(p["proposedArea"] for p in district_projects)) * 100, 1
                ),
                "delayProbability": round(
                    sum(p["delayProbability"] for p in district_projects) / len(district_projects), 1
                ) if district_projects else round(rng.number(18, 82, 1), 1),
                "projects": len(district_projects),
                "parcels": len([p for p in ds.parcels if p["district"] == district["name"]]),
                "center": district["center"],
            }
        )

    for i in range(600):
        project = rng.pick(ds.projects)
        ds.audit_events.append(
            {
                "id": rng.uuid(),
                "correlationId": f"COR-{rng.integer(100000, 999999)}",
                "actor": f"{rng.pick(['A.', 'B.', 'K.', 'M.', 'R.', 'S.'])} {rng.pick(SURNAMES)}",
                "role": rng.pick(["national_admin", "state_admin", "district_collector", "verification_officer", "auditor"]),
                "action": rng.pick(["document.viewed", "field.corrected", "validation.resolved", "review.assigned", "report.downloaded"]),
                "entityType": "Project",
                "entityId": project["code"],
                "reason": "Routine verification",
                "timestamp": _iso(REFERENCE_NOW - timedelta(hours=rng.integer(1, 2000))),
                "sourceIp": f"10.{rng.integer(0, 255)}.{rng.integer(0, 255)}.{rng.integer(1, 254)}",
            }
        )

    for system, category, endpoint in [
        ("Land Records Management System (LRMS)", "records", "/adapters/lrms/v2"),
        ("DILRMP National Exchange", "records", "/adapters/dilrmp/v1"),
        ("Property Registration Gateway", "registration", "/adapters/registration/v2"),
        ("National GIS Platform", "gis", "/adapters/gis/v4"),
        ("Compensation Payment Gateway", "payments", "/adapters/payments/v2"),
        ("Court Case Reference Service", "legal", "/adapters/legal/v1"),
        ("Satellite Imagery Service", "remote_sensing", "/adapters/rs/v2"),
    ]:
        status = rng.weighted(["connected", "syncing", "degraded", "error", "offline"], [58, 14, 14, 8, 6])
        ds.integrations.append(
            {
                "id": rng.uuid(),
                "system": system,
                "category": category,
                "endpoint": endpoint,
                "status": status,
                "lastSyncAt": _iso(REFERENCE_NOW - timedelta(minutes=rng.integer(1, 2000))),
                "recordsSynced": rng.integer(12_000, 4_800_000),
                "failedRecords": rng.integer(0, 60) if status == "connected" else rng.integer(40, 2400),
                "latencyMs": rng.integer(60, 6200),
            }
        )

    return ds


@lru_cache
def get_dataset(seed: int = 20260909, scale: str = "standard") -> Dataset:
    return build_dataset(seed=seed, scale=scale)
