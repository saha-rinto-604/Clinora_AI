import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { researchApi } from '../../features/research/research-api';
import { DatasetRequestDetailPage } from './dataset-request-detail-page';

vi.mock('../../features/research/research-api');

const mockRequest = {
  id: 'req-1',
  projectId: 'proj-1',
  name: 'Test Request',
  status: 'APPROVED',
  requestedVariables: '[]',
  requestedPopulation: '{}',
  requestedFormat: 'CSV',
  createdAt: new Date().toISOString(),
  submittable: false,
  cancellable: false,
};

describe('DatasetRequestDetailPage Failure Banners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (researchApi.getDatasetRequest as import('vitest').Mock).mockResolvedValue(mockRequest);
    (researchApi.getDatasetByRequest as import('vitest').Mock).mockResolvedValue(null);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/research/requests/req-1']}>
        <Routes>
          <Route path="/research/requests/:requestId" element={<DatasetRequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('displays amber privacy message for MINIMUM_COHORT_NOT_MET', async () => {
    (researchApi.getLatestGenerationJob as import('vitest').Mock).mockResolvedValue({
      id: 'job-1',
      datasetRequestId: 'req-1',
      status: 'FAILED',
      failureCode: 'MINIMUM_COHORT_NOT_MET',
      failureReason: "This request does not meet Clinora's minimum cohort requirement of 5 subjects.",
      retryable: false,
      createdAt: new Date().toISOString(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Dataset generation blocked')).toBeInTheDocument();
      expect(screen.getByText('Privacy threshold not met')).toBeInTheDocument();
      expect(screen.queryByText('Dataset generation encountered an error')).not.toBeInTheDocument();
    });
  });

  it('displays amber privacy message for EMPTY_ELIGIBLE_COHORT', async () => {
    (researchApi.getLatestGenerationJob as import('vitest').Mock).mockResolvedValue({
      id: 'job-1',
      datasetRequestId: 'req-1',
      status: 'FAILED',
      failureCode: 'EMPTY_ELIGIBLE_COHORT',
      failureReason: 'No records satisfied all approved eligibility and consent requirements.',
      retryable: false,
      createdAt: new Date().toISOString(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Dataset generation blocked')).toBeInTheDocument();
      expect(screen.getByText('No eligible records matched this request')).toBeInTheDocument();
      expect(screen.queryByText('Dataset generation encountered an error')).not.toBeInTheDocument();
    });
  });

  it('displays red generic failure for INTERNAL_GENERATION_ERROR', async () => {
    (researchApi.getLatestGenerationJob as import('vitest').Mock).mockResolvedValue({
      id: 'job-1',
      datasetRequestId: 'req-1',
      status: 'FAILED',
      failureCode: 'INTERNAL_GENERATION_ERROR',
      failureReason: 'Clinora could not complete this generation job because of a system error.',
      retryable: true,
      createdAt: new Date().toISOString(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Dataset generation encountered an error')).toBeInTheDocument();
      expect(screen.getByText(/Clinora could not complete this generation job/)).toBeInTheDocument();
      expect(screen.queryByText('Dataset generation blocked')).not.toBeInTheDocument();
    });
  });
  
  it('displays success banner for SUCCEEDED job with missing optional values', async () => {
    (researchApi.getLatestGenerationJob as import('vitest').Mock).mockResolvedValue({
      id: 'job-1',
      datasetRequestId: 'req-1',
      status: 'SUCCEEDED',
      createdAt: new Date().toISOString(),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Dataset generated successfully')).toBeInTheDocument();
      expect(screen.getByText(/Some approved variables may have had no available observations and were left empty/)).toBeInTheDocument();
    });
  });
});
