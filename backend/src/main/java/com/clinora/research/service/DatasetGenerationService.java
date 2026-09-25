package com.clinora.research.service;

import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.research.config.ResearchMessagingConfig;
import com.clinora.research.deid.DeidentificationResult;
import com.clinora.research.deid.DeidentificationService;
import com.clinora.research.domain.*;
import com.clinora.research.domain.catalog.ResearchCatalogVariable;
import com.clinora.research.domain.catalog.ResearchDataCatalog;
import com.clinora.research.exception.ResearchApiException;
import com.clinora.research.exception.ResearchErrorCode;
import com.clinora.research.repository.*;
import com.clinora.research.storage.ResearchDatasetStoragePort;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class DatasetGenerationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DatasetGenerationService.class);

    private final DatasetRequestRepository requestRepository;
    private final ResearchProjectRepository projectRepository;
    private final ResearchDatasetRepository datasetRepository;
    private final DatasetVersionRepository versionRepository;
    private final DatasetAccessGrantRepository accessGrantRepository;
    private final DatasetGenerationJobRepository jobRepository;
    private final DeidentificationService deidentificationService;
    private final ResearchDatasetStoragePort storagePort;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ResearchDataCatalog catalog;
    private final RabbitTemplate rabbitTemplate;
    private final AuthAuditService auditService;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final String queueName;

    public DatasetGenerationService(
            DatasetRequestRepository requestRepository,
            ResearchProjectRepository projectRepository,
            ResearchDatasetRepository datasetRepository,
            DatasetVersionRepository versionRepository,
            DatasetAccessGrantRepository accessGrantRepository,
            DatasetGenerationJobRepository jobRepository,
            DeidentificationService deidentificationService,
            ResearchDatasetStoragePort storagePort,
            NamedParameterJdbcTemplate jdbcTemplate,
            ResearchDataCatalog catalog,
            RabbitTemplate rabbitTemplate,
            AuthAuditService auditService,
            ObjectMapper objectMapper,
            Clock clock,
            @Value("${clinora.research.dataset-generation-queue:" + ResearchMessagingConfig.DEFAULT_RESEARCH_DATASET_QUEUE + "}") String queueName
    ) {
        this.requestRepository = requestRepository;
        this.projectRepository = projectRepository;
        this.datasetRepository = datasetRepository;
        this.versionRepository = versionRepository;
        this.accessGrantRepository = accessGrantRepository;
        this.jobRepository = jobRepository;
        this.deidentificationService = deidentificationService;
        this.storagePort = storagePort;
        this.jdbcTemplate = jdbcTemplate;
        this.catalog = catalog;
        this.rabbitTemplate = rabbitTemplate;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.queueName = queueName;
    }

    @Transactional
    public DatasetGenerationJob enqueueJob(UUID datasetRequestId) {
        DatasetRequest request = requestRepository.findById(datasetRequestId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, ResearchErrorCode.DATASET_REQUEST_NOT_FOUND, "Dataset request not found"));

        if (request.getStatus() != DatasetRequestStatus.APPROVED) {
            throw new ResearchApiException(HttpStatus.BAD_REQUEST, ResearchErrorCode.DATASET_REQUEST_NOT_SUBMITTABLE,
                    "Dataset generation can only be initiated for APPROVED dataset requests. Current status: " + request.getStatus());
        }

        DatasetGenerationJob job = new DatasetGenerationJob(UUID.randomUUID(), datasetRequestId, clock.instant());
        job = jobRepository.save(job);

        rabbitTemplate.convertAndSend(queueName, job.getId().toString());
        LOGGER.info("Enqueued dataset generation job {} for dataset request {}", job.getId(), datasetRequestId);
        return job;
    }

    @Transactional
    public void processJob(UUID jobId) {
        DatasetGenerationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            LOGGER.warn("Dataset generation job {} not found; skipping", jobId);
            return;
        }

        if (!"PENDING".equalsIgnoreCase(job.getStatus())) {
            LOGGER.info("Dataset generation job {} is already {}; skipping", jobId, job.getStatus());
            return;
        }

        job.markProcessing(clock.instant());
        jobRepository.save(job);

        try {
            DatasetRequest request = requestRepository.findById(job.getDatasetRequestId())
                    .orElseThrow(() -> new IllegalStateException("Dataset request not found: " + job.getDatasetRequestId()));
            ResearchProject project = projectRepository.findById(request.getProjectId())
                    .orElseThrow(() -> new IllegalStateException("Research project not found: " + request.getProjectId()));

            // Extract criteria & fetch eligible observation candidates
            List<DeidentificationService.RawObservationRow> rows = fetchEligibleRows(request);

            // Execute Phase R8 De-identification Pipeline
            String formatStr = request.getRequestedFormat() != null ? request.getRequestedFormat().name() : "CSV";
            DeidentificationResult deidResult = deidentificationService.transform(
                    request.getId(),
                    project.getId(),
                    formatStr,
                    rows
            );

            // Create or fetch ResearchDataset
            ResearchDataset dataset = datasetRepository.findByDatasetRequestId(request.getId())
                    .orElseGet(() -> {
                        ResearchDataset newDataset = new ResearchDataset(
                                UUID.randomUUID(),
                                project.getId(),
                                request.getId(),
                                request.getName(),
                                clock.instant(),
                                request.getExpiresAt()
                        );
                        return datasetRepository.save(newDataset);
                    });

            // Calculate version number
            List<DatasetVersion> existingVersions = versionRepository.findByDatasetIdOrderByVersionNumberDesc(dataset.getId());
            int nextVersion = existingVersions.isEmpty() ? 1 : existingVersions.get(0).getVersionNumber() + 1;

            // Upload de-identified payload to private MinIO storage
            String extension = "JSON".equalsIgnoreCase(deidResult.format()) ? ".json" : ".csv";
            String objectKey = "datasets/%s/%s/v%d%s".formatted(project.getId(), dataset.getId(), nextVersion, extension);
            String contentType = "JSON".equalsIgnoreCase(deidResult.format()) ? "application/json" : "text/csv";

            storagePort.put(objectKey, deidResult.serializedPayload(), contentType);

            // Create immutable DatasetVersion
            DatasetVersion version = new DatasetVersion(
                    UUID.randomUUID(),
                    dataset.getId(),
                    nextVersion,
                    "1.0",
                    deidResult.totalEligibleRecords(),
                    objectKey,
                    deidResult.sha256Checksum(),
                    deidResult.format(),
                    deidResult.deidentificationProfileVersion(),
                    clock.instant()
            );
            versionRepository.save(version);

            // Automatically grant access to project owner
            if (accessGrantRepository.findByDatasetIdAndResearcherUserId(dataset.getId(), project.getOwnerUserId()).isEmpty()) {
                DatasetAccessGrant grant = new DatasetAccessGrant(
                        UUID.randomUUID(),
                        dataset.getId(),
                        project.getOwnerUserId(),
                        project.getOwnerUserId(),
                        clock.instant(),
                        dataset.getExpiresAt()
                );
                accessGrantRepository.save(grant);
            }

            job.markSucceeded(clock.instant());
            jobRepository.save(job);

            auditService.record(
                    project.getOwnerUserId(),
                    AuthAuditAction.RESEARCH_DATASET_GENERATED,
                    AuthAuditOutcome.SUCCESS,
                    "system",
                    "worker",
                    dataset.getId().toString(),
                    "version=" + nextVersion + ";records=" + deidResult.totalEligibleRecords()
            );

            LOGGER.info("Dataset generation job {} SUCCEEDED: dataset {}, version {}, records {}",
                    jobId, dataset.getId(), nextVersion, deidResult.totalEligibleRecords());
        } catch (Exception e) {
            LOGGER.error("Dataset generation job {} FAILED: {}", jobId, e.getMessage(), e);
            job.markFailed(e.getMessage(), clock.instant());
            jobRepository.save(job);
        }
    }

    @Transactional(readOnly = true)
    public List<ResearchDataset> listDatasetsForProject(UUID projectId, UUID requestingUserId) {
        ResearchProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, ResearchErrorCode.PROJECT_NOT_FOUND, "Project not found"));

        return datasetRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    /**
     * Lists all datasets accessible to the requesting researcher:
     * - Datasets belonging to projects they own.
     * - Datasets they hold an active DatasetAccessGrant for.
     */
    @Transactional(readOnly = true)
    public List<ResearchDataset> listDatasetsForResearcher(UUID requestingUserId) {
        // Collect dataset IDs from owned projects
        Set<UUID> datasetIds = new LinkedHashSet<>();
        List<ResearchProject> ownedProjects = projectRepository.findByOwnerUserIdOrderByCreatedAtDesc(requestingUserId);
        for (ResearchProject project : ownedProjects) {
            datasetRepository.findByProjectIdOrderByCreatedAtDesc(project.getId())
                    .forEach(d -> datasetIds.add(d.getId()));
        }
        // Collect dataset IDs from access grants
        List<DatasetAccessGrant> grants = accessGrantRepository.findByResearcherUserId(requestingUserId);
        grants.stream().filter(DatasetAccessGrant::isActive).forEach(g -> datasetIds.add(g.getDatasetId()));

        if (datasetIds.isEmpty()) return List.of();
        return datasetRepository.findByIdInOrderByCreatedAtDesc(datasetIds);
    }

    @Transactional(readOnly = true)
    public ResearchDataset getDataset(UUID datasetId, UUID requestingUserId) {
        ResearchDataset dataset = datasetRepository.findById(datasetId)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, ResearchErrorCode.DATASET_REQUEST_NOT_FOUND, "Dataset not found"));

        verifyDatasetAccess(dataset, requestingUserId);
        return dataset;
    }

    @Transactional(readOnly = true)
    public List<DatasetVersion> listVersions(UUID datasetId, UUID requestingUserId) {
        ResearchDataset dataset = getDataset(datasetId, requestingUserId);
        return versionRepository.findByDatasetIdOrderByVersionNumberDesc(dataset.getId());
    }

    @Transactional(readOnly = true)
    public DatasetDownload downloadVersion(UUID datasetId, int versionNumber, UUID requestingUserId, String ip, String userAgent) {
        ResearchDataset dataset = getDataset(datasetId, requestingUserId);

        if (dataset.getRevokedAt() != null || "REVOKED".equalsIgnoreCase(dataset.getStatus())) {
            throw new ResearchApiException(
                    HttpStatus.FORBIDDEN,
                    ResearchErrorCode.PROJECT_ACCESS_DENIED,
                    "Dataset has been revoked and downloads are prohibited."
            );
        }

        if (dataset.getExpiresAt() != null && dataset.getExpiresAt().isBefore(clock.instant())) {
            throw new ResearchApiException(
                    HttpStatus.GONE,
                    ResearchErrorCode.INVALID_PROJECT_STATE,
                    "Dataset access has expired and cannot be downloaded."
            );
        }

        DatasetVersion version = versionRepository.findByDatasetIdAndVersionNumber(datasetId, versionNumber)
                .orElseThrow(() -> new ResearchApiException(HttpStatus.NOT_FOUND, ResearchErrorCode.DATASET_REQUEST_NOT_FOUND, "Dataset version not found"));

        var stored = storagePort.get(version.getStorageObjectKey());

        auditService.record(
                requestingUserId,
                AuthAuditAction.RESEARCH_DATASET_DOWNLOADED,
                AuthAuditOutcome.SUCCESS,
                ip,
                userAgent,
                datasetId.toString(),
                "version=" + versionNumber + ";checksum=" + version.getChecksum()
        );

        String ext = "JSON".equalsIgnoreCase(version.getFormat()) ? "json" : "csv";
        String filename = "dataset-%s-v%d.%s".formatted(dataset.getName().replaceAll("[^a-zA-Z0-9-_]", "_"), versionNumber, ext);

        return new DatasetDownload(filename, stored.contentType(), stored.bytes(), version.getChecksum());
    }

    private void verifyDatasetAccess(ResearchDataset dataset, UUID requestingUserId) {
        ResearchProject project = projectRepository.findById(dataset.getProjectId()).orElseThrow();
        if (project.getOwnerUserId().equals(requestingUserId)) {
            return;
        }
        Optional<DatasetAccessGrant> grant = accessGrantRepository.findByDatasetIdAndResearcherUserId(dataset.getId(), requestingUserId);
        if (grant.isPresent() && grant.get().isActive()) {
            return;
        }
        throw new ResearchApiException(HttpStatus.FORBIDDEN, ResearchErrorCode.PROJECT_ACCESS_DENIED, "You do not have access to this research dataset");
    }

    private List<DeidentificationService.RawObservationRow> fetchEligibleRows(DatasetRequest request) {
        MapSqlParameterSource params = new MapSqlParameterSource();
        StringBuilder whereClause = new StringBuilder();

        // Baseline Eligibility boundary: Fail-closed consent & verified hygiene
        whereClause.append("rep.subject_type = 'SELF' ")
                .append("AND rep.archived_at IS NULL ")
                .append("AND obs.verification_status IN ('DOCTOR_VERIFIED', 'PATIENT_CONFIRMED', 'PATIENT_CORRECTED') ")
                .append("AND obs.review_required = false ")
                .append("AND obs.effective_numeric_value IS NOT NULL ")
                .append("AND EXISTS (SELECT 1 FROM patient_research_consents prc WHERE prc.patient_user_id = rep.patient_user_id AND prc.consent_status = 'CONSENTED' AND prc.revoked_at IS NULL) ");

        // Parse requested population criteria if available
        try {
            if (request.getRequestedPopulation() != null && !request.getRequestedPopulation().isBlank()) {
                JsonNode pop = objectMapper.readTree(request.getRequestedPopulation());
                if (pop.has("ageMin") && !pop.get("ageMin").isNull()) {
                    whereClause.append("AND EXTRACT(YEAR FROM age(rep.report_date, p.date_of_birth)) >= :minAge ");
                    params.addValue("minAge", pop.get("ageMin").asInt());
                }
                if (pop.has("ageMax") && !pop.get("ageMax").isNull()) {
                    whereClause.append("AND EXTRACT(YEAR FROM age(rep.report_date, p.date_of_birth)) <= :maxAge ");
                    params.addValue("maxAge", pop.get("ageMax").asInt());
                }
                if (pop.has("dateFrom") && !pop.get("dateFrom").isNull()) {
                    whereClause.append("AND rep.report_date >= :dateFrom ");
                    params.addValue("dateFrom", LocalDate.parse(pop.get("dateFrom").asText()));
                }
                if (pop.has("dateTo") && !pop.get("dateTo").isNull()) {
                    whereClause.append("AND rep.report_date <= :dateTo ");
                    params.addValue("dateTo", LocalDate.parse(pop.get("dateTo").asText()));
                }
                if (pop.has("sexes") && pop.get("sexes").isArray() && !pop.get("sexes").isEmpty()) {
                    List<String> sexes = new ArrayList<>();
                    pop.get("sexes").forEach(s -> sexes.add(s.asText().toUpperCase(Locale.ROOT)));
                    whereClause.append("AND UPPER(p.gender) IN (:sexes) ");
                    params.addValue("sexes", sexes);
                }
            }
        } catch (Exception e) {
            LOGGER.warn("Failed to parse requested population JSON: {}", e.getMessage());
        }

        // Parse requested variables
        Set<String> aliases = new HashSet<>();
        try {
            if (request.getRequestedVariables() != null && !request.getRequestedVariables().isBlank()) {
                List<String> vars = objectMapper.readValue(request.getRequestedVariables(), new TypeReference<List<String>>() {});
                for (String varCode : vars) {
                    catalog.getByCode(varCode).ifPresent(v -> {
                        if (!"Demographics".equalsIgnoreCase(v.category())) {
                            v.labelAliases().forEach(a -> aliases.add(a.toLowerCase(Locale.ROOT)));
                        }
                    });
                }
            }
        } catch (Exception e) {
            LOGGER.warn("Failed to parse requested variables JSON: {}", e.getMessage());
        }

        if (!aliases.isEmpty()) {
            whereClause.append("AND (LOWER(obs.normalized_label) IN (:aliases) OR LOWER(obs.effective_label) IN (:aliases)) ");
            params.addValue("aliases", new ArrayList<>(aliases));
        }

        String sql = """
            SELECT 
                rep.patient_user_id,
                p.date_of_birth,
                p.gender,
                rep.report_date,
                obs.normalized_label,
                obs.effective_label,
                obs.effective_numeric_value,
                obs.effective_unit,
                obs.reference_low,
                obs.reference_high,
                obs.derived_range_flag
            FROM patient_medical_reports rep
            JOIN users u ON rep.patient_user_id = u.id
            LEFT JOIN patient_profiles p ON p.user_id = rep.patient_user_id
            JOIN medical_report_extraction_results res ON res.report_id = rep.id
            JOIN medical_report_observations obs ON obs.extraction_result_id = res.id
            WHERE %s
            ORDER BY rep.patient_user_id, rep.report_date ASC, obs.created_at ASC
            """.formatted(whereClause.toString());

        return jdbcTemplate.query(sql, params, (rs, rowNum) -> mapRow(rs));
    }

    private DeidentificationService.RawObservationRow mapRow(ResultSet rs) throws SQLException {
        java.sql.Date dobSql = rs.getDate("date_of_birth");
        LocalDate dob = dobSql != null ? dobSql.toLocalDate() : null;

        java.sql.Date repDateSql = rs.getDate("report_date");
        LocalDate repDate = repDateSql != null ? repDateSql.toLocalDate() : LocalDate.now();

        String normLabel = rs.getString("normalized_label");
        String effLabel = rs.getString("effective_label");
        String varCode = resolveCatalogCode(normLabel, effLabel);

        return new DeidentificationService.RawObservationRow(
                rs.getObject("patient_user_id", UUID.class),
                dob,
                rs.getString("gender"),
                repDate,
                varCode,
                rs.getBigDecimal("effective_numeric_value"),
                rs.getString("effective_unit"),
                rs.getBigDecimal("reference_low"),
                rs.getBigDecimal("reference_high"),
                rs.getString("derived_range_flag")
        );
    }

    private String resolveCatalogCode(String normalizedLabel, String effectiveLabel) {
        String lowerNorm = normalizedLabel != null ? normalizedLabel.toLowerCase(Locale.ROOT) : "";
        String lowerEff = effectiveLabel != null ? effectiveLabel.toLowerCase(Locale.ROOT) : "";

        for (ResearchCatalogVariable var : catalog.getAllVariables()) {
            for (String alias : var.labelAliases()) {
                String lowerAlias = alias.toLowerCase(Locale.ROOT);
                if (lowerNorm.equals(lowerAlias) || lowerEff.equals(lowerAlias) || lowerNorm.contains(lowerAlias)) {
                    return var.code();
                }
            }
        }
        return normalizedLabel != null ? normalizedLabel.toUpperCase(Locale.ROOT) : "OBSERVATION";
    }

    public record DatasetDownload(String filename, String contentType, byte[] bytes, String checksum) {}
}
