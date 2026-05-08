import type { Dict } from './fr.ts';

export const en: Dict = {
  searchPlaceholder: 'Search a place or address…',
  searchAriaLabel: 'Search a place',
  searchNoResults: 'No results',
  searchNetworkError: 'Network error',

  categoryRestaurants: 'Restaurants',
  categoryHotels: 'Hotels',
  categoryCafes: 'Cafés',
  categoryMuseums: 'Museums',
  categoryParks: 'Parks',
  categoryNoneNearby: (label: string): string => `No ${label.toLowerCase()} nearby`,

  presetDawn: 'Dawn',
  presetDay: 'Day',
  presetDusk: 'Dusk',
  presetNight: 'Night',
  presetAuto: 'Auto',
  presetAutoTitle: 'Follow local time',

  toolbarShare: 'Share this view',
  toolbarFavorites: 'My places',
  toolbarDirections: 'Directions',
  toolbarIsochrone: 'How far in… ?',
  toolbarStory: 'Paris story',

  shareCopied: 'Link copied',
  shareCopyFail: 'Could not copy — select the URL manually',

  favPanelTitle: 'My places',
  favPlaceholder: 'Place name (e.g. Notre-Dame)',
  favSave: '+ Save this view',
  favSaveNeedName: 'Give the place a name first',
  favSaved: (name: string): string => `"${name}" saved`,
  favRemoved: (name: string): string => `"${name}" removed`,
  favEmpty:
    'No saved places yet. Navigate the map, tweak the angle, then save the view.',
  favGo: 'Go',
  favRename: '✎',
  favDelete: '×',
  favRenamePrompt: 'New name:',

  dirPanelTitle: 'Directions',
  dirHint: 'Click the map to add waypoints',
  dirEmpty: 'Click the map to add at least 2 points',
  dirProfileDriving: '🚗 Driving',
  dirProfileWalking: '🚶 Walking',
  dirProfileCycling: '🚴 Cycling',
  dirSummaryDuration: 'Duration',
  dirSummaryDistance: 'Distance',
  dirFollow: '🎬 Follow the route',
  dirClear: 'Clear',
  dirNoRoute: 'No route found',
  dirHttpError: (status: number): string => `Directions HTTP ${status} error`,
  dirNetworkError: 'Network error (Directions)',

  isoHint: 'Click the map to compute the reachable area',
  isoProfileLabel: 'Profile:',
  isoProfileWalking: 'Walking',
  isoProfileCycling: 'Cycling',
  isoProfileDriving: 'Driving',
  isoClear: 'Clear',
  isoHttpError: (status: number): string => `Isochrone HTTP ${status} error`,
  isoNetworkError: 'Network error (Isochrone)',

  storyExit: 'Exit',
  storyHint: 'Click a chapter — press Esc to exit',

  langFR: 'FR',
  langEN: 'EN',
  langSwitchLabel: 'Change language',

  skipToMap: 'Skip to map',

  errTokenMissing: 'Missing Mapbox token',
  errTokenMissingHint: 'Create a .env file at the project root with:',
  errTokenMissingHelp:
    'Get a public token from https://account.mapbox.com/access-tokens/, then run npm run dev. Remember to protect this token with an URL allowlist on the Mapbox account (see README).',
  errTokenInvalid: 'Invalid Mapbox token',
  errTokenInvalidHint: 'The token was rejected by Mapbox (HTTP 401).',
  errTokenInvalidHelp:
    'Check that VITE_MAPBOX_PUBLIC_TOKEN in .env contains a valid public token (pk. prefix).',

  popupNoAddress: 'No address found',
  popupLoading: 'Looking up address…',
};
