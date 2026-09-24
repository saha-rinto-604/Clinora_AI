import { apiClient } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type {
  AdminDatasetRequestDetailResponse,
  AdminDatasetRequestQueueItem,
  AdminProjectDetailResponse,
  AdminProjectPageResponse,
  AIEvaluationRun,
  AddMemberPayload,
  CatalogResponse,
  CohortFilterCriteria,
  CohortPreviewResponse,
  CreateDatasetRequestInput,
  CreateEvaluationRunPayload,
  CreateProjectInput,
  CreatePublicationPayload,
  DatasetGenerationJob,
  DatasetRequest,
  DatasetRequestPageResponse,
  DatasetRequestStatus,
  DatasetStatsSummary,
  DatasetVersion,
  FrequencyBin,
  GroupComparisonRow,
  ProjectPageResponse,
  ResearchAuditLogEntry,
  ResearchDataset,
  ResearchProject,
  ResearchProjectMember,
  ResearchProjectStatus,
  ResearchPublication,
  TrendPoint,
  UpdateDatasetRequestInput,
  UpdateMemberRolePayload,
  UpdateProjectInput,
  UpdatePublicationPayload,
} from './research-types';

export interface ProjectListParams {
  status?: ResearchProjectStatus | '';
  page?: number;
  size?: number;
  sort?: string;
}

