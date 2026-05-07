// Types for Mapbox Search Box, Geocoding v6, Directions, Isochrone, Categories.
// Trimmed to the fields we actually consume — extend as needed.

export interface SearchBoxSuggestion {
  mapbox_id: string;
  name: string;
  name_preferred?: string;
  feature_type?: string;
  place_formatted?: string;
  full_address?: string;
  context?: Record<string, unknown>;
}

export interface SearchBoxSuggestResponse {
  suggestions: SearchBoxSuggestion[];
  attribution?: string;
}

export interface SearchBoxRetrieveFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    coordinates?: { longitude: number; latitude: number };
    context?: Record<string, unknown>;
  };
}

export interface SearchBoxRetrieveResponse {
  type: 'FeatureCollection';
  features: SearchBoxRetrieveFeature[];
  attribution?: string;
}

export interface GeocodeV6Feature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    context?: Record<string, unknown>;
  };
}

export interface GeocodeV6Response {
  type: 'FeatureCollection';
  features: GeocodeV6Feature[];
  attribution?: string;
}

export type DirectionsProfile = 'driving' | 'walking' | 'cycling';

export interface DirectionsRoute {
  distance: number;
  duration: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  legs: unknown[];
}

export interface DirectionsResponse {
  routes: DirectionsRoute[];
  waypoints: unknown[];
  code: string;
}

export interface IsochroneFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  properties: { contour: number; color?: string; opacity?: number };
}

export interface IsochroneFeatureCollection {
  type: 'FeatureCollection';
  features: IsochroneFeature[];
}

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

export interface MapState {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
  preset: LightPreset;
}
