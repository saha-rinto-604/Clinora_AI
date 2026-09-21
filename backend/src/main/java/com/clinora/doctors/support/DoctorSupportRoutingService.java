package com.clinora.doctors.support;

import com.clinora.doctors.api.DoctorApiException;
import com.clinora.ai.client.DoctorRouterException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class DoctorSupportRoutingService {
    private static final Logger LOGGER = LoggerFactory.getLogger(DoctorSupportRoutingService.class);
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
        "(?:\\b(?:assessment|impression)\\b.{0,60}\\b(?:fits?|supports?|contradicts?|argue[sd]?\\s+against|does\\s+not\\s+fit)\\b)"
            + "|(?:\\b(?:fits?|supports?|contradicts?|argue[sd]?\\s+against)\\b.{0,60}\\b(?:assessment|impression)\\b)"
            + "|(?:\\b(?:could\\s+(?:this|these)\\s+be|does\\s+(?:this|that)\\s+support|what\\s+does\\s+not\\s+fit)\\b.{1,100})",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern FIND_GAPS = Pattern.compile(
        "\\b(?:what\\s+(?:information|info|data|context|tests?)\\s+(?:(?:am\\s+i|are\\s+we|is|do\\s+we\\s+need)\\s+)?(?:missing|need)|what\\s+(?:information|context|tests?)\\s+do\\s+we\\s+need|what\\s+else\\s+would\\s+help|information\\s+(?:is\\s+)?missing|data\\s+(?:is\\s+)?unavailable|what\\s+would\\s+help\\s+distinguish|find\\s+(?:the\\s+)?gaps?)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern EXPLORE = Pattern.compile(
        "\\b(?:what\\s+(?:clinical\\s+)?patterns?|what\\s+(?:could|might)\\s+explain|could\\s+explain|possible\\s+(?:causes?|explanations?)|possibilities\\s+(?:should|could)|explore\\s+(?:clinical\\s+patterns?|the\\s+possibilities)|separate\\s+(?:clinical\\s+)?processes|independent\\s+findings)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern STRUCTURE = Pattern.compile(
        "\\b(?:structure|organize|format|turn|tidy)\\b.{0,80}\\b(?:notes?|consultation\\s+note)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern FOCUSED = Pattern.compile(
        "(?:\\b(?:what|which|show|list|find|identify|describe|how\\s+many|count)\\b.{0,80}"
            + "\\b(?:evidence|findings?|results?|observations?|abnormal\\w*|high|low|positive|values?|units?|"
            + "ranges?|status(?:es)?|dates?|verified)\\b)"
            + "|(?:\\b(?:what\\s+does|explain|question\\s+about)\\b.{0,80}"
            + "\\b(?:evidence|finding|result|value)\\b)"
            + "|(?:\\b(?:latest|current|most\\s+recent|newest)\\b.{0,60}"
            + "\\b(?:finding|result|observation|value|unit|range|status|date)\\b)",
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
        long routeStarted = System.nanoTime();
        long authorizationStarted = System.nanoTime();
        DoctorSupportContext context = contexts.build(doctorId, appointmentId, request);
        long authorizationMs = elapsedMillis(authorizationStarted);
        if (request.explicitTaskId() != null) {
            return complete(routedOrMissing(List.of(request.explicitTaskId()), context, false), routeStarted,
                authorizationMs, 0, "EXPLICIT_COMPATIBILITY");
        }

        String message = request.message().trim();
        if (UNSUPPORTED.matcher(message).find()) return complete(unsupported(context), routeStarted, authorizationMs, 0, "UNSUPPORTED");
        if (AMBIGUOUS.matcher(message).matches()) {
            return complete(ambiguous(context, List.of()), routeStarted, authorizationMs, 0, "AMBIGUOUS_FAST_PATH");
        }

        List<DoctorSupportTask> deterministic = deterministicTasks(message);
        if (!deterministic.isEmpty()) {
            boolean inlineAssessment = CROSS_CHECK.matcher(message).find();
            return complete(routedOrMissing(deterministic, context, inlineAssessment), routeStarted,
                authorizationMs, 0, "DETERMINISTIC");
        }
        if (message.matches("(?i)^(?:what is|tell me about)\\s+[a-z][a-z -]{1,60}[?.!]*$")) {
            return complete(unsupported(context), routeStarted, authorizationMs, 0, "UNSUPPORTED");
        }

        DoctorSupportSemanticRouter.SemanticDecision semantic;
        long semanticStarted = System.nanoTime();
        try {
            semantic = semanticRouter.route(message, context, registry.all());
        } catch (DoctorRouterException exception) {
            if (exception.clarificationSafe()) return ambiguous(context, List.of());
            throw new DoctorApiException(
                switch (exception.category()) {
                    case ROUTER_MODEL_BUSY -> HttpStatus.TOO_MANY_REQUESTS;
                    case ROUTER_TIMEOUT -> HttpStatus.GATEWAY_TIMEOUT;
                    case ROUTER_INVALID_RESPONSE -> HttpStatus.BAD_GATEWAY;
                    default -> HttpStatus.SERVICE_UNAVAILABLE;
                },
                exception.category().name(),
                switch (exception.category()) {
                    case ROUTER_MODEL_BUSY -> "Clinical reasoning is temporarily busy. Please try again shortly.";
                    case ROUTER_TIMEOUT -> "Clinora took too long to respond. Please try again.";
                    case ROUTER_INVALID_RESPONSE -> "Clinora could not safely understand this request. Please choose an operation.";
                    default -> "Clinora routing is temporarily unavailable.";
                }
            );
        } catch (RestClientException exception) {
            throw new DoctorApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "CLINICAL_SUPPORT_ROUTER_UNAVAILABLE",
                "Clinora routing is temporarily unavailable."
            );
        } catch (IllegalArgumentException exception) {
            throw invalidRouterResponse();
        }
        long semanticMs = elapsedMillis(semanticStarted);
        return complete(validateSemantic(semantic, context, CROSS_CHECK.matcher(message).find()), routeStarted,
            authorizationMs, semanticMs, "GEMINI");
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
        DoctorSupportContext context,
        boolean inlineAssessment
    ) {
        List<DoctorSupportTask> tasks = parseUnique(semantic.taskIds());
        List<DoctorSupportTask> options = parseUnique(semantic.clarificationOptionTaskIds());
        if (semantic.status() == DoctorSupportRoutingStatus.ROUTED) {
            if (tasks.isEmpty() || !options.isEmpty()) throw invalidRouterResponse();
            return routedOrMissing(tasks, context, inlineAssessment);
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
        DoctorSupportContext context,
        boolean inlineAssessment
    ) {
        List<DoctorSupportTask> tasks = registry.ordered(requestedTasks);
        Set<DoctorSupportRequiredContext> missing = EnumSet.noneOf(DoctorSupportRequiredContext.class);
        tasks.forEach(task -> registry.require(task).requiredContext().stream()
            .filter(required -> !(required == DoctorSupportRequiredContext.DOCTOR_ASSESSMENT && inlineAssessment))
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
            .filter(task -> task != DoctorSupportTask.STRUCTURE_NOTES)
            .limit(5)
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

    private DoctorSupportRoutingDecision complete(
        DoctorSupportRoutingDecision decision,
        long routeStarted,
        long authorizationMs,
        long semanticMs,
        String mode
    ) {
        LOGGER.info(
            "doctor_support_routing route_ms={} authorization_ms={} semantic_ms={} mode={} status={} task_count={}",
            elapsedMillis(routeStarted), authorizationMs, semanticMs, mode, decision.status(), decision.taskIds().size()
        );
        return decision;
    }

    private static long elapsedMillis(long startedNanos) {
        return Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000);
    }
}
