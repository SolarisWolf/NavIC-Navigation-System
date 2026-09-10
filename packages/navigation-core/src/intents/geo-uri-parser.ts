/**
 * @navic/navigation-core - Geo URI Parser
 *
 * Parses Android intent URIs (geo: and google.navigation:) into structured
 * GeoIntentPayload objects for offline navigation destination resolution.
 * Supports RFC 5870 Geo URIs and Google Navigation standard intent schemes.
 */

import { GeoIntentPayload } from '@navic/shared-models';

export class GeoUriParser {
  /**
   * Parse an incoming Android intent URI or deep link into a GeoIntentPayload.
   *
   * Handles formats:
   * 1. geo:28.6129,77.2295
   * 2. geo:28.6129,77.2295,216.5
   * 3. geo:28.6129,77.2295?z=16
   * 4. geo:28.6129,77.2295?q=India+Gate
   * 5. geo:0,0?q=Connaught+Place
   * 6. geo:0,0?q=28.6129,77.2295(India+Gate)
   * 7. google.navigation:q=28.6129,77.2295
   * 8. google.navigation:q=India+Gate
   */
  public static parse(rawUri: string): GeoIntentPayload {
    const trimmed = (rawUri || '').trim();
    const timestamp = Date.now();

    const emptyResult: GeoIntentPayload = {
      latitude: null,
      longitude: null,
      query: null,
      zoom: null,
      rawUri: trimmed,
      timestamp,
    };

    if (!trimmed) {
      return emptyResult;
    }

    try {
      // ─── Case A: google.navigation:q=... ─────────────────────────────────
      if (trimmed.toLowerCase().startsWith('google.navigation:')) {
        return this.parseGoogleNavigation(trimmed, timestamp);
      }

      // ─── Case B: geo: scheme (RFC 5870 + Android extensions) ──────────────
      if (trimmed.toLowerCase().startsWith('geo:')) {
        return this.parseGeoScheme(trimmed, timestamp);
      }

      // ─── Case C: Plain coordinate string fallback (lat,lng) ───────────────
      const plainCoords = this.extractCoords(trimmed);
      if (plainCoords) {
        return {
          latitude: plainCoords.lat,
          longitude: plainCoords.lng,
          query: null,
          zoom: null,
          rawUri: trimmed,
          timestamp,
        };
      }

      return emptyResult;
    } catch {
      return emptyResult;
    }
  }

  /**
   * Parse geo:... RFC 5870 URIs.
   */
  private static parseGeoScheme(uri: string, timestamp: number): GeoIntentPayload {
    // Strip scheme prefix
    const pathAndQuery = uri.substring(4); // remove "geo:"
    const [pathPart, queryPart] = pathAndQuery.split('?');

    let latitude: number | null = null;
    let longitude: number | null = null;
    let zoom: number | null = null;
    let query: string | null = null;

    // Parse path coordinates (e.g. "28.6129,77.2295" or "0,0")
    if (pathPart) {
      const parts = pathPart.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // Only accept if not zero or if no query overrides it
        if (parts[0] !== 0 || parts[1] !== 0) {
          if (this.isValidCoordinate(parts[0], parts[1])) {
            latitude = parts[0];
            longitude = parts[1];
          }
        }
      }
    }

    // Parse query parameters
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);

      // Check for zoom parameter
      const zParam = searchParams.get('z');
      if (zParam) {
        const parsedZoom = parseFloat(zParam);
        if (!isNaN(parsedZoom) && parsedZoom >= 0 && parsedZoom <= 22) {
          zoom = parsedZoom;
        }
      }

      // Check for 'q' parameter
      const qParam = searchParams.get('q');
      if (qParam) {
        const decodedQuery = decodeURIComponent(qParam.replace(/\+/g, ' ')).trim();

        // Check for Android standard: q=lat,lng(Label)
        const labeledCoordMatch = decodedQuery.match(
          /^([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)(?:\s*\((.*)\))?$/
        );

        if (labeledCoordMatch) {
          const lat = parseFloat(labeledCoordMatch[1]);
          const lng = parseFloat(labeledCoordMatch[2]);
          const label = labeledCoordMatch[3]?.trim();

          if (this.isValidCoordinate(lat, lng)) {
            latitude = lat;
            longitude = lng;
            query = label || null;
          }
        } else {
          // If path had 0,0 and q is non-empty text, query is the search string
          query = decodedQuery;
        }
      }
    }

    return {
      latitude,
      longitude,
      query,
      zoom,
      rawUri: uri,
      timestamp,
    };
  }

  /**
   * Parse google.navigation:q=... intent URIs.
   */
  private static parseGoogleNavigation(uri: string, timestamp: number): GeoIntentPayload {
    // Strip scheme prefix (e.g. "google.navigation:")
    let queryPart = uri.substring('google.navigation:'.length);
    if (queryPart.startsWith('?')) {
      queryPart = queryPart.substring(1);
    }
    const searchParams = new URLSearchParams(queryPart);
    const qParam = searchParams.get('q');

    let latitude: number | null = null;
    let longitude: number | null = null;
    let query: string | null = null;

    if (qParam) {
      const decodedQuery = decodeURIComponent(qParam.replace(/\+/g, ' ')).trim();
      const coords = this.extractCoords(decodedQuery);

      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      } else {
        query = decodedQuery;
      }
    }

    return {
      latitude,
      longitude,
      query,
      zoom: null,
      rawUri: uri,
      timestamp,
    };
  }

  /**
   * Extract coordinates from string formatted as "lat,lng".
   */
  private static extractCoords(str: string): { lat: number; lng: number } | null {
    const match = str.match(/^([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)$/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (this.isValidCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }
    return null;
  }

  /**
   * Validate coordinate bounds.
   */
  public static isValidCoordinate(lat: number, lng: number): boolean {
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  /**
   * Build a standard RFC 5870 Geo URI.
   */
  public static buildGeoUri(latitude: number, longitude: number, query?: string): string {
    const base = `geo:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    if (query && query.trim().length > 0) {
      return `${base}?q=${encodeURIComponent(query.trim())}`;
    }
    return base;
  }
}
