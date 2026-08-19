const API_KEY = 'a1e72fd93ed59f56e6332813b9f8dcae';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;
let bannerItem;
let currentSeasons = [];
// ADD THESE NEW LINES:
let myList = JSON.parse(localStorage.getItem('myList')) || [];
let watchProgress = JSON.parse(localStorage.getItem('watchProgress')) || {};

// Tab navigation: smooth-scroll to the matching section
function scrollToSection(event) {
  const target = document.querySelector(event.currentTarget.getAttribute('href'));
  if (target) {
    event.preventDefault();
    const offset = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  }
  setActiveTab(event.currentTarget.dataset.tab);
}

function setActiveTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const active = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
  if (active) active.classList.add('active');
}

// Highlight the correct tab when scrolling past its section
function updateActiveTabOnScroll() {
  const sections = ['movies-row', 'tvshows-row', 'anime-row'];
  let active = 'home';
  for (const id of sections) {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 160) active = el.id.replace('-row', '');
  }
  const tabName = active === 'movies' ? 'movies' : active === 'tvshows' ? 'tv' : active === 'anime' ? 'anime' : 'home';
  setActiveTab(tabName);
}
window.addEventListener('scroll', updateActiveTabOnScroll);

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 100) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

async function fetchTrending(type) {
  try {
    const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
}

async function fetchTrendingAnime() {
  let allResults = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    const filtered = data.results.filter(item =>
      item.original_language === 'ja' && item.genre_ids.includes(16)
    );
    allResults = allResults.concat(filtered);
  }
  return allResults;
}

// Fetch TV show details including seasons
async function fetchTVShowDetails(tvId) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`);
    if (!res.ok) throw new Error('Failed to fetch TV details');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching TV details:', error);
    return null;
  }
}

// Fetch season details including episodes
async function fetchSeasonDetails(tvId, seasonNumber) {
  try {
    const res = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`);
    if (!res.ok) throw new Error('Failed to fetch season details');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching season details:', error);
    return null;
  }
}

function displayBanner(item) {
  bannerItem = item;
  const banner = document.getElementById('banner');
  banner.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('banner-title').textContent = item.title || item.name;
  document.getElementById('banner-description').textContent = item.overview.substring(0, 200) + '...';
}

function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div class="loading">Loading...</div>';
  
  setTimeout(() => {
    container.innerHTML = '';
    items.forEach(item => {
      if (!item.poster_path) return;
      
      const div = document.createElement('div');
      div.className = 'list-item';
      
      const img = document.createElement('img');
      img.src = `${IMG_URL}${item.poster_path}`;
      img.alt = item.title || item.name;
      img.loading = 'lazy';
      img.onclick = () => showDetails(item);
      
      div.appendChild(img);
      
      // ADD PROGRESS BAR IF ITEM HAS WATCH PROGRESS
      const progress = getWatchProgress(item.id, item.media_type || 'movie');
      if (progress && progress.percentage > 5 && progress.percentage < 95) {
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = `<div class="progress-fill" style="width: ${progress.percentage}%"></div>`;
        div.appendChild(progressBar);
        
        const badge = document.createElement('div');
        badge.className = 'continue-watching-badge';
        badge.textContent = `${Math.round(progress.percentage)}%`;
        div.appendChild(badge);
      }
      
      createHoverCard(item, div);
      container.appendChild(div);
    });
    
    addScrollButtons(containerId);
  }, 100);
}

