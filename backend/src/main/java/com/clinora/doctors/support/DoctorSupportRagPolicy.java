package com.clinora.doctors.support;

/** Future knowledge-retrieval policy. Phase 6D.3 keeps every task disabled. */
public enum DoctorSupportRagPolicy {
    DISABLED,
    OPTIONAL,
    REQUIRED_WHEN_AVAILABLE
}
