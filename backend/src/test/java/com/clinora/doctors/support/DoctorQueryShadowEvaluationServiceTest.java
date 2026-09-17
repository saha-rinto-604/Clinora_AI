package com.clinora.doctors.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DoctorQueryShadowEvaluationServiceTest {
    @Test
    void comparesCandidatePlanWithoutLoggingOrReturningRawClinicalText() {
        DoctorQueryInterpreter interpreter = mock(DoctorQueryInterpreter.class);
        DoctorSupportPlanner planner = new DoctorSupportPlanner(new DoctorSupportTaskRegistry());
        DoctorQueryShadowEvaluationService service = new DoctorQueryShadowEvaluationService(interpreter, planner);
        UUID reportId = UUID.randomUUID();
        DoctorSupportContext context = new DoctorSupportContext(
            UUID.randomUUID(), UUID.randomUUID(), DoctorSupportScreen.REPORT_REVIEW, reportId, "CBC",
            List.of(reportId), List.of(), true, true, true, DoctorSupportSelectionType.REPORT
        );
        DoctorClinicalQueryFrame frame = new DoctorClinicalQueryFrame(
            DoctorClinicalQueryFrame.FrameStatus.INTERPRETED,
            List.of(DoctorClinicalQueryFrame.InformationNeed.RELATE_FINDINGS),
            List.of(), List.of(),
            DoctorClinicalQueryFrame.RelationshipMode.MULTI_FINDING_PATTERN,
            DoctorClinicalQueryFrame.TemporalIntent.CURRENT,
            DoctorClinicalQueryFrame.EvidenceScope.CURRENT_REPORT,
            List.of(), List.of()
        );
        when(interpreter.interpret("novel clinical wording", context)).thenReturn(
            new DoctorQueryInterpreter.Interpretation(frame, "doctor-query-interpreter-v1", "doctor-query-frame-v1", "stop", 80, 34, 920)
        );
        DoctorSupportRoutingDecision production = new DoctorSupportRoutingDecision(
            DoctorSupportRoutingStatus.ROUTED,
            List.of(DoctorSupportTask.CONNECT_EVIDENCE),
            null,
            List.of(),
            null,
            List.of()
        );

        DoctorQueryShadowEvaluationService.ShadowEvaluation result = service.evaluate(
            "novel clinical wording", context, production
        );

        assertTrue(result.agreement());
        assertEquals(List.of(DoctorSupportTask.CONNECT_EVIDENCE), result.candidateTasks());
        assertEquals(920, result.interpretationDurationMs());
    }
}