// NEW FUNCTION - Add this after addScrollButtons function
function createHoverCard(item, containerDiv) {
  let hoverTimeout;
  let card;
  
  containerDiv.addEventListener('mouseenter', () => {
    hoverTimeout = setTimeout(() => {
      // Create hover card
      card = document.createElement('div');
      card.className = 'hover-card';
      
      const year = item.release_date?.substring(0,4) || item.first_air_date?.substring(0,4) || 'N/A';
      const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
      const description = item.overview ? 
        (item.overview.length > 120 ? item.overview.substring(0, 120) + '...' : item.overview) 
        : 'No description available.';
      
      card.innerHTML = `
        <img class="hover-card-backdrop" src="${IMG_URL}${item.backdrop_path || item.poster_path}" alt="">
        <div class="hover-card-info">
          <h3>${item.title || item.name}</h3>
          <div class="hover-card-meta">
            <span class="match">★ ${rating}</span>
            <span>${year}</span>
          </div>
          <p class="hover-card-description">${description}</p>
          <div class="hover-card-buttons">
            <button title="Play">
              <i class="fas fa-play"></i>
            </button>
            <button title="Add to My List">
              <i class="fas fa-plus"></i>
            </button>
            <button title="Like">
              <i class="fas fa-thumbs-up"></i>
            </button>
            <button title="More Info">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
        </div>
      `;
      
      // Add click handlers
      const playBtn = card.querySelector('.hover-card-buttons button:first-child');
      playBtn.onclick = (e) => {
        e.stopPropagation();
        showDetails(item);
      };
      
      const addBtn = card.querySelector('.hover-card-buttons button:nth-child(2)');
      addBtn.onclick = (e) => {
        e.stopPropagation();
        toggleMyList(item);
        addBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          addBtn.innerHTML = '<i class="fas fa-plus"></i>';
        }, 1000);
      };
      
      const infoBtn = card.querySelector('.hover-card-buttons button:last-child');
      infoBtn.onclick = (e) => {
        e.stopPropagation();
        showDetails(item);
      };
      
      containerDiv.appendChild(card);
    }, 500); // Show card after 500ms hover
  });
  
  containerDiv.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    if (card) {
      card.remove();
      card = null;
    }
  });
}

// NEW FUNCTION - Add this right after the displayList function
function addScrollButtons(containerId) {
  const container = document.getElementById(containerId);
  const row = container.parentElement;
  
  // Remove existing buttons if any
  const existingButtons = row.querySelectorAll('.scroll-btn');
  existingButtons.forEach(btn => btn.remove());
  
  // Create left arrow
  const leftBtn = document.createElement('button');
  leftBtn.className = 'scroll-btn scroll-left';
  leftBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  leftBtn.onclick = () => {
    container.scrollBy({ left: -600, behavior: 'smooth' });
  };
  
  // Create right arrow
  const rightBtn = document.createElement('button');
  rightBtn.className = 'scroll-btn scroll-right';
  rightBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  rightBtn.onclick = () => {
    container.scrollBy({ left: 600, behavior: 'smooth' });
  };
  
  // Add buttons to row
  row.appendChild(leftBtn);
  row.appendChild(rightBtn);
  
  // Hide left arrow initially if at start
  container.addEventListener('scroll', () => {
    leftBtn.style.opacity = container.scrollLeft <= 0 ? '0' : '1';
    rightBtn.style.opacity = 
      container.scrollLeft >= (container.scrollWidth - container.clientWidth) ? '0' : '1';
  });
}

async function recordWatchStart(item) {
  const isTV = item.media_type === 'tv' || item.first_air_date;
  const type = isTV ? 'tv' : 'movie';
  const key = `${item.id}-${type}`;
  const existing = watchProgress[key] || { id: item.id, mediaType: type, currentTime: 0, duration: 0, percentage: 0, timestamp: 0 };
  existing.timestamp = Date.now();
  // Remember the season/episode the viewer was on (TV) so resume means the same episode
  if (isTV) {
    const seasonEl = document.getElementById('season-select');
    const episodeEl = document.getElementById('episode-select');
    if (seasonEl) existing.season = parseInt(seasonEl.value, 10) || existing.season || 1;
    if (episodeEl) existing.episode = parseInt(episodeEl.value, 10) || existing.episode || 1;
  }
  watchProgress[key] = existing;
  localStorage.setItem('watchProgress', JSON.stringify(watchProgress));
}

let modalOpenSince = 0;

