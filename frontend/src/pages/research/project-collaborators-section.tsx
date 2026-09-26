import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  FileCheck,
  Info,
  Lock,
  LoaderCircle,
  MailPlus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type {
  InvitationStatus,
  ProjectMemberRole,
  ResearchProjectInvitation,
  ResearchProjectMember,
  ResearcherDirectoryEntry,
} from '../../features/research/research-types';

interface ProjectCollaboratorsSectionProps {
  projectId: string;
  projectStatus: string;
  isOwner: boolean;
  ownerUserId: string;
  ownerDisplayName: string;
}

function isTeamLocked(status: string): boolean {
  return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
}

function isTeamReadOnly(status: string): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'ARCHIVED' ||
    status === 'REJECTED' ||
    status === 'WITHDRAWN'
  );
}

function getRoleBadge(role: ProjectMemberRole) {
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
}

function getInvitationStatusBadge(status: InvitationStatus) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-950/60 text-yellow-300 border border-yellow-800">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800">
          <CheckCircle2 className="w-3 h-3" />
          Accepted
        </span>
      );
    case 'DECLINED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-950/60 text-red-300 border border-red-800">
          <XCircle className="w-3 h-3" />
          Declined
        </span>
      );
    case 'REVOKED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          <XCircle className="w-3 h-3" />
          Revoked
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-500 border border-slate-700">
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const colors = [
    'bg-cyan-900 text-cyan-300',
    'bg-purple-900 text-purple-300',
    'bg-amber-900 text-amber-300',
    'bg-emerald-900 text-emerald-300',
    'bg-rose-900 text-rose-300',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${sz} ${color} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ width: size === 'sm' ? 28 : 36, height: size === 'sm' ? 28 : 36, fontSize: size === 'sm' ? 10 : 12 }}
    >
      <div className="rounded-full flex items-center justify-center font-bold w-full h-full">
        {getInitials(name)}
      </div>
    </div>
  );
}

