import { apiClient } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';
import type {
  AdminDatasetRequestDetailResponse,
  AdminDatasetRequestQueueItem,
  AdminProjectDetailResponse,
  AdminProjectPageResponse,
  AIEvaluationOptions,
  AIEvaluationRun,
  CatalogResponse,
  CohortFilterCriteria,
  CohortPreviewResponse,
  CreateDatasetRequestInput,
  CreateEvaluationRunPayload,
  CreateNotePayload,
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
  ProjectActivityItem,
  ProjectPageResponse,
  ResearchAuditLogEntry,
  ResearchDataset,
  ResearchNote,
  ResearchNoteComment,
  ResearchProject,
  ResearchProjectFile,
  ResearchProjectFileVersion,
  ResearchProjectInvitation,
  ResearchProjectMember,
  ResearchProjectStatus,
  ResearchPublication,
  ResearcherDirectoryEntry,
  SendInvitationPayload,
  TrendPoint,
  UpdateDatasetRequestInput,
  UpdateMemberRolePayload,
  UpdateNotePayload,
  UpdateProjectInput,
  UpdatePublicationPayload,
  LibraryPublicationsPageResponse,
  LibraryPublicationDetail,
  MyResearchOutputSummary,
  RegisterResearchOutputPayload,
  UpdateResearchOutputPayload,
  ProjectSelectOption,
  ResearchDocumentSummary,
  ResearchDocumentDetail,
  ResearchDocumentRevision,
  ResearchDocumentComment,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  AddDocumentCommentPayload,
  SafeDatasetReference,
  SafeAIEvaluationReference,
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

  /** Get authorized dataset versions and approved evaluation options for this project. */
  async getEvaluationOptions(projectId: string): Promise<AIEvaluationOptions> {
    const response = await apiClient.get<ApiEnvelope<AIEvaluationOptions>>(
      `/research/projects/${projectId}/evaluations/options`,
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

  /** Search verified researchers by name for invitation. Min 2 chars. Returns safe profiles (no email). */
  async searchResearchers(q: string, projectId?: string): Promise<ResearcherDirectoryEntry[]> {
    const response = await apiClient.get<ApiEnvelope<ResearcherDirectoryEntry[]>>('/research/researchers/search', {
      params: { q, projectId },
    });
    return response.data.data;
  },

  // ─── Invitations (project-scoped) ────────────────────────────────────────

  /** Send an invitation to a verified researcher. Returns pending invitation. */
  async sendInvitation(projectId: string, payload: SendInvitationPayload): Promise<ResearchProjectInvitation> {
    const response = await apiClient.post<ApiEnvelope<ResearchProjectInvitation>>(
      `/research/projects/${projectId}/invitations`,
      payload,
    );
    return response.data.data;
  },

  /** List all invitations for this project (owner view). */
  async listProjectInvitations(projectId: string): Promise<ResearchProjectInvitation[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchProjectInvitation[]>>(
      `/research/projects/${projectId}/invitations`,
    );
    return response.data.data;
  },

  /** Revoke a pending invitation (owner action). */
  async revokeInvitation(projectId: string, invitationId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/invitations/${invitationId}`);
  },

  // ─── Invitations (invitee-scoped) ─────────────────────────────────────────

  /** List all invitations received by the current researcher (their inbox). */
  async listMyInvitations(): Promise<ResearchProjectInvitation[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchProjectInvitation[]>>('/research/invitations');
    return response.data.data;
  },

  /** Accept a pending invitation. Grants project membership (NOT dataset access). */
  async acceptInvitation(invitationId: string): Promise<ResearchProjectInvitation> {
    const response = await apiClient.post<ApiEnvelope<ResearchProjectInvitation>>(
      `/research/invitations/${invitationId}/accept`,
    );
    return response.data.data;
  },

  /** Decline a pending invitation. */
  async declineInvitation(invitationId: string): Promise<ResearchProjectInvitation> {
    const response = await apiClient.post<ApiEnvelope<ResearchProjectInvitation>>(
      `/research/invitations/${invitationId}/decline`,
    );
    return response.data.data;
  },

  // ─── Members ──────────────────────────────────────────────────────────────

  /** List active project team members. */
  async listProjectMembers(projectId: string): Promise<ResearchProjectMember[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchProjectMember[]>>(
      `/research/projects/${projectId}/members`,
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

  /** Remove a collaborator from a project. Active dataset grants are revoked server-side. */
  async removeProjectMember(projectId: string, memberId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/members/${memberId}`);
  },

  // ─── Workspace: Notes ────────────────────────────────────────────────────

  async listNotes(projectId: string): Promise<ResearchNote[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchNote[]>>(`/research/projects/${projectId}/notes`);
    return response.data.data;
  },

  async getNote(projectId: string, noteId: string): Promise<ResearchNote> {
    const response = await apiClient.get<ApiEnvelope<ResearchNote>>(`/research/projects/${projectId}/notes/${noteId}`);
    return response.data.data;
  },

  async createNote(projectId: string, payload: CreateNotePayload): Promise<ResearchNote> {
    const response = await apiClient.post<ApiEnvelope<ResearchNote>>(`/research/projects/${projectId}/notes`, payload);
    return response.data.data;
  },

  async updateNote(projectId: string, noteId: string, payload: UpdateNotePayload): Promise<ResearchNote> {
    const response = await apiClient.put<ApiEnvelope<ResearchNote>>(
      `/research/projects/${projectId}/notes/${noteId}`,
      payload,
    );
    return response.data.data;
  },

  async archiveNote(projectId: string, noteId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/notes/${noteId}`);
  },

  async togglePinNote(projectId: string, noteId: string): Promise<ResearchNote> {
    const response = await apiClient.post<ApiEnvelope<ResearchNote>>(
      `/research/projects/${projectId}/notes/${noteId}/pin`,
    );
    return response.data.data;
  },

  // ─── Workspace: Comments ─────────────────────────────────────────────────

  async listNoteComments(projectId: string, noteId: string): Promise<ResearchNoteComment[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchNoteComment[]>>(
      `/research/projects/${projectId}/notes/${noteId}/comments`,
    );
    return response.data.data;
  },

  async addNoteComment(projectId: string, noteId: string, content: string): Promise<ResearchNoteComment> {
    const response = await apiClient.post<ApiEnvelope<ResearchNoteComment>>(
      `/research/projects/${projectId}/notes/${noteId}/comments`,
      { content },
    );
    return response.data.data;
  },

  async deleteNoteComment(projectId: string, noteId: string, commentId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/notes/${noteId}/comments/${commentId}`);
  },

  // ─── Workspace: Files & Versions ─────────────────────────────────────────

  async listProjectFiles(projectId: string): Promise<ResearchProjectFile[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchProjectFile[]>>(`/research/projects/${projectId}/files`);
    return response.data.data;
  },

  async uploadProjectFile(projectId: string, file: File, displayName?: string): Promise<ResearchProjectFile> {
    const formData = new FormData();
    formData.append('file', file);
    if (displayName) {
      formData.append('displayName', displayName);
    }
    const response = await apiClient.post<ApiEnvelope<ResearchProjectFile>>(
      `/research/projects/${projectId}/files`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },

  async uploadFileVersion(projectId: string, fileId: string, file: File): Promise<ResearchProjectFileVersion> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ApiEnvelope<ResearchProjectFileVersion>>(
      `/research/projects/${projectId}/files/${fileId}/versions`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },

  async listProjectFileVersions(projectId: string, fileId: string): Promise<ResearchProjectFileVersion[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchProjectFileVersion[]>>(
      `/research/projects/${projectId}/files/${fileId}/versions`,
    );
    return response.data.data;
  },

  async downloadProjectFile(projectId: string, fileId: string, version?: number): Promise<Blob> {
    const response = await apiClient.get(`/research/projects/${projectId}/files/${fileId}/download`, {
      params: { version },
      responseType: 'blob',
    });
    return response.data;
  },

  async archiveProjectFile(projectId: string, fileId: string): Promise<void> {
    await apiClient.delete(`/research/projects/${projectId}/files/${fileId}`);
  },

  // ─── Workspace: Activity Feed ────────────────────────────────────────────

  async getProjectActivity(projectId: string): Promise<ProjectActivityItem[]> {
    const response = await apiClient.get<ApiEnvelope<ProjectActivityItem[]>>(
      `/research/projects/${projectId}/activity`,
    );
    return response.data.data;
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

  // ─── Clinora Library & Scientific Discovery ─────────────────────────────

  /** Search published research outputs across Clinora studies (safe discovery). */
  async searchLibraryPublications(params?: {
    search?: string;
    publicationType?: string;
    researchField?: string;
    year?: number;
    page?: number;
    size?: number;
  }): Promise<LibraryPublicationsPageResponse> {
    const response = await apiClient.get<ApiEnvelope<LibraryPublicationsPageResponse>>(
      '/research/library/publications',
      { params },
    );
    return response.data.data;
  },

  /** Get detailed publication metadata, methodology, and safe provenance. */
  async getLibraryPublicationDetail(publicationId: string): Promise<LibraryPublicationDetail> {
    const response = await apiClient.get<ApiEnvelope<LibraryPublicationDetail>>(
      `/research/library/publications/${publicationId}`,
    );
    return response.data.data;
  },

  /** List research outputs authored or contributed to by the current researcher. */
  async listMyResearchOutputs(): Promise<MyResearchOutputSummary[]> {
    const response = await apiClient.get<ApiEnvelope<MyResearchOutputSummary[]>>('/research/library/my-outputs');
    return response.data.data;
  },

  /** Get a specific researcher output detail for editing. */
  async getMyResearchOutputDetail(publicationId: string): Promise<LibraryPublicationDetail> {
    const response = await apiClient.get<ApiEnvelope<LibraryPublicationDetail>>(
      `/research/library/my-outputs/${publicationId}`,
    );
    return response.data.data;
  },

  /** Register a new research output linked to an approved study. */
  async registerResearchOutput(payload: RegisterResearchOutputPayload): Promise<LibraryPublicationDetail> {
    const response = await apiClient.post<ApiEnvelope<LibraryPublicationDetail>>(
      '/research/library/my-outputs',
      payload,
    );
    return response.data.data;
  },

  /** Update an existing research output. */
  async updateResearchOutput(
    publicationId: string,
    payload: UpdateResearchOutputPayload,
  ): Promise<LibraryPublicationDetail> {
    const response = await apiClient.put<ApiEnvelope<LibraryPublicationDetail>>(
      `/research/library/my-outputs/${publicationId}`,
      payload,
    );
    return response.data.data;
  },

  /** Delete a research output. */
  async deleteResearchOutput(publicationId: string): Promise<void> {
    await apiClient.delete(`/research/library/my-outputs/${publicationId}`);
  },

  /** Get projects authorized for linking during output registration. */
  async getAuthorizedProjectsForLibrary(): Promise<ProjectSelectOption[]> {
    const response = await apiClient.get<ApiEnvelope<ProjectSelectOption[]>>('/research/library/authorized-projects');
    return response.data.data;
  },

  // ─── Phase R16: Audit Trail ──────────────────────────────────────────────

  /** Retrieve sanitized project audit history. */
  async getProjectAuditTrail(projectId: string): Promise<ResearchAuditLogEntry[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchAuditLogEntry[]>>(
      `/research/projects/${projectId}/audit-events`,
    );
    return response.data.data;
  },

  // ─── Research Notepad Collaborative Documents ──────────────────────────────

  /** List all documents for a project. */
  async listDocuments(projectId: string): Promise<ResearchDocumentSummary[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchDocumentSummary[]>>(
      `/research/projects/${projectId}/documents`,
    );
    return response.data.data;
  },

  /** Get detailed document with content and contributors. */
  async getDocument(projectId: string, documentId: string): Promise<ResearchDocumentDetail> {
    const response = await apiClient.get<ApiEnvelope<ResearchDocumentDetail>>(
      `/research/projects/${projectId}/documents/${documentId}`,
    );
    return response.data.data;
  },

  /** Create a new research document. */
  async createDocument(projectId: string, payload: CreateDocumentPayload): Promise<ResearchDocumentDetail> {
    const response = await apiClient.post<ApiEnvelope<ResearchDocumentDetail>>(
      `/research/projects/${projectId}/documents`,
      payload,
    );
    return response.data.data;
  },

  /** Autosave or update document content, title, and CRDT delta. */
  async updateDocument(
    projectId: string,
    documentId: string,
    payload: UpdateDocumentPayload,
  ): Promise<ResearchDocumentDetail> {
    const response = await apiClient.patch<ApiEnvelope<ResearchDocumentDetail>>(
      `/research/projects/${projectId}/documents/${documentId}`,
      payload,
    );
    return response.data.data;
  },

  /** Rename a document. */
  async renameDocument(
    projectId: string,
    documentId: string,
    title: string,
    expectedRevisionNumber: number,
  ): Promise<ResearchDocumentDetail> {
    const response = await apiClient.post<ApiEnvelope<ResearchDocumentDetail>>(
      `/research/projects/${projectId}/documents/${documentId}/rename`,
      { title, expectedRevisionNumber },
    );
    return response.data.data;
  },

  /** Archive a document (OWNER only). */
  async archiveDocument(
    projectId: string,
    documentId: string,
    expectedRevisionNumber: number,
  ): Promise<ResearchDocumentDetail> {
    const response = await apiClient.post<ApiEnvelope<ResearchDocumentDetail>>(
      `/research/projects/${projectId}/documents/${documentId}/archive`,
      { expectedRevisionNumber },
    );
    return response.data.data;
  },

  /** List revision history for a document. */
  async listDocumentRevisions(projectId: string, documentId: string): Promise<ResearchDocumentRevision[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchDocumentRevision[]>>(
      `/research/projects/${projectId}/documents/${documentId}/versions`,
    );
    return response.data.data;
  },

  /** Get specific historical revision. */
  async getDocumentRevision(
    projectId: string,
    documentId: string,
    versionNumber: number,
  ): Promise<ResearchDocumentRevision> {
    const response = await apiClient.get<ApiEnvelope<ResearchDocumentRevision>>(
      `/research/projects/${projectId}/documents/${documentId}/versions/${versionNumber}`,
    );
    return response.data.data;
  },

  /** Restore a previous revision without deleting history. */
  async restoreDocumentRevision(
    projectId: string,
    documentId: string,
    versionNumber: number,
    expectedRevisionNumber: number,
  ): Promise<ResearchDocumentDetail> {
    const response = await apiClient.post<ApiEnvelope<ResearchDocumentDetail>>(
      `/research/projects/${projectId}/documents/${documentId}/versions/${versionNumber}/restore`,
      { expectedRevisionNumber },
    );
    return response.data.data;
  },

  /** List comments for a document. */
  async listDocumentComments(projectId: string, documentId: string): Promise<ResearchDocumentComment[]> {
    const response = await apiClient.get<ApiEnvelope<ResearchDocumentComment[]>>(
      `/research/projects/${projectId}/documents/${documentId}/comments`,
    );
    return response.data.data;
  },

  /** Add a comment to a document. */
  async addDocumentComment(
    projectId: string,
    documentId: string,
    payload: AddDocumentCommentPayload,
  ): Promise<ResearchDocumentComment> {
    const response = await apiClient.post<ApiEnvelope<ResearchDocumentComment>>(
      `/research/projects/${projectId}/documents/${documentId}/comments`,
      payload,
    );
    return response.data.data;
  },

  /** Resolve or reopen a comment. */
  async resolveDocumentComment(
    projectId: string,
    documentId: string,
    commentId: string,
    resolved: boolean,
  ): Promise<ResearchDocumentComment> {
    const response = await apiClient.patch<ApiEnvelope<ResearchDocumentComment>>(
      `/research/projects/${projectId}/documents/${documentId}/comments/${commentId}`,
      { resolved },
    );
    return response.data.data;
  },

  /** Safe reference lookups (provenance metadata only, no dataset files). */
  async getSafeDatasetReferences(projectId: string): Promise<SafeDatasetReference[]> {
    const response = await apiClient.get<ApiEnvelope<SafeDatasetReference[]>>(
      `/research/projects/${projectId}/documents/references/datasets`,
    );
    return response.data.data;
  },

  async getSafeEvaluationReferences(projectId: string): Promise<SafeAIEvaluationReference[]> {
    const response = await apiClient.get<ApiEnvelope<SafeAIEvaluationReference[]>>(
      `/research/projects/${projectId}/documents/references/evaluations`,
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
