export type DoctorInterviewStatus =
  'SCHEDULED' | 'RESCHEDULE_REQUESTED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type InterviewMeetingProvider = 'GOOGLE_MEET' | 'ZOOM' | 'OTHER';

export interface DoctorInterview {
  id: string;
  status: DoctorInterviewStatus;
  scheduledStartUtc?: string | null;
  timezone?: string | null;
  durationMinutes?: number | null;
  meetingProvider?: InterviewMeetingProvider | null;
  meetingUrl?: string | null;
  instructions?: string | null;
  scheduledByUserId?: string | null;
  rescheduleRequestedAt?: string | null;
  rescheduleRequestMessage?: string | null;
  rescheduledAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  completedAt?: string | null;
  noShowAt?: string | null;
  updatedAt: string;
}

export interface DoctorInterviewScheduleInput {
  scheduledLocalDateTime: string;
  timezone: string;
  durationMinutes: number;
  meetingProvider: InterviewMeetingProvider;
  meetingUrl: string;
  instructions?: string;
}
