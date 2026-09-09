-- ---------------------------------------------------------------------------
-- BhoomiLens reference schema (PostgreSQL 16 + PostGIS 3.4)
--
-- The prototype serves synthetic data from memory; this schema documents the
-- production data model that the same API contracts map onto.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS bhoomilens;
SET search_path TO bhoomilens, public;

-- ------------------------------ Enumerations ------------------------------

CREATE TYPE project_type AS ENUM ('highway', 'railway', 'irrigation', 'industrial_corridor', 'urban_development');
CREATE TYPE lifecycle_stage AS ENUM ('proposal','scrutiny','approval','notification','objection_handling','survey','award','compensation','possession','rehabilitation','closure');
CREATE TYPE risk_level AS ENUM ('low','medium','high','critical');
CREATE TYPE conflict_severity AS ENUM ('blocking','review','informational','validated');
CREATE TYPE processing_stage AS ENUM ('uploaded','preprocessed','ocr_completed','fields_extracted','validated','human_reviewed','approved');
CREATE TYPE compensation_status AS ENUM ('Assessed','Approved','Partially Paid','Paid','Failed','Withheld');

-- --------------------------- Identity and access ---------------------------

CREATE TABLE roles (
    id            TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    scope         TEXT NOT NULL CHECK (scope IN ('national','state','district','project','citizen')),
    description   TEXT NOT NULL
);

CREATE TABLE permissions (
    id            TEXT PRIMARY KEY,
    description   TEXT NOT NULL
);

