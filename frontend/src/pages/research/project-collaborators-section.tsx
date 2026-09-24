import {
  AlertCircle,
  Crown,
  Eye,
  FileCheck,
  LoaderCircle,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  AddMemberPayload,
  ProjectMemberRole,
  ResearchProjectMember,
} from '../../features/research/research-types';

interface ProjectCollaboratorsSectionProps {
  projectId: string;
  isOwner: boolean;
}

export function ProjectCollaboratorsSection({ projectId, isOwner }: ProjectCollaboratorsSectionProps) {
  const [members, setMembers] = useState<ResearchProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add modal form state
  const [userIdInput, setUserIdInput] = useState('');
  const [roleInput, setRoleInput] = useState<ProjectMemberRole>('CO_RESEARCHER');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadMembers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await researchApi.listProjectMembers(projectId);
      setMembers(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load project collaborators.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdInput.trim()) {
      setModalError('Target User UUID is required.');
      return;
    }
    setSubmitting(true);
    setModalError('');

    try {
      const payload: AddMemberPayload = {
        userId: userIdInput.trim(),
        role: roleInput,
      };
      const created = await researchApi.addProjectMember(projectId, payload);
      setMembers((prev) => [...prev, created]);
      setIsAddModalOpen(false);
      setUserIdInput('');
      setRoleInput('CO_RESEARCHER');
    } catch (err: unknown) {
      setModalError(apiErrorMessage(err, 'Failed to add collaborator.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectMemberRole) => {
    try {
      const updated = await researchApi.updateProjectMemberRole(projectId, memberId, { role: newRole });
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to update member role.'));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm('Remove this collaborator from the research project?')) return;
    try {
      await researchApi.removeProjectMember(projectId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to remove member.'));
    }
  };

  const getRoleBadge = (role: ProjectMemberRole) => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800">
            <Crown className="w-3 h-3 text-amber-400" />
            Owner
          </span>
        );
      case 'CO_RESEARCHER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            Co-Researcher
          </span>
        );
      case 'SUPERVISOR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800">
            <FileCheck className="w-3 h-3 text-purple-400" />
            Supervisor
          </span>
        );
      case 'VIEWER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Eye className="w-3 h-3 text-slate-400" />
            Viewer
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">Project Collaboration Team (Phase R14)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Project-scoped permission roles governing protocol modifications, dataset requests, and benchmarks.
          </p>
        </div>

        {isOwner && (
          <Button
            onClick={() => {
              setModalError('');
              setIsAddModalOpen(true);
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Add Collaborator
          </Button>
        )}
      </div>

      {/* Role Explainer Banner */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="text-slate-200 font-medium">Project Permissions Scope:</span> All users remain globally{' '}
          <code className="text-cyan-300">ROLE_RESEARCHER</code>. Inside this project, members have granular
          permissions: <strong className="text-slate-300">OWNER</strong> (full administrative rights),{' '}
          <strong className="text-slate-300">CO_RESEARCHER</strong> (cohorts &amp; AI evals),{' '}
          <strong className="text-slate-300">SUPERVISOR</strong> (supervisory read/review), or{' '}
          <strong className="text-slate-300">VIEWER</strong> (read-only audit).
        </div>
      </div>

      {/* Team Member List */}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate-400 text-xs gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Loading team members...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : members.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">No additional collaborators registered.</div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {members.map((member) => (
            <div key={member.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                  <span>{member.userDisplayName}</span>
                  {getRoleBadge(member.role)}
                </div>
                <div className="text-xs text-slate-400 font-mono">{member.userEmail}</div>
              </div>

              {/* Actions */}
              {isOwner && member.role !== 'OWNER' && (
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value as ProjectMemberRole)}
                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CO_RESEARCHER">Co-Researcher</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>

                  <Button
                    variant="ghost"
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-7 w-7 p-0"
                    title="Remove Collaborator"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-semibold text-slate-100">Add Team Collaborator</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">User UUID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Enter the researcher user account UUID.</span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Project Role *</label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as ProjectMemberRole)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CO_RESEARCHER">Co-Researcher (Full collaboration &amp; evaluation)</option>
                  <option value="SUPERVISOR">Supervisor (Advisory review)</option>
                  <option value="VIEWER">Viewer (Read-only audit)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Adding...
                    </>
                  ) : (
                    'Add Member'
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
