import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Filter,
  Layers,
  LoaderCircle,
  Plus,
  Quote,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  LibraryPublicationDetail,
  LibraryPublicationSummary,
  MyResearchOutputSummary,
  ProjectSelectOption,
  PublicationStatus,
  PublicationType,
  RegisterResearchOutputPayload,
  UpdateResearchOutputPayload,
} from '../../features/research/research-types';

export function ResearchLibraryPage() {
  const [activeTab, setActiveTab] = useState<'published' | 'my-outputs'>('published');

  // ── Published Research State ──
  const [publishedList, setPublishedList] = useState<LibraryPublicationSummary[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedError, setPublishedError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // ── My Outputs State ──
  const [myOutputs, setMyOutputs] = useState<MyResearchOutputSummary[]>([]);
  const [outputsLoading, setOutputsLoading] = useState(false);
  const [outputsError, setOutputsError] = useState('');

  // ── Detail & Citation Modal ──
  const [selectedPubDetail, setSelectedPubDetail] = useState<LibraryPublicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // ── Registration / Edit Modal ──
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingPubId, setEditingPubId] = useState<string | null>(null);
  const [authorizedProjects, setAuthorizedProjects] = useState<ProjectSelectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formProjectId, setFormProjectId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formAuthors, setFormAuthors] = useState('');
  const [formType, setFormType] = useState<PublicationType>('JOURNAL_ARTICLE');
  const [formStatus, setFormStatus] = useState<PublicationStatus>('PUBLISHED');
  const [formVisibility, setFormVisibility] = useState<'PROJECT_ONLY' | 'CLINORA_RESEARCHERS'>('CLINORA_RESEARCHERS');
  const [formAbstract, setFormAbstract] = useState('');
  const [formMethodology, setFormMethodology] = useState('');
  const [formStudyDesign, setFormStudyDesign] = useState('');
  const [formAnalysisSummary, setFormAnalysisSummary] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formResearchField, setFormResearchField] = useState('');
  const [formJournal, setFormJournal] = useState('');
  const [formConference, setFormConference] = useState('');
  const [formDoi, setFormDoi] = useState('');
  const [formPublishedUrl, setFormPublishedUrl] = useState('');
  const [formDate, setFormDate] = useState('');
  const [selectedDatasetVersionIds, setSelectedDatasetVersionIds] = useState<string[]>([]);
  const [selectedEvaluationRunIds, setSelectedEvaluationRunIds] = useState<string[]>([]);

  // ── Fetch Published Research ──
  const loadPublishedResearch = useCallback(async () => {
    setPublishedLoading(true);
    setPublishedError('');
    try {
      const res = await researchApi.searchLibraryPublications({
        search: searchQuery.trim() || undefined,
        researchField: selectedField || undefined,
        publicationType: selectedType || undefined,
        year: selectedYear ? parseInt(selectedYear, 10) : undefined,
        page,
        size: 10,
      });
      setPublishedList(res.items);
      setTotalPages(res.totalPages);
      setTotalItems(res.totalItems);
    } catch (err: unknown) {
      setPublishedError(apiErrorMessage(err, 'Failed to load published research.'));
    } finally {
      setPublishedLoading(false);
    }
  }, [searchQuery, selectedField, selectedType, selectedYear, page]);

  // ── Fetch My Outputs ──
  const loadMyOutputs = useCallback(async () => {
    setOutputsLoading(true);
    setOutputsError('');
    try {
      const data = await researchApi.listMyResearchOutputs();
      setMyOutputs(data);
    } catch (err: unknown) {
      setOutputsError(apiErrorMessage(err, 'Failed to load your research outputs.'));
    } finally {
      setOutputsLoading(false);
    }
  }, []);

  // ── Fetch Authorized Projects ──
  const loadAuthorizedProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const projects = await researchApi.getAuthorizedProjectsForLibrary();
      setAuthorizedProjects(projects);
      if (projects.length > 0 && !formProjectId) {
        setFormProjectId(projects[0].id);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingProjects(false);
    }
  }, [formProjectId]);

  useEffect(() => {
    if (activeTab === 'published') {
      loadPublishedResearch();
    } else {
      loadMyOutputs();
    }
  }, [activeTab, loadPublishedResearch, loadMyOutputs]);

  // ── Open Detail Modal ──
  const handleOpenDetail = async (pubId: string) => {
    setDetailLoading(true);
    try {
      const detail = await researchApi.getLibraryPublicationDetail(pubId);
      setSelectedPubDetail(detail);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to load publication details.'));
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Open Register Modal ──
  const handleOpenRegister = async () => {
    resetForm();
    setEditingPubId(null);
    setIsRegisterModalOpen(true);
    await loadAuthorizedProjects();
  };

  // ── Open Edit Modal ──
  const handleOpenEdit = async (pubId: string) => {
    setDetailLoading(true);
    try {
      const detail = await researchApi.getMyResearchOutputDetail(pubId);
      await loadAuthorizedProjects();
      setEditingPubId(pubId);
      setFormProjectId(detail.projectId);
      setFormTitle(detail.title);
      setFormAuthors(detail.authors || '');
      setFormType(detail.publicationType);
      setFormStatus(detail.status);
      setFormVisibility(detail.libraryVisibility);
      setFormAbstract(detail.abstractText || '');
      setFormMethodology(detail.methodologySummary || '');
      setFormStudyDesign(detail.studyDesign || '');
      setFormAnalysisSummary(detail.analysisSummary || '');
      setFormKeywords(detail.keywords || '');
      setFormResearchField(detail.researchField || '');
      setFormJournal(detail.journal || '');
      setFormConference(detail.conference || '');
      setFormDoi(detail.doi || '');
      setFormPublishedUrl(detail.publishedUrl || '');
      setFormDate(detail.publicationDate || '');
      setSelectedDatasetVersionIds(detail.datasetProvenance.map((d) => d.datasetVersionId));
      setSelectedEvaluationRunIds(detail.evaluationProvenance.map((e) => e.evaluationRunId));
      setIsRegisterModalOpen(true);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to load output for editing.'));
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Submit Form ──
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!formMethodology.trim()) {
      setFormError('Methodology Summary is required.');
      return;
    }
    if (!formAuthors.trim()) {
      setFormError('Authors are required.');
      return;
    }
    if (!editingPubId && !formProjectId) {
      setFormError('Linked Research Project is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      if (editingPubId) {
        const payload: UpdateResearchOutputPayload = {
          title: formTitle.trim(),
          abstractText: formAbstract.trim() || undefined,
          publicationType: formType,
          status: formStatus,
          libraryVisibility: formVisibility,
          methodologySummary: formMethodology.trim(),
          studyDesign: formStudyDesign.trim() || undefined,
          analysisSummary: formAnalysisSummary.trim() || undefined,
          keywords: formKeywords.trim() || undefined,
          authors: formAuthors.trim(),
          researchField: formResearchField.trim() || undefined,
          doi: formDoi.trim() || undefined,
          journal: formJournal.trim() || undefined,
          conference: formConference.trim() || undefined,
          publicationDate: formDate || undefined,
          publishedUrl: formPublishedUrl.trim() || undefined,
          linkedDatasetVersionIds: selectedDatasetVersionIds,
          linkedEvaluationRunIds: selectedEvaluationRunIds,
        };
        await researchApi.updateResearchOutput(editingPubId, payload);
      } else {
        const payload: RegisterResearchOutputPayload = {
          projectId: formProjectId,
          title: formTitle.trim(),
          abstractText: formAbstract.trim() || undefined,
          publicationType: formType,
          status: formStatus,
          libraryVisibility: formVisibility,
          methodologySummary: formMethodology.trim(),
          studyDesign: formStudyDesign.trim() || undefined,
          analysisSummary: formAnalysisSummary.trim() || undefined,
          keywords: formKeywords.trim() || undefined,
          authors: formAuthors.trim(),
          researchField: formResearchField.trim() || undefined,
          doi: formDoi.trim() || undefined,
          journal: formJournal.trim() || undefined,
          conference: formConference.trim() || undefined,
          publicationDate: formDate || undefined,
          publishedUrl: formPublishedUrl.trim() || undefined,
          linkedDatasetVersionIds: selectedDatasetVersionIds,
          linkedEvaluationRunIds: selectedEvaluationRunIds,
        };
        await researchApi.registerResearchOutput(payload);
      }

      setIsRegisterModalOpen(false);
      resetForm();
      if (activeTab === 'my-outputs') {
        loadMyOutputs();
      } else {
        loadPublishedResearch();
      }
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err, 'Failed to save research output.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Delete Output ──
  const handleDeleteOutput = async (pubId: string) => {
    if (!window.confirm('Are you sure you want to remove this research output?')) return;
    try {
      await researchApi.deleteResearchOutput(pubId);
      setMyOutputs((prev) => prev.filter((p) => p.id !== pubId));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to delete research output.'));
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormAuthors('');
    setFormType('JOURNAL_ARTICLE');
    setFormStatus('PUBLISHED');
    setFormVisibility('CLINORA_RESEARCHERS');
    setFormAbstract('');
    setFormMethodology('');
    setFormStudyDesign('');
    setFormAnalysisSummary('');
    setFormKeywords('');
    setFormResearchField('');
    setFormJournal('');
    setFormConference('');
    setFormDoi('');
    setFormPublishedUrl('');
    setFormDate('');
    setSelectedDatasetVersionIds([]);
    setSelectedEvaluationRunIds([]);
    setFormError('');
  };

  const copyToClipboard = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const currentProject = authorizedProjects.find((p) => p.id === formProjectId);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">Clinora Library</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Discover published research produced from Clinora Research projects.
              </p>
            </div>
          </div>
        </div>

        {/* Global Register Output Button */}
        <Button
          onClick={handleOpenRegister}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs px-4 py-2 self-start md:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Register Research Output
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-800/80 pb-px text-sm font-medium">
        <button
          onClick={() => setActiveTab('published')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'published'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Published Research
          {totalItems > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 ml-1">
              {totalItems}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('my-outputs')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
            activeTab === 'my-outputs'
              ? 'border-cyan-400 text-cyan-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          My Research Outputs
          {myOutputs.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-300 ml-1">
              {myOutputs.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Published Research */}
      {activeTab === 'published' && (
        <div className="space-y-6">
          {/* Search & Filter Controls */}
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search papers, authors, keywords..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <select
                value={selectedField}
                onChange={(e) => {
                  setSelectedField(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Research Fields</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Oncology">Oncology</option>
                <option value="Neurology">Neurology</option>
                <option value="Genomics">Genomics</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Immunology">Immunology</option>
                <option value="Infectious Diseases">Infectious Diseases</option>
                <option value="Pulmonology">Pulmonology</option>
              </select>
            </div>

            <div>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Publication Types</option>
                <option value="JOURNAL_ARTICLE">Journal Article</option>
                <option value="CONFERENCE_PAPER">Conference Paper</option>
                <option value="PREPRINT">Preprint</option>
                <option value="BOOK_CHAPTER">Book Chapter</option>
                <option value="REPORT">Report</option>
                <option value="THESIS">Thesis</option>
              </select>
            </div>

            <div>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
              </select>
            </div>
          </div>

          {/* Results List */}
          {publishedLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs">Loading published Clinora research...</p>
            </div>
          ) : publishedError ? (
            <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{publishedError}</span>
            </div>
          ) : publishedList.length === 0 ? (
            <div className="py-20 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center text-center px-4">
              <BookOpen className="w-10 h-10 text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No published Clinora research matches your filters.</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Try adjusting your search criteria or register a research output from your approved studies.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {publishedList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 hover:border-slate-700/80 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.researchField && (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                            {item.researchField}
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-slate-800 text-slate-300">
                          {item.publicationType.replace(/_/g, ' ')}
                        </span>
                        {item.venue && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <span className="font-medium text-slate-300">{item.venue}</span>
                            {item.publicationYear ? ` · ${item.publicationYear}` : ''}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer"
                          onClick={() => handleOpenDetail(item.id)}>
                        {item.title}
                      </h3>

                      <p className="text-xs font-medium text-cyan-200/90 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>{item.authors}</span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDetail(item.id)}
                        className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800 h-8"
                      >
                        View details
                      </Button>

                      {(item.doi || item.publishedUrl) && (
                        <a
                          href={item.publishedUrl || `https://doi.org/${item.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 hover:bg-cyan-900/60 transition-colors h-8"
                        >
                          <span>Open paper</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Methodology Snippet */}
                  {item.methodologySummary && (
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs text-slate-300 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Methodology:
                      </span>
                      <p className="line-clamp-2 text-slate-300/90">{item.methodologySummary}</p>
                    </div>
                  )}

                  {/* Safe Clinora Provenance */}
                  <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-400">
                    <span className="font-semibold text-slate-400">Clinora Provenance:</span>
                    <span className="text-slate-300">
                      Project: <span className="text-cyan-300 font-medium">{item.projectTitle}</span>
                    </span>

                    {item.datasetProvenance.map((ds) => (
                      <span
                        key={ds.datasetVersionId}
                        className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300"
                      >
                        Dataset: {ds.datasetDisplayName} (v{ds.versionNumber})
                      </span>
                    ))}

                    {item.evaluationProvenance.map((ev) => (
                      <span
                        key={ev.evaluationRunId}
                        className="px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/60 text-[11px] text-purple-300"
                      >
                        AI: {ev.modelName} ({ev.modelVersion})
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Server-Side Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
                  <span>
                    Page {page} of {totalPages} ({totalItems} papers)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || publishedLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="text-xs h-8"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages || publishedLoading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="text-xs h-8"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Research Outputs */}
      {activeTab === 'my-outputs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Manage scientific publications and draft research outputs originating from your studies.
            </p>
            <Button
              onClick={handleOpenRegister}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Register Output
            </Button>
          </div>

          {outputsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <LoaderCircle className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs">Loading your outputs...</p>
            </div>
          ) : outputsError ? (
            <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{outputsError}</span>
            </div>
          ) : myOutputs.length === 0 ? (
            <div className="py-20 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center text-center px-4 space-y-3">
              <Layers className="w-10 h-10 text-slate-600 mb-1" />
              <h3 className="text-sm font-semibold text-slate-300">You have not registered any research outputs yet.</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Link approved project results, dataset versions, and AI model evaluation runs into peer-reviewed or preprint metadata.
              </p>
              <Button
                onClick={handleOpenRegister}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs mt-2"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Register research output
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Title &amp; Authors</th>
                      <th className="py-3 px-4">Linked Project</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Updated</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {myOutputs.map((out) => (
                      <tr key={out.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-medium">
                          <div className="text-slate-100 font-semibold">{out.title}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{out.authors}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{out.projectTitle}</td>
                        <td className="py-3 px-4 text-slate-400">{out.publicationType.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                              out.status === 'PUBLISHED'
                                ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-300'
                                : out.status === 'ACCEPTED'
                                  ? 'bg-cyan-950/80 border border-cyan-800/60 text-cyan-300'
                                  : out.status === 'SUBMITTED'
                                    ? 'bg-amber-950/80 border border-amber-800/60 text-amber-300'
                                    : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {out.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(out.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {out.status === 'DRAFT' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(out.id)}
                                className="text-[11px] text-amber-300 border-amber-800/60 hover:bg-amber-950/30 h-7"
                              >
                                Continue editing
                              </Button>
                            )}

                            {out.status === 'SUBMITTED' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenDetail(out.id)}
                                className="text-[11px] text-slate-300 border-slate-700 hover:bg-slate-800 h-7"
                              >
                                Open output
                              </Button>
                            )}

                            {out.status === 'ACCEPTED' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(out.id)}
                                className="text-[11px] text-cyan-300 border-cyan-800/60 hover:bg-cyan-950/30 h-7"
                              >
                                Update publication
                              </Button>
                            )}

                            {out.status === 'PUBLISHED' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenDetail(out.id)}
                                className="text-[11px] text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/30 h-7"
                              >
                                View in Library
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(out.id)}
                              className="text-slate-400 hover:text-slate-200 h-7 px-2"
                              title="Edit Output"
                            >
                              Edit
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteOutput(out.id)}
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-7 px-2"
                              title="Delete Output"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal 1: Publication Detail & Citations ── */}
      {selectedPubDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-200 space-y-6 shadow-2xl my-8">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                    {selectedPubDetail.publicationType.replace(/_/g, ' ')}
                  </span>
                  {selectedPubDetail.researchField && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                      {selectedPubDetail.researchField}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{selectedPubDetail.status}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-100">{selectedPubDetail.title}</h2>
                <p className="text-xs font-medium text-cyan-300">{selectedPubDetail.authors}</p>
                {selectedPubDetail.venue && (
                  <p className="text-xs text-slate-400">
                    {selectedPubDetail.venue}{selectedPubDetail.publicationDate ? ` · ${selectedPubDetail.publicationDate}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedPubDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* External Links */}
            {(selectedPubDetail.doi || selectedPubDetail.publishedUrl) && (
              <div className="flex items-center gap-4 text-xs">
                {selectedPubDetail.doi && (
                  <div>
                    <span className="text-slate-400">DOI: </span>
                    <a
                      href={`https://doi.org/${selectedPubDetail.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      {selectedPubDetail.doi}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {selectedPubDetail.publishedUrl && (
                  <div>
                    <a
                      href={selectedPubDetail.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      Published Paper URL
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Abstract */}
            {selectedPubDetail.abstractText && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Abstract</h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                  {selectedPubDetail.abstractText}
                </p>
              </div>
            )}

            {/* Methodology */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Methodology &amp; Study Design</h4>
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-3 text-xs">
                {selectedPubDetail.methodologySummary && (
                  <div>
                    <span className="font-semibold text-slate-300">Methodology Summary: </span>
                    <p className="text-slate-400 mt-0.5">{selectedPubDetail.methodologySummary}</p>
                  </div>
                )}
                {selectedPubDetail.studyDesign && (
                  <div>
                    <span className="font-semibold text-slate-300">Study Design: </span>
                    <span className="text-slate-400">{selectedPubDetail.studyDesign}</span>
                  </div>
                )}
                {selectedPubDetail.analysisSummary && (
                  <div>
                    <span className="font-semibold text-slate-300">Analysis Summary: </span>
                    <p className="text-slate-400 mt-0.5">{selectedPubDetail.analysisSummary}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Safe Clinora Provenance */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clinora Provenance</h4>
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs space-y-2">
                <div>
                  <span className="text-slate-400">Research Project: </span>
                  <span className="text-cyan-300 font-medium">{selectedPubDetail.projectTitle}</span>
                </div>
                {selectedPubDetail.datasetProvenance.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-slate-400">Linked Approved Dataset Version(s):</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedPubDetail.datasetProvenance.map((ds) => (
                        <span
                          key={ds.datasetVersionId}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300"
                        >
                          {ds.datasetDisplayName} · Version {ds.versionNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPubDetail.evaluationProvenance.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-slate-400">Linked AI Model Evaluation(s):</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedPubDetail.evaluationProvenance.map((ev) => (
                        <span
                          key={ev.evaluationRunId}
                          className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-800/60 text-xs text-purple-300"
                        >
                          {ev.modelName} (v{ev.modelVersion}) · {ev.taskType} [{ev.status}]
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Citations Box */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Generate Citations</h4>
              </div>

              <div className="space-y-2">
                {/* APA */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-300 font-mono select-all">
                    <span className="font-semibold text-cyan-400 mr-2">APA:</span>
                    {selectedPubDetail.citations?.apa}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedPubDetail.citations?.apa || '', 'apa')}
                    className="text-xs text-slate-400 hover:text-cyan-300 shrink-0 h-7"
                  >
                    {copiedFormat === 'apa' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                {/* IEEE */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-300 font-mono select-all">
                    <span className="font-semibold text-cyan-400 mr-2">IEEE:</span>
                    {selectedPubDetail.citations?.ieee}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedPubDetail.citations?.ieee || '', 'ieee')}
                    className="text-xs text-slate-400 hover:text-cyan-300 shrink-0 h-7"
                  >
                    {copiedFormat === 'ieee' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                {/* BibTeX */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-300 font-mono select-all truncate">
                    <span className="font-semibold text-cyan-400 mr-2">BibTeX:</span>
                    {selectedPubDetail.citations?.bibtex.replace(/\n/g, ' ')}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedPubDetail.citations?.bibtex || '', 'bibtex')}
                    className="text-xs text-slate-400 hover:text-cyan-300 shrink-0 h-7"
                  >
                    {copiedFormat === 'bibtex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedPubDetail(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Register / Edit Research Output ── */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-200 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100">
                {editingPubId ? 'Edit Research Output' : 'Register Research Output'}
              </h2>
              <button
                onClick={() => {
                  setIsRegisterModalOpen(false);
                  resetForm();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Linked Project Select */}
              {!editingPubId && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Linked Research Project *
                  </label>
                  {loadingProjects ? (
                    <p className="text-slate-500">Loading authorized projects...</p>
                  ) : authorizedProjects.length === 0 ? (
                    <p className="text-amber-400">You must own or contribute to at least one project.</p>
                  ) : (
                    <select
                      value={formProjectId}
                      onChange={(e) => {
                        setFormProjectId(e.target.value);
                        setSelectedDatasetVersionIds([]);
                        setSelectedEvaluationRunIds([]);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                      required
                    >
                      {authorizedProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Title & Output Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Genomic Markers in Early Disease Prediction"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Output Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PublicationType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="JOURNAL_ARTICLE">Journal Article</option>
                    <option value="CONFERENCE_PAPER">Conference Paper</option>
                    <option value="PREPRINT">Preprint</option>
                    <option value="BOOK_CHAPTER">Book Chapter</option>
                    <option value="REPORT">Report</option>
                    <option value="THESIS">Thesis</option>
                  </select>
                </div>
              </div>

              {/* Status & Library Visibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Status *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PublicationStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="PUBLISHED">PUBLISHED (Discoverable in Library)</option>
                    <option value="ACCEPTED">ACCEPTED (In Press)</option>
                    <option value="SUBMITTED">SUBMITTED (Under Peer Review)</option>
                    <option value="DRAFT">DRAFT (Drafting)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Library Visibility</label>
                  <select
                    value={formVisibility}
                    onChange={(e) => setFormVisibility(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CLINORA_RESEARCHERS">CLINORA_RESEARCHERS (Global Discovery)</option>
                    <option value="PROJECT_ONLY">PROJECT_ONLY (Private to Project Team)</option>
                  </select>
                </div>
              </div>

              {/* Authors & Research Field */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Authors *</label>
                  <input
                    type="text"
                    value={formAuthors}
                    onChange={(e) => setFormAuthors(e.target.value)}
                    placeholder="e.g. Dr. Alice Smith, Dr. Robert Johnson"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Research Field</label>
                  <input
                    type="text"
                    value={formResearchField}
                    onChange={(e) => setFormResearchField(e.target.value)}
                    placeholder="e.g. Cardiology, Oncology, AI Diagnostics"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Methodology Summary * */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Methodology Summary *
                </label>
                <textarea
                  value={formMethodology}
                  onChange={(e) => setFormMethodology(e.target.value)}
                  rows={2}
                  placeholder="Summarize the experimental or analytical protocol used..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Study Design & Analysis Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Study Design</label>
                  <input
                    type="text"
                    value={formStudyDesign}
                    onChange={(e) => setFormStudyDesign(e.target.value)}
                    placeholder="e.g. Retrospective cohort, Multi-center trial"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Analysis Summary</label>
                  <input
                    type="text"
                    value={formAnalysisSummary}
                    onChange={(e) => setFormAnalysisSummary(e.target.value)}
                    placeholder="e.g. Cox proportional hazards, Logistic regression"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Abstract */}
              <div>
                <label className="block text-slate-400 font-medium mb-1">Abstract</label>
                <textarea
                  value={formAbstract}
                  onChange={(e) => setFormAbstract(e.target.value)}
                  rows={2}
                  placeholder="Abstract text..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Provenance Select: Dataset Versions */}
              {currentProject && currentProject.datasetVersions.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300">Link Approved Dataset Version(s):</span>
                  <div className="space-y-1">
                    {currentProject.datasetVersions.map((dv) => {
                      const isChecked = selectedDatasetVersionIds.includes(dv.id);
                      return (
                        <label key={dv.id} className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDatasetVersionIds((prev) => [...prev, dv.id]);
                              } else {
                                setSelectedDatasetVersionIds((prev) => prev.filter((id) => id !== dv.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                          />
                          <span>
                            {dv.datasetName} (Version {dv.versionNumber})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Provenance Select: AI Evaluation Runs */}
              {currentProject && currentProject.evaluationRuns.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300">Link AI Model Evaluation Run(s):</span>
                  <div className="space-y-1">
                    {currentProject.evaluationRuns.map((er) => {
                      const isChecked = selectedEvaluationRunIds.includes(er.id);
                      return (
                        <label key={er.id} className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEvaluationRunIds((prev) => [...prev, er.id]);
                              } else {
                                setSelectedEvaluationRunIds((prev) => prev.filter((id) => id !== er.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                          />
                          <span>
                            {er.modelId} (v{er.modelVersion}) — {er.taskType}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Venue, DOI, URL & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Journal or Conference</label>
                  <input
                    type="text"
                    value={formJournal || formConference}
                    onChange={(e) => {
                      setFormJournal(e.target.value);
                      setFormConference(e.target.value);
                    }}
                    placeholder="e.g. Nature Medicine or ICML 2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Publication Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">DOI</label>
                  <input
                    type="text"
                    value={formDoi}
                    onChange={(e) => setFormDoi(e.target.value)}
                    placeholder="e.g. 10.1038/s41586-026-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Published Paper Link</label>
                  <input
                    type="url"
                    value={formPublishedUrl}
                    onChange={(e) => setFormPublishedUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsRegisterModalOpen(false);
                    resetForm();
                  }}
                  disabled={formSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-4"
                >
                  {formSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </span>
                  ) : editingPubId ? (
                    'Update Output'
                  ) : (
                    'Register Output'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
