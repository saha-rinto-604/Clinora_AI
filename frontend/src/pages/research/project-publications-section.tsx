import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Plus,
  Quote,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  CreatePublicationPayload,
  PublicationType,
  ResearchPublication,
} from '../../features/research/research-types';

interface ProjectPublicationsSectionProps {
  projectId: string;
  isOwnerOrCollaborator: boolean;
}

export function ProjectPublicationsSection({
  projectId,
  isOwnerOrCollaborator,
}: ProjectPublicationsSectionProps) {
  const [publications, setPublications] = useState<ResearchPublication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [citationModalPub, setCitationModalPub] = useState<ResearchPublication | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAbstract, setFormAbstract] = useState('');
  const [formType, setFormType] = useState<PublicationType>('JOURNAL_ARTICLE');
  const [formDoi, setFormDoi] = useState('');
  const [formJournal, setFormJournal] = useState('');
  const [formConference, setFormConference] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadPublications = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await researchApi.listPublications(projectId);
      setPublications(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load project publications.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  const handleRegisterPublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Publication title is required.');
      return;
    }
    setSubmitting(true);
    setFormError('');

    try {
      const payload: CreatePublicationPayload = {
        title: formTitle.trim(),
        abstractText: formAbstract.trim() || undefined,
        publicationType: formType,
        doi: formDoi.trim() || undefined,
        journal: formJournal.trim() || undefined,
        conference: formConference.trim() || undefined,
        publicationDate: formDate || undefined,
        externalUrl: formExternalUrl.trim() || undefined,
      };

      const created = await researchApi.createPublication(projectId, payload);
      setPublications((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      setFormError(apiErrorMessage(err, 'Failed to register publication.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePublication = async (pubId: string) => {
    if (!window.confirm('Delete this publication record?')) return;
    try {
      await researchApi.deletePublication(projectId, pubId);
      setPublications((prev) => prev.filter((p) => p.id !== pubId));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to delete publication.'));
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormAbstract('');
    setFormType('JOURNAL_ARTICLE');
    setFormDoi('');
    setFormJournal('');
    setFormConference('');
    setFormDate('');
    setFormExternalUrl('');
    setFormError('');
  };

  const copyToClipboard = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatName);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Publications &amp; Scientific Outputs (Phase R15)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track published peer-reviewed papers, conference proceedings, preprints, and generate APA, IEEE, and BibTeX citations.
          </p>
        </div>

        {isOwnerOrCollaborator && (
          <Button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Register Publication
          </Button>
        )}
      </div>

      {/* Publications List */}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate-400 text-xs gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Loading publications...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : publications.length === 0 ? (
        <div className="py-8 text-center">
          <BookOpen className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <div className="text-xs font-medium text-slate-300">No publications registered yet</div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
            Record journal papers, preprints, or symposium presentations derived from this research project.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {publications.map((pub) => (
            <div
              key={pub.id}
              className="py-4 flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-emerald-300 border border-slate-700">
                    {pub.publicationType.replace('_', ' ')}
                  </span>
                  {pub.publicationDate && (
                    <span className="text-xs text-slate-400">
                      {new Date(pub.publicationDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-slate-100 hover:text-emerald-300 transition-colors">
                  {pub.title}
                </h3>

                {(pub.journal || pub.conference) && (
                  <div className="text-xs text-slate-400 italic">
                    {pub.journal || pub.conference}
                  </div>
                )}

                {pub.abstractText && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {pub.abstractText}
                  </p>
                )}

                {pub.doi && (
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 pt-1">
                    <span className="text-slate-500">DOI:</span>
                    <a
                      href={`https://doi.org/${pub.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      {pub.doi}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0 self-start">
                <Button
                  variant="secondary"
                  onClick={() => setCitationModalPub(pub)}
                  className="text-xs py-1 px-3 h-auto border border-slate-700 hover:border-slate-600 flex items-center gap-1.5"
                >
                  <Quote className="w-3.5 h-3.5 text-emerald-400" />
                  Cite
                </Button>

                {isOwnerOrCollaborator && (
                  <Button
                    variant="ghost"
                    onClick={() => handleDeletePublication(pub.id)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-7 w-7 p-0"
                    title="Delete Publication"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Publication Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-100">Register Scientific Publication</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterPublication} className="space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deep Learning in Early Diabetic Retinopathy Detection"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Publication Type *</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PublicationType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="JOURNAL_ARTICLE">Journal Article</option>
                    <option value="CONFERENCE_PAPER">Conference Paper</option>
                    <option value="PREPRINT">Preprint</option>
                    <option value="BOOK_CHAPTER">Book Chapter</option>
                    <option value="REPORT">Technical Report</option>
                    <option value="THESIS">Thesis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Publication Date</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Journal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. The Lancet Digital Health"
                    value={formJournal}
                    onChange={(e) => setFormJournal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Conference Name</label>
                  <input
                    type="text"
                    placeholder="e.g. IEEE BHI 2026"
                    value={formConference}
                    onChange={(e) => setFormConference(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">DOI</label>
                  <input
                    type="text"
                    placeholder="e.g. 10.1016/j.clinora.2026.04.012"
                    value={formDoi}
                    onChange={(e) => setFormDoi(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">External URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formExternalUrl}
                    onChange={(e) => setFormExternalUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Abstract</label>
                <textarea
                  rows={3}
                  placeholder="Summary of findings and clinical methodology..."
                  value={formAbstract}
                  onChange={(e) => setFormAbstract(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Register Output'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Citation Formats Modal */}
      {citationModalPub && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Quote className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-100">Export Citation Formats</h3>
              </div>
              <button
                onClick={() => setCitationModalPub(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* APA */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                    APA 7th Edition
                  </span>
                  <button
                    onClick={() => copyToClipboard(citationModalPub.citations.apa, 'APA')}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                  >
                    {copiedFormat === 'APA' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedFormat === 'APA' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] leading-relaxed">
                  {citationModalPub.citations.apa}
                </div>
              </div>

              {/* IEEE */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                    IEEE
                  </span>
                  <button
                    onClick={() => copyToClipboard(citationModalPub.citations.ieee, 'IEEE')}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                  >
                    {copiedFormat === 'IEEE' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedFormat === 'IEEE' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] leading-relaxed">
                  {citationModalPub.citations.ieee}
                </div>
              </div>

              {/* BibTeX */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                    BibTeX
                  </span>
                  <button
                    onClick={() => copyToClipboard(citationModalPub.citations.bibtex, 'BibTeX')}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                  >
                    {copiedFormat === 'BibTeX' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedFormat === 'BibTeX' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px] overflow-x-auto whitespace-pre">
                  {citationModalPub.citations.bibtex}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setCitationModalPub(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
