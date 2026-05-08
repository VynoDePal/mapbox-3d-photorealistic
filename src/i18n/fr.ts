// All UI strings, French. The shape of this object is the source of truth
// for translation keys — en.ts must implement the same keys.
export const fr = {
  // Search
  searchPlaceholder: 'Rechercher un lieu, une adresse…',
  searchAriaLabel: 'Rechercher un lieu',
  searchNoResults: 'Aucun résultat',
  searchNetworkError: 'Erreur réseau',

  // Categories
  categoryRestaurants: 'Restaurants',
  categoryHotels: 'Hôtels',
  categoryCafes: 'Cafés',
  categoryMuseums: 'Musées',
  categoryParks: 'Parcs',
  categoryNoneNearby: (label: string): string => `Aucun ${label.toLowerCase()} à proximité`,

  // Light presets
  presetDawn: 'Aube',
  presetDay: 'Jour',
  presetDusk: 'Crépuscule',
  presetNight: 'Nuit',
  presetAuto: 'Auto',
  presetAutoTitle: "Suivre l'heure locale",

  // Toolbar
  toolbarShare: 'Partager cette vue',
  toolbarFavorites: 'Mes lieux',
  toolbarDirections: 'Itinéraire',
  toolbarIsochrone: 'Combien de temps ?',
  toolbarStory: 'Story Paris',

  // Share / toasts
  shareCopied: 'Lien copié',
  shareCopyFail: 'Impossible de copier — sélectionne l’URL manuellement',

  // Favorites
  favPanelTitle: 'Mes lieux',
  favPlaceholder: 'Nom du lieu (ex : Notre-Dame)',
  favSave: '+ Sauvegarder cette vue',
  favSaveNeedName: 'Donne un nom au lieu d’abord',
  favSaved: (name: string): string => `« ${name} » sauvegardé`,
  favRemoved: (name: string): string => `« ${name} » supprimé`,
  favEmpty:
    'Aucun lieu sauvegardé. Navigue sur la carte, ajuste l’angle, puis sauvegarde la vue.',
  favGo: 'Aller',
  favRename: '✎',
  favDelete: '×',
  favRenamePrompt: 'Nouveau nom :',

  // Directions
  dirPanelTitle: 'Itinéraire',
  dirHint: 'Clique sur la carte pour ajouter des points',
  dirEmpty: 'Clique sur la carte pour ajouter au moins 2 points',
  dirProfileDriving: '🚗 Voiture',
  dirProfileWalking: '🚶 Marche',
  dirProfileCycling: '🚴 Vélo',
  dirSummaryDuration: 'Durée',
  dirSummaryDistance: 'Distance',
  dirFollow: '🎬 Suivre l’itinéraire',
  dirClear: 'Effacer',
  dirNoRoute: 'Aucun itinéraire trouvé',
  dirHttpError: (status: number): string => `Erreur Directions HTTP ${status}`,
  dirNetworkError: 'Erreur réseau (Directions)',

  // Isochrone
  isoHint: 'Clique sur la carte pour calculer la zone accessible',
  isoProfileLabel: 'Profil :',
  isoProfileWalking: 'Marche',
  isoProfileCycling: 'Vélo',
  isoProfileDriving: 'Voiture',
  isoClear: 'Effacer',
  isoHttpError: (status: number): string => `Erreur Isochrone HTTP ${status}`,
  isoNetworkError: 'Erreur réseau (Isochrone)',

  // Story
  storyExit: 'Quitter',
  storyHint: 'Clique sur un chapitre — appuie Esc pour quitter',

  // Lang switcher
  langFR: 'FR',
  langEN: 'EN',
  langSwitchLabel: 'Changer la langue',

  // Skip link
  skipToMap: 'Aller à la carte',

  // Token errors (in fatal-error overlay)
  errTokenMissing: 'Token Mapbox manquant',
  errTokenMissingHint:
    'Crée un fichier .env à la racine du projet avec :',
  errTokenMissingHelp:
    'Récupère un token public sur https://account.mapbox.com/access-tokens/, puis relance npm run dev. Pense à protéger ce token via une URL allowlist côté Mapbox (cf. README).',
  errTokenInvalid: 'Token Mapbox invalide',
  errTokenInvalidHint: 'Le token a été refusé par Mapbox (HTTP 401).',
  errTokenInvalidHelp:
    'Vérifie que VITE_MAPBOX_PUBLIC_TOKEN dans .env contient un token public valide (préfixe pk.).',

  // Misc
  popupNoAddress: 'Aucune adresse trouvée',
  popupLoading: 'Recherche d’adresse…',

  // Style retry (BUG-007)
  styleRetrying: 'Le style 3D met du temps à charger, nouvelle tentative…',

  // Favorites — duplicate (BUG-001)
  favDuplicate: 'Un favori avec ce nom existe déjà',

  // Undo toast (BUG-003)
  undo: 'Annuler',

  // Geolocation errors (BUG-012)
  geolocDenied: 'Géolocalisation refusée',
  geolocUnavailable: 'Géolocalisation indisponible',

  // URL preset invalid (BUG-013)
  presetInvalid: "Preset d'éclairage inconnu, utilisation du preset par défaut",

  // App title h1 sr-only (BUG-011)
  appTitle: 'Carte Mapbox 3D photoréaliste',
};

// Widened type: each property is `string` or its concrete function signature,
// so en.ts can implement the same shape with different string values.
type Widen<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => string ? (...args: A) => string : string;
};

export type Dict = Widen<typeof fr>;
