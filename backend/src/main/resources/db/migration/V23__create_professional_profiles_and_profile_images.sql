ALTER TABLE doctor_booking_profiles
    ADD COLUMN professional_bio TEXT,
    ADD COLUMN professional_profile_url VARCHAR(500),
    ADD COLUMN display_title VARCHAR(160),
    ADD COLUMN preferred_timezone VARCHAR(80),
    ADD COLUMN default_consultation_minutes INTEGER,
    ADD COLUMN profile_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE doctor_booking_profiles
    ADD CONSTRAINT ck_doctor_profile_bio_length
        CHECK (professional_bio IS NULL OR char_length(professional_bio) <= 2000),
    ADD CONSTRAINT ck_doctor_profile_url_length
        CHECK (professional_profile_url IS NULL OR char_length(professional_profile_url) <= 500),
    ADD CONSTRAINT ck_doctor_profile_display_title
        CHECK (display_title IS NULL OR btrim(display_title) <> ''),
    ADD CONSTRAINT ck_doctor_profile_timezone
        CHECK (preferred_timezone IS NULL OR btrim(preferred_timezone) <> ''),
    ADD CONSTRAINT ck_doctor_default_consultation_minutes
        CHECK (
            default_consultation_minutes IS NULL OR
            (default_consultation_minutes BETWEEN 15 AND 120 AND default_consultation_minutes % 5 = 0)
        );

-- Preserve an application-provided professional link as the initial editable presentation value.
UPDATE doctor_booking_profiles p
SET professional_profile_url = d.professional_profile_url
FROM doctor_application_details d
WHERE d.application_id = p.application_id
  AND p.professional_profile_url IS NULL
  AND d.professional_profile_url IS NOT NULL
  AND btrim(d.professional_profile_url) <> ''
  AND d.professional_profile_url ~* '^https?://';

CREATE TABLE user_profile_images (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    object_key VARCHAR(700) NOT NULL UNIQUE,
    content_type VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_checksum CHAR(64) NOT NULL,
    width_px INTEGER,
    height_px INTEGER,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_user_profile_image_size CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    CONSTRAINT ck_user_profile_image_content_type CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
    CONSTRAINT ck_user_profile_image_dimensions CHECK (
        (width_px IS NULL AND height_px IS NULL) OR
        (width_px > 0 AND height_px > 0 AND width_px <= 4096 AND height_px <= 4096)
    )
);

CREATE INDEX ix_user_profile_images_updated_at ON user_profile_images(updated_at DESC);
