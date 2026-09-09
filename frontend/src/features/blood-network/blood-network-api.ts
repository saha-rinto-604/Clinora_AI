import { apiClient, apiErrorMessage } from '../auth/auth-api';
import type { ApiEnvelope } from '../auth/auth-types';

export type BloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE';

export const bloodGroupOptions: { value: BloodGroup; label: string }[] = [
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A−' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B−' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB−' },
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O−' },
];

export type BloodNetworkCurrentUser = {
  userId: string;
  firstName: string;
  lastName: string;
  bloodGroup: BloodGroup | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodedAddress: string | null;
  bloodNetworkEnabled: boolean;
  bloodNetworkAvailable: boolean;
};

export type NearbyBloodNetworkPerson = {
  userId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  phone: string | null;
  responseStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
  demo: boolean;
};

export type BloodRequestSummary = {
  id: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  neededBy: string | null;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  createdAt: string;
};

export type BloodRequestDetail = {
  id: string;
  owner: boolean;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  latitude: number;
  longitude: number;
  note: string | null;
  neededBy: string | null;
  status: BloodRequestSummary['status'];
  createdAt: string;
  myResponseStatus: NearbyBloodNetworkPerson['responseStatus'] | null;
  myDistanceMeters: number | null;
  matches: NearbyBloodNetworkPerson[];
  requesterContact: { name: string; phone: string | null } | null;
};

export type BloodNetworkOverview = {
  currentUser: BloodNetworkCurrentUser;
  selectedBloodGroup: BloodGroup | null;
  radiusMeters: number;
  mapsConfigured: boolean;
  nearbyPeople: NearbyBloodNetworkPerson[];
  nearbyRequests: BloodRequestSummary[];
  myRequests: BloodRequestSummary[];
};


export type BloodRoute = {
  requestId: string;
  matchedUserId: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
};

export type CreateBloodRequestInput = {
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  hospitalName: string;
  hospitalAddress: string;
  latitude?: number;
  longitude?: number;
  neededBy?: string;
  note?: string;
};

export const bloodNetworkApi = {
  async overview(bloodGroup?: BloodGroup) {
    const response = await apiClient.get<ApiEnvelope<BloodNetworkOverview>>('/patient/blood-network', {
      params: bloodGroup ? { bloodGroup } : undefined,
    });
    return response.data.data;
  },
  async preferences(input: { enabled: boolean; available: boolean }) {
    const response = await apiClient.patch<ApiEnvelope<BloodNetworkCurrentUser>>(
      '/patient/blood-network/preferences',
      input,
    );
    return response.data.data;
  },
  async createRequest(input: CreateBloodRequestInput) {
    const response = await apiClient.post<ApiEnvelope<BloodRequestDetail>>('/patient/blood-network/requests', input);
    return response.data.data;
  },
  async request(requestId: string) {
    const response = await apiClient.get<ApiEnvelope<BloodRequestDetail>>(`/patient/blood-network/requests/${requestId}`);
    return response.data.data;
  },
  async route(requestId: string, matchedUserId?: string) {
    const response = await apiClient.get<ApiEnvelope<BloodRoute>>(`/patient/blood-network/requests/${requestId}/route`, {
      params: matchedUserId ? { matchedUserId } : undefined,
    });
    return response.data.data;
  },
  async respond(requestId: string, action: 'ACCEPT' | 'DECLINE') {
    const response = await apiClient.post<ApiEnvelope<BloodRequestDetail>>(
      `/patient/blood-network/requests/${requestId}/responses`,
      { action },
    );
    return response.data.data;
  },
  async updateStatus(requestId: string, action: 'FULFILL' | 'CANCEL') {
    const response = await apiClient.patch<ApiEnvelope<BloodRequestDetail>>(
      `/patient/blood-network/requests/${requestId}/status`,
      { action },
    );
    return response.data.data;
  },
};

export function bloodNetworkError(error: unknown, fallback: string) {
  return apiErrorMessage(error, fallback);
}

export function bloodGroupLabel(value: BloodGroup | null | undefined) {
  return bloodGroupOptions.find((item) => item.value === value)?.label ?? '—';
}

export function distanceLabel(meters: number) {
  return meters < 1000 ? `${Math.max(0, Math.round(meters))} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function durationLabel(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) return '< 1 min';
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}
