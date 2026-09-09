import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Route } from 'lucide-react';
import type { BloodRequestDetail, BloodRoute, NearbyBloodNetworkPerson } from './blood-network-api';
import { bloodGroupLabel, distanceLabel, durationLabel } from './blood-network-api';
import {
  clinoraMapStyles,
  createHtmlMapOverlay,
  decodeGooglePolyline,
  loadGoogleMaps,
  type HtmlMapOverlay,
  type LatLngPoint,
  type MapInstance,
} from './google-maps-loader';

type BloodNetworkMapProps = {
  apiKey: string;
  currentLocation: LatLngPoint | null;
  nearbyPeople: NearbyBloodNetworkPerson[];
  request: BloodRequestDetail | null;
  route: BloodRoute | null;
  selectedPersonId: string | null;
  radiusMeters: number;
  onSelectPerson: (person: NearbyBloodNetworkPerson) => void;
  onPickRequestLocation?: (point: LatLngPoint) => void;
};

export function BloodNetworkMap({
  apiKey,
  currentLocation,
  nearbyPeople,
  request,
  route,
  selectedPersonId,
  radiusMeters,
  onSelectPerson,
  onPickRequestLocation,
}: BloodNetworkMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const onSelectPersonRef = useRef(onSelectPerson);
  const onPickRequestLocationRef = useRef(onPickRequestLocation);
  const initialViewportSetRef = useRef(false);
  const [mapRevision, setMapRevision] = useState(0);
  const [loadError, setLoadError] = useState('');
  onSelectPersonRef.current = onSelectPerson;
  onPickRequestLocationRef.current = onPickRequestLocation;
  const mapCurrentLocation = useSemanticSnapshot(currentLocation);
  const mapPeople = useSemanticSnapshot(nearbyPeople);
  const mapRequest = useSemanticSnapshot(request);
  const mapRoute = useSemanticSnapshot(route);
  const requestLocation = useMemo(
    () => (mapRequest ? { lat: mapRequest.latitude, lng: mapRequest.longitude } : null),
    [mapRequest],
  );
  const initialCenter = requestLocation ?? mapCurrentLocation;
  const requestLocationPickingEnabled = onPickRequestLocation != null;

  useEffect(() => {
    if (!containerRef.current || !apiKey || !initialCenter || mapRef.current) return;
    let cancelled = false;

    setLoadError('');
    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: initialCenter,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          scrollwheel: true,
          draggable: true,
          keyboardShortcuts: true,
          backgroundColor: '#06111f',
          styles: clinoraMapStyles,
        });
        setMapRevision((revision) => revision + 1);
      })
      .catch(() => !cancelled && setLoadError('Google Maps could not be loaded. Check the browser key and Maps JavaScript API.'));

    return () => {
      cancelled = true;
    };
  }, [apiKey, initialCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapRevision === 0) return;
    const maps = window.google?.maps;
    if (!maps) return;

    const overlays: HtmlMapOverlay[] = [];
    let circle: { setMap: (map: null) => void } | null = null;
    const routeLines: { setMap: (map: null) => void }[] = [];
    const bounds = new maps.LatLngBounds();
    let boundsPointCount = 0;

    if (mapCurrentLocation) {
      bounds.extend(mapCurrentLocation);
      boundsPointCount += 1;
      overlays.push(
        createHtmlMapOverlay(maps, map, mapCurrentLocation, locationMarker('You', 'Saved matching area', 'current'), 20),
      );
    }

    const radiusCenter = requestLocation ?? mapCurrentLocation;
    if (radiusCenter) {
      circle = new maps.Circle({
        map,
        center: radiusCenter,
        radius: radiusMeters,
        strokeColor: '#22d3ee',
        strokeOpacity: 0.48,
        strokeWeight: 1.5,
        fillColor: '#0891b2',
        fillOpacity: 0.075,
        clickable: false,
      }) as { setMap: (map: null) => void };
    }

    if (requestLocation) {
      bounds.extend(requestLocation);
      boundsPointCount += 1;
      overlays.push(
        createHtmlMapOverlay(
          maps,
          map,
          requestLocation,
          locationMarker(
            mapRequest ? `${bloodGroupLabel(mapRequest.bloodGroup)} blood needed` : 'Blood needed',
            mapRequest?.hospitalName ?? 'Request location',
            'request',
          ),
          35,
        ),
      );
    }

    for (const person of mapPeople) {
      const point = { lat: person.latitude, lng: person.longitude };
      bounds.extend(point);
      boundsPointCount += 1;
      const selected = person.userId === selectedPersonId;
      const node = personMarker(person, selected, selected ? mapRoute : null);
      node.addEventListener('click', () => onSelectPersonRef.current(person));
      overlays.push(createHtmlMapOverlay(maps, map, point, node, selected ? 34 : person.responseStatus === 'ACCEPTED' ? 28 : 14));
    }

    if (mapRoute?.encodedPolyline) {
      const path = decodeGooglePolyline(mapRoute.encodedPolyline);
      if (path.length > 1) {
        for (const point of path) {
          bounds.extend(point);
          boundsPointCount += 1;
        }
        routeLines.push(
          new maps.Polyline({
            map,
            path,
            strokeColor: '#020617',
            strokeOpacity: 0.82,
            strokeWeight: 10,
            clickable: false,
            zIndex: 29,
          }) as { setMap: (map: null) => void },
          new maps.Polyline({
            map,
            path,
            strokeColor: '#22d3ee',
            strokeOpacity: 1,
            strokeWeight: 5,
            clickable: false,
            zIndex: 30,
          }) as { setMap: (map: null) => void },
        );
        overlays.push(
          createHtmlMapOverlay(maps, map, path[Math.floor(path.length / 2)], routeSummaryMarker(mapRoute), 40),
        );
      }
    }

    if (!initialViewportSetRef.current && boundsPointCount > 0) {
      map.fitBounds(bounds, 84);
      initialViewportSetRef.current = true;
    }

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null));
      circle?.setMap(null);
      routeLines.forEach((line) => line.setMap(null));
    };
  }, [mapCurrentLocation, mapPeople, mapRequest, mapRevision, mapRoute, radiusMeters, requestLocation, selectedPersonId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapRevision === 0 || !requestLocationPickingEnabled || !map.addListener) return;
    const clickListener = map.addListener('click', (event) => {
      const latLng = event.latLng;
      if (latLng) onPickRequestLocationRef.current?.({ lat: latLng.lat(), lng: latLng.lng() });
    });
    return () => clickListener?.remove?.();
  }, [mapRevision, requestLocationPickingEnabled]);

  if (!apiKey) {
    return <MapUnavailable message="Set VITE_GOOGLE_MAPS_API_KEY in the root .env and rebuild the frontend." />;
  }
  if (!currentLocation && !requestLocation) {
    return <MapUnavailable message="Add a valid address to your Health Profile so Clinora can place you on the map." />;
  }

  return (
    <div className="relative h-full min-h-[560px] overflow-hidden rounded-[inherit] bg-[#06111f]">
      <div ref={containerRef} className="absolute inset-0" aria-label="Blood Network map" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,8,18,0.16),transparent_22%,transparent_78%,rgba(2,8,18,0.22))]" />
      {loadError ? (
        <div className="absolute inset-x-4 top-4 z-30 rounded-xl border border-rose-300/20 bg-slate-950/92 px-4 py-3 text-sm text-rose-100 backdrop-blur">
          {loadError}
        </div>
      ) : null}
      {route ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-slate-950/88 px-3.5 py-2.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-xl">
          <Route size={14} className="text-cyan-300" aria-hidden="true" />
          <span>{distanceLabel(route.distanceMeters)}</span>
          <span className="text-slate-600">·</span>
          <span>{durationLabel(route.durationSeconds)}</span>
          <span className="text-slate-500">by road</span>
        </div>
      ) : null}
    </div>
  );
}

