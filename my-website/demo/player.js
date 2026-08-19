/* ==========================================================================
   Player Manager — learning demo
   Same pattern as a player-server aggregator (provider config, prioritized
   fallback chain, loading/error states, anonymous telemetry) but wired to
   legally licensed media only:
     - Primary: Big Buck Bunny HLS master playlist (Mux test streams, CORS
       enabled, 184p/288p/480p/720p/1080p adaptive levels)
     - Secondary: MDN's Creative Commons flower.mp4 (no adaptive variants)
     - Broken: deliberately unreachable host to demonstrate the fallback chain
   ========================================================================== */

/* --------------------------- Server configuration ---------------------------
   Priority = array order. The manager always tries index 0 first.
   `status: "down"` simulates a real outage. */
const SOURCES = [
  {
    key: "mux-hls",
    name: "Primary CDN — Mux (HLS adaptive)",
    status: "up",
    // Master playlist with five bandwidth-adaptive levels (184p … 1080p)
    getUrl: () => "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    adaptive: true,
  },
  {
    key: "mdn-mp4",
    name: "Secondary CDN — MDN (direct mp4)",
    status: "up",
    getUrl: () => "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    adaptive: false,
  },
  {
    key: "broken",
    name: "Broken CDN — simulated outage",
    status: "down",
    // Deliberately unreachable: triggers timeout + fallback
    getUrl: () => "https://example.invalid/stream/master.m3u8",
    adaptive: false,
  },
];

/* --------------------------------- Media ---------------------------------- */
const MEDIA = [
  {
    id: "bbb",
    title: "Big Buck Bunny",
    year: 2008,
    poster: "https://peach.blender.org/wp-content/uploads/bbb-splash.png",
    credit: "Blender Foundation — CC BY 3.0",
    note: "Primary source plays the 10-minute trailer in 5 adaptive qualities.",
  },
  {
    id: "clip",
    title: "Sample Clip",
    year: 2008,
    poster: "https://test-videos.co.uk/images/thumb/bigbuckbunny.jpg",
    credit: "MDN — CC0 flower clip",
    note: "Plays on the Secondary CDN (plain mp4, no quality switching).",
  },
];

/* ------------------------------ Player state ------------------------------ */
const TIMEOUT_MS = 8000;
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");
const retryBtn = document.getElementById("retry-btn");
const qualitySelect = document.getElementById("quality-select");
const sourceSelect = document.getElementById("source-select");
const logBox = document.getElementById("log");

let hls = null;
let loadTimer = null;
let startedAt = null;
let currentSourceIndex = 0;
let currentMedia = MEDIA[0];
let failedSources = new Set(); // session-scoped failure memory

/* --------------------------------- Telemetry -------------------------------- */
function log(entry) {
  const ts = new Date().toLocaleTimeString();
  logBox.textContent = `[${ts}] ${entry}\n` + logBox.textContent;
}

/* --------------------------------- Overlay --------------------------------- */
function showOverlay(msg) {
  overlay.classList.add("visible");
  overlayText.textContent = msg;
  retryBtn.style.display = "none";
}
function hideOverlay() {
  overlay.classList.remove("visible");
}
function showError(msg, canRetry) {
  overlay.classList.add("visible");
  overlayText.textContent = msg;
  retryBtn.style.display = canRetry ? "block" : "none";
}

/* ------------------------------ HLS playback -------------------------------- */
function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  clearTimeout(loadTimer);
}

function startLoadTimer(source) {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    log(`Source "${source.name}" timed out after ${TIMEOUT_MS / 1000}s — falling back.`);
    failedSources.add(source.key);
    fallbackToNext();
  }, TIMEOUT_MS);
}

function reportStartup(source) {
  hideOverlay();
  const ms = Date.now() - startedAt;
  log(`Playback started from ${source.name} in ${ms}ms.`);
}

function resetVideo() {
  // Clear any previous src and handlers so stale canplay/error callbacks
  // from an earlier source attempt can never fire during this one.
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.oncanplay = null;
  video.onerror = null;
}

function populateSourceOptions() {
  sourceSelect.innerHTML = "";
  SOURCES.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = s.name + (s.status === "down" ? " (down)" : "");
    sourceSelect.appendChild(opt);
  });
}

