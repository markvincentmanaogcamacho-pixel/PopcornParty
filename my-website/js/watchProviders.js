/* ============================================================
   watchProviders.js — Legal streaming availability
   Fetches "Where to Watch" data from TMDB (powered by JustWatch)
   and renders links out to the official TMDB watch pages, where
   users can open the legal stream on each provider.

   Data use complies with JustWatch attribution requirements:
   see the attribution element rendered by renderWatchProviders().
   ============================================================ */

const IMG_BASE = 'https://image.tmdb.org/t/p/w92';

// Regions the site offers; saved by the visitor's region selector.
const PROVIDER_REGIONS = {
  PH: 'Philippines',
  US: 'United States',
  GB: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  IN: 'India',
  SG: 'Singapore',
  JP: 'Japan'
};

const REGION_KEY = 'popcornparty:region';

function getRegion() {
  return localStorage.getItem(REGION_KEY) || 'PH';
}

function setRegion(code) {
  localStorage.setItem(REGION_KEY, code);
}

function buildWatchLink(item, region) {
  const slug = (item.title || item.name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const type = item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie';
  return `https://www.themoviedb.org/${type}/${item.id}-${slug}/watch?locale=${region}`;
}

/* Cache provider details by id so a second fetch is never needed. */
const providerCache = {};

async function fetchProvidersList() {
  if (Object.keys(providerCache).length > 0) return providerCache;
  try {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${BASE_URL}/watch/providers/movie?api_key=${API_KEY}`),
      fetch(`${BASE_URL}/watch/providers/tv?api_key=${API_KEY}`)
    ]);
    const movie = (await movieRes.json()).results || {};
    const tv = (await tvRes.json()).results || {};
    for (const id in movie) {
      providerCache[id] = providerCache[id] || movie[id];
    }
    for (const id in tv) {
      providerCache[id] = providerCache[id] || tv[id];
    }
  } catch (err) {
    console.error('Failed to fetch provider list:', err);
  }
  return providerCache;
}

function providerLogo(provider) {
  return provider.logo_path ? `${IMG_BASE}${provider.logo_path}` : '';
}

async function renderWatchProviders(item) {
  const container = document.getElementById('watch-providers');
  if (!container) return;

  const region = getRegion();
  const isTV = item.media_type === 'tv' || item.first_air_date;
  const typePath = isTV ? 'tv' : 'movie';

  container.innerHTML = '<div class="watch-loading">Checking where it\'s streaming…</div>';

  try {
    const res = await fetch(`${BASE_URL}/${typePath}/${item.id}/watch/providers?api_key=${API_KEY}`);
    if (!res.ok) throw new Error(`Providers request failed (${res.status})`);
    const data = await res.json();
    let regional = (data.results && data.results[region]) || null;

    // If nothing is listed for the chosen region, show the US listing as a
    // useful fallback (many titles list US availability even when the local
    // catalogue entry is missing). A direct watch-page link is always shown
    // so visitors are never left without an actionable option.
    let fallbackUsed = false;
    if (!regional || !Object.keys(regional).some(k => Array.isArray(regional[k]) && regional[k].length > 0)) {
      regional = (data.results && data.results['US']) || null;
      fallbackUsed = Boolean(regional);
    }

    // Ensure we know provider logos/names for everything returned
    await fetchProvidersList();

    const sections = [
      { key: 'flatrate', label: 'Stream' },
      { key: 'free', label: 'Free' },
      { key: 'ads', label: 'Ad-supported' },
      { key: 'rent', label: 'Rent' },
      { key: 'buy', label: 'Buy' }
    ];

    let html = '';
    let found = false;
    sections.forEach(section => {
      const providers = (regional && regional[section.key]) || [];
      const sorted = [...providers].sort(
        (a, b) => (a.display_priority || 99) - (b.display_priority || 99)
      );
      if (sorted.length === 0) return;
      found = true;
      html += `<div class="watch-section"><h4>${section.label}</h4><div class="watch-grid">`;
      sorted.forEach(p => {
        const info = providerCache[String(p.provider_id)] || p;
        const name = info.provider_name || p.provider_name;
        const logo = providerLogo(info);
        html += `
          <a class="watch-provider" href="${buildWatchLink(item, region)}"
             target="_blank" rel="noopener noreferrer" title="Watch on ${name}">
            ${logo ? `<img src="${logo}" alt="${name} logo" loading="lazy" />` : ''}
            <span>${name}</span>
          </a>`;
      });
      html += '</div></div>';
    });

    if (!found) {
      html = `<div class="watch-empty">
        <i class="fas fa-circle-info"></i>
        No providers listed for ${PROVIDER_REGIONS[region] || region} in the catalogue.
      </div>`;
    }

    if (fallbackUsed) {
      html += `<div class="watch-empty" style="margin-top: 12px;">
        <i class="fas fa-globe"></i>
        Showing ${PROVIDER_REGIONS['US']} listings — availability in ${PROVIDER_REGIONS[region] || region} may differ.
      </div>`;
    }

    html += `<a class="watch-full-page" href="${buildWatchLink(item, region)}" target="_blank" rel="noopener noreferrer">
      <i class="fas fa-arrow-up-right-from-square"></i> Open full watch page (shows all providers)
    </a>`;
    html += `<div class="watch-attribution">Streaming availability data by <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a></div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('Failed to load watch providers:', err);
    container.innerHTML = `<div class="watch-empty">
      <i class="fas fa-triangle-exclamation"></i>
      Couldn't load streaming availability. Please try again.
    </div>`;
  }
}

function renderRegionSelector() {
  const select = document.getElementById('region-select');
  if (!select) return;
  select.innerHTML = '';
  const current = getRegion();
  for (const code in PROVIDER_REGIONS) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = PROVIDER_REGIONS[code];
    if (code === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function onRegionChange() {
  const select = document.getElementById('region-select');
  if (!select || !select.value) return;
  setRegion(select.value);
  // Refresh providers if the details modal is open
  if (currentItem && document.getElementById('modal').style.display === 'flex') {
    renderWatchProviders(currentItem);
  }
}
