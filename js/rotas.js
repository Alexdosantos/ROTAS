// Login Guard
if (localStorage.getItem('isLoggedIn') !== 'true') {
  window.location.href = 'index.html';
} else {
  document.addEventListener('DOMContentLoaded', () => {
    const userBar = document.getElementById('userBar');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const email = localStorage.getItem('userEmail');
    if (email) {
      if (userEmailDisplay) userEmailDisplay.textContent = email;
      if (userBar) userBar.style.display = 'flex';
    }
  });
}

function logout() {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('userEmail');
  window.location.href = 'index.html';
}

let rawData = [];
let headers = [];
let sortMode = 'bairro';

const COLS = {
  atid: 0, seq: 1, stop: 2, spx: 3,
  address: 4, bairro: 5, city: 6, cep: 7, lat: 8, lng: 9
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAddressKey(row) {
  return normalizeText(row[COLS.address]) || '__sem_endereco__';
}

function getDisplayAddress(row) {
  return String(row[COLS.address] || '').trim() || 'Sem endereço informado';
}

function compareSequence(a, b) {
  const sa = a[COLS.seq];
  const sb = b[COLS.seq];
  const na = sa === '-' || sa === '' ? Infinity : Number(sa);
  const nb = sb === '-' || sb === '' ? Infinity : Number(sb);
  if (na !== nb) return na - nb;
  return String(a[COLS.spx] || '').localeCompare(String(b[COLS.spx] || ''), 'pt');
}

function compareAddress(a, b) {
  const aa = getAddressKey(a);
  const ab = getAddressKey(b);
  if (aa !== ab) return aa.localeCompare(ab, 'pt');
  return String(a[COLS.spx] || '').localeCompare(String(b[COLS.spx] || ''), 'pt');
}

function buildAddressGroups(rows) {
  const groups = [];
  const groupMap = new Map();

  rows.forEach(row => {
    const key = getAddressKey(row);
    if (!groupMap.has(key)) {
      const group = {
        key,
        address: getDisplayAddress(row),
        bairro: row[COLS.bairro] || '',
        cep: row[COLS.cep] || '',
        rows: []
      };
      groupMap.set(key, group);
      groups.push(group);
    }

    groupMap.get(key).rows.push(row);
  });

  return groups;
}

// Drag & drop
document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    });
  }

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) processFile(e.target.files[0]);
    });
  }
});

function processFile(file) {
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      headers = json[0] || [];
      rawData = json.slice(1).filter(r => r.some(c => c !== ''));

      showData(file.name, rawData.length);
    } catch(err) {
      showToast('Erro ao ler o arquivo: ' + err.message, true);
    }
  };
  reader.readAsBinaryString(file);
}

function showData(name, count) {
  document.getElementById('fileName').textContent = name;
  document.getElementById('rowCount').textContent = count + ' entregas';
  document.getElementById('fileInfo').classList.add('visible');
  document.getElementById('statsRow').style.display = 'grid';
  document.getElementById('sortSection').style.display = 'block';
  document.getElementById('previewSection').style.display = 'block';
  document.getElementById('btnDownload').disabled = false;
  document.getElementById('btnReset').style.display = 'block';
  document.getElementById('dropzone').style.display = 'none';

  // Stats
  const bairros = new Set(rawData.map(r => r[COLS.bairro]).filter(b => b));
  const pendentes = rawData.filter(r => r[COLS.seq] === '-' || r[COLS.seq] === '').length;
  document.getElementById('statTotal').textContent = count;
  document.getElementById('statBairros').textContent = bairros.size;
  document.getElementById('statPendentes').textContent = pendentes;

  // Populate bairro filter
  const sel = document.getElementById('filterBairro');
  sel.innerHTML = '<option value="">Todos os bairros</option>';
  [...bairros].sort().forEach(b => {
    const o = document.createElement('option');
    o.value = b; o.textContent = b;
    sel.appendChild(o);
  });

  renderPreview();
}

function setSort(btn) {
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  sortMode = btn.dataset.sort;
  renderPreview();
}

function getSorted() {
  let data = [...rawData];

  const bairroFilter = document.getElementById('filterBairro').value;
  const statusFilter = document.getElementById('filterStatus').value;

  if (bairroFilter) data = data.filter(r => r[COLS.bairro] === bairroFilter);
  if (statusFilter === 'seq') data = data.filter(r => r[COLS.seq] !== '-' && r[COLS.seq] !== '');
  if (statusFilter === 'pending') data = data.filter(r => r[COLS.seq] === '-' || r[COLS.seq] === '');

  const groups = buildAddressGroups(data);

  groups.forEach(group => {
    group.rows.sort(compareSequence);
  });

  groups.sort((groupA, groupB) => {
    const a = groupA.rows[0];
    const b = groupB.rows[0];

    if (sortMode === 'bairro') {
      const ba = String(a[COLS.bairro] || '').toLowerCase();
      const bb = String(b[COLS.bairro] || '').toLowerCase();
      if (ba !== bb) return ba.localeCompare(bb, 'pt');
      return compareAddress(a, b);
    }

    if (sortMode === 'cep') {
      const ca = String(a[COLS.cep] || '').replace(/\D/g, '');
      const cb = String(b[COLS.cep] || '').replace(/\D/g, '');
      if (ca !== cb) return ca.localeCompare(cb);
      return compareAddress(a, b);
    }

    if (sortMode === 'seq') {
      return compareSequence(a, b);
    }

    return compareAddress(a, b);
  });

  return groups.flatMap(group => group.rows);
}

