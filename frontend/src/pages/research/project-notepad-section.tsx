import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  FileText,
  Plus,
  History,
  MessageSquare,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Undo2,
  Redo2,
  Lock,
  Search,
  Users,
  Database,
  BrainCircuit,
  AlertCircle,
  Download,
  Share2,
  Trash2,
  Sparkles,
  Check,
  ChevronRight,
  Shield,
  Eye,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { researchApi } from '../../features/research/research-api';
import type {
  ResearchDocumentSummary,
  ResearchDocumentDetail,
  ResearchDocumentRevision,
  ResearchDocumentComment,
  ResearchDocumentType,
  SafeDatasetReference,
  SafeAIEvaluationReference,
} from '../../features/research/research-types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/form';

interface ProjectNotepadSectionProps {
  projectId: string;
  isOwner: boolean;
  canEdit: boolean; // OWNER, CO_RESEARCHER, or SUPERVISOR
  currentUserId: string;
  currentUserName: string;
}

const DOCUMENT_TYPE_LABELS: Record<ResearchDocumentType, string> = {
  PAPER_DRAFT: 'Paper Draft',
  METHODOLOGY: 'Methodology',
  ANALYSIS_NOTES: 'Analysis Notes',
  GENERAL: 'General',
};

const DOCUMENT_TYPE_COLORS: Record<ResearchDocumentType, string> = {
  PAPER_DRAFT: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60',
  METHODOLOGY: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
  ANALYSIS_NOTES: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  GENERAL: 'bg-slate-800/60 text-slate-300 border-slate-700/60',
};

