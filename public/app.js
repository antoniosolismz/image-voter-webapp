// ===== STATE =====
const USERS = ['Antonio', 'Ennio', 'Aldo'];
const CATEGORIES = ['estandar', 'doble', 'king'];
const CATEGORY_LABELS = {
  estandar: 'Estándar',
  doble: 'Doble',
  king: 'King'
};

let currentUser = null;
let currentCategory = null;
let currentIndex = 0;
let images = {};
let votes = {};
let resultsCategory = 'estandar';

// ===== DOM =====
const screens = {
  user: document.getElementById('screen-user'),
  categories: document.getElementById('screen-categories'),
  vote: document.getElementById('screen-vote'),
  results: document.getElementById('screen-results')
};

// ===== HELPERS =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  return res.json();
}

// ===== LOAD DATA =====
async function loadImages() {
  images = await api('GET', '/images');
}

async function loadVotes() {
  votes = await api('GET', '/votes');
}

// ===== USER SELECTION =====
document.querySelectorAll('.btn-user').forEach(btn => {
  btn.addEventListener('click', () => {
    currentUser = btn.dataset.user;
    document.getElementById('user-badge').textContent = currentUser;
    renderCategories();
    showScreen('categories');
  });
});

document.getElementById('btn-results').addEventListener('click', showResults);
document.getElementById('btn-results2').addEventListener('click', showResults);

document.getElementById('btn-back-user').addEventListener('click', () => {
  showScreen('user');
});

// ===== CATEGORIES =====
function renderCategories() {
  const container = document.getElementById('category-cards');
  container.innerHTML = '';

  for (const cat of CATEGORIES) {
    const catImages = images[cat] || [];
    const userVotes = (votes[currentUser] && votes[currentUser][cat]) || {};
    const done = Object.keys(userVotes).length;
    const total = catImages.length;

    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <span class="category-card-name">${CATEGORY_LABELS[cat]}</span>
      <span class="category-card-progress"><span class="done">${done}</span> / ${total}</span>
    `;
    card.addEventListener('click', () => enterCategory(cat));
    container.appendChild(card);
  }
}

async function enterCategory(cat) {
  currentCategory = cat;
  currentIndex = 0;
  document.getElementById('category-badge').textContent = CATEGORY_LABELS[cat];
  await loadVotes();
  renderVote();
  showScreen('vote');
}

// ===== VOTING =====
function renderVote() {
  const catImages = images[currentCategory] || [];
  if (catImages.length === 0) {
    document.getElementById('vote-image').src = '';
    document.getElementById('vote-image').alt = 'No hay imágenes';
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-text').textContent = '0 / 0';
    document.getElementById('vote-status').textContent = 'No hay imágenes en esta categoría';
    document.getElementById('vote-status').className = 'vote-status pending';
    document.getElementById('image-counter').textContent = '';
    return;
  }

  // Clamp index
  if (currentIndex >= catImages.length) currentIndex = catImages.length - 1;
  if (currentIndex < 0) currentIndex = 0;

  const img = catImages[currentIndex];
  document.getElementById('vote-image').src = img.url;
  document.getElementById('vote-image').alt = img.filename;

  // Progress
  const userVotes = (votes[currentUser] && votes[currentUser][currentCategory]) || {};
  const done = Object.keys(userVotes).length;
  const total = catImages.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${done} / ${total}`;

  // Current vote status
  const decision = userVotes[img.filename];
  const statusEl = document.getElementById('vote-status');
  if (decision === 'mantener') {
    statusEl.textContent = '✓ Mantener';
    statusEl.className = 'vote-status keep';
  } else if (decision === 'descartar') {
    statusEl.textContent = '✗ Descartar';
    statusEl.className = 'vote-status discard';
  } else {
    statusEl.textContent = 'Sin voto';
    statusEl.className = 'vote-status pending';
  }

  // Counter
  document.getElementById('image-counter').textContent = `${currentIndex + 1} de ${catImages.length}`;

  // Button states
  updateVoteButtons(decision);
}

function updateVoteButtons(decision) {
  const keepBtn = document.getElementById('btn-keep');
  const discardBtn = document.getElementById('btn-discard');
  const undoBtn = document.getElementById('btn-undo');

  keepBtn.style.opacity = decision === 'mantener' ? '1' : '0.7';
  discardBtn.style.opacity = decision === 'descartar' ? '1' : '0.7';
  undoBtn.style.opacity = decision ? '0.7' : '0.4';
}

// Vote button handlers
document.getElementById('btn-keep').addEventListener('click', () => castVote('mantener'));
document.getElementById('btn-discard').addEventListener('click', () => castVote('descartar'));
document.getElementById('btn-undo').addEventListener('click', () => castVote(null));

async function castVote(decision) {
  const catImages = images[currentCategory] || [];
  if (catImages.length === 0) return;
  const img = catImages[currentIndex];

  if (decision) {
    const res = await api('POST', '/votes', {
      user: currentUser,
      category: currentCategory,
      filename: img.filename,
      decision
    });
    votes = res.votes || res;
  } else {
    const res = await api('DELETE', '/votes', {
      user: currentUser,
      category: currentCategory,
      filename: img.filename
    });
    votes = res.votes || res;
  }

  renderVote();

  // Auto-advance to next unvoted image
  if (decision) {
    const nextUnvoted = findNextUnvoted(currentIndex);
    if (nextUnvoted !== -1 && nextUnvoted !== currentIndex) {
      currentIndex = nextUnvoted;
      renderVote();
    } else if (currentIndex < catImages.length - 1) {
      // If no unvoted ahead, just go to next
      currentIndex++;
      renderVote();
    }
  }
}

function findNextUnvoted(fromIndex) {
  const catImages = images[currentCategory] || [];
  const userVotes = (votes[currentUser] && votes[currentUser][currentCategory]) || {};

  // Search forward
  for (let i = fromIndex + 1; i < catImages.length; i++) {
    if (!userVotes[catImages[i].filename]) return i;
  }
  // Search from beginning
  for (let i = 0; i < fromIndex; i++) {
    if (!userVotes[catImages[i].filename]) return i;
  }
  return -1;
}

// Navigation
document.getElementById('btn-prev').addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderVote();
  }
});

