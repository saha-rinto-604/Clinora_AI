import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NearbyBloodNetworkPerson } from './blood-network-api';
import { BloodNetworkMap } from './blood-network-map';
import type { GoogleMapsRuntime } from './google-maps-loader';

const mapsMocks = vi.hoisted(() => ({
  createOverlay: vi.fn(() => ({ setMap: vi.fn() })),
  fitBounds: vi.fn(),
  mapConstructor: vi.fn(),
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

describe('BloodNetworkMap', () => {
  beforeEach(() => {
    mapsMocks.createOverlay.mockClear();
    mapsMocks.fitBounds.mockClear();
    mapsMocks.mapConstructor.mockReset();
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
      extend = vi.fn();
    }
    const runtime = {
      Map: mapsMocks.mapConstructor,
      Circle: FakeShape,
      LatLngBounds: FakeBounds,
      LatLng: class FakeLatLng {},
      OverlayView: class {},
      Polyline: FakeShape,
    } as unknown as GoogleMapsRuntime;
    window.google = { maps: runtime };
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
});