export const researchApi = {
  async listProjects(params?: ProjectListParams) {
    const response = await apiClient.get<ApiEnvelope<ProjectPageResponse>>('/research/projects', {
      params: {
        status: params?.status || undefined,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
        sort: params?.sort ?? 'createdAt,desc',
      },
    });
    return response.data.data;
  },

  async getProject(projectId: string) {
    const response = await apiClient.get<ApiEnvelope<ResearchProject>>(`/research/projects/${projectId}`);
    return response.data.data;
  },

  async createProject(input: CreateProjectInput) {
    const response = await apiClient.post<ApiEnvelope<ResearchProject>>('/research/projects', input);
    return response.data.data;
  },

  async updateProject(projectId: string, input: UpdateProjectInput) {
    const response = await apiClient.patch<ApiEnvelope<ResearchProject>>(`/research/projects/${projectId}`, input);
    return response.data.data;
  },

  async submitProject(projectId: string) {
    const response = await apiClient.post<ApiEnvelope<ResearchProject>>(`/research/projects/${projectId}/submit`);
    return response.data.data;
  },

  async withdrawProject(projectId: string) {
    const response = await apiClient.post<ApiEnvelope<ResearchProject>>(`/research/projects/${projectId}/withdraw`);
    return response.data.data;
  },

  async completeProject(projectId: string) {
    const response = await apiClient.post<ApiEnvelope<ResearchProject>>(`/research/projects/${projectId}/complete`);
    return response.data.data;
  },

  async archiveProject(projectId: string) {
    const response = await apiClient.post<ApiEnvelope<ResearchProject>>(`/research/projects/${projectId}/archive`);
    return response.data.data;
  },

  async listDatasetRequests(projectId: string, params?: { page?: number; size?: number }) {
    const response = await apiClient.get<ApiEnvelope<DatasetRequestPageResponse>>(
      `/research/projects/${projectId}/dataset-requests`,
      { params },
    );
    return response.data.data;
  },

  async getDatasetRequest(requestId: string) {
    const response = await apiClient.get<ApiEnvelope<DatasetRequest>>(`/research/dataset-requests/${requestId}`);
    return response.data.data;
  },

  async createDatasetRequest(projectId: string, input: CreateDatasetRequestInput) {
    const response = await apiClient.post<ApiEnvelope<DatasetRequest>>(
      `/research/projects/${projectId}/dataset-requests`,
      input,
    );
    return response.data.data;
  },

  async updateDatasetRequest(requestId: string, input: UpdateDatasetRequestInput) {
    const response = await apiClient.patch<ApiEnvelope<DatasetRequest>>(
      `/research/dataset-requests/${requestId}`,
      input,
    );
    return response.data.data;
  },

  async submitDatasetRequest(requestId: string) {
    const response = await apiClient.post<ApiEnvelope<DatasetRequest>>(
      `/research/dataset-requests/${requestId}/submit`,
    );
    return response.data.data;
  },

  async cancelDatasetRequest(requestId: string) {
    const response = await apiClient.post<ApiEnvelope<DatasetRequest>>(
      `/research/dataset-requests/${requestId}/cancel`,
    );
    return response.data.data;
  },

  async getCatalog() {
    const response = await apiClient.get<ApiEnvelope<CatalogResponse>>('/research/catalog');
    return response.data.data;
  },

  async previewCohort(criteria: CohortFilterCriteria) {
    const response = await apiClient.post<ApiEnvelope<CohortPreviewResponse>>('/research/cohort/preview', criteria);
    return response.data.data;
  },

  async triggerGeneration(requestId: string) {
    const response = await apiClient.post<ApiEnvelope<DatasetGenerationJob>>(
      `/research/dataset-requests/${requestId}/generate`,
    );
    return response.data.data;
  },

  async getLatestGenerationJob(requestId: string) {
    const response = await apiClient.get<ApiEnvelope<DatasetGenerationJob | null>>(
      `/research/dataset-requests/${requestId}/generation-jobs/latest`,
    );
    return response.data.data;
  },

  async getDatasetByRequest(requestId: string) {
    const response = await apiClient.get<ApiEnvelope<ResearchDataset | null>>(
      `/research/dataset-requests/${requestId}/dataset`,
    );
    return response.data.data;
  },

  async getDataset(datasetId: string) {
    const response = await apiClient.get<ApiEnvelope<ResearchDataset>>(`/research/datasets/${datasetId}`);
    return response.data.data;
  },

  async listDatasetVersions(datasetId: string) {
    const response = await apiClient.get<ApiEnvelope<DatasetVersion[]>>(`/research/datasets/${datasetId}/versions`);
    return response.data.data;
  },

  async downloadDatasetVersion(datasetId: string, versionNumber: number) {
    const response = await apiClient.get(`/research/datasets/${datasetId}/versions/${versionNumber}/download`, {
      responseType: 'blob',
    });
    return response;
  },

  // ─── Phase R10: Dataset Workspace ──────────────────────────────────────────

  /** Lists all datasets accessible to the authenticated researcher (owned or granted). */
  async listMyDatasets() {
    const response = await apiClient.get<ApiEnvelope<ResearchDataset[]>>('/research/datasets');
    return response.data.data;
  },

  // ─── Phase R11: Statistical Analytics ──────────────────────────────────────

  /** Full descriptive statistics summary for all variables in a dataset version. */
  async getDatasetStats(datasetId: string, versionNumber: number): Promise<DatasetStatsSummary> {
    const response = await apiClient.get<ApiEnvelope<DatasetStatsSummary>>(
      `/research/datasets/${datasetId}/versions/${versionNumber}/stats`,
    );
    return response.data.data;
  },

  /** Frequency histogram bins for a single variable. Only real data bins. */
  async getVariableDistribution(
    datasetId: string,
    versionNumber: number,
    variableCode: string,
  ): Promise<FrequencyBin[]> {
    const response = await apiClient.get<ApiEnvelope<FrequencyBin[]>>(
      `/research/datasets/${datasetId}/versions/${versionNumber}/stats/${variableCode}/distribution`,
    );
    return response.data.data;
  },

  /** Time trend: mean per real observation period. Never interpolated. */
  async getVariableTrend(datasetId: string, versionNumber: number, variableCode: string): Promise<TrendPoint[]> {
    const response = await apiClient.get<ApiEnvelope<TrendPoint[]>>(
      `/research/datasets/${datasetId}/versions/${versionNumber}/stats/${variableCode}/trend`,
    );
    return response.data.data;
  },

  /** Group comparison: per-group aggregate for a variable, grouped by SEX or AGE_BAND. */
  async getGroupComparison(
    datasetId: string,
    versionNumber: number,
    variableCode: string,
    groupBy: 'SEX' | 'AGE_BAND',
  ): Promise<GroupComparisonRow[]> {
    const response = await apiClient.get<ApiEnvelope<GroupComparisonRow[]>>(
      `/research/datasets/${datasetId}/versions/${versionNumber}/stats/compare`,
      { params: { variable: variableCode, groupBy } },
    );
    return response.data.data;
  },

  // ─── Phase R13: AI Model Evaluation ──────────────────────────────────────

  /** Submit and execute a new AI model evaluation experiment. */
  async createEvaluationRun(projectId: string, payload: CreateEvaluationRunPayload): Promise<AIEvaluationRun> {
    const response = await apiClient.post<ApiEnvelope<AIEvaluationRun>>(
      `/research/projects/${projectId}/evaluations`,
      payload,
    );
    return response.data.data;
  },

  /** List all AI model evaluation runs for a project. */
  async listEvaluationRuns(projectId: string): Promise<AIEvaluationRun[]> {
    const response = await apiClient.get<ApiEnvelope<AIEvaluationRun[]>>(`/research/projects/${projectId}/evaluations`);
    return response.data.data;
  },

  /** Get detail and computed diagnostic metrics for an evaluation run. */
  async getEvaluationRun(projectId: string, runId: string): Promise<AIEvaluationRun> {
    const response = await apiClient.get<ApiEnvelope<AIEvaluationRun>>(
      `/research/projects/${projectId}/evaluations/${runId}`,
    );
    return response.data.data;
  },

  /** Cancel an in-progress or queued evaluation run. */
  async cancelEvaluationRun(projectId: string, runId: string): Promise<AIEvaluationRun> {
    const response = await apiClient.post<ApiEnvelope<AIEvaluationRun>>(
      `/research/projects/${projectId}/evaluations/${runId}/cancel`,
    );
    return response.data.data;
  },

  // ─── Phase R14: Collaboration ────────────────────────────────────────────

  /** List project team members. */
  async listProjectMembers(projectId: string): Promise<ResearchProjectMember[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchProjectMember[]>>(
      `/research/projects/${projectId}/members`,
    );
    return response.data.data;
  },

  /** Add a collaborator with a project-level role. */
  async addProjectMember(projectId: string, payload: AddMemberPayload): Promise<ResearchProjectMember> {
    const response = await apiClient.post<ApiEnvelope<ResearchProjectMember>>(
      `/research/projects/${projectId}/members`,
      payload,
    );
    return response.data.data;
  },

  /** Update a collaborator's project-level role. */
  async updateProjectMemberRole(
    projectId: string,
    memberId: string,
    payload: UpdateMemberRolePayload,
  ): Promise<ResearchProjectMember> {
    const response = await apiClient.put<ApiEnvelope<ResearchProjectMember>>(
      `/research/projects/${projectId}/members/${memberId}`,
      payload,
    );
    return response.data.data;
  },

  /** Remove a collaborator from a project. */
  async removeProjectMember(projectId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/members/${memberId}`);
  },

  // ─── Phase R15: Publications ─────────────────────────────────────────────

  /** List publications for a project. */
  async listPublications(projectId: string): Promise<ResearchPublication[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchPublication[]>>(
      `/research/projects/${projectId}/publications`,
    );
    return response.data.data;
  },

  /** Register a publication linked to a study. */
  async createPublication(projectId: string, payload: CreatePublicationPayload): Promise<ResearchPublication> {
    const response = await apiClient.post<ApiEnvelope<ResearchPublication>>(
      `/research/projects/${projectId}/publications`,
      payload,
    );
    return response.data.data;
  },

  /** Update publication details. */
  async updatePublication(
    projectId: string,
    pubId: string,
    payload: UpdatePublicationPayload,
  ): Promise<ResearchPublication> {
    const response = await apiClient.put<ApiEnvelope<ResearchPublication>>(
      `/research/projects/${projectId}/publications/${pubId}`,
      payload,
    );
    return response.data.data;
  },

  /** Delete a publication record. */
  async deletePublication(projectId: string, pubId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/publications/${pubId}`);
  },

  // ─── Phase R16: Audit Trail ──────────────────────────────────────────────

  /** Retrieve sanitized project audit history. */
  async getProjectAuditTrail(projectId: string): Promise<ResearchAuditLogEntry[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchAuditLogEntry[]>>(
      `/research/projects/${projectId}/audit-events`,
    );
    return response.data.data;
  },
};

