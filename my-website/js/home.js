const API_KEY = 'a1e72fd93ed59f56e6332813b9f8dcae';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/original';
let currentItem;
let bannerItem;

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
      container.appendChild(div);
    });
  }, 100);
}

function showDetails(item) {
  currentItem = item;
  document.getElementById('modal-title').textContent = item.title || item.name;
  document.getElementById('modal-description').textContent = item.overview || 'No description available.';
  document.getElementById('modal-backdrop').style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
  document.getElementById('modal-date').textContent = item.release_date || item.first_air_date || 'N/A';
  document.getElementById('modal-vote').textContent = item.vote_average ? item.vote_average.toFixed(1) + '/10' : 'N/A';
  
  changeServer();
  document.getElementById('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function changeServer() {
  const server = document.getElementById('server').value;
  const type = currentItem.media_type === "movie" ? "movie" : "tv";
  let embedURL = "";

  if (server === "vidsrc.cc") {
    embedURL = `https://vidsrc.cc/v2/embed/${type}/${currentItem.id}`;
  } else if (server === "vidsrc.me") {
    embedURL = `https://vidsrc.net/embed/${type}/?tmdb=${currentItem.id}`;
  } else if (server === "player.videasy.net") {
    embedURL = `https://player.videasy.net/${type}/${currentItem.id}`;
  }

  document.getElementById('modal-video').src = embedURL;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-video').src = '';
  document.body.style.overflow = 'auto';
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

async function init() {
  const movies = await fetchTrending('movie');
  const tvShows = await fetchTrending('tv');
  const anime = await fetchTrendingAnime();

  if (movies.length > 0) {
    displayBanner(movies[Math.floor(Math.random() * movies.length)]);
  }
  
  displayList(movies, 'movies-list');
  displayList(tvShows, 'tvshows-list');
  displayList(anime, 'anime-list');
}

init();
