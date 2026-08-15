/* ============================================================
   playerConfig.js — Centralized player server (provider) config
   -------------------------------------------------------------
   All third-party embed providers are defined here in one place.
   Each provider defines how to build its movie and TV embed URL
   from a TMDB id (and optional season/episode numbers). The
   PlayerManager in playerManager.js uses these definitions, so
   no URL logic is scattered across the app anymore.
   ============================================================ */

/**
 * @typedef {Object} ProviderDefinition
 * @property {string} id          - Internal identifier used as the <select> value
 * @property {string} label       - Human-readable name shown to the user
 * @property {string} description - One-line hint shown next to the label
 * @property {string} movieURL    - URL template for movies
 * @property {string} tvURL       - URL template for TV shows
 *                                 Supported placeholders: {id}, {season}, {episode}
 */

/**
 * Build a URL from a template by replacing placeholders.
 * @param {string} template
 * @param {number} id
 * @param {number|string|null} season
 * @param {number|string|null} episode
 * @returns {string}
 */
function buildEmbedURL(template, id, season = null, episode = null) {
  return template
    .replaceAll('{id}', encodeURIComponent(String(id)))
    .replaceAll('{season}', encodeURIComponent(String(season ?? '')))
    .replaceAll('{episode}', encodeURIComponent(String(episode ?? '')));
}

/** @type {ProviderDefinition[]} */
const PLAYER_PROVIDERS = [
  {
    id: 'vidsrc.pro',
    label: 'Vidsrc Pro',
    description: 'Best subtitle support',
    movieURL: 'https://vidsrc.pro/embed/movie/{id}',
    tvURL: 'https://vidsrc.pro/embed/tv/{id}/{season}/{episode}',
  },
  {
    id: 'vidsrc.me',
    label: 'Vidsrc.me',
    description: '',
    movieURL: 'https://vidsrc.me/embed/movie?tmdb={id}',
    tvURL: 'https://vidsrc.me/embed/tv?tmdb={id}&season={season}&episode={episode}',
  },
  {
    id: 'vidsrc.cc',
    label: 'Vidsrc.cc',
    description: '',
    movieURL: 'https://vidsrc.cc/v2/embed/movie/{id}',
    tvURL: 'https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}',
  },
  {
    id: 'multiembed',
    label: 'MultiEmbed',
    description: '',
    movieURL: 'https://multiembed.mov/?video_id={id}&tmdb=1',
    tvURL: 'https://multiembed.mov/?video_id={id}&tmdb=1&s={season}&e={episode}',
  },
  {
    id: '2embed',
    label: '2Embed',
    description: '',
    movieURL: 'https://www.2embed.cc/embed/{id}',
    tvURL: 'https://www.2embed.cc/embedtv/{id}/{season}/{episode}',
  },
  {
    id: 'autoembed',
    label: 'AutoEmbed',
    description: '',
    movieURL: 'https://player.autoembed.cc/embed/movie/{id}',
    tvURL: 'https://player.autoembed.cc/embed/tv/{id}/{season}/{episode}',
  },
  {
    id: 'player.videasy.net',
    label: 'Videasy',
    description: '',
    movieURL: 'https://player.videasy.net/movie/{id}',
    tvURL: 'https://player.videasy.net/tv/{id}/{season}/{episode}',
  },
];

/* ---------- Player behavior settings ---------- */
const PLAYER_SETTINGS = {
  // How long (ms) to wait for an iframe to report it is loading
  // before showing a "no response" hint and offering manual fallback.
  loadTimeoutMs: 12000,
  // Default provider when the site is opened for the first time.
  defaultProviderId: 'vidsrc.pro',
  // Keys used for persisting user preferences.
  storageKeys: {
    lastProviderId: 'player:lastProviderId',
  },
};

/* ---------- Helpers ---------- */

/**
 * Look up a provider definition by its id.
 * @param {string} providerId
 * @returns {ProviderDefinition|undefined}
 */
function getProviderById(providerId) {
  return PLAYER_PROVIDERS.find((p) => p.id === providerId);
}

/**
 * Build the embed URL for a given provider and content.
 * Returns null if the provider or parameters are invalid, which
 * lets the caller fall back instead of loading a broken URL.
 * @param {string} providerId
 * @param {number} tmdbId
 * @param {'movie'|'tv'} type
 * @param {number|string|null} season
 * @param {number|string|null} episode
 * @returns {string|null}
 */
function buildProviderURL(providerId, tmdbId, type, season = null, episode = null) {
  const provider = getProviderById(providerId);
  if (!provider) return null;

  const template = type === 'tv' ? provider.tvURL : provider.movieURL;
  if (!template) return null;

  if (type === 'tv' && (season == null || episode == null)) {
    console.error('[Player] Cannot build TV URL without season/episode');
    return null;
  }

  const url = buildEmbedURL(template, tmdbId, season, episode);
  return url && url.includes('undefined') ? null : url;
}

/**
 * Remember the last provider the user selected so the site
 * opens with their preferred source next time.
 * @param {string} providerId
 */
function savePreferredProvider(providerId) {
  try {
    localStorage.setItem(PLAYER_SETTINGS.storageKeys.lastProviderId, providerId);
  } catch (err) {
    console.warn('[Player] Could not persist provider preference', err);
  }
}

/** @returns {string} The stored preference or the configured default. */
function getPreferredProvider() {
  try {
    const stored = localStorage.getItem(PLAYER_SETTINGS.storageKeys.lastProviderId);
    if (stored && getProviderById(stored)) return stored;
  } catch (err) {
    console.warn('[Player] Could not read provider preference', err);
  }
  return PLAYER_SETTINGS.defaultProviderId;
}