export const adminResearchApi = {
  async listProjects(params?: { status?: ResearchProjectStatus | ''; page?: number; size?: number; sort?: string }) {
    const response = await apiClient.get<ApiEnvelope<AdminProjectPageResponse>>('/admin/research/projects', {
      params: {
        status: params?.status || undefined,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
        sort: params?.sort ?? 'submittedAt,asc',
      },
    });
    return response.data.data;
  },

  async getProjectDetail(projectId: string) {
    const response = await apiClient.get<ApiEnvelope<AdminProjectDetailResponse>>(
      `/admin/research/projects/${projectId}`,
    );
    return response.data.data;
  },

  async startReview(projectId: string) {
    const response = await apiClient.post<ApiEnvelope<AdminProjectDetailResponse>>(
      `/admin/research/projects/${projectId}/start-review`,
    );
    return response.data.data;
  },

  async requestInfo(projectId: string, comment: string) {
    const response = await apiClient.post<ApiEnvelope<AdminProjectDetailResponse>>(
      `/admin/research/projects/${projectId}/request-info`,
      { comment },
    );
    return response.data.data;
  },

  async approve(projectId: string, comment?: string) {
    const response = await apiClient.post<ApiEnvelope<AdminProjectDetailResponse>>(
      `/admin/research/projects/${projectId}/approve`,
      { comment },
    );
    return response.data.data;
  },

  async reject(projectId: string, comment?: string) {
    const response = await apiClient.post<ApiEnvelope<AdminProjectDetailResponse>>(
      `/admin/research/projects/${projectId}/reject`,
      { comment },
    );
    return response.data.data;
  },

  async listDatasetRequests(params?: { status?: DatasetRequestStatus | ''; page?: number; size?: number }) {
    const response = await apiClient.get<ApiEnvelope<AdminDatasetRequestQueueItem[]>>(
      '/admin/research/dataset-requests',
      {
        params: {
          status: params?.status || undefined,
          page: params?.page ?? 1,
          size: params?.size ?? 20,
        },
      },
    );
    return response.data.data;
  },

  async getDatasetRequestDetail(requestId: string) {
    const response = await apiClient.get<ApiEnvelope<AdminDatasetRequestDetailResponse>>(
      `/admin/research/dataset-requests/${requestId}`,
    );
    return response.data.data;
  },

  async startDatasetReview(requestId: string) {
    const response = await apiClient.post<ApiEnvelope<AdminDatasetRequestDetailResponse>>(
      `/admin/research/dataset-requests/${requestId}/start-review`,
    );
    return response.data.data;
  },

  async requestDatasetInfo(requestId: string, reviewNotes: string) {
    const response = await apiClient.post<ApiEnvelope<AdminDatasetRequestDetailResponse>>(
      `/admin/research/dataset-requests/${requestId}/request-info`,
      { reviewNotes },
    );
    return response.data.data;
  },

  async approveDataset(requestId: string, reviewNotes?: string, expiresAt?: string) {
    const response = await apiClient.post<ApiEnvelope<AdminDatasetRequestDetailResponse>>(
      `/admin/research/dataset-requests/${requestId}/approve`,
      { reviewNotes, expiresAt },
    );
    return response.data.data;
  },

  async rejectDataset(requestId: string, reviewNotes?: string) {
    const response = await apiClient.post<ApiEnvelope<AdminDatasetRequestDetailResponse>>(
      `/admin/research/dataset-requests/${requestId}/reject`,
      { reviewNotes },
    );
    return response.data.data;
  },
};
