// 1. CONFIGURATION (remplacez par votre clé Unsplash)
const UNSPLASH_ACCESS_KEY = 'VOTRE_CLE_ICI';

// 2. ID des collections Unsplash "Nature" et "Espace"
// Vous pouvez les trouver en explorant https://unsplash.com/collections
// Voici deux exemples populaires :
const NATURE_COLLECTION_ID = '3330453'; // Nature (officielle)
const SPACE_COLLECTION_ID  = '557577';  // Space

// 3. État local
let currentPhoto = null;
let photosPool = [];          // Toutes les photos chargées et non refusées
let dislikedIds = new Set();  // IDs déjà refusés (stockés dans localStorage)
let likedIds = new Set();     // IDs aimés (stockés dans localStorage)

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

// Charge les préférences depuis le localStorage
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

// Sauvegarde les ensembles dans le localStorage
function saveToLocalStorage() {
  localStorage.setItem('unsplash_disliked', JSON.stringify([...dislikedIds]));
  localStorage.setItem('unsplash_liked', JSON.stringify([...likedIds]));
}

// Récupère les photos des deux collections
async function fetchPhotos() {
  try {
    const [naturePhotos, spacePhotos] = await Promise.all([
      fetchCollectionPhotos(NATURE_COLLECTION_ID),
      fetchCollectionPhotos(SPACE_COLLECTION_ID)
    ]);
    // Combine et élimine les doublons
    const allPhotos = [...naturePhotos, ...spacePhotos];
    const unique = [];
    const seen = new Set();
    for (const photo of allPhotos) {
      if (!seen.has(photo.id)) {
        seen.add(photo.id);
        unique.push(photo);
      }
    }
    // On ne garde que les photos non refusées ET non aimées (pour éviter de reproposer un like)
    photosPool = unique.filter(p => !dislikedIds.has(p.id) && !likedIds.has(p.id));
    if (photosPool.length === 0) {
      statusEl.textContent = "Toutes les photos ont été vues ! Réinitialisez les préférences.";
    }
  } catch (error) {
    console.error('Erreur lors du chargement des photos :', error);
    statusEl.textContent = "Impossible de charger les photos. Vérifiez votre clé API et votre connexion.";
  }
}

// Récupère les photos d'une collection (max 30, triées par popularité)
async function fetchCollectionPhotos(collectionId) {
  const url = `https://api.unsplash.com/collections/${collectionId}/photos?per_page=30&order_by=popular`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error(`Collection ${collectionId} non trouvée`);
  }
  const data = await response.json();
  return data.map(photo => ({
    id: photo.id,
    url: photo.urls.regular,
    description: photo.description || photo.alt_description || 'Sans titre',
    author: photo.user.name,
    download: photo.links.download_location
  }));
}

// Affiche une photo aléatoire parmi le pool
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
  // Retire la photo du pool pour ne pas la reproposer dans la session
  photosPool.splice(randomIndex, 1);
}

// Anime la carte et prépare la suivante
function swipeCard(action) {
  if (!currentPhoto) return;
  const card = cardEl;
  card.classList.add(action === 'like' ? 'liked' : 'disliked');
  // Après l'animation, afficher la suivante
  setTimeout(() => {
    card.classList.remove('liked', 'disliked');
    showRandomPhoto();
  }, 300);
}

// Gestion des événements
function attachEvents() {
  likeBtn.addEventListener('click', () => {
    if (!currentPhoto) return;
    // Ajoute l'ID aux aimés
    likedIds.add(currentPhoto.id);
    saveToLocalStorage();
    swipeCard('like');
  });

  dislikeBtn.addEventListener('click', () => {
    if (!currentPhoto) return;
    // Ajoute l'ID aux refusés
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

  // Optionnel : réinitialisation (appuyer longtemps sur le bouton export)
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
