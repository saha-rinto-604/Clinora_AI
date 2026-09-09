ALTER TABLE patient_profiles
    ADD COLUMN latitude DOUBLE PRECISION NULL,
    ADD COLUMN longitude DOUBLE PRECISION NULL,
    ADD COLUMN geocoded_address VARCHAR(500) NULL,
    ADD COLUMN geocoded_source_address VARCHAR(500) NULL,
    ADD COLUMN geocoded_at TIMESTAMPTZ NULL,
    ADD COLUMN blood_network_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN blood_network_available BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE patient_profiles
    ADD CONSTRAINT ck_patient_profiles_latitude
        CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    ADD CONSTRAINT ck_patient_profiles_longitude
        CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
    ADD CONSTRAINT ck_patient_profiles_location_pair
        CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
    ADD CONSTRAINT ck_patient_profiles_blood_network_availability
        CHECK (blood_network_available = FALSE OR blood_network_enabled = TRUE);

CREATE INDEX ix_patient_profiles_blood_network_lookup
    ON patient_profiles (blood_group, blood_network_enabled, blood_network_available)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE blood_requests (
    id UUID PRIMARY KEY,
    requester_user_id UUID NOT NULL,
    blood_group VARCHAR(16) NOT NULL,
    units_needed SMALLINT NOT NULL,
    hospital_name VARCHAR(180) NOT NULL,
    hospital_address VARCHAR(500) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    note VARCHAR(600) NULL,
    needed_by TIMESTAMPTZ NULL,
    status VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_blood_requests_requester FOREIGN KEY (requester_user_id) REFERENCES users(id),
    CONSTRAINT ck_blood_requests_group CHECK (blood_group IN (
        'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
        'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
    )),
    CONSTRAINT ck_blood_requests_units CHECK (units_needed BETWEEN 1 AND 20),
    CONSTRAINT ck_blood_requests_status CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT ck_blood_requests_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT ck_blood_requests_longitude CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX ix_blood_requests_requester ON blood_requests (requester_user_id, created_at DESC);
CREATE INDEX ix_blood_requests_active_group ON blood_requests (blood_group, status, created_at DESC);

CREATE TABLE blood_request_matches (
    id UUID PRIMARY KEY,
    request_id UUID NOT NULL,
    matched_user_id UUID NOT NULL,
    distance_meters INTEGER NOT NULL,
    status VARCHAR(24) NOT NULL,
    notified_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ NULL,
    contact_shared_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_blood_matches_request FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_blood_matches_user FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ux_blood_matches_request_user UNIQUE (request_id, matched_user_id),
    CONSTRAINT ck_blood_matches_distance CHECK (distance_meters >= 0),
    CONSTRAINT ck_blood_matches_status CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'))
);

CREATE INDEX ix_blood_matches_user_status ON blood_request_matches (matched_user_id, status, notified_at DESC);
CREATE INDEX ix_blood_matches_request_status ON blood_request_matches (request_id, status, distance_meters);