function playSource(source) {
  destroyHls();
  resetVideo();
  startedAt = Date.now();
  showOverlay(`Loading from ${source.name}…`);
  startLoadTimer(source);

  const url = source.getUrl(currentMedia);

  if (source.adaptive && window.Hls && Hls.isSupported()) {
    /* ---- Adaptive (HLS) path -------------------------------------------
       The master playlist lists all quality levels. hls.js picks the level
       matching the current bandwidth, and the LEVEL_SWITCHED event lets us
       log the automatic switching in the telemetry panel. */
    hls = new Hls({ maxBufferLength: 15 });
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      if (document.getElementById("source-select").value != currentSourceIndex) return;
      clearTimeout(loadTimer);
      buildQualityOptions(data.levels);
      video.play().catch(() => {});
      reportStartup(source);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      if (data.level !== undefined && hls.levels[data.level]) {
        log(`Quality auto-switched to ${hls.levels[data.level].height}p`);
      }
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        clearTimeout(loadTimer);
        failedSources.add(source.key);
        log(`Fatal HLS error on ${source.name}: ${data.type}`);
        fallbackToNext();
      }
    });
  } else if (video.canPlayType("video/mp4")) {
    /* ---- Direct mp4 fallback path --------------------------------------
       Some sources serve a plain mp4 with no variants. No adaptive
       switching is possible, so the quality selector shows "Source". */
    video.src = url;
    video.oncanplay = () => {
      if (parseInt(sourceSelect.value, 10) !== currentSourceIndex) return;
      clearTimeout(loadTimer);
      qualitySelect.innerHTML = '<option value="-1">Source quality</option>';
      video.play().catch(() => {});
      reportStartup(source);
    };
    video.onerror = () => {
      clearTimeout(loadTimer);
      failedSources.add(source.key);
      log(`mp4 load failed on ${source.name}`);
      fallbackToNext();
    };
  } else {
    clearTimeout(loadTimer);
    showError("This browser cannot play the demo media.", false);
  }
}

/* ------------------------------ Fallback chain ------------------------------
   Skips sources already proven dead this session and anything marked down,
   then retries from the top of the priority list when the user clicks
   "Switch to next server". */
function nextAvailableIndex() {
  for (let i = 0; i < SOURCES.length; i++) {
    const s = SOURCES[i];
    if (s.status !== "down" && !failedSources.has(s.key)) return i;
  }
  return -1;
}

function fallbackToNext() {
  const idx = nextAvailableIndex();
  if (idx === -1) {
    showError("Every server failed to start. Click retry to try the list again.", true);
    log("All sources exhausted.");
    return;
  }
  log(`Trying next server: ${SOURCES[idx].name}`);
  currentSourceIndex = idx;
  sourceSelect.value = idx;
  playSource(SOURCES[idx]);
}

function retryNextSource() {
  failedSources.clear();
  log("Retrying from the top of the priority list…");
  currentSourceIndex = 0;
  sourceSelect.value = 0;
  playSource(SOURCES[0]);
}

/* --------------------------------- Controls -------------------------------- */
function buildQualityOptions(levels) {
  qualitySelect.innerHTML = '<option value="-1">Auto (recommended)</option>';
  levels.forEach((lvl, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${lvl.height}p`;
    qualitySelect.appendChild(opt);
  });
}

function setQuality(value) {
  if (!hls) return;
  hls.currentLevel = parseInt(value, 10); // -1 = automatic
  log(value === "-1" ? "Quality: automatic (bandwidth-driven)" : `Quality locked to ${hls.levels[value].height}p`);
}

function selectSource(value) {
  const idx = parseInt(value, 10);
  currentSourceIndex = idx;
  log(`User selected server: ${SOURCES[idx].name}`);
  playSource(SOURCES[idx]);
}

function togglePlay() {
  const btn = document.getElementById("play-pause");
  if (video.paused) {
    video.play().catch(() => {});
    btn.innerHTML = "&#10074;&#10074; Pause";
  } else {
    video.pause();
    btn.innerHTML = "&#9654; Play";
  }
}

/* --------------------------------- UI setup -------------------------------- */
function renderMediaCards() {
  const container = document.getElementById("media-cards");
  MEDIA.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card" + (m.id === currentMedia.id ? " active" : "");
    card.innerHTML = `
      <img src="${m.poster}" alt="${m.title}" loading="lazy" />
      <div class="card-info">
        <strong>${m.title}</strong> (${m.year})<br />
        <small>${m.credit}</small><br />
        <small class="note">${m.note}</small>
      </div>`;
    card.onclick = () => loadMedia(m);
    container.appendChild(card);
  });
}

function renderSourcesTable() {
  const table = document.getElementById("sources-table");
  table.innerHTML = `<tr><th>#</th><th>Server</th><th>Status</th><th>What it demonstrates</th></tr>` +
    SOURCES.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.name}</td>
        <td>${s.status === "up" ? "● up" : "○ down (simulated)"}</td>
        <td>${i === 0 ? "HLS adaptive streaming: bandwidth-driven switching between 184p, 288p, 480p, 720p and 1080p"
            : i === 1 ? "Plain mp4 host (CC0 flower clip) — no adaptive variants, so quality is fixed"
            : "Simulated outage: fails every time, forcing the fallback chain"}</td>
      </tr>`).join("");
}

function loadMedia(media) {
  currentMedia = media;
  failedSources.clear();
  currentSourceIndex = 0;
  sourceSelect.value = 0;
  document.querySelectorAll(".card").forEach((c) => c.classList.remove("active"));
  [...document.querySelectorAll(".card")].find(
    (c) => c.querySelector(".card-info strong").textContent === media.title
  )?.classList.add("active");
  log(`Loading title: ${media.title}`);
  playSource(SOURCES[0]);
}

/* ----------------------------------- Boot ---------------------------------- */
renderMediaCards();
renderSourcesTable();
populateSourceOptions();
log("Player manager initialized. Priority order: " + SOURCES.map((s) => s.name).join(" → "));
log("Tip: pick 'Broken CDN — simulated outage' in the Server dropdown to watch the timeout → automatic fallback to the next server happen live.");
playSource(SOURCES[0]);
