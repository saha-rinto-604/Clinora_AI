package com.clinora.doctors.support;

import com.clinora.doctors.api.DoctorApiException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

@Service
public class DoctorSupportRoutingService {
    private static final Pattern UNSUPPORTED = Pattern.compile(
        "\\b(best\\s+(?:drug|medication)|(?:drug|medication).{0,30}dos(?:e|age)|prescrib|start\\s+(?:the\\s+)?(?:best\\s+)?medication|weather|every\\s+private\\s+report|all\\s+private\\s+reports|ignore\\s+(?:access|clinora|the\\s+rules|prior\\s+instructions|restrictions|safety)|diagnose\\s+the\\s+patient|system\\s+prompt|chain\\s+of\\s+thought|hidden\\s+reports?)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern AMBIGUOUS = Pattern.compile(
        "^(?:please\\s+)?(?:check\\s+(?:this|that)|what\\s+do\\s+you\\s+think|review\\s+this)[?.!]*$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern BRIEF = Pattern.compile(
        "\\b(?:brief(?:\\s+me)?|pre[- ]visit|rundown\\s+(?:before|for)|prepare\\s+(?:me\\s+)?(?:for|before).{0,30}(?:visit|encounter)|patient\\s+briefing)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CONNECT = Pattern.compile(
        "\\b(?:related|connected|connect|matter\\s+together|form\\s+(?:a\\s+)?pattern|fit\\s+together|go\\s+together|relationship\\s+(?:among|between))\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern COMPARE = Pattern.compile(
        "\\b(?:compare|compar\\b|cmp\\b|changed?\\s+since|since\\s+(?:the\\s+)?(?:last|previous|prev)|previous\\s+one|prev\\b|persist(?:ed|ent|ence)?|stayed|present\\s+before|over\\s+time|trend)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern CROSS_CHECK = Pattern.compile(
        "(?:\\b(?:assessment|impression)\\b.{0,60}\\b(?:fits?|supports?|contradicts?|argue[sd]?\\s+against|does\\s+not\\s+fit)\\b)|(?:\\b(?:fits?|supports?|contradicts?|argue[sd]?\\s+against)\\b.{0,60}\\b(?:assessment|impression)\\b)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern FIND_GAPS = Pattern.compile(
        "\\b(?:what\\s+(?:information|info|data)\\s+(?:(?:am\\s+i|are\\s+we|is)\\s+)?missing|what\\s+else\\s+would\\s+help|information\\s+(?:is\\s+)?missing|data\\s+(?:is\\s+)?unavailable|what\\s+would\\s+help\\s+distinguish|find\\s+(?:the\\s+)?gaps?)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern EXPLORE = Pattern.compile(
        "\\b(?:what\\s+(?:could|might)\\s+explain|could\\s+explain|possible\\s+explanations?|possibilities\\s+(?:should|could)|could\\s+this\\s+fit|explore\\s+(?:the\\s+)?possibilities)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern STRUCTURE = Pattern.compile(
        "\\b(?:structure|organize|format|turn|tidy)\\b.{0,80}\\b(?:notes?|consultation\\s+note)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern FOCUSED = Pattern.compile(
        "\\b(?:what\\s+does|explain|question\\s+about)\\b.{0,80}\\b(?:evidence|finding|result|value)\\b",
        Pattern.CASE_INSENSITIVE
    );

    private final DoctorSupportContextService contexts;
    private final DoctorSupportTaskRegistry registry;
    private final DoctorSupportSemanticRouter semanticRouter;

    public DoctorSupportRoutingService(
        DoctorSupportContextService contexts,
        DoctorSupportTaskRegistry registry,
        DoctorSupportSemanticRouter semanticRouter
    ) {
        this.contexts = contexts;
        this.registry = registry;
        this.semanticRouter = semanticRouter;
    }

