package com.clinora.research.domain;

public enum DatasetRequestStatus {
    DRAFT,
    SUBMITTED,
    UNDER_REVIEW,
    MORE_INFO_REQUIRED,
    APPROVED,
    REJECTED,
    CANCELLED;

    public boolean isEditable() {
        return this == DRAFT || this == MORE_INFO_REQUIRED;
    }

    public boolean canBeSubmitted() {
        return this == DRAFT || this == MORE_INFO_REQUIRED;
    }

    public boolean canBeCancelled() {
        return this == DRAFT || this == SUBMITTED || this == UNDER_REVIEW || this == MORE_INFO_REQUIRED;
    }

    public boolean canUndergoReview() {
        return this == SUBMITTED || this == UNDER_REVIEW || this == MORE_INFO_REQUIRED;
    }

    public boolean isTerminal() {
        return this == APPROVED || this == REJECTED || this == CANCELLED;
    }
}
