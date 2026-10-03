import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Eye,
  FileCheck,
  FileText,
  FolderGit2,
  History,
  Info,
  Lock,
  LoaderCircle,
  MailPlus,
  MessageSquare,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { researchApi } from '../../features/research/research-api';
import type {
  InvitationStatus,
  ProjectActivityItem,
  ProjectMemberRole,
  ResearchNote,
  ResearchNoteComment,
  ResearchNoteStatus,
  ResearchProjectFile,
  ResearchProjectFileVersion,
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
  return status === 'COMPLETED' || status === 'ARCHIVED' || status === 'REJECTED' || status === 'WITHDRAWN';
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          Declined
        </span>
      );
    case 'REVOKED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800">
          Revoked
        </span>
      );
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 text-slate-500 border border-slate-800">
          Expired
        </span>
      );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
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
      <div className="rounded-full flex items-center justify-center font-bold w-full h-full">{getInitials(name)}</div>
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
  const user = useAuthStore((state) => state.user);
  const [workspaceTab, setWorkspaceTab] = useState<'members' | 'notes' | 'files' | 'activity'>('members');

  // ─── Members State ────────────────────────────────────────────────────────
  const [members, setMembers] = useState<ResearchProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ResearchProjectInvitation[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');
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

  // ─── Research Notes State ──────────────────────────────────────────────────
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ResearchNote | null>(null);
  const [noteForm, setNoteForm] = useState<{
    title: string;
    content: string;
    status: ResearchNoteStatus;
    pinned: boolean;
  }>({
    title: '',
    content: '',
    status: 'DRAFT',
    pinned: false,
  });
  const [savingNote, setSavingNote] = useState(false);

  // Comments state
  const [comments, setComments] = useState<ResearchNoteComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // ─── Files State ──────────────────────────────────────────────────────────
  const [files, setFiles] = useState<ResearchProjectFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileModalError, setFileModalError] = useState('');

  // Version modal state
  const [selectedFileForVersions, setSelectedFileForVersions] = useState<ResearchProjectFile | null>(null);
  const [fileVersions, setFileVersions] = useState<ResearchProjectFileVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // ─── Activity State ───────────────────────────────────────────────────────
  const [activity, setActivity] = useState<ProjectActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState('');

  // ─── Computed Permissions ─────────────────────────────────────────────────
  const teamLocked = isTeamLocked(projectStatus);
  const teamReadOnly = isTeamReadOnly(projectStatus);
  const canModifyTeam = isOwner && !teamLocked && !teamReadOnly;

  // Resolve user's project role
  const currentUserMember = members.find((m) => m.userId === user?.id);
  const userProjectRole: ProjectMemberRole = isOwner ? 'OWNER' : currentUserMember ? currentUserMember.role : 'VIEWER';

  const canCreateNote = isOwner || userProjectRole === 'CO_RESEARCHER';
  const canComment = isOwner || userProjectRole === 'CO_RESEARCHER' || userProjectRole === 'SUPERVISOR';
  const canUploadFile = isOwner || userProjectRole === 'CO_RESEARCHER';

  // ─── Loaders ──────────────────────────────────────────────────────────────
  const loadMembersData = useCallback(async () => {
    setLoadingMembers(true);
    setMemberError('');
    try {
      const membersData = await researchApi.listProjectMembers(projectId);
      setMembers(membersData);

      if (isOwner) {
        try {
          const invs = await researchApi.listProjectInvitations(projectId);
          setInvitations(invs);
        } catch {
          // ignore invitation list error
        }
      }
    } catch (err: unknown) {
      setMemberError(apiErrorMessage(err, 'Failed to load project team.'));
    } finally {
      setLoadingMembers(false);
    }
  }, [projectId, isOwner]);

  const loadNotesData = useCallback(async () => {
    setLoadingNotes(true);
    setNotesError('');
    try {
      const data = await researchApi.listNotes(projectId);
      setNotes(data);
    } catch (err: unknown) {
      setNotesError(apiErrorMessage(err, 'Failed to load research notes.'));
    } finally {
      setLoadingNotes(false);
    }
  }, [projectId]);

  const loadFilesData = useCallback(async () => {
    setLoadingFiles(true);
    setFilesError('');
    try {
      const data = await researchApi.listProjectFiles(projectId);
      setFiles(data);
    } catch (err: unknown) {
      setFilesError(apiErrorMessage(err, 'Failed to load project documents.'));
    } finally {
      setLoadingFiles(false);
    }
  }, [projectId]);

  const loadActivityData = useCallback(async () => {
    setLoadingActivity(true);
    setActivityError('');
    try {
      const data = await researchApi.getProjectActivity(projectId);
      setActivity(data);
    } catch (err: unknown) {
      setActivityError(apiErrorMessage(err, 'Failed to load activity history.'));
    } finally {
      setLoadingActivity(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMembersData();
  }, [loadMembersData]);

  useEffect(() => {
    if (workspaceTab === 'notes') loadNotesData();
    if (workspaceTab === 'files') loadFilesData();
    if (workspaceTab === 'activity') loadActivityData();
  }, [workspaceTab, loadNotesData, loadFilesData, loadActivityData]);

  // ─── Member Actions ───────────────────────────────────────────────────────
  const handleRoleChange = async (memberId: string, newRole: ProjectMemberRole) => {
    try {
      const updated = await researchApi.updateProjectMemberRole(projectId, memberId, { role: newRole });
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to update collaborator role.'));
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (
      !window.confirm(
        `Remove ${memberName} from this project? Any active dataset access grants for this member will also be revoked.`,
      )
    )
      return;
    try {
      await researchApi.removeProjectMember(projectId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to remove collaborator.'));
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Revoke this invitation? The invitee will no longer be able to accept.')) return;
    try {
      await researchApi.revokeInvitation(projectId, invitationId);
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: 'REVOKED' as InvitationStatus } : i)),
      );
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to revoke invitation.'));
    }
  };

  // Search researchers
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await researchApi.searchResearchers(searchQuery.trim(), projectId);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, projectId]);

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResearcher) {
      setModalError('Please search and select a verified researcher.');
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

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResearcher(null);
    setProposedRole('CO_RESEARCHER');
    setInviteMessage('');
    setModalError('');
  };

  // ─── Research Notes Actions ───────────────────────────────────────────────
  const openCreateNoteModal = () => {
    setEditingNote(null);
    setNoteForm({ title: '', content: '', status: 'DRAFT', pinned: false });
    setIsNoteModalOpen(true);
  };

  const openEditNoteModal = (note: ResearchNote) => {
    setEditingNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      status: note.status,
      pinned: note.pinned,
    });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteForm.title.trim() || !noteForm.content.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        const updated = await researchApi.updateNote(projectId, editingNote.id, noteForm);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        if (selectedNote?.id === updated.id) setSelectedNote(updated);
      } else {
        const created = await researchApi.createNote(projectId, noteForm);
        setNotes((prev) => [created, ...prev]);
      }
      setIsNoteModalOpen(false);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to save research note.'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePin = async (note: ResearchNote) => {
    try {
      const updated = await researchApi.togglePinNote(projectId, note.id);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      if (selectedNote?.id === updated.id) setSelectedNote(updated);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to update pin status.'));
    }
  };

  const handleArchiveNote = async (note: ResearchNote) => {
    if (!window.confirm(`Archive note "${note.title}"?`)) return;
    try {
      await researchApi.archiveNote(projectId, note.id);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      if (selectedNote?.id === note.id) setSelectedNote(null);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to archive note.'));
    }
  };

  const openNoteReader = async (note: ResearchNote) => {
    setSelectedNote(note);
    setLoadingComments(true);
    try {
      const cmts = await researchApi.listNoteComments(projectId, note.id);
      setComments(cmts);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote || !newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      const cmt = await researchApi.addNoteComment(projectId, selectedNote.id, newCommentText.trim());
      setComments((prev) => [...prev, cmt]);
      setNewCommentText('');
      setNotes((prev) => prev.map((n) => (n.id === selectedNote.id ? { ...n, commentCount: n.commentCount + 1 } : n)));
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to add comment.'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedNote || !window.confirm('Delete this comment?')) return;
    try {
      await researchApi.deleteNoteComment(projectId, selectedNote.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedNote.id ? { ...n, commentCount: Math.max(0, n.commentCount - 1) } : n)),
      );
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to delete comment.'));
    }
  };

  // ─── Files Actions ────────────────────────────────────────────────────────
  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) return;
    setUploading(true);
    setFileModalError('');
    try {
      const res = await researchApi.uploadProjectFile(
        projectId,
        selectedUploadFile,
        uploadDisplayName.trim() || undefined,
      );
      setFiles((prev) => [res, ...prev]);
      setIsFileModalOpen(false);
      setSelectedUploadFile(null);
      setUploadDisplayName('');
    } catch (err: unknown) {
      setFileModalError(apiErrorMessage(err, 'Failed to upload document.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (file: ResearchProjectFile, version?: number) => {
    try {
      const blob = await researchApi.downloadProjectFile(projectId, file.id, version);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.displayName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to download document.'));
    }
  };

  const openVersionsModal = async (file: ResearchProjectFile) => {
    setSelectedFileForVersions(file);
    setLoadingVersions(true);
    try {
      const vers = await researchApi.listProjectFileVersions(projectId, file.id);
      setFileVersions(vers);
    } catch {
      setFileVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleUploadNewVersion = async () => {
    if (!selectedFileForVersions || !newVersionFile) return;
    setUploadingVersion(true);
    try {
      const ver = await researchApi.uploadFileVersion(projectId, selectedFileForVersions.id, newVersionFile);
      setFileVersions((prev) => [ver, ...prev]);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === selectedFileForVersions.id
            ? { ...f, currentVersionNumber: ver.versionNumber, currentSizeBytes: ver.sizeBytes }
            : f,
        ),
      );
      setNewVersionFile(null);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to upload new version.'));
    } finally {
      setUploadingVersion(false);
    }
  };

  const handleArchiveFile = async (file: ResearchProjectFile) => {
    if (!window.confirm(`Archive document "${file.displayName}"?`)) return;
    try {
      await researchApi.archiveProjectFile(projectId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (selectedFileForVersions?.id === file.id) setSelectedFileForVersions(null);
    } catch (err: unknown) {
      alert(apiErrorMessage(err, 'Failed to archive document.'));
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Workspace Subtabs ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
          <button
            onClick={() => setWorkspaceTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              workspaceTab === 'members'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Members ({members.length + 1})
          </button>
          <button
            onClick={() => setWorkspaceTab('notes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              workspaceTab === 'notes'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Research Notes
          </button>
          <button
            onClick={() => setWorkspaceTab('files')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              workspaceTab === 'files'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            Files &amp; Documents
          </button>
          <button
            onClick={() => setWorkspaceTab('activity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              workspaceTab === 'activity'
                ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/80 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Activity
          </button>
        </div>

        {/* Dynamic Action Button based on tab */}
        <div>
          {workspaceTab === 'members' && canModifyTeam && (
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs py-1.5 px-3 h-auto"
              id="invite-collaborator-btn"
            >
              <MailPlus className="w-3.5 h-3.5 mr-1.5" />
              Invite Collaborator
            </Button>
          )}

          {workspaceTab === 'notes' && (
            <Button
              onClick={openCreateNoteModal}
              disabled={!canCreateNote}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs py-1.5 px-3 h-auto disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Note
            </Button>
          )}

          {workspaceTab === 'files' && (
            <Button
              onClick={() => setIsFileModalOpen(true)}
              disabled={!canUploadFile}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs py-1.5 px-3 h-auto disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* ─── TAB 1: MEMBERS ────────────────────────────────────────────────── */}
      {workspaceTab === 'members' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Status Lock Warning Banner */}
          {teamLocked && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-800/60 bg-amber-950/30 text-amber-300 text-xs">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold">Team changes locked during review:</span> This research project is
                currently <span className="font-mono uppercase">{projectStatus}</span>. Member additions, role updates,
                and removals are locked to ensure the research team remains stable during governance evaluation.
              </div>
            </div>
          )}

          {/* Dataset access disclaimer */}
          <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong className="text-slate-300">Security Notice:</strong> Project membership does not grant clinical
              dataset access. Dataset access is authorized separately through explicit DatasetAccessGrant approvals.
            </span>
          </div>

          {memberError && (
            <div className="p-3.5 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{memberError}</span>
            </div>
          )}

          {/* Team Table / Cards */}
          {loadingMembers ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
              <LoaderCircle className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-xs">Loading members...</span>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
              {/* Primary Owner Row */}
              <div className="p-4 flex items-center justify-between gap-4 bg-slate-950/30">
                <div className="flex items-center gap-3">
                  <Avatar name={ownerDisplayName} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{ownerDisplayName}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800">
                        <Crown className="w-2.5 h-2.5 text-amber-400" />
                        Primary Owner
                      </span>
                      {user?.id === ownerUserId && <span className="text-[10px] text-slate-500 font-mono">(You)</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Project Creator &amp; Principal Investigator</p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-mono">Full Authority</div>
              </div>

              {/* Active Collaborators */}
              {members.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <Users className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                  No additional collaborators yet. Invite verified researchers using the button above.
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.userDisplayName} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{member.userDisplayName}</span>
                          {getRoleBadge(member.role)}
                          {user?.id === member.userId && (
                            <span className="text-[10px] text-slate-500 font-mono">(You)</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Owner-only actions: Change role or remove */}
                    {canModifyTeam ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as ProjectMemberRole)}
                          className="px-2 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="CO_RESEARCHER">Co-Researcher</option>
                          <option value="SUPERVISOR">Supervisor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(member.id, member.userDisplayName)}
                          className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Remove member"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 font-mono">Member</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending Invitations (Owner View) */}
          {isOwner && invitations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Pending &amp; Recent Invitations
              </h3>
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
                {invitations.map((inv) => (
                  <div key={inv.id} className="p-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={inv.inviteeDisplayName} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-200">{inv.inviteeDisplayName}</span>
                          {getInvitationStatusBadge(inv.status)}
                          <span className="text-[10px] text-slate-500 font-mono">({inv.proposedRole})</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Invited {new Date(inv.invitedAt).toLocaleDateString()} • Expires{' '}
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {inv.status === 'PENDING' && canModifyTeam && (
                      <Button
                        variant="secondary"
                        onClick={() => handleRevokeInvitation(inv.id)}
                        className="text-[11px] py-1 px-2.5 h-auto text-rose-300 hover:text-rose-200 border-rose-900/50 hover:bg-rose-950/40"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: RESEARCH NOTES ─────────────────────────────────────────── */}
      {workspaceTab === 'notes' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5 px-1">
            <Shield className="w-3 h-3" />
            Research workspace only · Do not include identifiable patient information.
          </div>

          {notesError && (
            <div className="p-3 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{notesError}</span>
            </div>
          )}

          {loadingNotes ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
              <LoaderCircle className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-xs">Loading notes...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
              <FileText className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-xs font-medium text-slate-300">No research notes yet</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Use notes to document hypotheses, protocol observations, statistical methodology, and study milestones.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    note.pinned
                      ? 'bg-slate-900/80 border-cyan-800/60 shadow-lg shadow-cyan-950/10'
                      : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {note.pinned && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800">
                            <Pin className="w-2.5 h-2.5" />
                            Pinned
                          </span>
                        )}
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {note.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {canCreateNote && (
                          <button
                            onClick={() => handleTogglePin(note)}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300"
                            title={note.pinned ? 'Unpin note' : 'Pin note'}
                          >
                            {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {(isOwner || note.authorUserId === user?.id) && (
                          <button
                            onClick={() => openEditNoteModal(note)}
                            className="p-1 rounded text-slate-400 hover:text-slate-200"
                            title="Edit note"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(isOwner || note.authorUserId === user?.id) && (
                          <button
                            onClick={() => handleArchiveNote(note)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400"
                            title="Archive note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4
                      onClick={() => openNoteReader(note)}
                      className="text-sm font-semibold text-slate-100 hover:text-cyan-300 cursor-pointer line-clamp-1 transition-colors"
                    >
                      {note.title}
                    </h4>
                    <p
                      onClick={() => openNoteReader(note)}
                      className="text-xs text-slate-400 mt-1 line-clamp-3 cursor-pointer whitespace-pre-wrap"
                    >
                      {note.content}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={note.authorDisplayName} size="sm" />
                      <span className="truncate max-w-[120px]">{note.authorDisplayName}</span>
                      <span>•</span>
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => openNoteReader(note)}
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{note.commentCount}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: FILES & DOCUMENTS ──────────────────────────────────────── */}
      {workspaceTab === 'files' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="text-[10px] text-slate-500 font-medium px-1">
            Collaborative research artifacts are securely segregated from clinical datasets.
          </div>

          {filesError && (
            <div className="p-3 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{filesError}</span>
            </div>
          )}

          {loadingFiles ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
              <LoaderCircle className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-xs">Loading documents...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
              <FolderGit2 className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-xs font-medium text-slate-300">No project files uploaded yet</div>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Upload research protocols, ethics certificates, data dictionaries, analysis plans, or manuscript drafts.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
              {files.map((file) => (
                <div key={file.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100 truncate">{file.displayName}</span>
                        <button
                          onClick={() => openVersionsModal(file)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800 hover:bg-cyan-900/80 transition-colors shrink-0"
                          title="Click to view version history"
                        >
                          v{file.currentVersionNumber}
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{formatBytes(file.currentSizeBytes)}</span>
                        <span>•</span>
                        <span>Uploaded by {file.uploaderDisplayName}</span>
                        <span>•</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      onClick={() => handleDownloadFile(file)}
                      className="text-xs py-1 px-2.5 h-auto flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </Button>
                    <button
                      onClick={() => openVersionsModal(file)}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-cyan-300 transition-colors"
                      title="Version history"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    {(isOwner || file.uploadedByUserId === user?.id) && (
                      <button
                        onClick={() => handleArchiveFile(file)}
                        className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Archive file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: ACTIVITY FEED ──────────────────────────────────────────── */}
      {workspaceTab === 'activity' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Project Collaboration History
            </h3>
            <button onClick={loadActivityData} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
              Refresh
            </button>
          </div>

          {activityError && (
            <div className="p-3 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{activityError}</span>
            </div>
          )}

          {loadingActivity ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
              <LoaderCircle className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-xs">Loading activity stream...</span>
            </div>
          ) : activity.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
              No audit events recorded yet for this project.
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 flex items-start gap-3.5"
                >
                  <Avatar name={item.actorDisplayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200">{item.actorDisplayName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-300/90 mt-0.5 font-medium">{item.description}</p>
                    <span className="inline-block mt-1 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                      {item.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Note Reader Modal with Comments ─────────────────────────────────── */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                    {selectedNote.status}
                  </span>
                  {selectedNote.pinned && (
                    <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                      <Pin className="w-2.5 h-2.5" /> Pinned
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">{selectedNote.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  By {selectedNote.authorDisplayName} • {new Date(selectedNote.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Note Content */}
            <div className="overflow-y-auto max-h-[35vh] p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
              {selectedNote.content}
            </div>

            {/* Comments Thread */}
            <div className="flex-1 overflow-y-auto space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                Comments ({comments.length})
              </h4>

              {loadingComments ? (
                <div className="py-4 text-center text-xs text-slate-500">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  No comments yet. Start the discussion below.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-start gap-2.5"
                    >
                      <Avatar name={c.authorDisplayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200">{c.authorDisplayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {(isOwner || c.authorUserId === user?.id) && (
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-slate-500 hover:text-rose-400"
                                title="Delete comment"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Comment Input */}
            {canComment ? (
              <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Write a comment or methodology note..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-600"
                />
                <Button
                  type="submit"
                  disabled={submittingComment || !newCommentText.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs py-1.5 px-3"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Post
                </Button>
              </form>
            ) : (
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 text-center">
                Viewer role is read-only.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Create / Edit Note Modal ────────────────────────────────────────── */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">
                {editingNote ? 'Edit Research Note' : 'Create Research Note'}
              </h3>
              <button onClick={() => setIsNoteModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-300/90 flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Workspace only — do not include patient identifiable data.</span>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="e.g. Statistical Analysis Plan for Cohort A"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Content *</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Document research rationale, analytical steps, observations..."
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noteForm.pinned}
                      onChange={(e) => setNoteForm({ ...noteForm, pinned: e.target.checked })}
                      className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>Pin to top</span>
                  </label>

                  <select
                    value={noteForm.status}
                    onChange={(e) => setNoteForm({ ...noteForm, status: e.target.value as ResearchNoteStatus })}
                    className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="REVIEWED">REVIEWED</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingNote || !noteForm.title.trim() || !noteForm.content.trim()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
                  >
                    {savingNote ? 'Saving...' : editingNote ? 'Update Note' : 'Create Note'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Upload File Modal ───────────────────────────────────────────────── */}
      {isFileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">Upload Project Document</h3>
              <button onClick={() => setIsFileModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {fileModalError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileModalError}</span>
              </div>
            )}

            <form onSubmit={handleUploadFile} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select File *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedUploadFile(f);
                    if (f && !uploadDisplayName) {
                      setUploadDisplayName(f.name);
                    }
                  }}
                  className="w-full text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Accepted formats: PDF, DOCX, XLSX, CSV, JSON, TXT, Images. Max 50 MB.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Analysis Protocol v1.0"
                  value={uploadDisplayName}
                  onChange={(e) => setUploadDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setIsFileModalOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploading || !selectedUploadFile}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
                >
                  {uploading ? (
                    <>
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── File Version History Modal ──────────────────────────────────────── */}
      {selectedFileForVersions && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">{selectedFileForVersions.displayName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Version History &amp; Immutable Audit</p>
              </div>
              <button onClick={() => setSelectedFileForVersions(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingVersions ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading versions...</div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto divide-y divide-slate-800/60">
                {fileVersions.map((v) => (
                  <div key={v.id} className="pt-2.5 pb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-cyan-300">v{v.versionNumber}</span>
                        <span className="text-xs text-slate-300 font-medium">({formatBytes(v.sizeBytes)})</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Uploaded by {v.uploaderDisplayName} on {new Date(v.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => handleDownloadFile(selectedFileForVersions, v.versionNumber)}
                      className="text-[11px] py-1 px-2.5 h-auto flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload New Version Section */}
            {canUploadFile && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Upload New Version</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                    className="flex-1 text-slate-300 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200 cursor-pointer text-xs"
                  />
                  <Button
                    onClick={handleUploadNewVersion}
                    disabled={uploadingVersion || !newVersionFile}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs py-1.5 px-3 h-auto"
                  >
                    {uploadingVersion ? 'Uploading...' : 'Save Version'}
                  </Button>
                </div>
              </div>
            )}
          </div>
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

            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-400">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <p>
                <strong className="text-slate-200">Note:</strong> Accepting this invitation grants project-level access
                only. Clinical dataset access is controlled separately and is not granted by this invitation.
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
                <label className="block text-slate-300 font-semibold mb-1.5">Search Verified Researchers</label>
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

                {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-500 text-center py-2">No matching researchers found.</p>
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
                      onClick={() => {
                        setSelectedResearcher(null);
                        setSearchQuery('');
                      }}
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
                  <option value="CO_RESEARCHER">
                    Co-Researcher — contributes to cohorts, analyses &amp; evaluations
                  </option>
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
