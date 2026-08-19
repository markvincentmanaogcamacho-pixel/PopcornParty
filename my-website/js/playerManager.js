/* ============================================================
   playerManager.js — Player loading states, timeout, and fallback
   --------------------------------------------------------------
   This module controls the iframe player lifecycle:
     1. Shows a loading spinner while the embed initializes.
     2. Reports an error state (with manual fallback button) if
        the embed does not respond within the configured timeout.
     3. Automatically falls back to the next provider when
        loadPlayer() is called with auto-fallback enabled.
     4. Remembers per-source failures for the rest of the session.
   ============================================================ */

/** Anonymous, session-only record of providers that failed to respond. */
const failedProvidersThisSession = new Set();

/* ---------- UI helpers ---------- */

function getElements() {
  return {
    iframe: document.getElementById('modal-video'),
    selector: document.getElementById('server'),
    status: document.getElementById('player-status'),
    spinner: document.getElementById('player-spinner'),
  };
}

function showPlayerState(state) {
  const els = getElements();
  if (!els.iframe) return;

  const spinner = els.spinner;
  const status = els.status;

  if (spinner) {
    spinner.style.display = state === 'loading' ? 'flex' : 'none';
  }
  if (status) {
    status.style.display = state === 'error' ? 'block' : 'none';
  }
}

function renderProviderOptions() {
  const els = getElements();
  if (!els.selector) return;

  els.selector.innerHTML = '';
  PLAYER_PROVIDERS.forEach((provider) => {
    const option = document.createElement('option');
    option.value = provider.id;
    // Ad-level indicator: ● = low, ●● = medium, ●●● = high.
    // Plain-text dots so the native <select> renders them everywhere.
    const adDots = provider.adLevel === 'low' ? '●' : provider.adLevel === 'medium' ? '●●' : '●●●';
    const desc = provider.description ? ` — ${provider.description}` : '';
    option.textContent = `${adDots} ${provider.label}${desc}`;
    els.selector.appendChild(option);
  });

  // Restore the user's last selection, falling back to the default provider.
  els.selector.value = getPreferredProvider();
}

/* ---------- Player lifecycle ---------- */

/**
 * Load the current item into the iframe using the selected provider.
 *
 * @param {object} opts
 * @param {boolean} [opts.autoFallback=true] - Try the next working
 *   provider automatically if the selected one fails to respond.
 */
async function loadPlayer({ autoFallback = true } = {}) {
  const els = getElements();
  if (!els.iframe) {
    console.error('[Player] Player iframe not found in the DOM');
    return;
  }

  let providerId = els.selector && els.selector.value ? els.selector.value : getPreferredProvider();
  let attempts = 0;
  const maxAttempts = autoFallback ? PLAYER_PROVIDERS.length : 1;

  while (attempts < maxAttempts) {
    const embedURL = buildProviderURL(providerId, currentItem.id, playerType(), seasonValue(), episodeValue());

    if (!embedURL) {
      console.error('[Player] Could not build embed URL for', providerId);
      break;
    }

    if (autoFallback && failedProvidersThisSession.has(providerId)) {
      attempts += 1;
      providerId = nextWorkingProvider(providerId);
      continue;
    }

    console.log('[Player] Loading:', embedURL);
    els.iframe.src = embedURL;
    showPlayerState('loading');

    // If the embed does not respond in time, offer an error state and
    // (in auto-fallback mode) try the next provider on the next attempt.
    const responded = await waitForPlayerResponse(embedURL, PLAYER_SETTINGS.loadTimeoutMs);

    if (responded) {
      savePreferredProvider(providerId);
      showPlayerState('ready');
      if (els.selector && els.selector.value !== providerId) {
        els.selector.value = providerId;
      }
      return;
    }

    if (!autoFallback) break;

    failedProvidersThisSession.add(providerId);
    attempts += 1;
    providerId = nextWorkingProvider(providerId);
    if (!providerId) break;
  }

  // All known providers unresponsive — surface a manual state.
  showPlayerState('error');
  console.warn('[Player] No working provider found for this item');
}

/** @returns {'movie'|'tv'} */
function playerType() {
  return currentItem.media_type === 'tv' || currentItem.first_air_date ? 'tv' : 'movie';
}

/** @returns {number|null} The selected season, or null for movies. */
function seasonValue() {
  if (playerType() !== 'tv') return null;
  const select = document.getElementById('season-select');
  return select ? select.value : null;
}

/** @returns {number|null} The selected episode, or null for movies. */
function episodeValue() {
  if (playerType() !== 'tv') return null;
  const select = document.getElementById('episode-select');
  return select ? select.value : null;
}

/**
 * Advance to the next provider that has not already failed this session,
 * wrapping around the list once.
 * @param {string} currentId
 * @returns {string|null}
 */
function nextWorkingProvider(currentId) {
  const currentIndex = PLAYER_PROVIDERS.findIndex((p) => p.id === currentId);
  if (currentIndex === -1) return PLAYER_PROVIDERS[0]?.id ?? null;

  for (let i = 1; i < PLAYER_PROVIDERS.length; i += 1) {
    const candidate = PLAYER_PROVIDERS[(currentIndex + i) % PLAYER_PROVIDERS.length];
    if (!failedProvidersThisSession.has(candidate.id)) return candidate.id;
  }
  return null;
}

/**
 * Detect whether the embedded player appears to have started loading.
 * We rely on standard iframe events (no cross-origin content access).
 */
function waitForPlayerResponse(embedURL, timeoutMs) {
  const els = getElements();
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    // Most embeds dispatch a load event once their page starts rendering.
    const onLoad = () => {
      // Some providers (e.g. 2Embed) intentionally suppress the load event;
      // treat the absence of a load within half the timeout as "no response".
    };
    els.iframe.addEventListener('load', onLoad);

    // Cross-origin iframes only expose a limited error surface. A load event
    // arriving before the timeout is our best indication of activity.
    const timer = setTimeout(() => {
      els.iframe.removeEventListener('load', onLoad);
      settle(false);
    }, timeoutMs);

    els.iframe.addEventListener('load', () => {
      clearTimeout(timer);
      settle(true);
    }, { once: true });
  });
}

/* ---------- Public helpers ---------- */

/** Clears the failure list and jumps to the next provider. */
function retryNextServer() {
  const els = getElements();
  failedProvidersThisSession.clear();
  if (els.selector) {
    const providerId = nextWorkingProvider(els.selector.value);
    if (providerId) els.selector.value = providerId;
  }
  loadPlayer({ autoFallback: true });
}

/* ---------- Public callbacks ---------- */

/** Called from the server <select> onchange in index.html. */
function changeServer() {
  failedProvidersThisSession.clear();
  loadPlayer({ autoFallback: true });
}
