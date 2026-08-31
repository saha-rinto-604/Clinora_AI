import { useAuthStore } from '../auth/auth-store';
import type { PatientNotification } from './notification-api';

const wsUrl = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';
const reconnectDelays = [1000, 2500, 5000, 10000, 30000] as const;

export function connectPatientNotificationStream(
  onNotification: (notification: PatientNotification) => void,
  onConnected?: () => void,
) {
  if (typeof WebSocket === 'undefined') return () => undefined;

  let disposed = false;
  let socket: WebSocket | null = null;
  let retryTimer: number | null = null;
  let retryAttempt = 0;

  const scheduleReconnect = () => {
    if (disposed || retryTimer != null) return;
    const delay = reconnectDelays[Math.min(retryAttempt, reconnectDelays.length - 1)];
    retryAttempt += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (disposed) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const current = new WebSocket(wsUrl, ['v12.stomp']);
    socket = current;
    let subscribed = false;

    current.addEventListener('open', () => {
      if (disposed || current !== socket) return;
      current.send(
        frame('CONNECT', { 'accept-version': '1.2', host: '/', Authorization: `Bearer ${token}`, 'heart-beat': '0,0' }),
      );
    });

    current.addEventListener('message', (event) => {
      if (disposed || current !== socket) return;
      for (const raw of String(event.data).split('\0')) {
        if (!raw.trim()) continue;
        const parsed = parseFrame(raw);
        if (parsed.command === 'CONNECTED' && !subscribed) {
          subscribed = true;
          retryAttempt = 0;
          current.send(
            frame('SUBSCRIBE', { id: 'patient-notifications', destination: '/user/queue/notifications', ack: 'auto' }),
          );
          onConnected?.();
        } else if (parsed.command === 'MESSAGE' && parsed.body) {
          try {
            onNotification(JSON.parse(parsed.body) as PatientNotification);
          } catch {
            // Persistent REST state is authoritative if a malformed realtime frame is received.
          }
        } else if (parsed.command === 'ERROR') {
          current.close();
        }
      }
    });

    current.addEventListener('close', () => {
      if (current === socket) socket = null;
      scheduleReconnect();
    });
    current.addEventListener('error', () => {
      // Closing triggers the bounded reconnect path. Do not surface transport internals to Patients.
      if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) current.close();
    });
  };

  connect();

  return () => {
    disposed = true;
    if (retryTimer != null) window.clearTimeout(retryTimer);
    retryTimer = null;
    const current = socket;
    socket = null;
    if (current?.readyState === WebSocket.OPEN) current.send(frame('DISCONNECT', { receipt: 'client-close' }));
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING))
      current.close();
  };
}

function frame(command: string, headers: Record<string, string>) {
  return `${command}\n${Object.entries(headers)
    .map(([key, value]) => `${key}:${value}`)
    .join('\n')}\n\n\0`;
}

function parseFrame(raw: string) {
  const separator = raw.indexOf('\n\n');
  const headerBlock = separator >= 0 ? raw.slice(0, separator) : raw;
  const body = separator >= 0 ? raw.slice(separator + 2) : '';
  const [command = '', ...headerLines] = headerBlock.split('\n');
  const headers = Object.fromEntries(
    headerLines.filter(Boolean).map((line) => {
      const index = line.indexOf(':');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
  );
  return { command, headers, body };
}
