import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      contributors: [{ userId: ownerUserId, name: 'Elena Rostova', email: 'elena@example.com' }],
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
      />,
    );

    expect(screen.getByText(/Research Notepad/i)).toBeInTheDocument();
    expect(screen.getByText(/do not enter identifiable patient information/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Phase 1 Study Protocol' })).toBeInTheDocument();
      expect(screen.getAllByText(/Methodology/i).length).toBeGreaterThan(0);
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
      />,
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
      />,
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
        expect.objectContaining({ title: 'New Paper Draft' }),
      );
    });
  });
  it('serializes edits made during an in-flight save using the returned revision', async () => {
    vi.mocked(researchApi.listDocuments).mockResolvedValue(mockDocuments);
    vi.mocked(researchApi.getDocument).mockResolvedValue(mockDetail);
    let completeFirst!: (value: ResearchDocumentDetail) => void;
    vi.mocked(researchApi.updateDocument)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...mockDetail, currentRevisionNumber: 4 });
    render(
      <ProjectNotepadSection
        projectId={projectId}
        isOwner
        canEdit
        currentUserId={ownerUserId}
        currentUserName="Synthetic researcher"
      />,
    );
    const editor = await screen.findByLabelText(`Research document editor for ${ownerUserId}`);
    await waitFor(() => expect(editor).toHaveTextContent('Protocol body'));
    vi.useFakeTimers();
    await act(async () => {
      editor.innerHTML = '<p>First edit</p>';
      fireEvent.input(editor);
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(researchApi.updateDocument).toHaveBeenCalledTimes(1);
    await act(async () => {
      editor.innerHTML = '<p>Second edit during save</p>';
      fireEvent.input(editor);
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(researchApi.updateDocument).toHaveBeenCalledTimes(1);
    await act(async () => {
      completeFirst({ ...mockDetail, currentRevisionNumber: 3 });
    });
    vi.useRealTimers();
    expect(researchApi.updateDocument).toHaveBeenNthCalledWith(
      2,
      projectId,
      'doc-1',
      expect.objectContaining({
        expectedRevisionNumber: 3,
        contentJson: expect.stringContaining('Second edit during save'),
      }),
    );
    expect(editor).toHaveTextContent('Second edit during save');
  });

  it('does not save on load and pauses a conflicting save without losing the draft', async () => {
    vi.mocked(researchApi.listDocuments).mockResolvedValue(mockDocuments);
    vi.mocked(researchApi.getDocument).mockResolvedValue(mockDetail);
    vi.mocked(researchApi.updateDocument).mockRejectedValue({ response: { status: 409 } });
    const props = {
      projectId,
      isOwner: true,
      canEdit: true,
      currentUserId: ownerUserId,
      currentUserName: 'Synthetic researcher',
    };
    const view = render(<ProjectNotepadSection {...props} />);
    const editor = await screen.findByLabelText(`Research document editor for ${ownerUserId}`);
    await waitFor(() => expect(editor).toHaveTextContent('Protocol body'));
    expect(researchApi.updateDocument).not.toHaveBeenCalled();
    vi.useFakeTimers();
    await act(async () => {
      editor.innerHTML = '<p>Unsent synthetic draft</p>';
      fireEvent.input(editor);
      await vi.advanceTimersByTimeAsync(1600);
    });
    vi.useRealTimers();
    await waitFor(() =>
      expect(researchApi.updateDocument).toHaveBeenCalledWith(
        projectId,
        'doc-1',
        expect.objectContaining({ expectedRevisionNumber: 2 }),
      ),
    );
    expect(editor).toHaveTextContent('Unsent synthetic draft');
    expect(screen.getByText(/Save paused/)).toBeInTheDocument();
    view.unmount();
    render(<ProjectNotepadSection {...props} />);
    await waitFor(() => expect(screen.getByText(/Recovered an unsaved local draft/)).toBeInTheDocument());
    expect(await screen.findByLabelText(`Research document editor for ${ownerUserId}`)).toHaveTextContent(
      'Unsent synthetic draft',
    );
    expect(researchApi.updateDocument).toHaveBeenCalledTimes(1);
  });
  it('preserves a newer recovered draft when a save from the previous view completes', async () => {
    const detail = { ...mockDetail, id: 'navigation-draft' };
    vi.mocked(researchApi.listDocuments).mockResolvedValue([detail]);
    vi.mocked(researchApi.getDocument).mockResolvedValue(detail);
    let completeSave!: (value: ResearchDocumentDetail) => void;
    vi.mocked(researchApi.updateDocument).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeSave = resolve;
        }),
    );
    const props = {
      projectId,
      isOwner: true,
      canEdit: true,
      currentUserId: ownerUserId,
      currentUserName: 'Synthetic researcher',
    };
    const first = render(<ProjectNotepadSection {...props} />);
    const editor = await screen.findByLabelText(`Research document editor for ${ownerUserId}`);
    await waitFor(() => expect(editor).toHaveTextContent('Protocol body'));
    vi.useFakeTimers();
    await act(async () => {
      editor.innerHTML = '<p>Earlier in-flight edit</p>';
      fireEvent.input(editor);
      await vi.advanceTimersByTimeAsync(1600);
    });
    vi.useRealTimers();
    expect(researchApi.updateDocument).toHaveBeenCalledTimes(1);
    first.unmount();
    const second = render(<ProjectNotepadSection {...props} />);
    await screen.findByText(/Recovered an unsaved local draft/);
    const recoveredEditor = screen.getByLabelText(`Research document editor for ${ownerUserId}`);
    await act(async () => {
      recoveredEditor.innerHTML = '<p>Newer recovered edit</p>';
      fireEvent.input(recoveredEditor);
    });
    await act(async () => {
      completeSave({ ...detail, currentRevisionNumber: 3 });
    });
    second.unmount();
    render(<ProjectNotepadSection {...props} />);
    await screen.findByText(/Recovered an unsaved local draft/);
    expect(screen.getByLabelText(`Research document editor for ${ownerUserId}`)).toHaveTextContent(
      'Newer recovered edit',
    );
    expect(researchApi.updateDocument).toHaveBeenCalledTimes(1);
  });
});
