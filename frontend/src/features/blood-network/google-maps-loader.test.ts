import { describe, expect, it } from 'vitest';
import { decodeGooglePolyline } from './google-maps-loader';

describe('decodeGooglePolyline', () => {
  it('decodes the canonical Google encoded polyline example', () => {
    expect(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('returns an empty path for an empty polyline', () => {
    expect(decodeGooglePolyline('')).toEqual([]);
  });
});
