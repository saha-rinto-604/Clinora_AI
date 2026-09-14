import { useCallback, useEffect, useRef, useState } from 'react';
import { appointmentApi } from '../appointments/appointment-api';
import { patientRecordApi } from '../patient-record/patient-record-api';
import { patientApi, patientErrorMessage } from './patient-api';
import type { PatientHomeSection } from './patient-home';
import { patientPortalApi } from './patient-portal-api';

const upcoming = () => appointmentApi.list('UPCOMING');
const activity = async () => (await patientRecordApi.timeline({ limit: 6 })).items;
const history = async () => (await patientRecordApi.healthTrends()).points;

// Each section can fail/retry independently; a late response cannot replace a newer refresh.
function useDashboardResource<T>(request: () => Promise<T>, fallback: string): PatientHomeSection<T> {
  const [state, setState] = useState({ data: null as T | null, loading: true, error: '' });
  const generation = useRef(0);
  const retry = useCallback(async () => {
    const current = ++generation.current;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const data = await request();
      if (current === generation.current) setState({ data, loading: false, error: '' });
    } catch (error) {
      if (current === generation.current) {
        setState((previous) => ({ ...previous, loading: false, error: patientErrorMessage(error, fallback) }));
      }
    }
  }, [request, fallback]);
  useEffect(() => {
    void retry();
    return () => {
      generation.current += 1;
    };
  }, [retry]);
  return { ...state, retry };
}

export function usePatientDashboard() {
  const reports = useDashboardResource(patientApi.dashboard, 'Reports could not be refreshed.');
  const profile = useDashboardResource(patientApi.profile, 'Health Profile could not be refreshed.');
  const care = useDashboardResource(upcoming, 'Appointments could not be refreshed.');
  const events = useDashboardResource(activity, 'Health activity could not be refreshed.');
  const record = useDashboardResource(patientRecordApi.history, 'Health Record could not be refreshed.');
  const sharing = useDashboardResource(patientPortalApi.summary, 'Sharing status could not be refreshed.');
  const trends = useDashboardResource(history, 'Measurement history could not be refreshed.');
  const refreshAfterUpload = () => {
    void reports.retry();
    void record.retry();
    void events.retry();
    void trends.retry();
  };
  return { reports, profile, care, events, record, sharing, trends, refreshAfterUpload };
}
