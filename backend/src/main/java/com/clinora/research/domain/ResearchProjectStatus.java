package com.clinora.research.domain;

public enum ResearchProjectStatus {
    DRAFT,
    SUBMITTED,
    UNDER_REVIEW,
    MORE_INFO_REQUIRED,
    APPROVED,
    REJECTED,
    ACTIVE,
    COMPLETED,
    ARCHIVED,
    WITHDRAWN;

    public boolean isEditableByResearcher() {
        return this == DRAFT || this == MORE_INFO_REQUIRED;
    }

    public boolean canBeSubmitted() {
        return this == DRAFT || this == MORE_INFO_REQUIRED;
    }

    public boolean canBeWithdrawn() {
        return this == SUBMITTED || this == UNDER_REVIEW || this == MORE_INFO_REQUIRED;
    }

    public boolean canUndergoReview() {
        return this == SUBMITTED || this == UNDER_REVIEW || this == MORE_INFO_REQUIRED;
    }

    public boolean isApprovedOrActive() {
        return this == APPROVED || this == ACTIVE;
    }

    public boolean isTerminal() {
        return this == REJECTED || this == COMPLETED || this == ARCHIVED || this == WITHDRAWN;
    }
}
