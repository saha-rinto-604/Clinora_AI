import { useAuthStore } from '../auth/auth-store';

// In-memory recovery across workspace navigation. Never persist research notes in browser storage.
const drafts = new Map<string, string>();
const key = (userId: string, projectId: string, documentId: string) => `${userId}:${projectId}:${documentId}`;

export function rememberResearchDraft(userId: string, projectId: string, documentId: string, content: string) {
  drafts.set(key(userId, projectId, documentId), content);
}

export function readResearchDraft(userId: string, projectId: string, documentId: string) {
  return drafts.get(key(userId, projectId, documentId));
}

export function forgetResearchDraft(userId: string, projectId: string, documentId: string) {
  drafts.delete(key(userId, projectId, documentId));
}

useAuthStore.subscribe((state, previous) => {
  if (state.status === 'anonymous' || state.user?.id !== previous.user?.id) drafts.clear();
});
