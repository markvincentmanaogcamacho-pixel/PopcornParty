const API_KEY = 'a1e72fd93ed59f56e6332813b9f8dcae';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;
let bannerItem;
let currentSeasons = [];
// ADD THESE NEW LINES:
let myList = JSON.parse(localStorage.getItem('myList')) || [];
let watchProgress = JSON.parse(localStorage.getItem('watchProgress')) || {};

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
        await loadEpisodes(item.id, currentSeasons[0].season_number);
      }
    }
  } else {
    episodeSelector.style.display = 'none';
  }
  
  changeServer();
  document.getElementById('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
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
        const item = await res.json();
        item.media_type = type;
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

function changeServer() {
  const server = document.getElementById('server').value;
  const isTVShow = currentItem.media_type === "tv" || currentItem.first_air_date;
  const type = isTVShow ? "tv" : "movie";
  let embedURL = "";
  
  const tmdbId = currentItem.id;

  if (isTVShow) {
    const season = document.getElementById('season-select').value;
    const episode = document.getElementById('episode-select').value;
    
    switch(server) {
      case "vidsrc.pro":
        // Vidsrc Pro - Best subtitle support
        embedURL = `https://vidsrc.pro/embed/${type}/${tmdbId}/${season}/${episode}`;
        break;
        
      case "vidsrc.me":
        embedURL = `https://vidsrc.me/embed/${type}?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
        break;
        
      case "vidsrc.cc":
        embedURL = `https://vidsrc.cc/v2/embed/${type}/${tmdbId}/${season}/${episode}`;
        break;
        
      case "multiembed":
        embedURL = `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
        break;
        
      case "2embed":
        embedURL = `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`;
        break;
        
      case "autoembed":
        embedURL = `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`;
        break;
        
      case "player.videasy.net":
        embedURL = `https://player.videasy.net/${type}/${tmdbId}/${season}/${episode}`;
        break;
        
      default:
        embedURL = `https://vidsrc.pro/embed/${type}/${tmdbId}/${season}/${episode}`;
    }
  } else {
    // Movies
    switch(server) {
      case "vidsrc.pro":
        // Vidsrc Pro - Best subtitle support
        embedURL = `https://vidsrc.pro/embed/movie/${tmdbId}`;
        break;
        
      case "vidsrc.me":
        embedURL = `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
        break;
        
      case "vidsrc.cc":
        embedURL = `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
        break;
        
      case "multiembed":
        embedURL = `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
        break;
        
      case "2embed":
        embedURL = `https://www.2embed.cc/embed/${tmdbId}`;
        break;
        
      case "autoembed":
        embedURL = `https://player.autoembed.cc/embed/movie/${tmdbId}`;
        break;
        
      case "player.videasy.net":
        embedURL = `https://player.videasy.net/movie/${tmdbId}`;
        break;
        
      default:
        embedURL = `https://vidsrc.pro/embed/movie/${tmdbId}`;
    }
  }

  console.log('Loading:', embedURL); // For debugging
  document.getElementById('modal-video').src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
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
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('search-input').focus();
  document.body.style.overflow = 'hidden';
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
  document.getElementById('search-results').innerHTML = '';
  document.getElementById('search-input').value = '';
  document.body.style.overflow = 'auto';
}

function closeSearchModalOnBackdrop(event) {
  if (event.target.id === 'search-modal') {
    closeSearchModal();
  }
}

async function searchTMDB() {
  const query = document.getElementById('search-input').value;
  if (!query.trim()) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }

  const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
  const data = await res.json();

  const container = document.getElementById('search-results');
  container.innerHTML = '';
  
  data.results.forEach(item => {
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
const GENRES = {
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
  const action = await fetchByGenre(GENRES.action);
  displayList(action, 'action-list');
  
  const comedy = await fetchByGenre(GENRES.comedy);
  displayList(comedy, 'comedy-list');
  
  const horror = await fetchByGenre(GENRES.horror);
  displayList(horror, 'horror-list');
  
  const romance = await fetchByGenre(GENRES.romance);
  displayList(romance, 'romance-list');
}

init();
