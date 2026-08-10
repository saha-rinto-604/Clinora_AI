import { describe, expect, it } from 'vitest';
import { applicationProgressFor, buildApplicantUpdates } from './application-status';
import type { ApplicationEvent } from './application-types';

describe('applicationProgressFor', () => {
  it('keeps Researcher progress free of Doctor interview milestones', () => {
    const milestones = applicationProgressFor('UNDER_REVIEW', 'RESEARCHER');

    expect(milestones.map((item) => item.label)).toEqual([
      'Application submitted',
      'Professional review',
      'Decision',
      'Account activation',
    ]);
    expect(milestones.some((item) => /interview/i.test(item.label))).toBe(false);
    expect(milestones[1]?.state).toBe('current');
  });

  it('marks more-information review as action required', () => {
    const milestones = applicationProgressFor('MORE_INFO_REQUIRED', 'DOCTOR');

    expect(milestones[0]?.state).toBe('complete');
    expect(milestones[1]?.state).toBe('action-required');
    expect(milestones[1]?.detail).toMatch(/additional information/i);
  });

  it('uses terminal treatment for rejection and withdrawal', () => {
    const rejected = applicationProgressFor('REJECTED', 'DOCTOR');
    const withdrawn = applicationProgressFor('WITHDRAWN', 'RESEARCHER');

    expect(rejected[3]?.detail).toMatch(/not approved/i);
    expect(rejected[4]?.state).toBe('not-applicable');
    expect(withdrawn.every((item) => item.state === 'not-applicable')).toBe(true);
  });

  it('marks every milestone complete after activation', () => {
    expect(applicationProgressFor('ACTIVATED', 'DOCTOR').every((item) => item.state === 'complete')).toBe(true);
  });
});

describe('buildApplicantUpdates', () => {
  it('filters internal noise and groups evidence uploads by day', () => {
    const events: ApplicationEvent[] = [
      { type: 'PROFILE_UPDATED', message: 'Application information updated.', createdAt: '2026-08-10T08:00:00Z' },
      { type: 'SESSION_ESTABLISHED', message: 'Session established.', createdAt: '2026-08-10T07:59:00Z' },
      { type: 'DOCUMENT_UPLOADED', message: 'A supporting document was uploaded.', createdAt: '2026-08-10T07:30:00Z' },
      { type: 'DOCUMENT_UPLOADED', message: 'A supporting document was uploaded.', createdAt: '2026-08-10T07:20:00Z' },
      { type: 'SUBMITTED', message: 'Application submitted.', createdAt: '2026-08-10T09:00:00Z' },
    ];

    const updates = buildApplicantUpdates(events);

    expect(updates).toHaveLength(2);
    expect(updates[0]?.message).toBe('Application submitted');
    expect(updates[1]?.message).toBe('Supporting evidence received · 2 documents');
    expect(updates.some((item) => /information updated/i.test(item.message))).toBe(false);
  });
});
