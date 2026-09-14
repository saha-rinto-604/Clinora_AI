ALTER TABLE medical_report_observations
    ADD COLUMN ocr_raw_value VARCHAR(400);

COMMENT ON COLUMN medical_report_observations.ocr_raw_value IS
    'Exact result token transcribed from the source row before numeric normalization; nullable for legacy observations.';
