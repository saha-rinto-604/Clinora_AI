import type { PatientNotification } from './notification-api';

export function notificationTarget(notification: PatientNotification) {
  if (notification.targetType === 'APPOINTMENT' && notification.targetId) {
    return `/patient/appointments/${notification.targetId}`;
  }
  if (notification.targetType === 'REPORT_ANALYSIS' && notification.targetId) {
    return `/patient/analyze/${notification.targetId}`;
  }
  if (notification.targetType === 'MEDICAL_REPORT' && notification.targetId) {
    return `/patient/reports/${notification.targetId}`;
  }
  if (notification.category === 'SECURITY') return '/account';
  return '/patient/notifications';
}