export function ProjectNotepadSection({
  projectId,
  isOwner,
  canEdit,
  currentUserId,
  currentUserName,
}: ProjectNotepadSectionProps) {
  // Document list state
  const [documents, setDocuments] = useState<ResearchDocumentSummary[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [currentDoc, setCurrentDoc] = useState<ResearchDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ResearchDocumentType>('PAPER_DRAFT');
  const [includeTemplate, setIncludeTemplate] = useState(true);

  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<ResearchDocumentRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<ResearchDocumentRevision | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ResearchDocumentComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const [showReferencesModal, setShowReferencesModal] = useState(false);
  const [safeDatasets, setSafeDatasets] = useState<SafeDatasetReference[]>([]);
  const [safeEvaluations, setSafeEvaluations] = useState<SafeAIEvaluationReference[]>([]);

  // Autosave status: 'saved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeDocIdRef = useRef<string | null>(null);

  // Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-cyan-400 underline underline-offset-2 hover:text-cyan-300',
        },
      }),
    ],
    editable: canEdit && !currentDoc?.archived,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none focus:outline-none min-h-[380px] p-6 text-slate-200 text-sm leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      if (!currentDoc || currentDoc.archived || !canEdit) return;
      setSaveStatus('saving');
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          const content = JSON.stringify(editor.getJSON());
          await researchApi.updateDocument(projectId, currentDoc.id, {
            contentJson: content,
          });
          setSaveStatus('saved');
        } catch (err) {
          console.error('Autosave error', err);
          setSaveStatus('error');
        }
      }, 1500);
    },
  });

  // Fetch document list
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await researchApi.listDocuments(projectId);
      setDocuments(docs);
      if (docs.length > 0 && !activeDocIdRef.current) {
        setSelectedDocId(docs[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load research documents');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load selected document detail
  useEffect(() => {
    if (!selectedDocId) {
      setCurrentDoc(null);
      activeDocIdRef.current = null;
      return;
    }

    activeDocIdRef.current = selectedDocId;
    let isCancelled = false;

    const fetchDoc = async () => {
      try {
        setLoadingDoc(true);
        const doc = await researchApi.getDocument(projectId, selectedDocId);
        if (isCancelled) return;
        setCurrentDoc(doc);
        if (editor) {
          try {
            const parsed = JSON.parse(doc.contentJson);
            editor.commands.setContent(parsed);
          } catch {
            editor.commands.setContent(doc.contentJson || '');
          }
          editor.setEditable(canEdit && !doc.archived);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.response?.data?.message || 'Unable to load document details');
        }
      } finally {
        if (!isCancelled) setLoadingDoc(false);
      }
    };

    fetchDoc();
    return () => {
      isCancelled = true;
    };
  }, [selectedDocId, projectId, editor, canEdit]);

  // Create new document
  const handleCreateDocument = async () => {
    if (!newTitle.trim()) return;

    let initialContent = '{"type":"doc","content":[{"type":"paragraph"}]}';
    if (includeTemplate) {
      if (newType === 'PAPER_DRAFT') {
        initialContent = JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: newTitle.trim() }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Abstract' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Provide an executive summary of research findings, scientific methodologies, and clinical outcomes.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Methodology & Study Protocol' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Describe dataset inclusion/exclusion criteria, cohort parameters, and statistical validation.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Results & Evaluation' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Document model inference metrics, confusion matrix results, and clinical efficacy comparisons.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conclusion & Next Steps' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Key takeaways and peer-review publication readiness.' }] },
          ],
        });
      } else if (newType === 'METHODOLOGY') {
        initialContent = JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: newTitle.trim() }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Study Design & Objectives' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Define the clinical objectives, primary endpoints, and hypothesis under investigation.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'De-identification & Governance Controls' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Record privacy tiers, differential privacy mechanisms, and IRB compliance protocols.' }] },
          ],
        });
      }
    }

    try {
      const created = await researchApi.createDocument(projectId, {
        title: newTitle.trim(),
        documentType: newType,
        contentJson: initialContent,
      });
      setShowCreateModal(false);
      setNewTitle('');
      await loadDocuments();
      setSelectedDocId(created.id);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create document');
    }
  };

  // Archive document
  const handleArchive = async () => {
    if (!currentDoc || !isOwner) return;
    if (!confirm(`Are you sure you want to archive "${currentDoc.title}"? It will become permanently read-only.`)) return;
    try {
      const updated = await researchApi.archiveDocument(projectId, currentDoc.id);
      setCurrentDoc(updated);
      if (editor) editor.setEditable(false);
      await loadDocuments();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to archive document');
    }
  };

  // Version History
  const openHistory = async () => {
    if (!currentDoc) return;
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      const revs = await researchApi.listDocumentRevisions(projectId, currentDoc.id);
      setRevisions(revs);
      setSelectedRevision(revs[0] || null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to load revision history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    if (!currentDoc || !canEdit) return;
    if (!confirm(`Restore Version ${versionNumber}? A new revision will be created preserving full history.`)) return;
    try {
      const updated = await researchApi.restoreDocumentRevision(projectId, currentDoc.id, versionNumber);
      setCurrentDoc(updated);
      if (editor) {
        try {
          editor.commands.setContent(JSON.parse(updated.contentJson));
        } catch {
          editor.commands.setContent(updated.contentJson);
        }
      }
      setShowHistory(false);
      await loadDocuments();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to restore revision');
    }
  };

  // Comments
  const openComments = async () => {
    if (!currentDoc) return;
    setShowComments(!showComments);
    if (!showComments) {
      setLoadingComments(true);
      try {
        const comms = await researchApi.listDocumentComments(projectId, currentDoc.id);
        setComments(comms);
      } catch (err: any) {
        console.error('Failed to load comments', err);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async () => {
    if (!currentDoc || !newCommentText.trim()) return;
    try {
      const created = await researchApi.addDocumentComment(projectId, currentDoc.id, {
        content: newCommentText.trim(),
      });
      setComments((prev) => [...prev, created]);
      setNewCommentText('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add comment');
    }
  };

  const handleToggleResolveComment = async (comment: ResearchDocumentComment) => {
    if (!currentDoc) return;
    try {
      const updated = await researchApi.resolveDocumentComment(
        projectId,
        currentDoc.id,
        comment.id,
        !comment.resolved,
      );
      setComments((prev) => prev.map((c) => (c.id === comment.id ? updated : c)));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update comment');
    }
  };

  // Safe Reference Insertion
  const openReferences = async () => {
    setShowReferencesModal(true);
    try {
      const [ds, ev] = await Promise.all([
        researchApi.getSafeDatasetReferences(projectId),
        researchApi.getSafeEvaluationReferences(projectId),
      ]);
      setSafeDatasets(ds);
      setSafeEvaluations(ev);
    } catch (err) {
      console.error('Failed to load references', err);
    }
  };

  const insertReferenceChip = (text: string) => {
    if (!editor || !canEdit || currentDoc?.archived) return;
    editor.chain().focus().insertContent(` [${text}] `).run();
    setShowReferencesModal(false);
  };

  // Export document
  const handleExportText = () => {
    if (!currentDoc || !editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentDoc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesType = filterType === 'ALL' || doc.documentType === filterType;
      const matchesQuery =
        !searchQuery.trim() ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.createdByName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [documents, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Research Notepad
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-mono">
                  Collaborative Workspace
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Write paper drafts, study protocols, and clinical methodology notes in real time with project collaborators.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-md shadow-cyan-500/20"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Document
              </Button>
            )}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs text-slate-400">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Research workspace only — do not enter identifiable patient information.</span>
        </div>
      </div>

      {/* Main Grid: Document List & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Document Sidebar (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Documents ({filteredDocs.length})
            </span>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs bg-slate-950/60 border-slate-800"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['ALL', 'PAPER_DRAFT', 'METHODOLOGY', 'ANALYSIS_NOTES', 'GENERAL'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                    filterType === type
                      ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 border border-transparent'
                  }`}
                >
                  {type === 'ALL' ? 'All' : DOCUMENT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Document Items List */}
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading documents...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                <FileText className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                <p className="font-semibold text-slate-400">No research documents yet.</p>
                <p className="text-[11px] mt-1">Create a document to start writing with your team.</p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-200 truncate flex-1">{doc.title}</h4>
                      {doc.archived ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 shrink-0">
                          Archived
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
                            DOCUMENT_TYPE_COLORS[doc.documentType]
                          }`}
                        >
                          {DOCUMENT_TYPE_LABELS[doc.documentType]}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Edited by {doc.lastEditedByName || doc.createdByName}</span>
                      <span>v{doc.revisionCount}</span>
                    </div>

                    {/* Contributor list */}
                    {doc.contributors && doc.contributors.length > 0 && (
                      <div className="mt-2 flex items-center gap-1">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {doc.contributors.slice(0, 3).map((contrib) => (
                            <div
                              key={contrib.userId}
                              title={contrib.name}
                              className="w-4 h-4 rounded-full bg-cyan-900 border border-slate-900 text-[8px] flex items-center justify-center font-bold text-cyan-200"
                            >
                              {contrib.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                        {doc.contributors.length > 3 && (
                          <span className="text-[9px] text-slate-500">+{doc.contributors.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Document Editor Area (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800/80 rounded-2xl backdrop-blur-sm flex flex-col overflow-hidden">
          {loadingDoc ? (
            <div className="p-24 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              <span>Loading document workspace...</span>
            </div>
          ) : !currentDoc ? (
            <div className="p-24 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
              <FileText className="w-8 h-8 text-slate-600" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-300">No document selected</p>
                <p className="text-[11px] text-slate-500">Select a document from the left or create a new one.</p>
              </div>
              {canEdit && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  variant="secondary"
                  className="mt-2 text-xs border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create First Document
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Document Header Bar */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-100">{currentDoc.title}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          DOCUMENT_TYPE_COLORS[currentDoc.documentType]
                        }`}
                      >
                        {DOCUMENT_TYPE_LABELS[currentDoc.documentType]}
                      </span>
                      {currentDoc.archived && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Read-Only (Archived)
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Created by <strong className="text-slate-300 font-medium">{currentDoc.createdByName}</strong></span>
                      <span>•</span>
                      <span>Last edited by <strong className="text-slate-300 font-medium">{currentDoc.lastEditedByName}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-cyan-400" />
                        Contributors: {currentDoc.contributors.map((c) => c.name).join(', ') || currentDoc.createdByName}
                      </span>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Autosave status indicator */}
                    <div className="text-[10px] font-mono flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                      {saveStatus === 'saving' ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                          <span className="text-cyan-400">Saving...</span>
                        </>
                      ) : saveStatus === 'error' ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          <span className="text-rose-400">Save failed</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-slate-400">Saved</span>
                        </>
                      )}
                    </div>

                    {/* Version history button */}
                    <Button
                      onClick={openHistory}
                      variant="ghost"
                      className="text-xs text-slate-300 hover:text-slate-100 p-2"
                      title="Version History"
                    >
                      <History className="w-3.5 h-3.5 mr-1" />
                      <span className="hidden sm:inline">History</span>
                    </Button>

                    {/* Comments button */}
                    <Button
                      onClick={openComments}
                      variant="ghost"
                      className={`text-xs p-2 ${
                        showComments ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-300 hover:text-slate-100'
                      }`}
                      title="Comments"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />
                      <span className="hidden sm:inline">Comments</span>
                    </Button>

                    {/* Export text button */}
                    <Button
                      onClick={handleExportText}
                      variant="ghost"
                      className="text-xs text-slate-300 hover:text-slate-100 p-2"
                      title="Export Text"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>

                    {/* Archive button (Owner only) */}
                    {isOwner && !currentDoc.archived && (
                      <Button
                        onClick={handleArchive}
                        variant="ghost"
                        className="text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 p-2"
                        title="Archive Document"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Rich Text Editor Toolbar */}
              {canEdit && !currentDoc.archived && editor && (
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-950/80 border-b border-slate-800/80 text-xs">
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('heading', { level: 1 }) ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Heading 1"
                  >
                    <Heading1 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('heading', { level: 2 }) ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Heading 2"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('heading', { level: 3 }) ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Heading 3"
                  >
                    <Heading3 className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-4 bg-slate-800 mx-1" />

                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('bold') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('italic') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('underline') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Underline"
                  >
                    <UnderlineIcon className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-4 bg-slate-800 mx-1" />

                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('bulletList') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Bullet List"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('orderedList') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Numbered List"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('blockquote') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Blockquote"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-4 bg-slate-800 mx-1" />

                  <button
                    onClick={() => {
                      const url = prompt('Enter link URL:');
                      if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                      }
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      editor.isActive('link') ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Insert Link"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Insert Dataset / AI Eval reference */}
                  <button
                    onClick={openReferences}
                    className="p-1.5 rounded text-cyan-400 hover:bg-cyan-950/40 flex items-center gap-1 transition-colors text-[11px] font-medium"
                    title="Insert Study Provenance Reference"
                  >
                    <Sparkles className="w-3 h-3" />
                    Reference Link
                  </button>

                  <div className="w-px h-4 bg-slate-800 mx-1" />

                  <button
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400"
                    title="Undo"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400"
                    title="Redo"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Editor Workspace Container */}
              <div className="relative min-h-[460px] bg-slate-950/20">
                <EditorContent editor={editor} />
              </div>

              {/* Comments Sidebar (Overlay Drawer) */}
              {showComments && (
                <div className="border-t border-slate-800/80 p-4 bg-slate-950/90 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                      Document Comments ({comments.length})
                    </h4>
                    <button
                      onClick={() => setShowComments(false)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {loadingComments ? (
                      <p className="text-xs text-slate-500">Loading comments...</p>
                    ) : comments.length === 0 ? (
                      <p className="text-xs text-slate-500">No comments yet. Start a discussion on this draft.</p>
                    ) : (
                      comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                            comment.resolved
                              ? 'bg-slate-900/30 border-slate-800/40 opacity-70'
                              : 'bg-slate-900/80 border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-300">{comment.authorName}</span>
                            <button
                              onClick={() => handleToggleResolveComment(comment)}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                comment.resolved
                                  ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60'
                              }`}
                            >
                              {comment.resolved ? 'Reopen' : 'Resolve'}
                            </button>
                          </div>

                          <p className="text-slate-300 text-xs">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {canEdit && !currentDoc.archived && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a comment or peer review note..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        className="text-xs bg-slate-900 border-slate-800"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment();
                        }}
                      />
                      <Button
                        onClick={handleAddComment}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold shrink-0"
                      >
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Create Research Document
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Document Title</label>
                <Input
                  placeholder="e.g. Clinical Trial Protocol v2, Biomarker Analysis..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Document Category</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ResearchDocumentType)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="PAPER_DRAFT">Paper Draft</option>
                  <option value="METHODOLOGY">Study Methodology</option>
                  <option value="ANALYSIS_NOTES">Analysis &amp; Evaluation Notes</option>
                  <option value="GENERAL">General Scientific Note</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="includeTemplate"
                  checked={includeTemplate}
                  onChange={(e) => setIncludeTemplate(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="includeTemplate" className="text-xs text-slate-300">
                  Pre-populate with scientific paper structure (Abstract, Methods, Results)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-slate-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDocument}
                disabled={!newTitle.trim()}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
              >
                Create Document
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Drawer Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                Version History — {currentDoc?.title}
              </h3>
              <Button
                variant="ghost"
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </Button>
            </div>

            {loadingHistory ? (
              <div className="p-12 text-center text-xs text-slate-500">Loading version history...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto">
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Revisions ({revisions.length})
                  </span>
                  {revisions.map((rev) => {
                    const isSelected = selectedRevision?.revisionNumber === rev.revisionNumber;
                    return (
                      <button
                        key={rev.id}
                        onClick={() => setSelectedRevision(rev)}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition-colors ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                            : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200">Version {rev.revisionNumber}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] mt-1 text-slate-300">Edited by {rev.editorName}</p>
                        {rev.changeSummary && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">{rev.changeSummary}</p>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  {selectedRevision ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">
                            Version {selectedRevision.revisionNumber}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            {new Date(selectedRevision.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {canEdit && !currentDoc?.archived && (
                          <Button
                            onClick={() => handleRestoreVersion(selectedRevision.revisionNumber)}
                            variant="secondary"
                            className="text-[11px] py-1 h-7 border-cyan-800 text-cyan-300 hover:bg-cyan-950"
                          >
                            Restore Version
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 font-mono bg-slate-900/80 p-3 rounded border border-slate-800 max-h-64 overflow-y-auto">
                        {selectedRevision.contentJson}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 text-center m-auto">
                      Select a revision on the left to inspect its snapshot.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insert Reference Modal */}
      {showReferencesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Insert Study Reference
              </h3>
              <Button
                variant="ghost"
                onClick={() => setShowReferencesModal(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </Button>
            </div>

            <p className="text-xs text-slate-400">
              Insert safe provenance references into your paper or methodology draft.
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              <div>
                <span className="text-xs font-semibold text-cyan-400 block mb-1">Approved Datasets</span>
                {safeDatasets.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No active datasets found.</p>
                ) : (
                  safeDatasets.map((ds) => (
                    <button
                      key={ds.id}
                      onClick={() => insertReferenceChip(`Dataset: ${ds.name} (${ds.version})`)}
                      className="w-full text-left p-2 rounded border border-slate-800 bg-slate-950 hover:bg-slate-900 text-xs flex items-center justify-between mb-1"
                    >
                      <span className="font-medium text-slate-200">{ds.name}</span>
                      <span className="text-[10px] text-slate-400">{ds.version}</span>
                    </button>
                  ))
                )}
              </div>

              <div>
                <span className="text-xs font-semibold text-cyan-400 block mb-1">AI Evaluation Runs</span>
                {safeEvaluations.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No completed AI evaluations found.</p>
                ) : (
                  safeEvaluations.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() =>
                        insertReferenceChip(
                          `AI Eval: ${ev.modelName} [Acc: ${(ev.accuracy ? ev.accuracy * 100 : 0).toFixed(1)}%]`,
                        )
                      }
                      className="w-full text-left p-2 rounded border border-slate-800 bg-slate-950 hover:bg-slate-900 text-xs flex items-center justify-between mb-1"
                    >
                      <span className="font-medium text-slate-200">{ev.modelName}</span>
                      <span className="text-[10px] text-slate-400">{ev.taskType}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