document.getElementById('btn-next').addEventListener('click', () => {
  const catImages = images[currentCategory] || [];
  if (currentIndex < catImages.length - 1) {
    currentIndex++;
    renderVote();
  }
});

document.getElementById('btn-back-categories').addEventListener('click', () => {
  renderCategories();
  showScreen('categories');
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!screens.vote.classList.contains('active')) return;

  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    document.getElementById('btn-prev').click();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    document.getElementById('btn-next').click();
  } else if (e.key === '1' || e.key === 'm' || e.key === 'M') {
    document.getElementById('btn-keep').click();
  } else if (e.key === '2' || e.key === 'd' || e.key === 'D') {
    document.getElementById('btn-discard').click();
  } else if (e.key === '0' || e.key === 'u' || e.key === 'U') {
    document.getElementById('btn-undo').click();
  }
});

// Touch swipe support
let touchStartX = 0;
let touchEndX = 0;

document.getElementById('image-viewer').addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.getElementById('image-viewer').addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  const diff = touchStartX - touchEndX;
  const threshold = 50;

  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      document.getElementById('btn-next').click();
    } else {
      document.getElementById('btn-prev').click();
    }
  }
}, { passive: true });

// ===== RESULTS =====
async function showResults() {
  await loadVotes();
  renderResults();
  showScreen('results');
}

