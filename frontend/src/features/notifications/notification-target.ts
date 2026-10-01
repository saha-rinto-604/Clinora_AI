import type { PatientNotification } from './notification-api';

export function notificationTarget(notification: PatientNotification, userRole?: string) {
  if (notification.targetType === 'RESEARCH_PROJECT' && notification.targetId) {
    return `/research/projects/${notification.targetId}`;
  }
  if (notification.targetType === 'RESEARCH_DATASET' && notification.targetId) {
    return `/research/datasets/${notification.targetId}`;
  }
  if (notification.targetType === 'RESEARCHER_CREDENTIAL') {
    return '/research/credentials';
  }
  if (notification.targetType === 'APPOINTMENT' && notification.targetId) {
    return `/patient/appointments/${notification.targetId}`;
  }
  if (notification.targetType === 'REPORT_ANALYSIS' && notification.targetId) {
    return `/patient/analyze/${notification.targetId}`;
  }
  if (notification.targetType === 'MEDICAL_REPORT' && notification.targetId) {
    return `/patient/reports/${notification.targetId}`;
  }
  if (notification.targetType === 'BLOOD_REQUEST' && notification.targetId) {
    return `/patient/blood-network?request=${notification.targetId}`;
  }
  if (notification.category === 'SECURITY') return '/account';
  return userRole === 'RESEARCHER' ? '/research/notifications' : '/patient/notifications';
}
