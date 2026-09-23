import { useEffect, useState } from 'react';
import { consultationApi, consultationError, type DoctorPatientDetail } from '../consultations/consultation-api';

export function useDoctorPatientDetail(patientId: string) {
  const [data, setData] = useState<DoctorPatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setError('');
    consultationApi
      .patient(patientId)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((requestError: unknown) => {
        if (active) setError(consultationError(requestError, 'We could not open this Patient care history.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId, attempt]);
  return { data, loading, error, retry: () => setAttempt((value) => value + 1) };
}

export function patientDetailModel(data: DoctorPatientDetail) {
  const care = data.currentCare;
  const appointments = [...data.upcomingAppointments].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const history = [...data.careHistory].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const activeEpisode = history.find((episode) => episode.status === 'IN_PROGRESS');
  const latestCompleted = history
    .filter((episode) => episode.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
  const state = care.consultationInProgress ? 'IN_PROGRESS' : care.careState;
  const next = appointments[0];
  const appointmentId = activeEpisode?.appointmentId ?? next?.appointmentId;
  const primary =
    state === 'IN_PROGRESS' && activeEpisode
      ? { label: 'Resume consultation', to: consultationPath(activeEpisode.appointmentId) }
      : next
        ? { label: 'Open appointment', to: appointmentPath(next.appointmentId) }
        : latestCompleted
          ? { label: 'View latest consultation', to: consultationPath(latestCompleted.appointmentId) }
          : null;
  const statusLabel =
    state === 'IN_PROGRESS'
      ? 'Consultation in progress'
      : state === 'NEW_PATIENT'
        ? 'New Patient'
        : state === 'FOLLOW_UP'
          ? 'Follow-up'
          : 'Active care';
  const events: CareTimelineEvent[] = [];
  for (const appointment of appointments) {
    events.push({
      key: `appointment:${appointment.appointmentId}`,
      date: appointment.scheduledStart,
      title: 'Scheduled appointment',
      detail: consultationMode(appointment.consultationMode),
      to: appointmentPath(appointment.appointmentId),
      timezone: appointment.timezone,
      kind: 'appointment',
    });
  }
  for (const episode of history) {
    events.push({
      key: `started:${episode.consultationId}`,
      date: episode.startedAt,
      title: 'Consultation started',
      to: consultationPath(episode.appointmentId),
      kind: 'started',
    });
    if (episode.status === 'COMPLETED') {
      if (episode.completedAt)
        events.push({
          key: `completed:${episode.consultationId}`,
          date: episode.completedAt,
          title: 'Consultation completed',
          detail: episode.assessment ?? undefined,
          to: consultationPath(episode.appointmentId),
          kind: 'completed',
        });
      if (episode.followUpDate)
        events.push({
          key: `follow-up:${episode.consultationId}`,
          date: episode.followUpDate,
          title: 'Recommended follow-up',
          to: consultationPath(episode.appointmentId),
          kind: 'follow-up',
        });
    }
  }
  if (care.followUpDate && !events.some((event) => event.kind === 'follow-up' && event.date === care.followUpDate)) {
    events.push({
      key: 'current-follow-up',
      date: care.followUpDate,
      title: 'Recommended follow-up',
      kind: 'follow-up',
    });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));
  return { care, state, statusLabel, appointments, history, activeEpisode, next, appointmentId, primary, events };
}

export interface CareTimelineEvent {
  key: string;
  date: string;
  title: string;
  detail?: string;
  to?: string;
  timezone?: string;
  kind: 'appointment' | 'started' | 'completed' | 'follow-up';
}
export const appointmentPath = (id: string) => `/doctor/appointments/${encodeURIComponent(id)}`;
export const consultationPath = (id: string) => `${appointmentPath(id)}/consultation`;
export const consultationMode = (mode: 'ONLINE' | 'IN_PERSON' | null) =>
  mode === 'ONLINE' ? 'Online consultation' : mode === 'IN_PERSON' ? 'In-person consultation' : 'Consultation';
export function detailDate(value: string, timezone?: string, options?: Intl.DateTimeFormatOptions) {
  // Preserve calendar-only follow-ups across browser timezones.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return (dateOnly ? new Date(`${value}T12:00:00`) : new Date(value)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
    ...(!dateOnly && timezone ? { timeZone: timezone } : {}),
  });
}
export function detailDateTime(value: string, timezone?: string) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}