function useSemanticSnapshot<T>(value: T): T {
  const serialized = JSON.stringify(value);
  const snapshotRef = useRef({ serialized, value });
  if (snapshotRef.current.serialized !== serialized) {
    snapshotRef.current = { serialized, value };
  }
  return snapshotRef.current.value;
}

function MapUnavailable({ message }: { message: string }) {
  return (
    <div className="grid min-h-[560px] place-items-center rounded-[inherit] bg-[radial-gradient(circle_at_50%_35%,rgba(8,145,178,0.16),transparent_35%),#07111f] p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200">
          <MapPin size={20} aria-hidden="true" />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-white">Map setup required</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function locationMarker(title: string, subtitle: string, tone: 'current' | 'request') {
  const root = document.createElement('div');
  root.style.cssText = 'font-family:Inter,ui-sans-serif,system-ui,sans-serif;pointer-events:auto;';
  const card = document.createElement('div');
  const request = tone === 'request';
  card.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:9px',
    'padding:9px 11px',
    'border-radius:14px',
    `border:1px solid ${request ? 'rgba(251,113,133,.38)' : 'rgba(34,211,238,.32)'}`,
    'background:rgba(3,10,20,.95)',
    'box-shadow:0 20px 48px rgba(0,0,0,.42)',
    'color:#fff',
    'white-space:nowrap',
  ].join(';');
  const dot = document.createElement('span');
  dot.style.cssText = `width:11px;height:11px;border-radius:999px;background:${request ? '#fb7185' : '#22d3ee'};box-shadow:0 0 0 5px ${request ? 'rgba(251,113,133,.12)' : 'rgba(34,211,238,.12)'};`;
  const copy = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = title;
  strong.style.cssText = 'display:block;font-size:11px;font-weight:800;letter-spacing:.01em;';
  const small = document.createElement('span');
  small.textContent = subtitle;
  small.style.cssText = 'display:block;margin-top:2px;color:#94a3b8;font-size:10px;max-width:190px;overflow:hidden;text-overflow:ellipsis;';
  copy.append(strong, small);
  card.append(dot, copy);
  root.appendChild(card);
  return root;
}

