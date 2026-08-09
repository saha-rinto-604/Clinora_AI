CREATE TABLE doctor_application_details (
    application_id UUID PRIMARY KEY REFERENCES access_applications(id) ON DELETE CASCADE,
    professional_title VARCHAR(160),
    specialization VARCHAR(180),
    years_experience INTEGER CHECK (years_experience IS NULL OR years_experience >= 0),
    current_organization VARCHAR(220),
    current_position VARCHAR(180),
    professional_profile_url VARCHAR(500),
    registration_jurisdiction VARCHAR(160),
    registration_authority VARCHAR(220),
    registration_number VARCHAR(160),
    registration_type VARCHAR(120),
    registration_issued_at DATE,
    registration_valid_until DATE
);

CREATE TABLE researcher_application_details (
    application_id UUID PRIMARY KEY REFERENCES access_applications(id) ON DELETE CASCADE,
    institution VARCHAR(220),
    department VARCHAR(180),
    professional_title VARCHAR(180),
    institutional_profile_url VARCHAR(500),
    research_field VARCHAR(240),
    research_purpose TEXT,
    research_summary TEXT,
    orcid VARCHAR(64),
    research_profile_url VARCHAR(500),
    publication_profile_url VARCHAR(500),
    ethics_reference VARCHAR(300),
    project_approval_reference VARCHAR(300)
);

CREATE TABLE doctor_qualifications (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES access_applications(id) ON DELETE CASCADE,
    qualification_name VARCHAR(220) NOT NULL,
    institution VARCHAR(220) NOT NULL,
    country_code VARCHAR(120) NOT NULL,
    completion_year INTEGER NOT NULL CHECK (completion_year BETWEEN 1900 AND 2200)
);
CREATE INDEX idx_doctor_qualifications_application ON doctor_qualifications(application_id);
