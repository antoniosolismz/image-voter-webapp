const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const IMAGES_DIR = path.join(__dirname, 'public', 'images');
const VOTES_FILE = process.env.VOTES_PATH || path.join(__dirname, 'votes.json');
const CATEGORIES = ['estandar', 'doble', 'king'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

// Ensure votes.json and its directory exist
const votesDir = path.dirname(VOTES_FILE);
if (!fs.existsSync(votesDir)) {
  fs.mkdirSync(votesDir, { recursive: true });
}
if (!fs.existsSync(VOTES_FILE)) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify({}, null, 2));
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Get all images grouped by category
app.get('/api/images', (req, res) => {
  const images = {};

  for (const category of CATEGORIES) {
    const categoryDir = path.join(IMAGES_DIR, category);
    images[category] = [];

    if (fs.existsSync(categoryDir)) {
      const files = fs.readdirSync(categoryDir).sort();
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          images[category].push({
            filename: file,
            url: `/images/${category}/${encodeURIComponent(file)}`,
            category: category
          });
        }
      }
    }
  }

  res.json(images);
});

// Get all votes
app.get('/api/votes', (req, res) => {
  const votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  res.json(votes);
});

// Save a vote
app.post('/api/votes', (req, res) => {
  const { user, category, filename, decision } = req.body;

  if (!user || !category || !filename || !decision) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  if (!['mantener', 'descartar'].includes(decision)) {
    return res.status(400).json({ error: 'Decisión inválida' });
  }

  const votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));

  if (!votes[user]) votes[user] = {};
  if (!votes[user][category]) votes[user][category] = {};

  votes[user][category][filename] = decision;

  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
  res.json({ success: true, votes });
});

// Delete a vote (for changing decision back to undecided)
app.delete('/api/votes', (req, res) => {
  const { user, category, filename } = req.body;

  if (!user || !category || !filename) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));

  if (votes[user] && votes[user][category] && votes[user][category][filename]) {
    delete votes[user][category][filename];
    fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
  }

  res.json({ success: true, votes });
});

// Get aggregated results
app.get('/api/results', (req, res) => {
  const votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
  const results = {};

  for (const category of CATEGORIES) {
    results[category] = {};

    // Get all images in this category
    const categoryDir = path.join(IMAGES_DIR, category);
    if (fs.existsSync(categoryDir)) {
      const files = fs.readdirSync(categoryDir).sort();
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          results[category][file] = {
            mantener: 0,
            descartar: 0,
            sinVoto: 0,
            voters: {}
          };
        }
      }
    }

    // Count votes
    for (const user of Object.keys(votes)) {
      if (votes[user][category]) {
        for (const [filename, decision] of Object.entries(votes[user][category])) {
          if (results[category][filename]) {
            results[category][filename][decision]++;
            results[category][filename].voters[user] = decision;
          }
        }
      }
    }

    // Count missing votes
    for (const filename of Object.keys(results[category])) {
      const totalVoters = Object.keys(votes).length || 3;
      const votedCount = Object.keys(results[category][filename].voters).length;
      results[category][filename].sinVoto = totalVoters - votedCount;
    }
  }

  res.json(results);
});

// Reset all votes for a user in a category
app.post('/api/votes/reset', (req, res) => {
  const { user, category } = req.body;

  if (!user) {
    return res.status(400).json({ error: 'Usuario requerido' });
  }

  const votes = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));

  if (category) {
    if (votes[user] && votes[user][category]) {
      delete votes[user][category];
    }
  } else {
    delete votes[user];
  }

  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
  res.json({ success: true, votes });
});

app.listen(PORT, () => {
  console.log(`🏨 Votador de imágenes del hotel`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   Categorías: ${CATEGORIES.join(', ')}`);
  console.log(`   Imágenes: pon las fotos en public/images/{categoría}/\n`);
});