function renderPreview() {
  const sorted = getSorted();
  const groups = buildAddressGroups(sorted);
  const previewCount = document.getElementById('previewCount');
  if (previewCount) previewCount.textContent = sorted.length;
  
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;

  if (!sorted.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><div>Nenhuma entrega encontrada</div></div>`;
    return;
  }

  let html = '';
  let lastBairro = null;

  groups.forEach(group => {
    const firstRow = group.rows[0];
    const bairro = firstRow[COLS.bairro] || '';

    if (sortMode === 'bairro' && bairro !== lastBairro) {
      html += `<div class="sep-header">📍 ${bairro || 'Sem bairro'}</div>`;
      lastBairro = bairro;
    }

    html += `
      <div class="address-group">
        <div class="address-group-header">
          <div class="address-group-title">${group.address}</div>
          <div class="address-group-count">${group.rows.length} ${group.rows.length === 1 ? 'pacote' : 'pacotes'}</div>
        </div>`;

    group.rows.forEach(row => {
      const seq = row[COLS.seq];
      const cep = row[COLS.cep] || '';
      const spx = row[COLS.spx] || '';
      const isPending = seq === '-' || seq === '';

      html += `
        <div class="delivery-card grouped">
          <div class="seq-badge ${isPending ? 'pending' : ''}">${isPending ? '?' : seq}</div>
          <div class="delivery-info">
            <div class="delivery-meta">
              ${bairro ? `<span class="tag tag-bairro">${bairro}</span>` : ''}
              ${cep ? `<span class="tag tag-cep">${cep}</span>` : ''}
              ${spx ? `<span class="tag tag-id">${spx.substring(0,16)}</span>` : ''}
            </div>
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  wrap.innerHTML = html;
}

function downloadOrganized() {
  if (!rawData.length) return;

  const sorted = getSorted();
  const groups = buildAddressGroups(sorted);
  const wb = XLSX.utils.book_new();

  const groupedRows = [];
  groups.forEach((group, index) => {
    group.rows.forEach(row => {
      groupedRows.push([index + 1, group.rows.length, ...row]);
    });
  });

  // Build output data
  const outputData = [['Ordem', 'Qtd no Endereço', ...headers], ...groupedRows];

  const ws = XLSX.utils.aoa_to_sheet(outputData);

  // Column widths
  ws['!cols'] = [
    { wch: 6 },   // Ordem
    { wch: 16 },  // Qtd no Endereço
    { wch: 18 },  // AT ID
    { wch: 10 },  // Sequence
    { wch: 8 },   // Stop
    { wch: 20 },  // SPX TN
    { wch: 55 },  // Address
    { wch: 22 },  // Bairro
    { wch: 14 },  // City
    { wch: 14 },  // CEP
    { wch: 12 },  // Lat
    { wch: 12 },  // Lng
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rotas Organizadas');

  // Summary sheet by bairro
  const bairroMap = {};
  sorted.forEach(r => {
    const b = r[COLS.bairro] || 'Sem bairro';
    bairroMap[b] = (bairroMap[b] || 0) + 1;
  });

  const summaryData = [
    ['Bairro', 'Qtd Entregas'],
    ...Object.entries(bairroMap).sort((a,b) => b[1]-a[1])
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Bairro');

  const now = new Date();
  const stamp = `${now.getDate().toString().padStart(2,'0')}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getFullYear()}`;
  XLSX.writeFile(wb, `rotas_organizadas_${stamp}.xlsx`);

  showToast('✅ Planilha baixada com sucesso!');
}

function resetApp() {
  rawData = []; headers = [];
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
  document.getElementById('fileInfo').classList.remove('visible');
  document.getElementById('statsRow').style.display = 'none';
  document.getElementById('sortSection').style.display = 'none';
  document.getElementById('previewSection').style.display = 'none';
  document.getElementById('dropzone').style.display = 'block';
  document.getElementById('btnDownload').disabled = true;
  document.getElementById('btnReset').style.display = 'none';
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = isError ? '#e94560' : '#00d4aa';
  t.style.color = isError ? '#fff' : '#000';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