    public DoctorSupportRoutingDecision route(
        java.util.UUID doctorId,
        java.util.UUID appointmentId,
        DoctorSupportRoutingRequest request
    ) {
        DoctorSupportContext context = contexts.build(doctorId, appointmentId, request);
        if (request.explicitTaskId() != null) {
            return routedOrMissing(List.of(request.explicitTaskId()), context);
        }

        String message = request.message().trim();
        if (UNSUPPORTED.matcher(message).find()) return unsupported(context);
        if (message.matches("(?i)^(?:what is|tell me about)\\s+[a-z][a-z -]{1,60}[?.!]*$")) return unsupported(context);
        if (AMBIGUOUS.matcher(message).matches()) return ambiguous(context, List.of());

        List<DoctorSupportTask> deterministic = deterministicTasks(message);
        if (!deterministic.isEmpty()) return routedOrMissing(deterministic, context);

        DoctorSupportSemanticRouter.SemanticDecision semantic;
        try {
            semantic = semanticRouter.route(message, context, registry.all());
        } catch (RestClientException exception) {
            throw new DoctorApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CLINICAL_SUPPORT_ROUTER_UNAVAILABLE",
                "Clinora routing is temporarily unavailable."
            );
        } catch (IllegalArgumentException exception) {
            throw invalidRouterResponse();
        }
        return validateSemantic(semantic, context);
    }

    private List<DoctorSupportTask> deterministicTasks(String message) {
        List<DoctorSupportTask> tasks = new ArrayList<>();
        addIf(tasks, BRIEF, message, DoctorSupportTask.BRIEF_PATIENT);
        addIf(tasks, CONNECT, message, DoctorSupportTask.CONNECT_EVIDENCE);
        addIf(tasks, COMPARE, message, DoctorSupportTask.COMPARE_EVIDENCE);
        addIf(tasks, CROSS_CHECK, message, DoctorSupportTask.CROSS_CHECK_ASSESSMENT);
        addIf(tasks, FIND_GAPS, message, DoctorSupportTask.FIND_GAPS);
        addIf(tasks, EXPLORE, message, DoctorSupportTask.EXPLORE_EXPLANATIONS);
        addIf(tasks, STRUCTURE, message, DoctorSupportTask.STRUCTURE_NOTES);
        if (tasks.isEmpty()) addIf(tasks, FOCUSED, message, DoctorSupportTask.FOCUSED_EVIDENCE_QUESTION);
        return registry.ordered(tasks);
    }

    private static void addIf(List<DoctorSupportTask> tasks, Pattern pattern, String message, DoctorSupportTask task) {
        if (pattern.matcher(message).find()) tasks.add(task);
    }

    private DoctorSupportRoutingDecision validateSemantic(
        DoctorSupportSemanticRouter.SemanticDecision semantic,
        DoctorSupportContext context
    ) {
        List<DoctorSupportTask> tasks = parseUnique(semantic.taskIds());
        List<DoctorSupportTask> options = parseUnique(semantic.clarificationOptionTaskIds());
        if (semantic.status() == DoctorSupportRoutingStatus.ROUTED) {
            if (tasks.isEmpty() || !options.isEmpty()) throw invalidRouterResponse();
            return routedOrMissing(tasks, context);
        }
        if (semantic.status() == DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED) {
            if (!tasks.isEmpty()) throw invalidRouterResponse();
            return ambiguous(context, options);
        }
        if (!tasks.isEmpty() || !options.isEmpty()) throw invalidRouterResponse();
        return unsupported(context);
    }

    private List<DoctorSupportTask> parseUnique(List<String> taskIds) {
        Set<DoctorSupportTask> parsed = new LinkedHashSet<>();
        for (String taskId : taskIds) {
            DoctorSupportTask task;
            try {
                task = DoctorSupportTask.valueOf(taskId);
            } catch (RuntimeException exception) {
                throw invalidRouterResponse();
            }
            if (!parsed.add(task)) throw invalidRouterResponse();
        }
        return registry.ordered(List.copyOf(parsed));
    }

    private DoctorSupportRoutingDecision routedOrMissing(
        List<DoctorSupportTask> requestedTasks,
        DoctorSupportContext context
    ) {
        List<DoctorSupportTask> tasks = registry.ordered(requestedTasks);
        Set<DoctorSupportRequiredContext> missing = EnumSet.noneOf(DoctorSupportRequiredContext.class);
        tasks.forEach(task -> registry.require(task).requiredContext().stream()
            .filter(required -> !has(required, context))
            .forEach(missing::add));
        if (!missing.isEmpty()) {
            return new DoctorSupportRoutingDecision(
                DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED,
                List.of(),
                referenced(context),
                options(tasks),
                DoctorSupportClarificationReason.MISSING_REQUIRED_CONTEXT,
                List.copyOf(missing)
            );
        }
        return new DoctorSupportRoutingDecision(
            DoctorSupportRoutingStatus.ROUTED,
            tasks,
            referenced(context),
            List.of(),
            null,
            List.of()
        );
    }

    private DoctorSupportRoutingDecision ambiguous(
        DoctorSupportContext context,
        List<DoctorSupportTask> proposedOptions
    ) {
        List<DoctorSupportTask> candidates = proposedOptions.isEmpty()
            ? registry.all().stream().map(DoctorSupportTaskSpec::taskId).toList()
            : registry.ordered(proposedOptions);
        List<DoctorSupportTask> contextual = candidates.stream()
            .filter(task -> registry.require(task).requiredContext().stream().allMatch(required -> has(required, context)))
            .filter(task -> task != DoctorSupportTask.BRIEF_PATIENT && task != DoctorSupportTask.STRUCTURE_NOTES)
            .limit(4)
            .toList();
        if (contextual.isEmpty()) {
            contextual = List.of(DoctorSupportTask.BRIEF_PATIENT);
        }
        return new DoctorSupportRoutingDecision(
            DoctorSupportRoutingStatus.CLARIFICATION_REQUIRED,
            List.of(),
            referenced(context),
            options(contextual),
            DoctorSupportClarificationReason.AMBIGUOUS_INTENT,
            List.of()
        );
    }

    private DoctorSupportRoutingDecision unsupported(DoctorSupportContext context) {
        return new DoctorSupportRoutingDecision(
            DoctorSupportRoutingStatus.UNSUPPORTED,
            List.of(),
            referenced(context),
            List.of(),
            null,
            List.of()
        );
    }

    private boolean has(DoctorSupportRequiredContext required, DoctorSupportContext context) {
        return switch (required) {
            case APPOINTMENT -> true;
            case AUTHORIZED_EVIDENCE -> context.hasAuthorizedEvidence();
            case COMPARABLE_REPORTS -> context.comparableAuthorizedReportsAvailable();
            case DOCTOR_ASSESSMENT -> context.doctorAssessmentPresent();
            case DOCTOR_NOTES -> context.doctorNotesPresent();
        };
    }

    private List<DoctorSupportRoutingDecision.ClarificationOption> options(List<DoctorSupportTask> tasks) {
        return registry.ordered(tasks).stream().map(task -> {
            DoctorSupportTaskSpec spec = registry.require(task);
            return new DoctorSupportRoutingDecision.ClarificationOption(task, spec.label(), spec.shortDescription());
        }).toList();
    }

    private static DoctorSupportRoutingDecision.ReferencedContext referenced(DoctorSupportContext context) {
        return new DoctorSupportRoutingDecision.ReferencedContext(
            context.currentScreen(),
            context.currentReportType(),
            context.authorizedReportIds().size(),
            context.authorizedObservationIds().size(),
            context.doctorAssessmentPresent(),
            context.doctorNotesPresent(),
            context.comparableAuthorizedReportsAvailable(),
            context.selectionType()
        );
    }

    private static DoctorApiException invalidRouterResponse() {
        return new DoctorApiException(
            HttpStatus.BAD_GATEWAY,
            "CLINICAL_SUPPORT_ROUTER_INVALID",
            "Clinora could not safely determine the requested operation."
        );
    }
}