CREATE TABLE role_permissions (
    role_id       TEXT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    role_id       TEXT NOT NULL REFERENCES roles(id),
    designation   TEXT,
    office        TEXT,
    state         TEXT,
    district      TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------ Administrative geography ------------------------

CREATE TABLE states (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code    TEXT UNIQUE NOT NULL,
    name    TEXT UNIQUE NOT NULL,
    zone    TEXT,
    geom    GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE districts (
    id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code     TEXT UNIQUE NOT NULL,
    name     TEXT NOT NULL,
    state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    geom     GEOMETRY(MultiPolygon, 4326),
    UNIQUE (state_id, name)
);

CREATE TABLE tehsils (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE
);

CREATE TABLE villages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    tehsil_id  UUID NOT NULL REFERENCES tehsils(id) ON DELETE CASCADE,
    lgd_code   TEXT
);

-- ------------------------------- Projects ---------------------------------

CREATE TABLE projects (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                   TEXT UNIQUE NOT NULL,
    name                   TEXT NOT NULL,
    project_type           project_type NOT NULL,
    state_id               UUID NOT NULL REFERENCES states(id),
    district_id            UUID NOT NULL REFERENCES districts(id),
    implementing_agency    TEXT NOT NULL,
    project_officer        TEXT,
    proposed_area_ha       NUMERIC(12,2) NOT NULL,
    acquired_area_ha       NUMERIC(12,2) NOT NULL DEFAULT 0,
    affected_villages      INTEGER NOT NULL DEFAULT 0,
    affected_families      INTEGER NOT NULL DEFAULT 0,
    compensation_assessed  NUMERIC(18,2) NOT NULL DEFAULT 0,
    compensation_paid      NUMERIC(18,2) NOT NULL DEFAULT 0,
    possession_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
    rr_progress_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
    current_stage          lifecycle_stage NOT NULL,
    completion_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
    start_date             DATE NOT NULL,
    planned_completion     DATE NOT NULL,
    geom                   GEOMETRY(MultiPolygon, 4326),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             TEXT,
    version                INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT chk_acquired_area CHECK (acquired_area_ha <= proposed_area_ha),
    CONSTRAINT chk_compensation CHECK (compensation_paid <= compensation_assessed)
);

CREATE TABLE project_stages (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    stage                   lifecycle_stage NOT NULL,
    status                  TEXT NOT NULL,
    completed_cases         INTEGER NOT NULL DEFAULT 0,
    pending_cases           INTEGER NOT NULL DEFAULT 0,
    delayed_cases           INTEGER NOT NULL DEFAULT 0,
    average_duration_days   INTEGER,
    statutory_deadline_days INTEGER,
    responsible_officer     TEXT,
    planned_start           DATE,
    planned_end             DATE,
    actual_start            DATE,
    actual_end              DATE,
    on_critical_path        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (project_id, stage)
);

CREATE TABLE project_milestones (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    stage          lifecycle_stage NOT NULL,
    due_date       DATE NOT NULL,
    completed_date DATE,
    note           TEXT
);

-- ------------------------- Parcels and ownership --------------------------

CREATE TABLE owners (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           TEXT NOT NULL,
    guardian_name  TEXT,
    ownership_type TEXT,
    village_id     UUID REFERENCES villages(id),
    -- Identity numbers are stored hashed; the plain value never lands in the DB.
    identity_hash  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parcels (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_code        TEXT UNIQUE NOT NULL,
    survey_number      TEXT NOT NULL,
    khasra_number      TEXT,
    khata_number       TEXT,
    village_id         UUID REFERENCES villages(id),
    district_id        UUID NOT NULL REFERENCES districts(id),
    owner_id           UUID REFERENCES owners(id),
    recorded_area_ha   NUMERIC(12,4) NOT NULL,
    gis_area_ha        NUMERIC(12,4),
    land_classification TEXT,
    tax_status         TEXT,
    acquisition_status TEXT,
    possession_status  TEXT,
    legal_status       TEXT,
    project_id         UUID REFERENCES projects(id),
    trust_score        SMALLINT CHECK (trust_score BETWEEN 0 AND 100),
    health_score       SMALLINT CHECK (health_score BETWEEN 0 AND 100),
    fraud_risk_score   SMALLINT CHECK (fraud_risk_score BETWEEN 0 AND 100),
    dispute_risk_score SMALLINT CHECK (dispute_risk_score BETWEEN 0 AND 100),
    geom               GEOMETRY(Polygon, 4326) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    version            INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_parcels_geom ON parcels USING GIST (geom);
CREATE INDEX idx_parcels_survey ON parcels USING GIN (survey_number gin_trgm_ops);
CREATE INDEX idx_parcels_project ON parcels (project_id);
CREATE INDEX idx_parcels_district ON parcels (district_id);

CREATE TABLE ownership_records (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id         UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    owner_id          UUID REFERENCES owners(id),
    owner_name        TEXT NOT NULL,
    from_year         SMALLINT NOT NULL,
    to_year           SMALLINT,
    acquisition_mode  TEXT NOT NULL,
    share_percent     NUMERIC(5,2) NOT NULL DEFAULT 100,
    verified          BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_years CHECK (to_year IS NULL OR to_year >= from_year)
);

CREATE TABLE mutations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mutation_number TEXT NOT NULL,
    parcel_id       UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    from_owner      TEXT,
    to_owner        TEXT,
    mutation_date   DATE NOT NULL,
    status          TEXT NOT NULL,
    reason          TEXT,
    officer         TEXT,
    registration_id UUID,
    anomaly_flag    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX idx_mutation_unique ON mutations (parcel_id, mutation_number);

CREATE TABLE registrations (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_number   TEXT NOT NULL,
    parcel_id             UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    registration_date     DATE NOT NULL,
    sub_registrar_office  TEXT,
    consideration_amount  NUMERIC(18,2),
    stamp_duty            NUMERIC(18,2),
    buyer                 TEXT,
    seller                TEXT
);

-- ---------------------------- Document pipeline ---------------------------

CREATE TABLE documents (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code              TEXT UNIQUE NOT NULL,
    file_name         TEXT NOT NULL,
    document_type     TEXT NOT NULL,
    language          TEXT NOT NULL,
    script            TEXT,
    is_handwritten    BOOLEAN NOT NULL DEFAULT FALSE,
    pages             SMALLINT NOT NULL DEFAULT 1,
    district_id       UUID REFERENCES districts(id),
    project_id        UUID REFERENCES projects(id),
    parcel_id         UUID REFERENCES parcels(id),
    storage_key       TEXT NOT NULL,
    checksum_sha256   TEXT NOT NULL,
    processing_stage  processing_stage NOT NULL DEFAULT 'uploaded',
    status            TEXT NOT NULL,
    ocr_confidence    NUMERIC(5,2),
    image_quality     SMALLINT,
    validation_issues SMALLINT NOT NULL DEFAULT 0,
    uploaded_by       UUID REFERENCES users(id),
    uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Idempotent ingestion: the same source object never lands twice.
    source_key        TEXT UNIQUE
);

CREATE TABLE document_pages (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number    SMALLINT NOT NULL,
    status         TEXT,
    rotation       SMALLINT NOT NULL DEFAULT 0,
    ocr_confidence NUMERIC(5,2),
    UNIQUE (document_id, page_number)
);

CREATE TABLE extracted_fields (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number       SMALLINT NOT NULL,
    field_name        TEXT NOT NULL,
    original_text     TEXT,          -- original-language evidence, never overwritten
    transliterated    TEXT,
    translated        TEXT,
    normalized_value  TEXT,
    suggested_value   TEXT,
    lrms_value        TEXT,
    registry_value    TEXT,
    mutation_value    TEXT,
    gis_value         TEXT,
    confidence        NUMERIC(5,2) NOT NULL,
    status            TEXT NOT NULL,
    bbox              JSONB,
    reviewer_comment  TEXT,
    model_version     TEXT
);

CREATE INDEX idx_fields_document ON extracted_fields (document_id);

CREATE TABLE field_corrections (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id     UUID NOT NULL REFERENCES extracted_fields(id) ON DELETE CASCADE,
    old_value    TEXT,
    new_value    TEXT,
    corrected_by UUID REFERENCES users(id),
    corrected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason       TEXT
);

-- ------------------------ Validation and anomalies ------------------------

CREATE TABLE validation_issues (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id             UUID REFERENCES documents(id) ON DELETE CASCADE,
    parcel_id               UUID REFERENCES parcels(id),
    project_id              UUID REFERENCES projects(id),
    field_name              TEXT,
    category                TEXT NOT NULL,
    severity                conflict_severity NOT NULL,
    title                   TEXT NOT NULL,
    detail                  TEXT,
    ocr_value               TEXT,
    lrms_value              TEXT,
    registry_value          TEXT,
    mutation_value          TEXT,
    gis_value               TEXT,
    confidence              NUMERIC(5,2),
    recommended_resolution  TEXT,
    status                  TEXT NOT NULL DEFAULT 'open',
    assigned_to             UUID REFERENCES users(id),
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at             TIMESTAMPTZ
);

CREATE TABLE fraud_alerts (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code           TEXT UNIQUE NOT NULL,
    category       TEXT NOT NULL,
    severity       risk_level NOT NULL,
    anomaly_score  SMALLINT NOT NULL,
    parcel_id      UUID REFERENCES parcels(id),
    project_id     UUID REFERENCES projects(id),
    district_id    UUID REFERENCES districts(id),
    summary        TEXT NOT NULL,
    evidence       JSONB NOT NULL DEFAULT '[]'::jsonb,
    status         TEXT NOT NULL DEFAULT 'new',
    investigator   UUID REFERENCES users(id),
    detected_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------ Risk model --------------------------------

CREATE TABLE risk_predictions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    risk_score          SMALLINT NOT NULL,
    risk_level          risk_level NOT NULL,
    delay_probability   SMALLINT NOT NULL,
    predicted_completion DATE,
    district_baseline   SMALLINT,
    model_confidence    SMALLINT,
    data_completeness   SMALLINT,
    model_version       TEXT NOT NULL,
    features            JSONB NOT NULL,
    contributors        JSONB NOT NULL,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_project ON risk_predictions (project_id, generated_at DESC);

CREATE TABLE interventions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                    TEXT UNIQUE NOT NULL,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title                   TEXT NOT NULL,
    description             TEXT,
    driver                  TEXT,
    priority                risk_level NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'proposed',
    assigned_office         TEXT,
    assigned_officer        UUID REFERENCES users(id),
    due_date                DATE,
    expected_risk_reduction SMALLINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------- Compensation / R&R ---------------------------

CREATE TABLE beneficiaries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beneficiary_code    TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    guardian_name       TEXT,
    family_size         SMALLINT,
    category            TEXT,
    parcel_id           UUID REFERENCES parcels(id),
    project_id          UUID REFERENCES projects(id),
    -- Only the last four digits are retained for display; the rest is tokenised.
    bank_account_token  TEXT,
    bank_account_last4  CHAR(4),
    bank_verification   TEXT NOT NULL DEFAULT 'pending',
    vulnerable          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE compensation_records (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beneficiary_id           UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
    project_id               UUID REFERENCES projects(id),
    parcel_id                UUID REFERENCES parcels(id),
    amount_assessed          NUMERIC(18,2) NOT NULL,
    amount_paid              NUMERIC(18,2) NOT NULL DEFAULT 0,
    status                   compensation_status NOT NULL,
    assessed_on              DATE NOT NULL,
    paid_on                  DATE,
    disbursement_delay_days  INTEGER,
    failure_reason           TEXT,
    grievance_raised         BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_paid CHECK (amount_paid <= amount_assessed)
);

CREATE TABLE rr_records (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beneficiary_id             UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
    project_id                 UUID REFERENCES projects(id),
    eligibility                TEXT NOT NULL,
    entitlements               JSONB NOT NULL DEFAULT '[]'::jsonb,
    site_allotted              BOOLEAN NOT NULL DEFAULT FALSE,
    site_code                  TEXT,
    benefits_disbursed_percent SMALLINT NOT NULL DEFAULT 0,
    status                     TEXT NOT NULL DEFAULT 'pending',
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------- Legal and field work -------------------------

CREATE TABLE legal_cases (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number  TEXT NOT NULL,
    project_id   UUID REFERENCES projects(id),
    parcel_id    UUID REFERENCES parcels(id),
    court        TEXT,
    subject      TEXT,
    filed_on     DATE,
    status       TEXT,
    next_hearing DATE,
    impact       risk_level
);

CREATE TABLE field_inspections (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                  TEXT UNIQUE NOT NULL,
    parcel_id             UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    project_id            UUID REFERENCES projects(id),
    officer_id            UUID REFERENCES users(id),
    inspected_on          DATE NOT NULL,
    findings              TEXT,
    possession_observed   BOOLEAN,
    encroachment_observed BOOLEAN,
    verification_status   TEXT
);

CREATE TABLE geo_evidence (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID REFERENCES field_inspections(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    caption       TEXT,
    captured_on   TIMESTAMPTZ,
    location      GEOMETRY(Point, 4326),
    storage_key   TEXT,
    source        TEXT,
    confidence    SMALLINT
);

CREATE INDEX idx_geo_evidence_location ON geo_evidence USING GIST (location);

-- ------------------------------- Watershed --------------------------------

CREATE TABLE watersheds (
    id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                          TEXT UNIQUE NOT NULL,
    name                          TEXT NOT NULL,
    district_id                   UUID REFERENCES districts(id),
    area_ha                       NUMERIC(12,2),
    geom                          GEOMETRY(Polygon, 4326),
    land_use                      JSONB,
    ndvi_trend                    JSONB,
    soil_moisture_trend           JSONB,
    erosion_risk_before           SMALLINT,
    erosion_risk_after            SMALLINT,
    encroachment_alerts           SMALLINT,
    intervention_coverage_percent SMALLINT,
    observation_date              DATE,
    confidence                    SMALLINT,
    verification_status           TEXT
);

CREATE INDEX idx_watershed_geom ON watersheds USING GIST (geom);

-- ---------------------------- Workflow and audit --------------------------

CREATE TABLE review_tasks (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code           TEXT UNIQUE NOT NULL,
    document_id    UUID REFERENCES documents(id),
    parcel_id      UUID REFERENCES parcels(id),
    project_id     UUID REFERENCES projects(id),
    reason         TEXT NOT NULL,
    severity       conflict_severity NOT NULL,
    confidence     NUMERIC(5,2),
    priority_score SMALLINT NOT NULL,
    sla_days       SMALLINT NOT NULL,
    assigned_to    UUID REFERENCES users(id),
    status         TEXT NOT NULL DEFAULT 'unassigned',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at   TIMESTAMPTZ
);

CREATE INDEX idx_review_priority ON review_tasks (status, priority_score DESC);

CREATE TABLE audit_events (
    id             BIGSERIAL PRIMARY KEY,
    correlation_id TEXT NOT NULL,
    actor_id       UUID REFERENCES users(id),
    actor_name     TEXT NOT NULL,
    role_id        TEXT NOT NULL,
    action         TEXT NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      TEXT NOT NULL,
    old_value      TEXT,
    new_value      TEXT,
    reason         TEXT,
    source_ip      INET,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_events (actor_name, occurred_at DESC);

-- Audit is append-only: updates and deletes are rejected at the database level.
CREATE OR REPLACE FUNCTION bhoomilens.reject_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION bhoomilens.reject_audit_mutation();

CREATE TABLE integration_status (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system          TEXT UNIQUE NOT NULL,
    category        TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    status          TEXT NOT NULL,
    last_sync_at    TIMESTAMPTZ,
    records_synced  BIGINT NOT NULL DEFAULT 0,
    failed_records  BIGINT NOT NULL DEFAULT 0,
    latency_ms      INTEGER
);

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title      TEXT NOT NULL,
    body       TEXT,
    severity   TEXT NOT NULL,
    route      TEXT,
    roles      TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE research_documents (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        TEXT NOT NULL,
    category     TEXT NOT NULL,
    authors      TEXT[],
    published_on DATE,
    abstract     TEXT,
    tags         TEXT[],
    states       TEXT[],
    citations    INTEGER DEFAULT 0,
    access_level TEXT NOT NULL DEFAULT 'public',
    source_ref   TEXT UNIQUE
);

-- ------------------------------ Analytics views ---------------------------

CREATE OR REPLACE VIEW v_district_metrics AS
SELECT
    d.id                                        AS district_id,
    d.name                                      AS district,
    s.name                                      AS state,
    COUNT(DISTINCT p.id)                        AS projects,
    COUNT(DISTINCT pa.id)                       AS parcels,
    COALESCE(AVG(rp.delay_probability), 0)      AS delay_probability,
    COALESCE(SUM(cr.amount_paid), 0)            AS compensation_paid,
    COALESCE(SUM(cr.amount_assessed), 0)        AS compensation_assessed
FROM districts d
JOIN states s ON s.id = d.state_id
LEFT JOIN projects p ON p.district_id = d.id
LEFT JOIN parcels pa ON pa.district_id = d.id
LEFT JOIN risk_predictions rp ON rp.project_id = p.id
LEFT JOIN compensation_records cr ON cr.project_id = p.id
GROUP BY d.id, d.name, s.name;

-- Parcels whose recorded area disagrees with the surveyed polygon by >8%.
CREATE OR REPLACE VIEW v_gis_discrepancies AS
SELECT
    parcel_code,
    survey_number,
    recorded_area_ha,
    ROUND((ST_Area(geom::geography) / 10000)::numeric, 4) AS computed_area_ha,
    ROUND(ABS(recorded_area_ha - (ST_Area(geom::geography) / 10000)::numeric)
          / NULLIF(recorded_area_ha, 0) * 100, 2)         AS deviation_percent
FROM parcels
WHERE recorded_area_ha > 0
  AND ABS(recorded_area_ha - (ST_Area(geom::geography) / 10000)::numeric)
      / recorded_area_ha > 0.08;

-- Overlapping cadastral geometry, the primary GIS boundary-conflict signal.
CREATE OR REPLACE VIEW v_parcel_overlaps AS
SELECT
    a.parcel_code AS parcel_a,
    b.parcel_code AS parcel_b,
    ROUND((ST_Area(ST_Intersection(a.geom, b.geom)::geography) / 10000)::numeric, 4) AS overlap_ha
FROM parcels a
JOIN parcels b ON a.id < b.id AND ST_Intersects(a.geom, b.geom)
WHERE ST_Area(ST_Intersection(a.geom, b.geom)::geography) > 0;
