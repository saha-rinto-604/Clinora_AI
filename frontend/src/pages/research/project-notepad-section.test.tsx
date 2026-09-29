import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectNotepadSection } from './project-notepad-section';
import { researchApi } from '../../features/research/research-api';
import type { ResearchDocumentSummary, ResearchDocumentDetail } from '../../features/research/research-types';

vi.mock('../../features/research/research-api', () => ({
  researchApi: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    renameDocument: vi.fn(),
    archiveDocument: vi.fn(),
    listDocumentRevisions: vi.fn(),
    restoreDocumentRevision: vi.fn(),
    listDocumentComments: vi.fn(),
    addDocumentComment: vi.fn(),
    resolveDocumentComment: vi.fn(),
    getSafeDatasetReferences: vi.fn(),
    getSafeEvaluationReferences: vi.fn(),
  },
}));

describe('ProjectNotepadSection', () => {
  const projectId = '7d69e317-2efc-4d94-91a8-3946a7927164';
  const ownerUserId = '102a0999-3756-48d1-b144-28786db99fe5';

  const mockDocuments: ResearchDocumentSummary[] = [
    {
      id: 'doc-1',
      projectId,
      title: 'Phase 1 Study Protocol',
      documentType: 'METHODOLOGY',
      createdByUserId: ownerUserId,
      createdByName: 'Elena Rostova',
      lastEditedByUserId: ownerUserId,
      lastEditedByName: 'Elena Rostova',
      createdAt: '2026-09-28T10:00:00Z',
      updatedAt: '2026-09-28T12:00:00Z',
      archived: false,
      contributors: [
        { userId: ownerUserId, name: 'Elena Rostova', email: 'elena@example.com' },
      ],
      revisionCount: 2,
    },
  ];

  const mockDetail: ResearchDocumentDetail = {
    ...mockDocuments[0],
    contentJson: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Protocol body' }] }],
    }),
    currentRevisionNumber: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays document list', async () => {
    vi.mocked(researchApi.listDocuments).mockResolvedValue(mockDocuments);
    vi.mocked(researchApi.getDocument).mockResolvedValue(mockDetail);

    render(
      <ProjectNotepadSection
        projectId={projectId}
        isOwner={true}
        canEdit={true}
        currentUserId={ownerUserId}
        currentUserName="Elena Rostova"
      />
    );

    expect(screen.getByText(/Research Notepad/i)).toBeInTheDocument();
    expect(screen.getByText(/do not enter identifiable patient information/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Phase 1 Study Protocol')).toBeInTheDocument();
      expect(screen.getByText(/Methodology/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no documents exist', async () => {
    vi.mocked(researchApi.listDocuments).mockResolvedValue([]);

    render(
      <ProjectNotepadSection
        projectId={projectId}
        isOwner={true}
        canEdit={true}
        currentUserId={ownerUserId}
        currentUserName="Elena Rostova"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No research documents yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Create a document to start writing with your team/i)).toBeInTheDocument();
    });
  });

  it('opens and submits create document modal', async () => {
    const user = userEvent.setup();
    vi.mocked(researchApi.listDocuments).mockResolvedValue(mockDocuments);
    vi.mocked(researchApi.getDocument).mockResolvedValue(mockDetail);
    vi.mocked(researchApi.createDocument).mockResolvedValue({
      ...mockDetail,
      id: 'doc-2',
      title: 'New Paper Draft',
    });

    render(
      <ProjectNotepadSection
        projectId={projectId}
        isOwner={true}
        canEdit={true}
        currentUserId={ownerUserId}
        currentUserName="Elena Rostova"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('New Document')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Document'));
    expect(screen.getByPlaceholderText(/Clinical Trial Protocol/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Clinical Trial Protocol/i), 'New Paper Draft');
    await user.click(screen.getByRole('button', { name: /^Create Document$/i }));

    await waitFor(() => {
      expect(researchApi.createDocument).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({ title: 'New Paper Draft' })
      );
    });
  });
});
