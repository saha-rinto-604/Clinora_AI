import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BloodNetworkOverview,
  BloodRequestDetail,
  BloodRoute,
  NearbyBloodNetworkPerson,
} from '../../features/blood-network/blood-network-api';
import { PatientBloodNetworkPage } from './patient-blood-network-page';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  request: vi.fn(),
  route: vi.fn(),
  respond: vi.fn(),
  preferences: vi.fn(),
  createRequest: vi.fn(),
  updateStatus: vi.fn(),
  mapProps: vi.fn(),
}));

vi.mock('../../features/blood-network/blood-network-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/blood-network/blood-network-api')>();
  return {
    ...actual,
    bloodNetworkApi: {
      overview: mocks.overview,
      request: mocks.request,
      route: mocks.route,
      respond: mocks.respond,
      preferences: mocks.preferences,
      createRequest: mocks.createRequest,
      updateStatus: mocks.updateStatus,
    },
  };
});

vi.mock('../../features/blood-network/blood-network-map', () => ({
  BloodNetworkMap: (props: { currentLocation: { lat: number; lng: number } | null }) => {
    mocks.mapProps(props);
    return <div data-testid="blood-network-map" data-current-location={JSON.stringify(props.currentLocation)} />;
  },
}));

const requester = {
  userId: 'requester-id',
  firstName: 'Rafi',
  lastName: 'Requester',
  bloodGroup: 'O_POSITIVE' as const,
  phone: '01711111111',
  address: 'Requester home',
  latitude: 23.71,
  longitude: 90.41,
  geocodedAddress: 'Requester home',
  bloodNetworkEnabled: true,
  bloodNetworkAvailable: true,
};

const donor = {
  ...requester,
  userId: 'donor-id',
  firstName: 'Dina',
  lastName: 'Donor',
  phone: '01822222222',
  address: 'Donor home',
  latitude: 23.8,
  longitude: 90.38,
  geocodedAddress: 'Donor home',
};

const acceptedDonor: NearbyBloodNetworkPerson = {
  userId: donor.userId,
  displayName: 'Dina Donor',
  bloodGroup: 'O_POSITIVE',
  distanceMeters: 812,
  latitude: donor.latitude,
  longitude: donor.longitude,
  phone: donor.phone,
  responseStatus: 'ACCEPTED',
  demo: false,
};

const route: BloodRoute = {
  requestId: 'request-id',
  matchedUserId: donor.userId,
  distanceMeters: 3300,
  durationSeconds: 720,
  encodedPolyline: 'google-road-polyline',
};

function overviewFor(currentUser: BloodNetworkOverview['currentUser']): BloodNetworkOverview {
  return {
    currentUser,
    selectedBloodGroup: 'O_POSITIVE',
    radiusMeters: 5000,
    mapsConfigured: true,
    nearbyPeople: [],
    nearbyRequests: [],
    myRequests: [],
  };
}

function requestFor(overrides: Partial<BloodRequestDetail> = {}): BloodRequestDetail {
  return {
    id: 'request-id',
    owner: true,
    bloodGroup: 'O_POSITIVE',
    unitsNeeded: 1,
    hospitalName: 'Clinora Hospital',
    hospitalAddress: 'Hospital destination',
    latitude: 23.78,
    longitude: 90.4,
    note: null,
    neededBy: null,
    status: 'ACTIVE',
    createdAt: '2026-09-09T10:00:00Z',
    myResponseStatus: null,
    myDistanceMeters: null,
    matches: [acceptedDonor],
    requesterContact: null,
    ...overrides,
  };
}

function renderRequest() {
  return render(
    <MemoryRouter initialEntries={['/patient/blood-network?request=request-id']}>
      <Routes>
        <Route path="/patient/blood-network" element={<PatientBloodNetworkPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Patient Blood Network coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.mockResolvedValue(route);
  });

  it('shows the accepted donor contact to the requester and excludes requester home from that route view', async () => {
    mocks.overview.mockResolvedValue(overviewFor(requester));
    mocks.request.mockResolvedValue(requestFor());

    renderRequest();

    expect(await screen.findByText(donor.phone)).toBeInTheDocument();
    expect(screen.queryByText(requester.phone)).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith('request-id', donor.userId));
    await waitFor(() => expect(screen.getByTestId('blood-network-map')).toHaveAttribute('data-current-location', 'null'));
  });

  it('keeps contact and route hidden while the donor response is pending', async () => {
    mocks.overview.mockResolvedValue(overviewFor(donor));
    mocks.request.mockResolvedValue(
      requestFor({
        owner: false,
        matches: [],
        myResponseStatus: 'PENDING',
        myDistanceMeters: 812,
      }),
    );

    renderRequest();

    expect(await screen.findByRole('button', { name: 'I can help' })).toBeInTheDocument();
    expect(screen.queryByText(requester.phone)).not.toBeInTheDocument();
    expect(screen.queryByText(donor.phone)).not.toBeInTheDocument();
    expect(mocks.route).not.toHaveBeenCalled();
  });

  it('shows the requester contact to the accepted donor and keeps donor-to-hospital routing', async () => {
    mocks.overview.mockResolvedValue(overviewFor(donor));
    mocks.request.mockResolvedValue(
      requestFor({
        owner: false,
        matches: [],
        myResponseStatus: 'ACCEPTED',
        myDistanceMeters: 812,
        requesterContact: { name: 'Rafi Requester', phone: requester.phone },
      }),
    );

    renderRequest();

    expect(await screen.findByText(requester.phone)).toBeInTheDocument();
    expect(screen.queryByText(donor.phone)).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith('request-id', undefined));
    await waitFor(() =>
      expect(screen.getByTestId('blood-network-map')).toHaveAttribute(
        'data-current-location',
        JSON.stringify({ lat: donor.latitude, lng: donor.longitude }),
      ),
    );
  });

  it('clears and recalculates the requester route when another accepted donor is selected', async () => {
    const user = userEvent.setup();
    const secondDonor = {
      ...acceptedDonor,
      userId: 'donor-id-2',
      displayName: 'Mina Donor',
      phone: '01833333333',
      latitude: 23.82,
      longitude: 90.36,
    };
    mocks.overview.mockResolvedValue(overviewFor(requester));
    mocks.request.mockResolvedValue(requestFor({ matches: [acceptedDonor, secondDonor] }));

    renderRequest();
    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith('request-id', donor.userId));
    await user.click(await screen.findByRole('button', { name: /Mina Donor/i }));

    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith('request-id', secondDonor.userId));
  });
});
