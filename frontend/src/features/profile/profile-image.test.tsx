import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileAvatar, ProfileImageEditor } from './profile-image';

const mocks = vi.hoisted(() => ({
  metadata: vi.fn(),
  content: vi.fn(),
  replace: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('./profile-image-api', () => ({
  profileImageApi: mocks,
  profileImageError: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

describe('shared profile image UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.metadata.mockResolvedValue(null);
    mocks.content.mockResolvedValue(null);
    mocks.replace.mockResolvedValue({
      contentType: 'image/png',
      width: 200,
      height: 200,
      version: 1,
      updatedAt: '2026-09-10T10:00:00Z',
    });
    mocks.remove.mockResolvedValue(undefined);
  });

  it('keeps a recognizable initials fallback when no photo exists', async () => {
    render(<ProfileAvatar source={{ kind: 'self' }} name="Dr. Arafat Hossain" />);

    expect(screen.getByLabelText('Dr. Arafat Hossain profile photo')).toHaveTextContent('AH');
    await waitFor(() => expect(mocks.content).toHaveBeenCalled());
  });

  it('uploads a supported profile photo through the shared editor', async () => {
    const user = userEvent.setup();
    render(<ProfileImageEditor name="Rumana Akter" />);

    const input = screen.getByLabelText('Choose profile photo');
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'rumana.png', { type: 'image/png' });
    await user.upload(input, file);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(file));
    expect(await screen.findByText('Profile photo updated.')).toBeInTheDocument();
  });

  it('rejects an obviously unsupported browser-declared file before upload', async () => {
    render(<ProfileImageEditor name="Rumana Akter" />);

    const file = new File(['GIF89a'], 'avatar.gif', { type: 'image/gif' });
    const input = screen.getByLabelText('Choose profile photo') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(await screen.findByText('Choose a JPEG, PNG, or WebP image.')).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
