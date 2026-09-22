package com.clinora.research.exception;

public final class ResearchErrorCode {

    public static final String PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND";
    public static final String PROJECT_NOT_EDITABLE = "PROJECT_NOT_EDITABLE";
    public static final String INVALID_PROJECT_STATE = "INVALID_PROJECT_STATE";
    public static final String ACCESS_DENIED = "ACCESS_DENIED";
    public static final String UNAUTHORIZED_RESEARCHER = "UNAUTHORIZED_RESEARCHER";
    public static final String DUPLICATE_PROJECT_TITLE = "DUPLICATE_PROJECT_TITLE";
    public static final String INVALID_SUBMISSION = "INVALID_SUBMISSION";
    public static final String DATASET_REQUEST_NOT_FOUND = "DATASET_REQUEST_NOT_FOUND";
    public static final String DATASET_REQUEST_NOT_SUBMITTABLE = "DATASET_REQUEST_NOT_SUBMITTABLE";
    public static final String PROJECT_ACCESS_DENIED = "PROJECT_ACCESS_DENIED";

    private ResearchErrorCode() {}
}
