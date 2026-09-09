export type LatLngPoint = { lat: number; lng: number };

type MapsEventListener = { remove?: () => void };
export type MapInstance = {
  fitBounds: (bounds: unknown, padding?: number) => void;
  panTo: (point: LatLngPoint) => void;
  setZoom: (zoom: number) => void;
  addListener?: (event: string, listener: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) => MapsEventListener;
};

type MapConstructor = new (
  element: HTMLElement,
  options: {
    center: LatLngPoint;
    zoom: number;
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
    gestureHandling?: string;
    scrollwheel?: boolean;
    draggable?: boolean;
    keyboardShortcuts?: boolean;
    styles?: unknown[];
    backgroundColor?: string;
  },
) => MapInstance;

type CircleInstance = { setMap: (map: MapInstance | null) => void };
type CircleConstructor = new (options: {
  map: MapInstance;
  center: LatLngPoint;
  radius: number;
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  fillColor: string;
  fillOpacity: number;
  clickable?: boolean;
}) => CircleInstance;

type LatLngBoundsInstance = { extend: (point: LatLngPoint) => void };
type LatLngBoundsConstructor = new () => LatLngBoundsInstance;

type LatLngInstance = object;
type LatLngConstructor = new (lat: number, lng: number) => LatLngInstance;

type OverlayPanes = {
  overlayMouseTarget?: HTMLElement;
  floatPane?: HTMLElement;
};
type OverlayProjection = {
  fromLatLngToDivPixel: (point: LatLngInstance) => { x: number; y: number } | null;
};
type OverlayViewInstance = {
  setMap: (map: MapInstance | null) => void;
  getPanes: () => OverlayPanes;
  getProjection: () => OverlayProjection;
};
type OverlayViewConstructor = new () => OverlayViewInstance;

type PolylineInstance = { setMap: (map: MapInstance | null) => void };
type PolylineConstructor = new (options: {
  map: MapInstance;
  path: LatLngPoint[];
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  geodesic?: boolean;
  clickable?: boolean;
  zIndex?: number;
}) => PolylineInstance;

export type GoogleMapsRuntime = {
  Map: MapConstructor;
  Circle: CircleConstructor;
  LatLngBounds: LatLngBoundsConstructor;
  LatLng: LatLngConstructor;
  OverlayView: OverlayViewConstructor;
  Polyline: PolylineConstructor;
};

export type HtmlMapOverlay = {
  setMap: (map: MapInstance | null) => void;
};

declare global {
  interface Window {
    google?: { maps: GoogleMapsRuntime };
    __clinoraGoogleMapsPromise?: Promise<GoogleMapsRuntime>;
  }
}

export async function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return window.google.maps;
  if (window.__clinoraGoogleMapsPromise) return window.__clinoraGoogleMapsPromise;

  window.__clinoraGoogleMapsPromise = new Promise<GoogleMapsRuntime>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-clinora-google-maps="true"]');
    const finish = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps did not initialize.'));
    };
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.clinoraGoogleMaps = 'true';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
    document.head.appendChild(script);
  });

  return window.__clinoraGoogleMapsPromise;
}

export function createHtmlMapOverlay(
  maps: GoogleMapsRuntime,
  map: MapInstance,
  point: LatLngPoint,
  node: HTMLElement,
  zIndex = 10,
): HtmlMapOverlay {
  const BaseOverlay = maps.OverlayView;
  class ClinoraOverlay extends BaseOverlay {
    onAdd() {
      const panes = this.getPanes();
      (panes.overlayMouseTarget ?? panes.floatPane)?.appendChild(node);
    }

    draw() {
      const pixel = this.getProjection().fromLatLngToDivPixel(new maps.LatLng(point.lat, point.lng));
      if (!pixel) return;
      node.style.position = 'absolute';
      node.style.left = `${pixel.x}px`;
      node.style.top = `${pixel.y}px`;
      node.style.zIndex = String(zIndex);
      node.style.transform = 'translate(-50%, calc(-100% - 12px))';
    }

    onRemove() {
      node.remove();
    }
  }

  const overlay = new ClinoraOverlay();
  overlay.setMap(map);
  return overlay;
}

export function decodeGooglePolyline(encoded: string): LatLngPoint[] {
  const points: LatLngPoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeDelta = decodeChunk(encoded, index);
    index = latitudeDelta.nextIndex;
    const longitudeDelta = decodeChunk(encoded, index);
    index = longitudeDelta.nextIndex;
    latitude += latitudeDelta.value;
    longitude += longitudeDelta.value;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }

  return points;
}

function decodeChunk(encoded: string, startIndex: number) {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte = 0;
  do {
    if (index >= encoded.length) return { value: 0, nextIndex: index };
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, nextIndex: index };
}

export const clinoraMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#06111f' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#06111f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#73879d' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#173046' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#b4c5d5' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0b1827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#647b91' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0a2424' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#688f82' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#132537' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#091523' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a9db0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1a3448' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0d1e2e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#102132' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#041928' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4d7188' }] },
];
