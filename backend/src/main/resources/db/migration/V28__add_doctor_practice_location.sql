ALTER TABLE doctor_booking_profiles
    ADD COLUMN practice_location VARCHAR(500);

ALTER TABLE doctor_booking_profiles
    ADD CONSTRAINT ck_doctor_practice_location
        CHECK (practice_location IS NULL OR btrim(practice_location) <> '');

COMMENT ON COLUMN doctor_booking_profiles.practice_location IS
    'Single Doctor-configured Patient-facing location used for in-person appointment snapshots.';
