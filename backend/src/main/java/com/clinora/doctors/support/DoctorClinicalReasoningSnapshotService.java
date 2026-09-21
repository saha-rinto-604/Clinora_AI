package com.clinora.doctors.support;

import com.clinora.ai.client.MedGemmaClient.ClinicalCluster;
import com.clinora.ai.client.MedGemmaClient.ClinicalPattern;
import com.clinora.ai.client.MedGemmaClient.ClusterCandidate;
import com.clinora.ai.client.MedGemmaClient.ClusterEvidence;
import com.clinora.ai.client.MedGemmaClient.ReportAnalysisResponse;
import com.clinora.ai.service.PatientReportAiAnalysisService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Reuses the current report-scoped Patient MedGemma result as advisory Doctor reasoning. */
@Service
public class DoctorClinicalReasoningSnapshotService {
    private final PatientReportAiAnalysisService reportAnalysis;

    public DoctorClinicalReasoningSnapshotService(PatientReportAiAnalysisService reportAnalysis) {
        this.reportAnalysis = reportAnalysis;
    }

    public Resolution resolve(UUID patientId, DoctorSupportEvidenceSnapshot evidence) {
        return resolve(patientId, evidence, true);
    }

    /** Returns only already-existing snapshots and never queues MedGemma work. */
    public Resolution resolveAvailable(UUID patientId, DoctorSupportEvidenceSnapshot evidence) {
        return resolve(patientId, evidence, false);
    }

    private Resolution resolve(UUID patientId, DoctorSupportEvidenceSnapshot evidence, boolean queueMissing) {
        Map<UUID, Set<UUID>> allowedByReport = evidence.observations().stream().collect(Collectors.groupingBy(
            DoctorSupportEvidenceSnapshot.ObservationEvidence::reportId,
            Collectors.mapping(DoctorSupportEvidenceSnapshot.ObservationEvidence::observationId, Collectors.toSet())
        ));
        List<ClinicalReasoningSnapshot> ready = new ArrayList<>();
        List<SnapshotProvenance> provenance = new ArrayList<>();
        boolean failed = false;
        boolean stale = false;
        boolean preparing = false;

        for (DoctorSupportEvidenceSnapshot.ReportEvidence report : evidence.reports()) {
            PatientReportAiAnalysisService.DoctorSnapshot resolved = queueMissing
                ? reportAnalysis.resolveDoctorSnapshot(patientId, report.reportId())
                : reportAnalysis.peekDoctorSnapshot(patientId, report.reportId());
            provenance.add(new SnapshotProvenance(
                resolved.snapshotId(), resolved.jobId(), report.reportId(), resolved.evidenceVersion(),
                resolved.status(), resolved.modelName(), resolved.modelRevision(), resolved.promptVersion(),
                resolved.schemaVersion(), resolved.generatedAt()
            ));
            switch (resolved.status()) {
                case "READY" -> ready.add(compact(resolved, allowedByReport.getOrDefault(report.reportId(), Set.of())));
                case "FAILED" -> failed = true;
                case "STALE" -> stale = true;
                default -> preparing = true;
            }
        }
        Availability availability = failed ? Availability.FAILED
            : stale ? Availability.STALE
            : preparing ? Availability.PREPARING
            : Availability.READY;
        return new Resolution(availability, ready, provenance);
    }

