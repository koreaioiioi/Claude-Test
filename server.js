const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'wines.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readWines() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeWines(wines) {
  await fs.writeFile(DATA_FILE, JSON.stringify(wines, null, 2));
}

app.get('/api/wines', async (req, res) => {
  res.json(await readWines());
});

app.post('/api/wines', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: '와인 이름을 입력하세요.' });

  const wines = await readWines();
  const wine = { id: Date.now().toString(), name };
  wines.push(wine);
  await writeWines(wines);
  res.status(201).json(wine);
});

app.delete('/api/wines/:id', async (req, res) => {
  const wines = await readWines();
  const next = wines.filter((w) => w.id !== req.params.id);
  await writeWines(next);
  res.status(204).end();
});

const labelCache = new Map();

app.get('/api/wine-label', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name 쿼리가 필요합니다.' });

  if (labelCache.has(name)) {
    return res.json({ imageUrl: labelCache.get(name) });
  }

  try {
    const query = encodeURIComponent(`${name} wine label`);
    const url = `https://www.bing.com/images/search?q=${query}&form=HDRSC2`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });

    if (!response.ok) throw new Error(`검색 요청 실패: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    let imageUrl = null;
    $('.iusc').each((_, el) => {
      if (imageUrl) return;
      const m = $(el).attr('m');
      if (!m) return;
      try {
        const data = JSON.parse(m);
        if (data.murl) imageUrl = data.murl;
      } catch {
        /* skip malformed entry */
      }
    });

    if (imageUrl) labelCache.set(name, imageUrl);
    res.json({ imageUrl });
  } catch (err) {
    res.status(502).json({ error: '라벨 이미지를 검색하지 못했습니다.', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Wine list app running at http://localhost:${PORT}`);
});