async function showDetails(item) {
  currentItem = item;
  const isTVShow = item.media_type === "tv" || item.first_air_date;
  
  document.getElementById('modal-title').textContent = item.title || item.name;
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-backdrop').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
  document.getElementById('modal-date').textContent = item.release_date || item.first_air_date || 'N/A';
  document.getElementById('modal-vote').textContent = item.vote_average ? item.vote_average.toFixed(1) + '/10' : 'N/A';
  
  // Show/hide season/episode selectors based on content type
  const episodeSelector = document.getElementById('episode-selector');
  const serverSelector = document.getElementById('server-selector');
  
  if (isTVShow) {
    // Fetch TV show details to get seasons
    const tvDetails = await fetchTVShowDetails(item.id);
    if (tvDetails && tvDetails.seasons) {
      currentSeasons = tvDetails.seasons.filter(s => s.season_number > 0); // Filter out "specials"
      populateSeasonSelector(currentSeasons);
      episodeSelector.style.display = 'block';
      
      // Load first season's episodes
      if (currentSeasons.length > 0) {
        // Resume: if the visitor came from Continue Watching, open the
        // exact season/episode they were last watching.
        const savedSeason = item._savedSeason || 1;
        const season = currentSeasons.find(s => s.season_number === savedSeason) || currentSeasons[0];
        if (season.season_number !== currentSeasons[0].season_number) {
          document.getElementById('season-select').value = season.season_number;
        }
        await loadEpisodes(item.id, season.season_number);
        // After episodes load, select the saved episode if it exists
        if (item._savedEpisode) {
          const epSelect = document.getElementById('episode-select');
          if (epSelect && [...epSelect.options].some(o => o.value === String(item._savedEpisode))) {
            epSelect.value = String(item._savedEpisode);
          }
        }
      }
    }
  } else {
    episodeSelector.style.display = 'none';
  }
  
  renderProviderOptions();
  changeServer();
  document.getElementById('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  recordWatchStart(item);
  modalOpenSince = Date.now();
}

function populateSeasonSelector(seasons) {
  const seasonSelect = document.getElementById('season-select');
  seasonSelect.innerHTML = '';
  
  seasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.season_number;
    option.textContent = `Season ${season.season_number}`;
    seasonSelect.appendChild(option);
  });
}

// Get recently watched items
function getContinueWatching() {
  const items = Object.values(watchProgress)
    .filter(p => p.percentage > 5 && p.percentage < 95)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);
  
  return items;
}

async function displayContinueWatching() {
  const continueItems = getContinueWatching();
  const row = document.getElementById('continue-watching-row');
  
  if (continueItems.length === 0) {
    row.style.display = 'none';
    return;
  }
  
  row.style.display = 'block';
  
  // Fetch full item details for each continue watching item
  const fullItems = await Promise.all(
    continueItems.map(async (progress) => {
      try {
        const type = progress.mediaType || 'movie';
        const res = await fetch(`${BASE_URL}/${type}/${progress.id}?api_key=${API_KEY}`);
        if (!res.ok) return null;
        const item = await res.json();
        item.media_type = type;
        // Attach the saved season/episode so the row can resume at the
        // right place instead of always opening at S1E1.
        item._savedSeason = progress.season || null;
        item._savedEpisode = progress.episode || null;
        return item;
      } catch (error) {
        console.error('Error fetching continue watching item:', error);
        return null;
      }
    })
  );
  
  const validItems = fullItems.filter(item => item !== null);
  displayList(validItems, 'continue-watching-list');
}

// Clear the Continue Watching history (called from the section's × button)
function clearContinueWatching() {
  watchProgress = {};
  localStorage.removeItem('watchProgress');
  const row = document.getElementById('continue-watching-row');
  if (row) row.style.display = 'none';
}
async function loadEpisodes(tvId, seasonNumber) {
  const episodeSelect = document.getElementById('episode-select');
  episodeSelect.innerHTML = '<option>Loading episodes...</option>';
  
  const seasonDetails = await fetchSeasonDetails(tvId, seasonNumber);
  
  if (seasonDetails && seasonDetails.episodes) {
    episodeSelect.innerHTML = '';
    seasonDetails.episodes.forEach(episode => {
      const option = document.createElement('option');
      option.value = episode.episode_number;
      option.textContent = `Episode ${episode.episode_number}: ${episode.name}`;
      episodeSelect.appendChild(option);
    });
    
    // Automatically load first episode
    changeServer();
  } else {
    episodeSelect.innerHTML = '<option>No episodes found</option>';
  }
}

