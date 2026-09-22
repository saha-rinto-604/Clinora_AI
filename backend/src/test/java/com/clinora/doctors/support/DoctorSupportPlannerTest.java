package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.clinora.doctors.support.DoctorClinicalQueryFrame.EvidenceScope;
import com.clinora.doctors.support.DoctorClinicalQueryFrame.FrameStatus;
import com.clinora.doctors.support.DoctorClinicalQueryFrame.InformationNeed;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.api.Test;

class DoctorSupportPlannerTest {
    private final DoctorSupportPlanner planner = new DoctorSupportPlanner(new DoctorSupportTaskRegistry());

    @ParameterizedTest
    @MethodSource("singleNeedMappings")
    void mapsGeneralizedInformationNeedsToBoundedExistingTasks(
        InformationNeed need,
        EvidenceScope scope,
        DoctorSupportTask expected
    ) {
        DoctorSupportPlanner.Plan plan = planner.plan(frame(scope, need), fullContext());

        assertEquals(DoctorSupportRoutingStatus.ROUTED, plan.status());
        assertEquals(List.of(expected), plan.taskIds());
    }

    static Stream<Arguments> singleNeedMappings() {
        return Stream.of(
            Arguments.of(InformationNeed.SUMMARIZE, EvidenceScope.APPOINTMENT_CONTEXT, DoctorSupportTask.BRIEF_PATIENT),
            Arguments.of(InformationNeed.SUMMARIZE, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION),
            Arguments.of(InformationNeed.INTERPRET_FINDING, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION),
            Arguments.of(InformationNeed.RELATE_FINDINGS, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.CONNECT_EVIDENCE),
            Arguments.of(InformationNeed.EXPLAIN_POSSIBILITIES, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.EXPLORE_EXPLANATIONS),
            Arguments.of(InformationNeed.DIFFERENTIATE, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.EXPLORE_EXPLANATIONS),
            Arguments.of(InformationNeed.COMPARE, EvidenceScope.COMPARABLE_REPORTS, DoctorSupportTask.COMPARE_EVIDENCE),
            Arguments.of(InformationNeed.TRACE_CHANGE, EvidenceScope.COMPARABLE_REPORTS, DoctorSupportTask.COMPARE_EVIDENCE),
            Arguments.of(InformationNeed.CHECK_ASSESSMENT, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.CROSS_CHECK_ASSESSMENT),
            Arguments.of(InformationNeed.CHALLENGE_HYPOTHESIS, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.CROSS_CHECK_ASSESSMENT),
            Arguments.of(InformationNeed.IDENTIFY_GAPS, EvidenceScope.CURRENT_REPORT, DoctorSupportTask.FIND_GAPS),
            Arguments.of(InformationNeed.ORGANIZE_NOTES, EvidenceScope.DOCTOR_NOTES, DoctorSupportTask.STRUCTURE_NOTES)
        );
    }

    @Test
    void deduplicatesCompoundSemanticsAndPreservesRegistryOrder() {
        DoctorClinicalQueryFrame frame = frame(
            EvidenceScope.CURRENT_REPORT,
            InformationNeed.IDENTIFY_GAPS,
            InformationNeed.RELATE_FINDINGS,
            InformationNeed.DIFFERENTIATE,
            InformationNeed.EXPLAIN_POSSIBILITIES
        );

        DoctorSupportPlanner.Plan plan = planner.plan(frame, fullContext());

        assertEquals(
            List.of(
                DoctorSupportTask.CONNECT_EVIDENCE,
                DoctorSupportTask.FIND_GAPS,
                DoctorSupportTask.EXPLORE_EXPLANATIONS
            ),
            plan.taskIds()
        );
    }

    @Test
    void routesComparisonToAuthorizedSideBySideWhenNoRepeatedFindingsExist() {
        DoctorSupportContext noComparable = contextWithoutComparableReports();

        DoctorSupportPlanner.Plan plan = planner.plan(
            frame(EvidenceScope.COMPARABLE_REPORTS, InformationNeed.COMPARE), noComparable
        );

        assertEquals(DoctorSupportRoutingStatus.ROUTED, plan.status());
        assertEquals(List.of(DoctorSupportTask.COMPARE_EVIDENCE), plan.taskIds());
        assertEquals(List.of(), plan.missingRequiredContext());
    }

