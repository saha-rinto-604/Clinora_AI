import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  Save,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type { CreateProjectInput } from '../../features/research/research-types';

export function ResearchProjectFormPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const isEditing = Boolean(projectId);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CreateProjectInput>({
    title: '',
    objective: '',
    description: '',
    researchField: 'Cardiology',
    methodologySummary: '',
    institutionName: '',
    ethicsReference: '',
  });

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;

    async function loadProject() {
      setLoading(true);
      setError('');
      try {
        const project = await researchApi.getProject(projectId!);
        if (!project.editable) {
          setError(`This project is in status "${project.status}" and can no longer be edited.`);
          return;
        }
        setFormData({
          title: project.title,
          objective: project.objective,
          description: project.description || '',
          researchField: project.researchField,
          methodologySummary: project.methodologySummary || '',
          institutionName: project.institutionName || '',
          ethicsReference: project.ethicsReference || '',
        });
      } catch (err: unknown) {
        setError(apiErrorMessage(err, 'Failed to load project details.'));
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Study title is required.');
      return;
    }
    if (!formData.objective.trim()) {
      setError('Research objective is required.');
      return;
    }
    if (!formData.researchField.trim()) {
      setError('Research field is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && projectId) {
        const updated = await researchApi.updateProject(projectId, formData);
        navigate(`/research/projects/${updated.id}`);
      } else {
        const created = await researchApi.createProject(formData);
        navigate(`/research/projects/${created.id}`);
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to save research project.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-400 gap-3">
        <LoaderCircle className="w-6 h-6 animate-spin text-cyan-400" />
        <span>Loading study form...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Link
          to={isEditing ? `/research/projects/${projectId}` : '/research/projects'}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            {isEditing ? 'Edit Research Study Protocol' : 'Draft New Research Study'}
          </h1>
          <p className="text-xs text-slate-400">
            Projects begin in Draft status with zero data privileges. Submit for administrative review once complete.
          </p>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-6 sm:p-8 space-y-6"
      >
        {/* Study Title */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Study Title <span className="text-cyan-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={255}
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Longitudinal Cardiovascular Risk & Lipid Markers Study"
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Research Field & Institution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="field" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Research Field <span className="text-cyan-400">*</span>
            </label>
            <input
              id="field"
              type="text"
              required
              maxLength={120}
              value={formData.researchField}
              onChange={(e) => setFormData({ ...formData, researchField: e.target.value })}
              placeholder="e.g. Cardiology, Oncology, Endocrinology"
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="institution" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Primary Institution
            </label>
            <input
              id="institution"
              type="text"
              maxLength={255}
              value={formData.institutionName}
              onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
              placeholder="e.g. University Hospital Research Lab"
              className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>

        {/* Ethics & IRB Reference */}
        <div className="space-y-1.5">
          <label htmlFor="ethics" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Ethics / IRB Protocol Reference Number
          </label>
          <input
            id="ethics"
            type="text"
            maxLength={120}
            value={formData.ethicsReference}
            onChange={(e) => setFormData({ ...formData, ethicsReference: e.target.value })}
            placeholder="e.g. IRB-2026-MED-0941"
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Objective */}
        <div className="space-y-1.5">
          <label htmlFor="objective" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Research Objective <span className="text-cyan-400">*</span>
          </label>
          <textarea
            id="objective"
            required
            rows={3}
            value={formData.objective}
            onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
            placeholder="State the primary research hypotheses and clinical objectives..."
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Methodology Summary */}
        <div className="space-y-1.5">
          <label htmlFor="methodology" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Methodology Summary
          </label>
          <textarea
            id="methodology"
            rows={3}
            value={formData.methodologySummary}
            onChange={(e) => setFormData({ ...formData, methodologySummary: e.target.value })}
            placeholder="Describe the study methodology, statistical frameworks, and analytical models..."
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Description / Background */}
        <div className="space-y-1.5">
          <label htmlFor="desc" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Detailed Description
          </label>
          <textarea
            id="desc"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Additional context, funding disclosures, or clinical background..."
            className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <Link to={isEditing ? `/research/projects/${projectId}` : '/research/projects'}>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
          >
            {submitting ? (
              <LoaderCircle className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            {isEditing ? 'Save Changes' : 'Create Draft Project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