async function onSeasonChange() {
  const seasonNumber = document.getElementById('season-select').value;
  await loadEpisodes(currentItem.id, seasonNumber);
}

function onEpisodeChange() {
  changeServer();
}

/* -----------------------------------------------------------------
   Player servers are now managed by js/playerConfig.js and
   js/playerManager.js: provider URLs live in one configuration
   object, and the manager handles loading states, timeouts,
   automatic fallback, and remembering the user's preferred source.
   ----------------------------------------------------------------- */
// The old changeServer() was replaced by the loadPlayer() pipeline.
// changeServer() remains as the public onchange callback used by
// index.html and still routes through the new player manager.

function closePlayer() {
  const iframe = document.getElementById('modal-video');
  if (iframe) iframe.src = '';
  showPlayerState ? showPlayerState('idle') : undefined;
}

/* Finish a watch session: convert the time the modal was open into an
   approximate watched percentage using the title's runtime (TMDB minutes).
   We cap growth so repeatedly opening/closing doesn't invent progress. */
function finishWatchSession() {
  if (!currentItem || !modalOpenSince) return;
  const elapsedMs = Math.min(Date.now() - modalOpenSince, 6 * 3600 * 1000); // sane cap
  const minutesWatched = elapsedMs / 60000;
  const isTV = currentItem.media_type === 'tv' || currentItem.first_air_date;
  const type = isTV ? 'tv' : 'movie';
  const runtime = (currentItem.runtime || currentItem.episode_run_time?.[0] || 22);
  const key = `${currentItem.id}-${type}`;
  const entry = watchProgress[key] || { id: currentItem.id, mediaType: type, currentTime: 0, duration: runtime, percentage: 0, timestamp: Date.now() };
  entry.duration = runtime;
  const addedPct = Math.min((minutesWatched / runtime) * 100, 100);
  entry.percentage = Math.min((entry.percentage || 0) + addedPct, 99.9);
  entry.timestamp = Date.now();
  watchProgress[key] = entry;
  localStorage.setItem('watchProgress', JSON.stringify(watchProgress));
}

function closeModal() {
  finishWatchSession();
  modalOpenSince = 0;
  document.getElementById('modal').style.display = 'none';
  closePlayer();
  document.body.style.overflow = 'auto';
  currentSeasons = [];
}

function closeModalOnBackdrop(event) {
  if (event.target.id === 'modal') {
    closeModal();
  }
}

function playBanner() {
  if (bannerItem) {
    showDetails(bannerItem);
  }
}

function showBannerInfo() {
  if (bannerItem) {
    showDetails(bannerItem);
  }
}

function openSearchModal() {
  populateSearchFilters();
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
  document.body.style.overflow = 'hidden';
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-suggestions').style.display = 'none';
  document.getElementById('search-input').value = '';
  document.body.style.overflow = 'auto';
}

function closeSearchModalOnBackdrop(event) {
  if (event.target.id === 'search-modal') {
    closeSearchModal();
  }
}

/* ---------- Advanced search: filters + live suggestions ---------- */
let lastSearchResults = [];
let searchDebounceTimer = null;
let suggestionDebounceTimer = null;
let currentSearchQuery = '';

// Genre list shared by the filter dropdown and results
const GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' },
  { id: 99, name: 'Documentary' }, { id: 53, name: 'Thriller' }, { id: 10752, name: 'War' }
];

// Prepopulate genre and year dropdowns when the modal opens
function populateSearchFilters() {
  const genreSelect = document.getElementById('filter-genre');
  if (genreSelect && genreSelect.options.length <= 1) {
    GENRES.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      genreSelect.appendChild(opt);
    });
  }
  const yearSelect = document.getElementById('filter-year');
  if (yearSelect && yearSelect.options.length <= 1) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 25; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }
  }
}

// Debounced typing: suggestions first, then full search
function onSearchInput() {
  clearTimeout(suggestionDebounceTimer);
  clearTimeout(searchDebounceTimer);
  const query = document.getElementById('search-input').value;
  currentSearchQuery = query;

  if (!query.trim()) {
    document.getElementById('search-suggestions').style.display = 'none';
    document.getElementById('search-results').innerHTML = '';
    lastSearchResults = [];
    return;
  }

  // Live suggestions appear quickly (250ms)
  suggestionDebounceTimer = setTimeout(() => fetchSuggestions(query), 250);
  // Full poster-grid search follows after 500ms of no typing
  searchDebounceTimer = setTimeout(() => applySearchFilters(), 500);
}

