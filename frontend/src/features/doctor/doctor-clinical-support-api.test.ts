import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../auth/auth-api', () => ({
  apiClient: { post },
}));

import { doctorClinicalSupportApi } from './doctor-clinical-support-api';

describe('doctorClinicalSupportApi', () => {
  beforeEach(() => post.mockReset());

  it('routes only through the Spring Doctor appointment boundary and normalizes optional context', async () => {
    const decision = {
      status: 'ROUTED',
      taskIds: ['COMPARE_EVIDENCE'],
      referencedContext: {},
      clarificationOptions: [],
      clarificationReason: null,
      missingRequiredContext: [],
    };
    post.mockResolvedValue({ data: { data: decision } });

    const result = await doctorClinicalSupportApi.route('appointment/id', {
      message: 'Has this changed since the last CBC?',
      currentScreen: 'REPORT_REVIEW',
      currentReportId: 'report-id',
    });

    expect(post).toHaveBeenCalledWith('/doctor/appointments/appointment%2Fid/clinical-support/route', {
      message: 'Has this changed since the last CBC?',
      currentScreen: 'REPORT_REVIEW',
      explicitTaskId: null,
      currentReportId: 'report-id',
      selectedReportIds: [],
      selectedObservationIds: [],
      doctorAssessmentPresent: false,
      doctorNotesPresent: false,
    });
    expect(result).toBe(decision);
  });
});