function personMarker(person: NearbyBloodNetworkPerson, selected: boolean, route: BloodRoute | null) {
  const root = document.createElement('button');
  root.type = 'button';
  root.setAttribute('aria-label', `${person.displayName}, ${bloodGroupLabel(person.bloodGroup)}, ${distanceLabel(person.distanceMeters)} away`);
  root.style.cssText = 'border:0;background:transparent;padding:0;cursor:pointer;font-family:Inter,ui-sans-serif,system-ui,sans-serif;pointer-events:auto;';
  const accepted = person.responseStatus === 'ACCEPTED';
  const card = document.createElement('div');
  card.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:9px',
    'padding:8px 10px',
    'border-radius:14px',
    `border:1px solid ${selected ? 'rgba(34,211,238,.72)' : accepted ? 'rgba(52,211,153,.4)' : 'rgba(148,163,184,.22)'}`,
    `background:${selected ? 'rgba(8,47,73,.97)' : 'rgba(3,10,20,.95)'}`,
    'box-shadow:0 18px 44px rgba(0,0,0,.4)',
    'color:#fff',
    'white-space:nowrap',
    `transform:${selected ? 'scale(1.035)' : 'scale(1)'}`,
    'transition:transform .18s ease,border-color .18s ease',
  ].join(';');
  const avatar = document.createElement('span');
  avatar.textContent = bloodGroupLabel(person.bloodGroup);
  avatar.style.cssText = `display:grid;width:32px;height:32px;place-items:center;border-radius:11px;background:${accepted ? 'rgba(52,211,153,.13)' : 'rgba(34,211,238,.11)'};color:${accepted ? '#a7f3d0' : '#a5f3fc'};font-size:10px;font-weight:900;`;
  const copy = document.createElement('span');
  const name = document.createElement('strong');
  name.textContent = person.displayName;
  name.style.cssText = 'display:block;font-size:11px;font-weight:800;';
  const meta = document.createElement('span');
  if (selected && accepted && person.phone) {
    const routeMeta = route ? `${distanceLabel(route.distanceMeters)} · ${durationLabel(route.durationSeconds)}` : distanceLabel(person.distanceMeters);
    meta.textContent = `${routeMeta} · ${person.phone}`;
  } else {
    meta.textContent = `${distanceLabel(person.distanceMeters)} · ${accepted ? 'Accepted' : 'Nearby'}`;
  }
  meta.style.cssText = 'display:block;margin-top:2px;color:#94a3b8;font-size:10px;';
  copy.append(name, meta);
  card.append(avatar, copy);
  root.appendChild(card);
  return root;
}

function routeSummaryMarker(route: BloodRoute) {
  const root = document.createElement('div');
  root.style.cssText = 'font-family:Inter,ui-sans-serif,system-ui,sans-serif;pointer-events:none;';
  const label = document.createElement('div');
  label.textContent = `${distanceLabel(route.distanceMeters)} by road / ${durationLabel(route.durationSeconds)}`;
  label.style.cssText = [
    'padding:7px 10px',
    'border-radius:999px',
    'border:1px solid rgba(34,211,238,.55)',
    'background:rgba(2,6,23,.94)',
    'box-shadow:0 12px 32px rgba(0,0,0,.48)',
    'color:#cffafe',
    'font-size:10px',
    'font-weight:800',
    'white-space:nowrap',
  ].join(';');
  root.appendChild(label);
  return root;
}