    @Test
    void keepsDoctorHypothesisCrossCheckBehindAssessmentContextGate() {
        DoctorSupportContext noAssessment = contextWithoutDoctorAssessment();

        DoctorSupportPlanner.Plan plan = planner.plan(
            frame(EvidenceScope.CURRENT_REPORT, InformationNeed.CHALLENGE_HYPOTHESIS), noAssessment
        );

        assertEquals(DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED, plan.status());
        assertEquals(List.of(DoctorSupportRequiredContext.DOCTOR_ASSESSMENT), plan.missingRequiredContext());
    }

    @Test
    void unsupportedFrameCannotBecomeAnExecutableTask() {
        DoctorClinicalQueryFrame frame = new DoctorClinicalQueryFrame(
            FrameStatus.UNSUPPORTED, List.of(), List.of(), List.of(),
            DoctorClinicalQueryFrame.RelationshipMode.NONE,
            DoctorClinicalQueryFrame.TemporalIntent.NONE,
            EvidenceScope.UNSPECIFIED,
            List.of(), List.of()
        );

        DoctorSupportPlanner.Plan plan = planner.plan(frame, fullContext());

        assertEquals(DoctorSupportRoutingStatus.UNSUPPORTED, plan.status());
        assertEquals(List.of(), plan.taskIds());
    }

    @Test
    void clarificationFrameProducesOnlyRegistryBackedContextualOptions() {
        DoctorClinicalQueryFrame frame = new DoctorClinicalQueryFrame(
            FrameStatus.CLARIFICATION_REQUIRED,
            List.of(InformationNeed.RELATE_FINDINGS, InformationNeed.DIFFERENTIATE),
            List.of(), List.of(),
            DoctorClinicalQueryFrame.RelationshipMode.MULTI_FINDING_PATTERN,
            DoctorClinicalQueryFrame.TemporalIntent.CURRENT,
            EvidenceScope.CURRENT_REPORT,
            List.of(),
            List.of(DoctorClinicalQueryFrame.QueryAmbiguity.MULTIPLE_PLAUSIBLE_NEEDS)
        );

        DoctorSupportPlanner.Plan plan = planner.plan(frame, fullContext());

        assertEquals(DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED, plan.status());
        assertEquals(
            List.of(DoctorSupportTask.CONNECT_EVIDENCE, DoctorSupportTask.EXPLORE_EXPLANATIONS),
            plan.clarificationTaskIds()
        );
    }

    private DoctorClinicalQueryFrame frame(EvidenceScope scope, InformationNeed... needs) {
        return new DoctorClinicalQueryFrame(
            FrameStatus.INTERPRETED,
            List.of(needs),
            List.of(),
            List.of(),
            DoctorClinicalQueryFrame.RelationshipMode.NONE,
            DoctorClinicalQueryFrame.TemporalIntent.NONE,
            scope,
            List.of(),
            List.of()
        );
    }

    private DoctorSupportContext fullContext() {
        return context(true, true, true);
    }

    private DoctorSupportContext contextWithoutComparableReports() {
        return context(true, true, false);
    }

    private DoctorSupportContext contextWithoutDoctorAssessment() {
        return context(false, true, true);
    }

    private DoctorSupportContext context(
        boolean doctorAssessmentPresent,
        boolean doctorNotesPresent,
        boolean comparableAuthorizedReportsAvailable
    ) {
        UUID reportId = UUID.randomUUID();
        return new DoctorSupportContext(
            UUID.randomUUID(), UUID.randomUUID(), DoctorSupportScreen.REPORT_REVIEW, reportId, "CBC",
            List.of(reportId), List.of(),
            doctorAssessmentPresent,
            doctorNotesPresent,
            comparableAuthorizedReportsAvailable,
            DoctorSupportSelectionType.REPORT
        );
    }
}
