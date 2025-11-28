// === CONFIG ===
const MOVIE_BASE_URL = '/api'; // use relative path so nginx/docker routing works
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

// === STATE ===
let state = {
  q: '',
  genre: 'all',
  sort: 'popular',
  page: 1,
  genres: []
};

// === DOM ===
const grid = document.getElementById('grid');
const qInput = document.getElementById('q');
const genreSelect = document.getElementById('genre');
const sortSelect = document.getElementById('sort');
const clearBtn = document.getElementById('clear');
const pagination = document.getElementById('pagination');
const rangeEl = document.getElementById('range');
const totalEl = document.getElementById('total');
const emptyEl = document.getElementById('empty');

// === HELPERS ===
function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function buildUrl(endpoint, params = {}) {
  // build a full URL that supports relative MOVIE_BASE_URL (e.g. "/api")
  const base = MOVIE_BASE_URL.startsWith('/') ? window.location.origin + MOVIE_BASE_URL : MOVIE_BASE_URL;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = new URL(`${normalizedBase}/${normalizedEndpoint}`);
  const qs = new URLSearchParams(params);
  url.search = qs.toString();
  return url.toString();
}
function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
}
function setLoading(on = true) {
  if (on) {
    grid.innerHTML = '<div class="skeleton">Loading…</div>';
  } else {
    // no-op, renderMovies will update grid
  }
}

// === FETCH GENRES ===
async function loadGenres() {
  const res = await fetch(buildUrl('genres'));
  const data = await res.json();
  state.genres = data.genres || [];

  // Populate dropdown
  genreSelect.innerHTML = '<option value="all">All genres</option>';
  state.genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    genreSelect.appendChild(opt);
  });
}

// === FETCH MOVIES ===
async function loadMovies() {
  setLoading(true);
  try {
    let params = { page: state.page };
    if (state.q.trim()) params.q = state.q;
    if (state.genre !== 'all') params.genre = state.genre;
    if (state.sort) params.sort = state.sort;
    const res = await fetch(buildUrl('movies', params));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderMovies(data);
  } catch (err) {
    grid.innerHTML = `<div class="error">Error loading movies: ${err.message}</div>`;
  } finally {
    setLoading(false);
  }
}

// === RENDER MOVIES ===
function renderMovies(data) {
  const results = data.results || [];
  const total = data.total_results || 0;
  totalEl.textContent = total;

  if (results.length === 0) {
    emptyEl.style.display = 'block';
    grid.innerHTML = '';
    return;
  }
  emptyEl.style.display = 'none';

  grid.innerHTML = results.map(m => `
    <article class="card">
      <img class="poster" 
           src="${m.poster_path ? IMG_BASE + m.poster_path : 'https://via.placeholder.com/400x600?text=No+Image'}"
           alt="${escapeHtml(m.title)} poster">
      <div class="card-body">
        <h4 class="title">${escapeHtml(m.title)}</h4>
        <div class="meta">
          <span>${m.release_date ? m.release_date.split('-')[0] : 'N/A'}</span>
          <span>•</span>
          <span>⭐ ${m.vote_average?.toFixed(1) || '–'}</span>
        </div>
        <div class="genres">${getGenres(m.genre_ids).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn play" data-id="${m.id}" aria-label="Watch trailer for ${escapeHtml(m.title)}">Play Trailer</button>
        </div>
      </div>
    </article>
  `).join('');

  renderPagination(data.total_pages);
  document.querySelectorAll('.play').forEach(btn =>
    btn.addEventListener('click', e => openTrailer(e.currentTarget.dataset.id))
  );
}

function getGenres(ids = []) {
  return ids
    .map(id => state.genres.find(g => g.id === id))
    .filter(Boolean)
    .map(g => `<span class="genre">${escapeHtml(g.name)}</span>`);
}

// === PAGINATION ===
function renderPagination(totalPages) {
  pagination.innerHTML = '';
  const maxPages = Math.min(totalPages, 5);
  for (let i = 1; i <= maxPages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page' + (i === state.page ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => { state.page = i; loadMovies(); window.scrollTo(0, 0); };
    pagination.appendChild(btn);
  }
}

// === TRAILER MODAL ===
async function openTrailer(movieId) {
  const res = await fetch(buildUrl(`movies/${movieId}/videos`));
  const data = await res.json();
  const video = (data.results || []).find(v => v.site === 'YouTube');
  if (!video) return alert('No trailer available');

  const tpl = document.getElementById('modal-template');
  const node = tpl.content.cloneNode(true);
  const backdrop = node.querySelector('#modal-backdrop');
  const iframe = node.querySelector('#modal-iframe');
  const title = node.querySelector('#modal-title');
  const close = node.querySelector('#modal-close');

  title.textContent = 'Trailer';
  iframe.src = `https://www.youtube.com/embed/${video.key}?rel=0`;

  close.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  trapFocus(backdrop);
}

function trapFocus(container) {
  const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0], last = focusable[focusable.length - 1];
  function handle(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape') {
      container.remove();
      document.removeEventListener('keydown', handle);
    }
  }
  document.addEventListener('keydown', handle);
  first?.focus();
}

// === EVENTS ===
qInput.addEventListener('input', debounce(e => { state.q = e.target.value; state.page = 1; loadMovies(); }, 350));
genreSelect.addEventListener('change', e => { state.genre = e.target.value; state.page = 1; loadMovies(); });
sortSelect.addEventListener('change', e => { state.sort = e.target.value; state.page = 1; loadMovies(); });
clearBtn.addEventListener('click', () => {
  state = { q: '', genre: 'all', sort: 'popular', page: 1, genres: state.genres };
  qInput.value = '';
  genreSelect.value = 'all';
  sortSelect.value = 'popular';
  loadMovies();
});

// === INIT ===
(async function init() {
  await loadGenres();
  await loadMovies();
})();