async function fetchSuggestions(query) {
  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    renderSuggestions(data.results || []);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
  }
}

function renderSuggestions(items) {
  const box = document.getElementById('search-suggestions');
  const shown = items
    .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.title || item.name)
    .slice(0, 6);
  if (shown.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.innerHTML = '';
  shown.forEach(item => {
    const row = document.createElement('div');
    row.className = 'suggestion-row';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    row.innerHTML = `<img src="${IMG_URL}${item.backdrop_path || item.poster_path}" alt="" loading="lazy" />
      <div class="suggestion-info"><span class="suggestion-title">${title}</span>
      <span class="suggestion-meta">${item.media_type === 'tv' ? 'TV Show' : 'Movie'}${year ? ' · ' + year : ''}</span></div>`;
    row.onclick = () => {
      document.getElementById('search-input').value = title;
      closeSearchModal();
      showDetails(item);
    };
    box.appendChild(row);
  });
  box.style.display = 'block';
}

// Combined filter application (type + genre + year)
async function applySearchFilters() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    lastSearchResults = [];
    return;
  }
  document.getElementById('search-suggestions').style.display = 'none';
  const type = document.getElementById('filter-type').value;
  const genre = document.getElementById('filter-genre').value;
  const year = document.getElementById('filter-year').value;

  // Anime quick filter: TV shows flagged as Japanese animation
  const isAnime = type === 'anime';
  const searchType = type ? (isAnime ? 'tv' : type) : 'multi';

  try {
    let url = `${BASE_URL}/search/${searchType}?api_key=${API_KEY}&query=${encodeURIComponent(query)}`;
    if (year) url += `&${type === 'tv' || !type ? 'first_air_date_year' : 'year'}=${year}`;
    const res = await fetch(url);
    const data = await res.json();
    let results = data.results || [];

    // Client-side genre filter (search API doesn't filter genres reliably)
    if (genre) {
      results = results.filter(item =>
        (item.genre_ids || []).map(Number).includes(Number(genre))
      );
    }
    // Anime flag filter (TV shows originally in Japanese with Animation genre)
    if (isAnime) {
      results = results.filter(item =>
        item.original_language === 'ja' && (item.genre_ids || []).map(Number).includes(16)
      );
    }
    lastSearchResults = results;
    renderSearchResults(results);
  } catch (error) {
    console.error('Error applying search filters:', error);
  }
}

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  container.innerHTML = '';
  if (results.length === 0) {
    container.innerHTML = '<p class="no-results">No results found. Try a different title or filter.</p>';
    return;
  }
  results.forEach(item => {
    if (!item.poster_path) return;
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    img.loading = 'lazy';
    img.onclick = () => {
      closeSearchModal();
      showDetails(item);
    };
    container.appendChild(img);
  });
}

// Navbar quick filter dropdown
function quickFilter(type) {
  document.getElementById('search-type-filter').value = '';
  openSearchModal();
  document.getElementById('filter-type').value = type === 'anime' ? 'tv' : type;
  document.getElementById('search-input').focus();
  if (type === 'anime') {
    document.getElementById('search-input').placeholder = 'Search anime titles...';
  }
}

// ========== MY LIST FUNCTIONALITY ==========

function toggleMyList(item) {
  const index = myList.findIndex(i => i.id === item.id && i.media_type === item.media_type);
  
  if (index > -1) {
    // Remove from list
    myList.splice(index, 1);
    console.log('Removed from My List:', item.title || item.name);
  } else {
    // Add to list
    myList.push(item);
    console.log('Added to My List:', item.title || item.name);
  }
  
  // Save to localStorage
  localStorage.setItem('myList', JSON.stringify(myList));
  
  // Refresh My List display
  displayMyList();
}

function isInMyList(itemId, mediaType) {
  return myList.some(item => item.id === itemId && item.media_type === mediaType);
}

