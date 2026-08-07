// 1. CONFIGURATION
const UNSPLASH_ACCESS_KEY = 'YQU5KYLxy-672qT2JTX1AJ2tPJmu-vkrgV63hpv26VI'; // Votre clé

// 2. Thèmes paysagers (pool large, sans espace)
const THEMES = [
  'landscape',
  'nature',
  'mountain',
  'forest',
  'ocean',
  'sunset',
  'lake',
  'waterfall'
];

// 3. État local
let currentPhoto = null;
let photosPool = [];
let dislikedIds = new Set();
let likedIds = new Set();

// Sélecteurs DOM
const cardEl = document.getElementById('card');
const cardImageEl = document.getElementById('card-image');
const cardTitleEl = document.getElementById('card-title');
const cardAuthorEl = document.getElementById('card-author');
const likeBtn = document.getElementById('like-btn');
const dislikeBtn = document.getElementById('dislike-btn');
const exportBtn = document.getElementById('export-btn');
const statusEl = document.getElementById('status');

// Initialisation
document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadFromLocalStorage();
  await fetchPhotos();
  showRandomPhoto();
  attachEvents();
}

function loadFromLocalStorage() {
  const savedDisliked = localStorage.getItem('unsplash_disliked');
  if (savedDisliked) {
    dislikedIds = new Set(JSON.parse(savedDisliked));
  }
  const savedLiked = localStorage.getItem('unsplash_liked');
  if (savedLiked) {
    likedIds = new Set(JSON.parse(savedLiked));
  }
}

function saveToLocalStorage() {
  localStorage.setItem('unsplash_disliked', JSON.stringify([...dislikedIds]));
  localStorage.setItem('unsplash_liked', JSON.stringify([...likedIds]));
}

// Charge les photos de TOUS les thèmes en parallèle
async function fetchPhotos() {
  try {
    // Lance une recherche pour chaque thème (30 photos par thème, ordre de pertinence)
    const allResults = await Promise.all(
      THEMES.map(theme => fetchSearchPhotos(theme))
    );

    // Combine tous les résultats (aplanit le tableau de tableaux)
    const allPhotos = allResults.flat();

    // Supprime les doublons
    const unique = [];
    const seen = new Set();
    for (const photo of allPhotos) {
      if (!seen.has(photo.id)) {
        seen.add(photo.id);
        unique.push(photo);
      }
    }

    // Filtre les photos déjà refusées ou aimées
    photosPool = unique.filter(p => !dislikedIds.has(p.id) && !likedIds.has(p.id));

    if (photosPool.length === 0) {
      statusEl.textContent = "Toutes les photos ont été vues ! Réinitialisez les préférences.";
    } else {
      statusEl.textContent = `${photosPool.length} photos chargées (paysages uniquement).`;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des photos :', error);
    statusEl.textContent = "Erreur de chargement. Vérifiez la console (F12).";
  }
}

// Recherche pour un thème donné
async function fetchSearchPhotos(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&order_by=relevant`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
    }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Recherche "${query}": ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  return data.results.map(photo => ({
    id: photo.id,
    url: photo.urls.regular,
    description: photo.description || photo.alt_description || 'Sans titre',
    author: photo.user.name
  }));
}

// Affiche une photo aléatoire
function showRandomPhoto() {
  if (photosPool.length === 0) {
    cardImageEl.style.backgroundImage = 'none';
    cardTitleEl.textContent = 'Plus de photos disponibles';
    cardAuthorEl.textContent = '';
    return;
  }
  const randomIndex = Math.floor(Math.random() * photosPool.length);
  currentPhoto = photosPool[randomIndex];
  cardImageEl.style.backgroundImage = `url(${currentPhoto.url})`;
  cardTitleEl.textContent = currentPhoto.description;
  cardAuthorEl.textContent = `par ${currentPhoto.author}`;
  photosPool.splice(randomIndex, 1);
}

// Animation swipe
function swipeCard(action) {
  if (!currentPhoto) return;
  const card = cardEl;
  card.classList.add(action === 'like' ? 'liked' : 'disliked');
  setTimeout(() => {
    card.classList.remove('liked', 'disliked');
    showRandomPhoto();
  }, 300);
}

// Événements
function attachEvents() {
  likeBtn.addEventListener('click', () => {
    if (!currentPhoto) return;
    likedIds.add(currentPhoto.id);
    saveToLocalStorage();
    swipeCard('like');
  });

  dislikeBtn.addEventListener('click', () => {
    if (!currentPhoto) return;
    dislikedIds.add(currentPhoto.id);
    saveToLocalStorage();
    swipeCard('dislike');
  });

  exportBtn.addEventListener('click', () => {
    const likedArray = [...likedIds];
    const jsonStr = JSON.stringify(likedArray, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unsplash_liked.json';
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = `Exporté : ${likedArray.length} photos aimées.`;
  });

  // Réinitialisation par appui long
  let resetTimer;
  exportBtn.addEventListener('mousedown', () => {
    resetTimer = setTimeout(() => {
      if (confirm('Réinitialiser toutes les préférences ?')) {
        localStorage.clear();
        dislikedIds.clear();
        likedIds.clear();
        photosPool = [];
        fetchPhotos().then(() => showRandomPhoto());
        statusEl.textContent = 'Préférences réinitialisées.';
      }
    }, 2000);
  });
  exportBtn.addEventListener('mouseup', () => clearTimeout(resetTimer));
  exportBtn.addEventListener('mouseleave', () => clearTimeout(resetTimer));
}
