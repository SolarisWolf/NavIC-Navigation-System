import { describe, it, expect } from 'vitest';
import { GeoUriParser } from '../intents/geo-uri-parser';

describe('GeoUriParser', () => {
  it('should parse simple geo:lat,lng URI', () => {
    const uri = 'geo:28.6129,77.2295';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeCloseTo(28.6129, 4);
    expect(result.longitude).toBeCloseTo(77.2295, 4);
    expect(result.query).toBeNull();
    expect(result.zoom).toBeNull();
    expect(result.rawUri).toBe(uri);
  });

  it('should parse geo:lat,lng,altitude URI', () => {
    const uri = 'geo:28.6129,77.2295,216.5';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeCloseTo(28.6129, 4);
    expect(result.longitude).toBeCloseTo(77.2295, 4);
  });

  it('should parse geo:lat,lng?z=zoom parameter', () => {
    const uri = 'geo:28.6129,77.2295?z=16';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeCloseTo(28.6129, 4);
    expect(result.longitude).toBeCloseTo(77.2295, 4);
    expect(result.zoom).toBe(16);
  });

  it('should parse geo:lat,lng?q=Label query', () => {
    const uri = 'geo:28.6129,77.2295?q=India+Gate';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeCloseTo(28.6129, 4);
    expect(result.longitude).toBeCloseTo(77.2295, 4);
    expect(result.query).toBe('India Gate');
  });

  it('should parse geo:0,0?q=Search+Text query', () => {
    const uri = 'geo:0,0?q=Connaught+Place';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.query).toBe('Connaught Place');
  });

  it('should parse standard Android geo:0,0?q=lat,lng(Label) format', () => {
    const uri = 'geo:0,0?q=28.6562,77.2410(Red+Fort)';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeCloseTo(28.6562, 4);
    expect(result.longitude).toBeCloseTo(77.2410, 4);
    expect(result.query).toBe('Red Fort');
  });

  it('should parse google.navigation:q=lat,lng format', () => {
    const uri = 'google.navigation:q=28.5244,77.1855&mode=d';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeCloseTo(28.5244, 4);
    expect(result.longitude).toBeCloseTo(77.1855, 4);
  });

  it('should parse google.navigation:q=Name format', () => {
    const uri = 'google.navigation:q=Qutub+Minar';
    const result = GeoUriParser.parse(uri);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.query).toBe('Qutub Minar');
  });

  it('should handle raw coordinates without geo: prefix', () => {
    const result = GeoUriParser.parse('28.6129, 77.2295');

    expect(result.latitude).toBeCloseTo(28.6129, 4);
    expect(result.longitude).toBeCloseTo(77.2295, 4);
  });

  it('should return empty payload for invalid or empty strings', () => {
    const empty1 = GeoUriParser.parse('');
    expect(empty1.latitude).toBeNull();
    expect(empty1.longitude).toBeNull();

    const empty2 = GeoUriParser.parse('invalid://nonsense');
    expect(empty2.latitude).toBeNull();
    expect(empty2.longitude).toBeNull();
  });

  it('should validate coordinate bounds properly', () => {
    expect(GeoUriParser.isValidCoordinate(28.6129, 77.2295)).toBe(true);
    expect(GeoUriParser.isValidCoordinate(95.0, 77.0)).toBe(false);
    expect(GeoUriParser.isValidCoordinate(28.0, 195.0)).toBe(false);
    expect(GeoUriParser.isValidCoordinate(NaN, 77.0)).toBe(false);
  });

  it('should correctly build RFC 5870 geo URI strings', () => {
    const simple = GeoUriParser.buildGeoUri(28.6129, 77.2295);
    expect(simple).toBe('geo:28.612900,77.229500');

    const withQuery = GeoUriParser.buildGeoUri(28.6129, 77.2295, 'India Gate');
    expect(withQuery).toBe('geo:28.612900,77.229500?q=India%20Gate');
  });
});
