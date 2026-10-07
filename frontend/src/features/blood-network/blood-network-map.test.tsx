import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NearbyBloodNetworkPerson } from './blood-network-api';
import { BloodNetworkMap } from './blood-network-map';
import type { GoogleMapsRuntime, LatLngPoint } from './google-maps-loader';

const mapsMocks = vi.hoisted(() => ({
  createOverlay: vi.fn(() => ({ setMap: vi.fn() })),
  fitBounds: vi.fn(),
  mapConstructor: vi.fn(),
  circleConstructor: vi.fn(),
}));

vi.mock('./google-maps-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./google-maps-loader')>();
  return {
    ...actual,
    createHtmlMapOverlay: mapsMocks.createOverlay,
    loadGoogleMaps: vi.fn(async () => window.google?.maps),
  };
});

const person: NearbyBloodNetworkPerson = {
  userId: 'patient-2',
  displayName: 'Nusrat J.',
  bloodGroup: 'O_POSITIVE',
  distanceMeters: 812,
  latitude: 23.8009,
  longitude: 90.3861,
  phone: null,
  responseStatus: 'PENDING',
  demo: false,
};

// Approximate opposite corners of the 5 km matching area around the test location.
const matchingAreaCorners = [
  { lat: 23.7503, lng: 90.3327 },
  { lat: 23.8401, lng: 90.4309 },
];

describe('BloodNetworkMap', () => {
  beforeEach(() => {
    mapsMocks.createOverlay.mockClear();
    mapsMocks.fitBounds.mockClear();
    mapsMocks.mapConstructor.mockReset();
    mapsMocks.circleConstructor.mockReset();
    mapsMocks.mapConstructor.mockImplementation(function FakeMap() {
      return {
        fitBounds: mapsMocks.fitBounds,
        panTo: vi.fn(),
        setZoom: vi.fn(),
        addListener: vi.fn(() => ({ remove: vi.fn() })),
      };
    });

    class FakeShape {
      setMap = vi.fn();
    }
    class FakeBounds {
      points: LatLngPoint[] = [];
      extend = (point: LatLngPoint) => this.points.push(point);
      union = (bounds: FakeBounds) => this.points.push(...bounds.points);
    }
    mapsMocks.circleConstructor.mockImplementation(function FakeCircle() {
      const bounds = new FakeBounds();
      matchingAreaCorners.forEach((point) => bounds.extend(point));
      return { setMap: vi.fn(), getBounds: () => bounds };
    });
    const runtime = {
      Map: mapsMocks.mapConstructor,
      Circle: mapsMocks.circleConstructor,
      LatLngBounds: FakeBounds,
      LatLng: class FakeLatLng {},
      OverlayView: class {},
      Polyline: FakeShape,
    } as unknown as GoogleMapsRuntime;
    window.google = { maps: runtime };
  });

  it.each([
    { label: 'no nearby matches', people: [] },
    { label: 'a match at the same location', people: [{ ...person, latitude: 23.7952, longitude: 90.3818 }] },
  ])('frames the full matching area with $label', async ({ people }) => {
    const currentLocation = { lat: 23.7952, lng: 90.3818 };
    render(
      <BloodNetworkMap
        apiKey="browser-test-key"
        currentLocation={currentLocation}
        nearbyPeople={people}
        request={null}
        route={null}
        selectedPersonId={null}
        radiusMeters={5000}
        onSelectPerson={vi.fn()}
      />,
    );

    await waitFor(() => expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(1));
    expect(mapsMocks.circleConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ center: currentLocation, radius: 5000 }),
    );
    const [fittedBounds, padding] = mapsMocks.fitBounds.mock.calls[0];
    expect(fittedBounds.points).toEqual(expect.arrayContaining([currentLocation, ...matchingAreaCorners]));
    expect(padding).toBeGreaterThan(0);
  });

  it('keeps the native map viewport and overlays stable across equivalent background refreshes', async () => {
    const baseProps = {
      apiKey: 'browser-test-key',
      currentLocation: { lat: 23.7952, lng: 90.3818 },
      nearbyPeople: [person],
      request: null,
      route: null,
      selectedPersonId: null,
      radiusMeters: 5000,
      onSelectPerson: vi.fn(),
    };
    const { rerender } = render(<BloodNetworkMap {...baseProps} />);

    await waitFor(() => expect(mapsMocks.mapConstructor).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(1));
    const initialOverlayCalls = mapsMocks.createOverlay.mock.calls.length;
    expect(mapsMocks.mapConstructor.mock.calls[0]?.[1]).toMatchObject({
      gestureHandling: 'greedy',
      scrollwheel: true,
      draggable: true,
      keyboardShortcuts: true,
      zoomControl: true,
    });

    rerender(
      <BloodNetworkMap
        {...baseProps}
        currentLocation={{ ...baseProps.currentLocation }}
        nearbyPeople={[{ ...person }]}
        onSelectPerson={vi.fn()}
      />,
    );

    await waitFor(() => expect(mapsMocks.mapConstructor).toHaveBeenCalledTimes(1));
    expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(1);
    expect(mapsMocks.createOverlay).toHaveBeenCalledTimes(initialOverlayCalls);
  });

  it('fits a newly loaded blood group without resetting the viewport on every refresh', async () => {
    const props = {
      apiKey: 'browser-test-key',
      currentLocation: { lat: 23.7952, lng: 90.3818 },
      nearbyPeople: [person],
      request: null,
      route: null,
      selectedPersonId: null,
      radiusMeters: 5000,
      onSelectPerson: vi.fn(),
      viewportKey: 'O_POSITIVE',
    };
    const { rerender } = render(<BloodNetworkMap {...props} />);
    await waitFor(() => expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(1));
    rerender(<BloodNetworkMap {...props} nearbyPeople={[]} viewportKey={undefined} />);
    expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(1);
    const nextPerson = { ...person, userId: 'b-patient', bloodGroup: 'B_POSITIVE' as const, latitude: 23.82 };
    rerender(<BloodNetworkMap {...props} nearbyPeople={[nextPerson]} viewportKey="B_POSITIVE" />);
    await waitFor(() => expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(2));
    rerender(<BloodNetworkMap {...props} nearbyPeople={[{ ...nextPerson }]} viewportKey="B_POSITIVE" />);
    expect(mapsMocks.fitBounds).toHaveBeenCalledTimes(2);
    expect(mapsMocks.mapConstructor).toHaveBeenCalledTimes(1);
  });
});