function renderResults() {
  // Tabs
  const tabsContainer = document.getElementById('results-tabs');
  tabsContainer.innerHTML = '';
  for (const cat of CATEGORIES) {
    const tab = document.createElement('button');
    tab.className = 'btn results-tab' + (cat === resultsCategory ? ' active' : '');
    tab.textContent = CATEGORY_LABELS[cat];
    tab.addEventListener('click', () => {
      resultsCategory = cat;
      renderResults();
    });
    tabsContainer.appendChild(tab);
  }

  // Grid
  const grid = document.getElementById('results-grid');
  grid.innerHTML = '';

  const catImages = images[resultsCategory] || [];
  if (catImages.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📷</div><div class="empty-state-text">No hay imágenes en esta categoría</div></div>';
    return;
  }

  const results = computeResults();
  const catResults = results[resultsCategory] || {};
  const filter = document.getElementById('results-filter').value;

  // Sort: winners first, then pending, then discarded
  const sorted = [...catImages].sort((a, b) => {
    const ra = catResults[a.filename] || { mantener: 0, descartar: 0 };
    const rb = catResults[b.filename] || { mantener: 0, descartar: 0 };
    const scoreA = (ra.mantener || 0) - (ra.descartar || 0);
    const scoreB = (rb.mantener || 0) - (rb.descartar || 0);
    return scoreB - scoreA;
  });

  for (const img of sorted) {
    const r = catResults[img.filename] || { mantener: 0, descartar: 0, sinVoto: 3, voters: {} };
    const totalVotes = r.mantener + r.descartar;
    const isWinner = r.mantener >= 2;
    const isLoser = r.descartar >= 2;
    const isPending = totalVotes === 0;

    // Filter
    if (filter === 'winners' && !isWinner) continue;
    if (filter === 'discarded' && !isLoser) continue;
    if (filter === 'pending' && totalVotes > 0) continue;

    const card = document.createElement('div');
    let cardClass = 'result-card';
    if (isWinner) cardClass += ' winner';
    else if (isLoser) cardClass += ' loser';
    card.className = cardClass;

    // Build voter tags
    let voterTags = '';
    for (const user of USERS) {
      const v = r.voters[user];
      if (v === 'mantener') {
        voterTags += `<span class="voter-tag keep">${user[0]}</span>`;
      } else if (v === 'descartar') {
        voterTags += `<span class="voter-tag discard">${user[0]}</span>`;
      }
    }

    card.innerHTML = `
      <img src="${img.url}" alt="${img.filename}" loading="lazy">
      <div class="result-card-info">
        <div class="result-card-votes">
          <span class="vote-count-keep">✓ ${r.mantener || 0}</span>
          <span class="vote-count-discard">✗ ${r.descartar || 0}</span>
          ${r.sinVoto > 0 ? `<span class="vote-count-pending">? ${r.sinVoto}</span>` : ''}
        </div>
        <div class="result-card-voters">${voterTags}</div>
      </div>
    `;
    grid.appendChild(card);
  }
}

function computeResults() {
  const results = {};

  for (const cat of CATEGORIES) {
    results[cat] = {};
    const catImages = images[cat] || [];

    for (const img of catImages) {
      results[cat][img.filename] = { mantener: 0, descartar: 0, sinVoto: 0, voters: {} };
    }

    for (const user of USERS) {
      const userCatVotes = (votes[user] && votes[user][cat]) || {};
      for (const [filename, decision] of Object.entries(userCatVotes)) {
        if (results[cat][filename]) {
          results[cat][filename][decision]++;
          results[cat][filename].voters[user] = decision;
        }
      }
    }

    // Count missing votes
    for (const filename of Object.keys(results[cat])) {
      const votedCount = Object.keys(results[cat][filename].voters).length;
      results[cat][filename].sinVoto = USERS.length - votedCount;
    }
  }

  return results;
}

document.getElementById('results-filter').addEventListener('change', renderResults);
document.getElementById('btn-back-home').addEventListener('click', () => {
  showScreen('user');
});

// ===== INIT =====
async function init() {
  await loadImages();
  await loadVotes();
}

init();