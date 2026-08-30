CREATE TABLE patient_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    date_of_birth DATE NULL,
    gender VARCHAR(32) NULL,
    blood_group VARCHAR(16) NULL,
    phone VARCHAR(32) NULL,
    address VARCHAR(500) NULL,
    height_cm NUMERIC(5, 2) NULL,
    weight_kg NUMERIC(6, 2) NULL,
    family_medical_history VARCHAR(2000) NULL,
    lifestyle_information VARCHAR(2000) NULL,
    emergency_contact_name VARCHAR(160) NULL,
    emergency_contact_phone VARCHAR(32) NULL,
    emergency_contact_relationship VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_patient_profiles_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ux_patient_profiles_user UNIQUE (user_id),
    CONSTRAINT ck_patient_profiles_gender CHECK (gender IS NULL OR gender IN (
        'FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY'
    )),
    CONSTRAINT ck_patient_profiles_blood_group CHECK (blood_group IS NULL OR blood_group IN (
        'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
        'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
    )),
    CONSTRAINT ck_patient_profiles_height CHECK (height_cm IS NULL OR (height_cm >= 30 AND height_cm <= 300)),
    CONSTRAINT ck_patient_profiles_weight CHECK (weight_kg IS NULL OR (weight_kg >= 1 AND weight_kg <= 700))
);

CREATE INDEX ix_patient_profiles_blood_group ON patient_profiles (blood_group);

CREATE TABLE patient_allergies (
    id UUID PRIMARY KEY,
    patient_profile_id UUID NOT NULL,
    name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_patient_allergies_profile FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX ix_patient_allergies_profile ON patient_allergies (patient_profile_id);
CREATE UNIQUE INDEX ux_patient_allergies_profile_name ON patient_allergies (patient_profile_id, LOWER(name));

CREATE TABLE patient_chronic_conditions (
    id UUID PRIMARY KEY,
    patient_profile_id UUID NOT NULL,
    name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_patient_conditions_profile FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX ix_patient_conditions_profile ON patient_chronic_conditions (patient_profile_id);
CREATE UNIQUE INDEX ux_patient_conditions_profile_name ON patient_chronic_conditions (patient_profile_id, LOWER(name));

CREATE TABLE patient_current_medications (
    id UUID PRIMARY KEY,
    patient_profile_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_patient_medications_profile FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
);

CREATE INDEX ix_patient_medications_profile ON patient_current_medications (patient_profile_id);
CREATE UNIQUE INDEX ux_patient_medications_profile_name ON patient_current_medications (patient_profile_id, LOWER(name));