export function ProjectCollaboratorsSection({
  projectId,
  projectStatus,
  isOwner,
  ownerUserId,
  ownerDisplayName,
}: ProjectCollaboratorsSectionProps) {
  const [members, setMembers] = useState<ResearchProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ResearchProjectInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Invite modal state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ResearcherDirectoryEntry[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResearcher, setSelectedResearcher] = useState<ResearcherDirectoryEntry | null>(null);
  const [proposedRole, setProposedRole] = useState<ProjectMemberRole>('CO_RESEARCHER');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teamLocked = isTeamLocked(projectStatus);
  const teamReadOnly = isTeamReadOnly(projectStatus);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [membersData, invitationsData] = await Promise.all([
        researchApi.listProjectMembers(projectId),
        isOwner ? researchApi.listProjectInvitations(projectId) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load team data.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, isOwner]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced researcher search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await researchApi.searchResearchers(searchQuery, projectId);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, projectId]);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResearcher) {
      setModalError('Please select a researcher from the directory.');
      return;
    }
    setInviteSubmitting(true);
    setModalError('');
    try {
      const inv = await researchApi.sendInvitation(projectId, {
        inviteeUserId: selectedResearcher.userId,
        proposedRole,
        message: inviteMessage.trim() || undefined,
      });
      setInvitations((prev) => [inv, ...prev]);
      closeInviteModal();
    } catch (err: unknown) {
      setModalError(apiErrorMessage(err, 'Failed to send invitation.'));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Revoke this pending invitation?')) return;
    try {
      await researchApi.revokeInvitation(projectId, invitationId);
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: 'REVOKED' as InvitationStatus } : i)),
      );
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to revoke invitation.'));
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

  const handleRemoveMember = async (memberId: string, displayName: string) => {
    if (
      !window.confirm(
        `Remove ${displayName} from this research project?\n\nThis will also revoke any active dataset access grants for this researcher.`,
      )
    )
      return;
    try {
      await researchApi.removeProjectMember(projectId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to remove member.'));
    }
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResearcher(null);
    setProposedRole('CO_RESEARCHER');
    setInviteMessage('');
    setModalError('');
  };

  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING');
  const otherInvitations = invitations.filter((i) => i.status !== 'PENDING');

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-slate-100">Team & Collaboration</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage project participation and project-scoped permissions.
          </p>
        </div>
        {isOwner && !teamLocked && !teamReadOnly && (
          <Button
            onClick={() => { setModalError(''); setIsInviteModalOpen(true); }}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs self-start sm:self-auto"
            id="invite-collaborator-btn"
          >
            <MailPlus className="w-3.5 h-3.5 mr-1.5" />
            Invite Collaborator
          </Button>
        )}
      </div>

      {/* Project Status Lock Banner */}
      {teamLocked && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-800/60 bg-amber-950/20 text-amber-300 text-xs">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-200">Team changes are temporarily locked</p>
            <p className="text-amber-400 mt-0.5">
              This project is currently under governance review ({projectStatus.replace('_', ' ')}). Team
              membership is frozen to keep the reviewed team stable. Changes resume after review completes.
            </p>
          </div>
        </div>
      )}

      {teamReadOnly && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/20 text-slate-400 text-xs">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Team membership is read-only for {projectStatus.toLowerCase()} projects.</p>
        </div>
      )}

      {/* Security Scope Banner */}
      <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <span className="text-slate-200 font-medium">Project membership ≠ dataset access. </span>
            Accepting an invitation grants project-level access only. Clinical dataset downloads require a
            separate authorization.
          </p>
          <p className="text-slate-500 text-[11px]">
            <strong className="text-slate-400">OWNER</strong> — manages project, team &amp; governance submissions &nbsp;|&nbsp;
            <strong className="text-slate-400">CO_RESEARCHER</strong> — contributes to work, cohorts &amp; analyses &nbsp;|&nbsp;
            <strong className="text-slate-400">SUPERVISOR</strong> — reviews methodology &amp; outputs &nbsp;|&nbsp;
            <strong className="text-slate-400">VIEWER</strong> — read-only access
          </p>
        </div>
      </div>

      {/* Loading / Error */}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate-400 text-xs gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Loading team...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Project Owner */}
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Project Owner</p>
            <div className="flex items-center gap-3 py-2.5">
              <Avatar name={ownerDisplayName} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{ownerDisplayName}</span>
                  {getRoleBadge('OWNER')}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Principal Investigator</p>
              </div>
            </div>
          </div>

          {/* Active Collaborators */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Active Collaborators ({members.filter(m => m.userId !== ownerUserId).length})
              </p>
            </div>
            {members.filter(m => m.userId !== ownerUserId).length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-800 rounded-xl">
                No active collaborators yet.{' '}
                {isOwner && !teamLocked && !teamReadOnly && (
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Invite a researcher
                  </button>
                )}
              </p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {members
                  .filter((m) => m.userId !== ownerUserId)
                  .map((member) => (
                    <div key={member.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.userDisplayName} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-200">{member.userDisplayName}</span>
                            {getRoleBadge(member.role)}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {isOwner && !teamLocked && !teamReadOnly && (
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
                            onClick={() => handleRemoveMember(member.id, member.userDisplayName)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 h-7 w-7 p-0"
                            title="Remove Collaborator"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {isOwner && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Pending Invitations ({pendingInvitations.length})
              </p>
              {pendingInvitations.length === 0 ? (
                <p className="text-xs text-slate-600 py-2">No pending invitations.</p>
              ) : (
                <div className="space-y-2">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-yellow-900/40 bg-yellow-950/10"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={inv.inviteeDisplayName} size="sm" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-200">{inv.inviteeDisplayName}</span>
                            {getInvitationStatusBadge(inv.status)}
                            <span className="text-[10px] text-slate-500">as {inv.proposedRole.replace('_', ' ')}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Invited {new Date(inv.invitedAt).toLocaleDateString()} · Expires{' '}
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {!teamLocked && !teamReadOnly && (
                        <Button
                          variant="ghost"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 h-7 text-[10px] px-2 shrink-0"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Resolved Invitations */}
              {otherInvitations.length > 0 && (
                <details className="mt-3">
                  <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400 select-none">
                    Show {otherInvitations.length} resolved invitation(s)
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    {otherInvitations.slice(0, 5).map((inv) => (
                      <div key={inv.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-slate-900/30 border border-slate-800/40">
                        <span className="text-xs text-slate-400">{inv.inviteeDisplayName}</span>
                        {getInvitationStatusBadge(inv.status)}
                        <span className="text-[10px] text-slate-600 ml-auto">{new Date(inv.invitedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Invite Collaborator Modal ─────────────────────────────────────────── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MailPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-semibold text-slate-100">Invite Collaborator</h3>
              </div>
              <button onClick={closeInviteModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dataset access clarification */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-400">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <p>
                <strong className="text-slate-200">Note:</strong> Accepting this invitation grants project-level
                access only. Clinical dataset access is controlled separately and is not granted by this invitation.
              </p>
            </div>

            <form onSubmit={handleSendInvitation} className="space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Researcher Search */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Search Verified Researchers
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Type researcher name (min. 2 characters)..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedResearcher && e.target.value !== selectedResearcher.displayName) {
                        setSelectedResearcher(null);
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600 text-xs"
                    id="researcher-search-input"
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-cyan-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Only approved Clinora Researchers with active accounts are shown.
                </p>

                {/* Search Results */}
                {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500 text-center py-2">
                    No matching researchers found.
                  </p>
                )}
                {searchResults.length > 0 && !selectedResearcher && (
                  <div className="mt-2 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
                    {searchResults.map((r) => (
                      <button
                        key={r.userId}
                        type="button"
                        onClick={() => {
                          setSelectedResearcher(r);
                          setSearchQuery(r.displayName);
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3 py-2.5 bg-slate-950/60 hover:bg-slate-800/60 transition-colors flex items-center gap-3"
                        id={`researcher-result-${r.userId}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {r.initials}
                        </div>
                        <span className="text-slate-200 text-xs font-medium">{r.displayName}</span>
                        <span className="ml-auto text-[10px] text-cyan-400">Select</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected researcher */}
                {selectedResearcher && (
                  <div className="mt-2 flex items-center gap-3 p-2.5 rounded-xl border border-cyan-700/60 bg-cyan-950/20">
                    <div className="w-8 h-8 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {selectedResearcher.initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-cyan-200">{selectedResearcher.displayName}</p>
                      <p className="text-[10px] text-cyan-500">Verified Researcher</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedResearcher(null); setSearchQuery(''); }}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Project Role */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Project Role *</label>
                <select
                  value={proposedRole}
                  onChange={(e) => setProposedRole(e.target.value as ProjectMemberRole)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                  id="invitation-role-select"
                >
                  <option value="CO_RESEARCHER">Co-Researcher — contributes to cohorts, analyses &amp; evaluations</option>
                  <option value="SUPERVISOR">Supervisor — advisory review of methodology &amp; outputs</option>
                  <option value="VIEWER">Viewer — read-only access to project content</option>
                </select>
              </div>

              {/* Optional Message */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Optional message <span className="text-slate-600 font-normal">(max 500 chars)</span>
                </label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="e.g. I'd like you to collaborate on the statistical analysis phase..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 resize-none placeholder-slate-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeInviteModal} className="text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={inviteSubmitting || !selectedResearcher}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
                  id="send-invitation-btn"
                >
                  {inviteSubmitting ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <MailPlus className="w-3.5 h-3.5 mr-1.5" />
                      Send Invitation
                    </>
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
