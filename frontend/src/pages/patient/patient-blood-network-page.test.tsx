import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    vi.resetAllMocks();
    mocks.route.mockResolvedValue(route);
  });

  it('shows the accepted donor contact to the requester and excludes requester home from that route view', async () => {
    mocks.overview.mockResolvedValue(overviewFor(requester));
    mocks.request.mockResolvedValue(requestFor());

    renderRequest();

    expect(await screen.findByText(donor.phone)).toBeInTheDocument();
    expect(screen.queryByText(requester.phone)).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith('request-id', donor.userId));
    await waitFor(() =>
      expect(screen.getByTestId('blood-network-map')).toHaveAttribute('data-current-location', 'null'),
    );
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
    act(() => mocks.mapProps.mock.lastCall?.[0].onSelectPerson(acceptedDonor));
    await user.click(await screen.findByRole('button', { name: /Mina Donor/i }));

    await waitFor(() => expect(mocks.route).toHaveBeenCalledWith('request-id', secondDonor.userId));
    expect(mocks.mapProps.mock.lastCall?.[0].selectedPersonId).toBe(secondDonor.userId);
  });

  it.each([
    ['FULFILL', 'FULFILLED', 'Mark fulfilled'],
    ['CANCEL', 'CANCELLED', 'Cancel request'],
  ] as const)('removes coordination immediately after %s even if refresh fails', async (action, status, label) => {
    const user = userEvent.setup();
    mocks.overview.mockResolvedValue(overviewFor(requester));
    mocks.request.mockResolvedValue(requestFor());
    mocks.updateStatus.mockResolvedValue(requestFor({ status }));
    renderRequest();
    expect(await screen.findByText(donor.phone)).toBeInTheDocument();
    await waitFor(() => expect(mocks.mapProps.mock.lastCall?.[0].route).toEqual(route));

    // A refresh begun before closure must not restore its old accepted snapshot.
    let resolveStale!: (value: BloodRequestDetail) => void;
    mocks.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(resolveStale).toBeDefined());
    mocks.overview.mockRejectedValue(new Error('Refresh offline'));
    await user.click(screen.getByRole('button', { name: label }));
    expect(mocks.updateStatus).toHaveBeenCalledWith('request-id', action);
    expect(await screen.findByText(new RegExp(`This request is ${status.toLowerCase()}`))).toBeInTheDocument();
    await act(async () => resolveStale(requestFor()));

    expect(screen.queryByText(donor.phone)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Dina Donor')).not.toBeInTheDocument();
    expect(mocks.mapProps.mock.lastCall?.[0]).toMatchObject({ nearbyPeople: [], route: null, selectedPersonId: null });
    expect(mocks.mapProps.mock.lastCall?.[0].request.matches[0].phone).toBeNull();
  });

  it.each(['FULFILLED', 'CANCELLED', 'EXPIRED'] as const)(
    'hides contacts when reopening a %s request',
    async (status) => {
      mocks.overview.mockResolvedValue(overviewFor(requester));
      mocks.request.mockResolvedValue(requestFor({ status }));
      renderRequest();
      expect(await screen.findByText(new RegExp(`This request is ${status.toLowerCase()}`))).toBeInTheDocument();
      expect(screen.queryByText(donor.phone)).not.toBeInTheDocument();
      expect(screen.queryByText('Dina Donor')).not.toBeInTheDocument();
      expect(mocks.route).not.toHaveBeenCalled();
      expect(mocks.mapProps.mock.lastCall?.[0].nearbyPeople).toEqual([]);
    },
  );

  it('removes requester contact from the donor view when background sync sees closure', async () => {
    mocks.overview.mockResolvedValue(overviewFor(donor));
    const accepted = requestFor({
      owner: false,
      matches: [],
      myResponseStatus: 'ACCEPTED',
      requesterContact: { name: 'Rafi Requester', phone: requester.phone },
    });
    mocks.request.mockResolvedValue(accepted);
    renderRequest();
    expect(await screen.findByText(requester.phone)).toBeInTheDocument();
    mocks.request.mockResolvedValue({ ...accepted, status: 'CANCELLED' });
    act(() => window.dispatchEvent(new Event('focus')));
    expect(await screen.findByText('This request is cancelled.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call requester' })).not.toBeInTheDocument();
    expect(screen.queryByText(requester.phone)).not.toBeInTheDocument();
    expect(mocks.mapProps.mock.lastCall?.[0].route).toBeNull();
  });

  it('validates inside the modal, focuses the first error, clears corrected fields, and submits valid input', async () => {
    const user = userEvent.setup();
    mocks.overview.mockResolvedValue(overviewFor(requester));
    mocks.request.mockResolvedValue(requestFor());
    mocks.createRequest.mockResolvedValue(requestFor());
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Request blood' }));
    const dialog = screen.getByRole('dialog');
    const form = within(dialog);
    const group = form.getByLabelText('Blood group', { exact: false });
    const units = form.getByLabelText('Units needed', { exact: false });
    fireEvent.change(group, { target: { value: '' } });
    await user.clear(units);
    await user.click(form.getByRole('button', { name: 'Send nearby request' }));
    expect(await form.findByText('Blood group is required.')).toBeInTheDocument();
    expect(group).toHaveFocus();
    expect(form.getAllByRole('alert')).toHaveLength(5);
    expect(screen.getAllByRole('alert')).toHaveLength(5);
    expect(dialog.querySelectorAll('label span.text-red-400')).toHaveLength(5);
    for (const label of [
      'Blood group',
      'Units needed',
      'Hospital / donation centre',
      'Request location address',
      'Needed by',
    ]) {
      expect(form.getByLabelText(label, { exact: false })).toHaveAttribute('aria-invalid', 'true');
      expect(form.getByLabelText(label, { exact: false })).toHaveClass('border-red-400');
    }
    expect(mocks.createRequest).not.toHaveBeenCalled();
    await user.selectOptions(group, 'B_POSITIVE');
    await waitFor(() => expect(form.queryByText('Blood group is required.')).not.toBeInTheDocument());
    await user.type(units, '2');
    await waitFor(() => expect(units).toHaveAttribute('aria-invalid', 'false'));
    await user.type(form.getByLabelText('Hospital / donation centre', { exact: false }), 'Hospital');
    await waitFor(() => expect(form.queryByText('Hospital / donation centre is required.')).not.toBeInTheDocument());
    await user.type(form.getByLabelText('Request location address', { exact: false }), 'Dhaka');
    await waitFor(() => expect(form.queryByText('Request location is required.')).not.toBeInTheDocument());
    fireEvent.change(form.getByLabelText('Needed by', { exact: false }), { target: { value: '2026-11-01T10:00' } });
    await waitFor(() => expect(form.queryAllByRole('alert')).toHaveLength(0));
    expect(form.getByLabelText('Context for nearby patients', { exact: false })).not.toBeRequired();
    await user.click(form.getByRole('button', { name: 'Send nearby request' }));
    await waitFor(() =>
      expect(mocks.createRequest).toHaveBeenCalledWith({
        bloodGroup: 'B_POSITIVE',
        unitsNeeded: 2,
        hospitalName: 'Hospital',
        hospitalAddress: 'Dhaka',
        neededBy: new Date('2026-11-01T10:00').toISOString(),
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps request API errors inside the modal', async () => {
    const user = userEvent.setup();
    mocks.overview.mockResolvedValue(overviewFor(requester));
    mocks.request.mockResolvedValue(requestFor());
    mocks.createRequest.mockRejectedValue(new Error('Unavailable'));
    renderRequest();
    await user.click(await screen.findByRole('button', { name: 'Request blood' }));
    const form = within(screen.getByRole('dialog'));
    await user.type(form.getByLabelText('Hospital / donation centre', { exact: false }), 'Hospital');
    await user.type(form.getByLabelText('Request location address', { exact: false }), 'Dhaka');
    fireEvent.change(form.getByLabelText('Needed by', { exact: false }), { target: { value: '2026-11-01T10:00' } });
    await user.click(form.getByRole('button', { name: 'Send nearby request' }));
    expect(await form.findByRole('alert')).toHaveTextContent('The blood request could not be created.');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('browses several groups independently of the active request and ignores delayed results', async () => {
    const user = userEvent.setup();
    const bDonor = { ...acceptedDonor, bloodGroup: 'B_POSITIVE' as const };
    const oDonor = {
      ...acceptedDonor,
      userId: 'o-donor',
      displayName: 'Omar Ali',
      phone: null,
      responseStatus: 'PENDING' as const,
    };
    const aDonor = { ...oDonor, userId: 'a-donor', displayName: 'Anika Ali', bloodGroup: 'A_POSITIVE' as const };
    const overview = (group = 'B_POSITIVE') => ({
      ...overviewFor(requester),
      selectedBloodGroup: group,
      nearbyPeople: [bDonor, oDonor, aDonor].filter((person) => person.bloodGroup === group),
    });
    mocks.overview.mockImplementation(async (group) => overview(group));
    mocks.request.mockResolvedValue(requestFor({ bloodGroup: 'B_POSITIVE', matches: [bDonor] }));
    renderRequest();
    await screen.findByText(donor.phone);
    const filter = screen.getByLabelText('Showing blood group');
    for (const group of ['O_POSITIVE', 'A_POSITIVE', 'B_POSITIVE']) {
      await user.selectOptions(filter, group);
      await waitFor(() => expect(mocks.overview).toHaveBeenLastCalledWith(group));
      await waitFor(() => expect(mocks.mapProps.mock.lastCall?.[0].nearbyPeople).toEqual(overview(group).nearbyPeople));
      expect(screen.getByRole('button', { name: 'Mark fulfilled' })).toBeInTheDocument();
      expect(screen.getByText('1 nearby match')).toBeInTheDocument();
      if (group !== 'B_POSITIVE') {
        expect(mocks.mapProps.mock.lastCall?.[0].request).toBeNull();
        expect(mocks.mapProps.mock.lastCall?.[0].route).toBeNull();
        expect(screen.queryByText(donor.phone)).not.toBeInTheDocument();
        expect(screen.getByText(overview(group).nearbyPeople[0].displayName)).toBeInTheDocument();
      }
    }
    let resolveOld!: (value: unknown) => void;
    mocks.overview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await user.selectOptions(filter, 'O_POSITIVE');
    await waitFor(() => expect(resolveOld).toBeDefined());
    expect(mocks.mapProps.mock.lastCall?.[0].nearbyPeople).toEqual([]);
    await user.selectOptions(filter, 'A_POSITIVE');
    await waitFor(() => expect(mocks.mapProps.mock.lastCall?.[0].nearbyPeople[0]?.userId).toBe('a-donor'));
    await act(async () => resolveOld(overview('O_POSITIVE')));
    expect(mocks.mapProps.mock.lastCall?.[0].nearbyPeople[0]?.userId).toBe('a-donor');
  });

  it('shows eligible API fixtures and namesakes in both request matches and map markers', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const namesake = { ...acceptedDonor, userId: 'namesake-id' };
    const records = [
      acceptedDonor,
      namesake,
      { ...acceptedDonor, userId: 'seed-id', displayName: 'Nusrat Jahan', demo: true },
      { ...acceptedDonor, userId: 'codex-id', displayName: 'Codex Patient' },
    ];
    mocks.overview.mockResolvedValue({ ...overviewFor(requester), nearbyPeople: records });
    mocks.request.mockResolvedValue(requestFor({ matches: records }));
    renderRequest();
    await screen.findByText(donor.phone);
    expect(screen.getAllByRole('button', { name: /Dina Donor/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Nusrat Jahan/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Codex Patient/ })).toBeInTheDocument();
    expect(screen.getByText('4 nearby matches')).toBeInTheDocument();
    expect(
      mocks.mapProps.mock.lastCall?.[0].nearbyPeople.map((person: NearbyBloodNetworkPerson) => person.userId),
    ).toEqual([donor.userId, 'namesake-id', 'seed-id', 'codex-id']);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
