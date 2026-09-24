import type { DoctorNotification } from './doctor-notification-api';

export function doctorNotificationTarget(notification: DoctorNotification) {
  if (notification.targetType === 'APPOINTMENT' && notification.targetId) {
    return `/doctor/appointments/${notification.targetId}`;
  }
  return '/doctor/notifications';
}