    private ClinicalReasoningSnapshot compact(
        PatientReportAiAnalysisService.DoctorSnapshot source,
        Set<UUID> allowedObservationIds
    ) {
        ReportAnalysisResponse result = source.reasoning();
        List<ReasoningPattern> patterns = new ArrayList<>();
        List<ReasoningPossibility> possibilities = new ArrayList<>();
        LinkedHashSet<String> gaps = new LinkedHashSet<>();

        for (ClinicalCluster cluster : result.clinicalClusters()) {
            List<UUID> support = evidenceIds(cluster.evidence(), "SUPPORTS", allowedObservationIds);
            List<UUID> against = evidenceIds(cluster.evidence(), "CONTRADICTS", allowedObservationIds);
            if (!support.isEmpty()) {
                addPattern(patterns, text(cluster.displayTitle(), cluster.title()), support, against);
            }
            addStrings(gaps, cluster.missingEvidence(), 12);
            for (ClusterCandidate candidate : cluster.candidates()) {
                List<UUID> candidateSupport = allowed(candidate.supportingObservationIds(), allowedObservationIds, 8);
                if (candidateSupport.isEmpty()) continue;
                List<UUID> candidateAgainst = allowed(candidate.contradictoryObservationIds(), allowedObservationIds, 8);
                List<String> missing = compactStrings(candidate.missingEvidence(), 6);
                addPossibility(possibilities, candidate.name(), candidateSupport, candidateAgainst, missing);
                addStrings(gaps, missing, 12);
            }
        }

        // Historical Phase 10P results remain reusable through their report-level pattern contract.
        for (ClinicalPattern pattern : result.clinicalPatterns()) {
            List<UUID> support = allowed(pattern.supportingObservationIds(), allowedObservationIds, 8);
            if (support.isEmpty()) continue;
            List<UUID> against = allowed(pattern.contradictoryObservationIds(), allowedObservationIds, 8);
            addPattern(patterns, pattern.name(), support, against);
            addStrings(gaps, pattern.missingEvidence(), 12);
            for (String possibility : compactStrings(pattern.possibleCauses(), 6)) {
                addPossibility(possibilities, possibility, support, against, compactStrings(pattern.missingEvidence(), 6));
            }
        }

        String modelVersion = text(source.modelName(), "unknown") + "@" + text(source.modelRevision(), "unknown");
        return new ClinicalReasoningSnapshot(
            source.snapshotId(), source.reportId(), source.evidenceVersion(), modelVersion,
            source.promptVersion(), source.schemaVersion(), "READY",
            patterns.stream().limit(6).toList(), possibilities.stream().limit(6).toList(),
            gaps.stream().limit(12).toList(), source.generatedAt()
        );
    }

    private static List<UUID> evidenceIds(List<ClusterEvidence> evidence, String role, Set<UUID> allowed) {
        return evidence.stream().filter(item -> role.equals(item.role())).map(ClusterEvidence::observationId)
            .filter(allowed::contains).distinct().limit(8).toList();
    }

    private static List<UUID> allowed(List<UUID> values, Set<UUID> allowed, int limit) {
        if (values == null) return List.of();
        return values.stream().filter(allowed::contains).distinct().limit(limit).toList();
    }

    private static void addPattern(
        List<ReasoningPattern> target, String concept, List<UUID> support, List<UUID> against
    ) {
        String value = compactText(concept, 160);
        if (!value.isBlank() && target.stream().noneMatch(item -> item.concept().equalsIgnoreCase(value))) {
            target.add(new ReasoningPattern(value, support, against));
        }
    }

    private static void addPossibility(
        List<ReasoningPossibility> target, String concept, List<UUID> support,
        List<UUID> against, List<String> missing
    ) {
        String value = compactText(concept, 160);
        if (!value.isBlank() && target.stream().noneMatch(item -> item.concept().equalsIgnoreCase(value))) {
            target.add(new ReasoningPossibility(value, support, against, missing));
        }
    }

    private static void addStrings(LinkedHashSet<String> target, List<String> values, int limit) {
        for (String value : compactStrings(values, limit)) {
            if (target.size() >= limit) return;
            target.add(value);
        }
    }

    private static List<String> compactStrings(List<String> values, int limit) {
        if (values == null) return List.of();
        return values.stream().map(value -> compactText(value, 180)).filter(value -> !value.isBlank())
            .distinct().limit(limit).toList();
    }

    private static String compactText(String value, int max) {
        if (value == null) return "";
        String compact = value.replaceAll("\\s+", " ").trim();
        return compact.length() <= max ? compact : compact.substring(0, max).trim();
    }

    private static String text(String preferred, String fallback) {
        return preferred == null || preferred.isBlank() ? fallback : preferred;
    }

    public enum Availability { READY, PREPARING, STALE, FAILED }

    public record Resolution(
        Availability availability,
        List<ClinicalReasoningSnapshot> snapshots,
        List<SnapshotProvenance> provenance
    ) {
        public Resolution {
            snapshots = List.copyOf(snapshots);
            provenance = List.copyOf(provenance);
        }
    }

    public record ClinicalReasoningSnapshot(
        UUID snapshotId,
        UUID reportId,
        String evidenceVersion,
        String modelVersion,
        String promptVersion,
        String schemaVersion,
        String status,
        List<ReasoningPattern> patterns,
        List<ReasoningPossibility> possibilities,
        List<String> gaps,
        Instant generatedAt
    ) {}

    public record ReasoningPattern(String concept, List<UUID> support, List<UUID> against) {}
    public record ReasoningPossibility(
        String concept, List<UUID> support, List<UUID> against, List<String> missing
    ) {}
    public record SnapshotProvenance(
        UUID snapshotId, UUID jobId, UUID reportId, String evidenceVersion, String status,
        String modelName, String modelRevision, String promptVersion, String schemaVersion, Instant generatedAt
    ) {}
}
