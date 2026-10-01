package com.clinora.research.service;

import com.clinora.audit.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Phase R16 — Research Audit & Security Hardening Service.
 *
 * <p>Auditable research event history.
 *
 * <p>CRITICAL AUDIT RULE:
 * Never put raw medical content, personal identifiers (patient names, emails, national IDs),
 * tokens, or clinical dataset observation payloads inside normal audit logs.
 *
 * <p>All audit metadata is strictly scrubbed and redacted to maintain research privacy policies.
 */
@Service
public class ResearchAuditService {

    private static final Logger log = LoggerFactory.getLogger(ResearchAuditService.class);

    private static final Pattern SENSITIVE_KEY_PATTERN = Pattern.compile(
            "(?i).*(password|token|secret|payload|observations|ssn|nid|patient_name|patient_email|bearer).*"
    );

    private final AuthAuditService authAuditService;
    private final AuthAuditEventRepository auditEventRepository;

    public ResearchAuditService(
            AuthAuditService authAuditService,
            AuthAuditEventRepository auditEventRepository
    ) {
        this.authAuditService = authAuditService;
        this.auditEventRepository = auditEventRepository;
    }

    public void recordEvent(
            UUID actorUserId,
            AuthAuditAction action,
            AuthAuditOutcome outcome,
            String resourceId,
            String ipAddress,
            String userAgent,
            Map<String, Object> metadata
    ) {
        String sanitizedMetadata = sanitizeMetadata(metadata);
        authAuditService.record(
                actorUserId,
                action,
                outcome,
                ipAddress,
                userAgent,
                resourceId,
                sanitizedMetadata
        );
    }

    public List<ResearchAuditLogEntry> getProjectAuditHistory(UUID projectId) {
        List<AuthAuditEvent> events = auditEventRepository.findByResourceIdOrderByOccurredAtDesc(projectId.toString());
        return events.stream()
                .map(e -> new ResearchAuditLogEntry(
                        e.getId(),
                        e.getActorUserId(),
                        e.getAction().name(),
                        e.getOutcome().name(),
                        e.getOccurredAt(),
                        e.getMetadata()
                ))
                .toList();
    }

    /**
     * Sanitizes metadata by removing any key matching sensitive terms, ensuring
     * no credentials, tokens, or raw medical text leak into the audit store.
     */
    public String sanitizeMetadata(Map<String, Object> input) {
        if (input == null || input.isEmpty()) {
            return "{}";
        }

        Map<String, String> cleaned = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : input.entrySet()) {
            String key = entry.getKey();
            if (key == null || SENSITIVE_KEY_PATTERN.matcher(key).matches()) {
                continue; // strip completely
            }

            Object val = entry.getValue();
            if (val == null) continue;

            String valStr = val.toString();
            // Cap value length to prevent payload leakage
            if (valStr.length() > 200) {
                valStr = valStr.substring(0, 200) + "...[TRUNCATED]";
            }
            cleaned.put(key, valStr);
        }

        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> e : cleaned.entrySet()) {
            if (!first) sb.append(", ");
            sb.append("\"").append(e.getKey()).append("\": \"").append(escapeJson(e.getValue())).append("\"");
            first = false;
        }
        sb.append("}");
        return sb.toString();
    }

    private String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public record ResearchAuditLogEntry(
            UUID id,
            UUID actorUserId,
            String action,
            String outcome,
            Instant occurredAt,
            String metadata
    ) {}
}