function displayMyList() {
  const row = document.getElementById('mylist-row');
  const container = document.getElementById('mylist-list');
  
  if (myList.length === 0) {
    row.style.display = 'none';
    return;
  }
  
  row.style.display = 'block';
  displayList(myList, 'mylist-list');
}

// ========== WATCH PROGRESS FUNCTIONALITY ==========

function updateWatchProgress(itemId, mediaType, currentTime, duration) {
  const key = `${itemId}-${mediaType}`;
  
  watchProgress[key] = {
    id: itemId,
    mediaType: mediaType,
    currentTime: currentTime,
    duration: duration,
    percentage: (currentTime / duration) * 100,
    timestamp: Date.now()
  };
  
  localStorage.setItem('watchProgress', JSON.stringify(watchProgress));
}

function getWatchProgress(itemId, mediaType) {
  const key = `${itemId}-${mediaType}`;
  return watchProgress[key] || null;
}
// ========== GENRE FUNCTIONALITY ==========
// Genre IDs from TMDB API
const GENRE_IDS = {
  action: 28,
  comedy: 35,
  horror: 27,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  documentary: 99,
  animation: 16
};

async function fetchByGenre(genreId, type = 'movie') {
  try {
    const res = await fetch(
      `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=1`
    );
    if (!res.ok) throw new Error('Failed to fetch genre');
    const data = await res.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching genre:', error);
    return [];
  }
}

// ========== END GENRE FUNCTIONALITY ==========

async function init() {
  const movies = await fetchTrending('movie');
  const tvShows = await fetchTrending('tv');
  const anime = await fetchTrendingAnime();

  if (movies.length > 0) {
    displayBanner(movies[Math.floor(Math.random() * movies.length)]);
  }
  
  displayMyList();
  displayContinueWatching();
  
  displayList(movies, 'movies-list');
  displayList(tvShows, 'tvshows-list');
  displayList(anime, 'anime-list');
  
  // ADD THESE LINES FOR GENRE CATEGORIES:
  const action = await fetchByGenre(GENRE_IDS.action);
  displayList(action, 'action-list');
  
  const comedy = await fetchByGenre(GENRE_IDS.comedy);
  displayList(comedy, 'comedy-list');
  
  const horror = await fetchByGenre(GENRE_IDS.horror);
  displayList(horror, 'horror-list');
  
  const romance = await fetchByGenre(GENRE_IDS.romance);
  displayList(romance, 'romance-list');
}

init();

/* ============ PWA install prompt ============ */
let deferredPrompt = null;

function installPopcornParty() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choice) => {
    if (choice.outcome === "accepted") {
      console.log("User installed the app");
    }
    deferredPrompt = null;
    hideInstallBanner();
  });
  return true;
}

function showInstallBanner() {
  const banner = document.getElementById("install-banner");
  const btn = document.getElementById("install-btn");
  if (!banner) return;
  banner.style.display = "block";
  if (deferredPrompt) {
    // Android/Chrome: the button installs the app
    btn.innerHTML = '<i class="fas fa-download"></i>';
    btn.title = "Install app";
    btn.onclick = () => installPopcornParty();
  } else {
    // iOS/Safari: the prompt cannot be captured; give manual instructions
    btn.innerHTML = '<i class="fas fa-times"></i>';
    btn.title = "Dismiss";
    btn.onclick = () => dismissInstallBanner();
    const text = banner.querySelector("span");
    if (text) text.textContent = "Tap Share, then Add to Home Screen to install.";
  }
}

function hideInstallBanner() {
  const banner = document.getElementById("install-banner");
  if (banner) banner.style.display = "none";
}

function dismissInstallBanner() {
  hideInstallBanner();
  try { sessionStorage.setItem("pp-install-dismissed", "1"); } catch (e) {}
}

// Capture the beforeinstallprompt event (Chromium desktop/Android)
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  try {
    if (sessionStorage.getItem("pp-install-dismissed")) return;
  } catch (e) {}
  setTimeout(showInstallBanner, 3000);
});

// Already installed (standalone mode): never show the banner
if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
  const b = document.getElementById("install-banner");
  if (b) b.remove();
}
