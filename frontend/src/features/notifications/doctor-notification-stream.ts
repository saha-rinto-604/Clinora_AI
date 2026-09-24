import { connectPatientNotificationStream } from './patient-notification-stream';
import type { DoctorNotification } from './doctor-notification-api';

export function connectDoctorNotificationStream(
  onNotification: (notification: DoctorNotification) => void,
  onConnected?: () => void,
) {
  return connectPatientNotificationStream(onNotification, onConnected);
}
