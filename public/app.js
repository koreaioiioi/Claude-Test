const addForm = document.getElementById('add-form');
const wineInput = document.getElementById('wine-input');
const wineList = document.getElementById('wine-list');
const emptyMessage = document.getElementById('empty-message');

const tooltip = document.getElementById('label-tooltip');
const labelImage = document.getElementById('label-image');
const labelStatus = document.getElementById('label-status');

const labelCache = new Map();
let currentRequestId = 0;

async function fetchWines() {
  const res = await fetch('/api/wines');
  const wines = await res.json();
  renderWines(wines);
}

function renderWines(wines) {
  wineList.innerHTML = '';
  emptyMessage.hidden = wines.length > 0;

  for (const wine of wines) {
    const li = document.createElement('li');
    li.className = 'wine-item';
    li.dataset.name = wine.name;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'wine-name';
    nameSpan.textContent = wine.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', () => deleteWine(wine.id));

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);

    li.addEventListener('mouseenter', (e) => showLabel(wine.name, e));
    li.addEventListener('mousemove', positionTooltip);
    li.addEventListener('mouseleave', hideLabel);

    wineList.appendChild(li);
  }
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = wineInput.value.trim();
  if (!name) return;

  const res = await fetch('/api/wines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (res.ok) {
    wineInput.value = '';
    await fetchWines();
  } else {
    const err = await res.json();
    alert(err.error || '와인을 추가하지 못했습니다.');
  }
});

async function deleteWine(id) {
  await fetch(`/api/wines/${id}`, { method: 'DELETE' });
  await fetchWines();
}

function positionTooltip(e) {
  tooltip.style.left = `${e.clientX}px`;
  tooltip.style.top = `${e.clientY - 12}px`;
}

async function showLabel(name, e) {
  const requestId = ++currentRequestId;
  positionTooltip(e);
  tooltip.hidden = false;
  labelImage.hidden = true;
  labelStatus.textContent = '라벨 검색 중...';

  if (labelCache.has(name)) {
    applyLabelResult(labelCache.get(name), requestId);
    return;
  }

  try {
    const res = await fetch(`/api/wine-label?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    const imageUrl = data.imageUrl || null;
    labelCache.set(name, imageUrl);
    applyLabelResult(imageUrl, requestId);
  } catch {
    labelCache.set(name, null);
    applyLabelResult(null, requestId);
  }
}

function applyLabelResult(imageUrl, requestId) {
  if (requestId !== currentRequestId) return;

  if (imageUrl) {
    labelImage.src = imageUrl;
    labelImage.hidden = false;
    labelImage.onerror = () => {
      labelImage.hidden = true;
      labelStatus.textContent = '이미지를 불러올 수 없습니다.';
    };
    labelImage.onload = () => {
      if (requestId === currentRequestId) labelStatus.textContent = '';
    };
  } else {
    labelImage.hidden = true;
    labelStatus.textContent = '라벨 이미지를 찾지 못했습니다.';
  }
}

function hideLabel() {
  currentRequestId++;
  tooltip.hidden = true;
}

fetchWines();
