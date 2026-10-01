-- Only for the isolated unified lineage. Never apply to an unreviewed retained database.
CREATE TABLE research_access_revocations (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    revoked_before TIMESTAMPTZ NOT NULL
);

-- Internal privacy provenance; never returned in research APIs or exports.
CREATE TABLE research_dataset_contributions (
    version_id UUID NOT NULL REFERENCES dataset_versions(id),
    patient_user_id UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (version_id, patient_user_id)
);
CREATE INDEX idx_research_contribution_patient ON research_dataset_contributions(patient_user_id);

CREATE TABLE research_dataset_privacy (
    version_id UUID PRIMARY KEY REFERENCES dataset_versions(id),
    suspended_at TIMESTAMPTZ,
    reason VARCHAR(1000),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ
);

-- Unknown historical provenance is not implicitly cleared for access.
INSERT INTO research_dataset_privacy(version_id,suspended_at,reason)
SELECT id,CURRENT_TIMESTAMP,'Historical contribution lineage requires governance review'
FROM dataset_versions;
