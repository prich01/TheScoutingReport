/**
 * The Scouting Report - Main Application Controller (js/app.js)
 * Handles UI navigation, team selection, roster editing, game log management,
 * spray chart SVG generation, pre-game dashboard rendering, and report aggregations.
 */

document.addEventListener('DOMContentLoaded', () => {
  initOpponentDropdown();
  switchTab('dashboard');
});

// ==========================================
// HELPER UTILITIES
// ==========================================

/**
 * Formats baseball Outs into standard Innings Pitched notation (e.g., 14 outs -> "4.2")
 * @param {number} outs 
 * @returns {string} Standard IP string
 */
function formatIP(outs = 0) {
  const fullInnings = Math.floor(outs / 3);
  const remOuts = outs % 3;
  return `${fullInnings}.${remOuts}`;
}

// ==========================================
// 1. NAVIGATION & TAB SWITCHING
// ==========================================

/**
 * Switches current active view tab and triggers view-specific renders.
 * @param {string} tabId - Identifier for tab ('dashboard', 'uploading', 'opponent', 'self', 'downloads')
 */
function switchTab(tabId) {
  // Hide all views
  document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
  // Deactivate all nav buttons
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabId}`);
  const targetNav = document.getElementById(`nav-${tabId}`);

  if (targetView) targetView.classList.remove('hidden');
  if (targetNav) targetNav.classList.add('active');

  // Trigger view updates
  if (tabId === 'dashboard') {
    renderDashboard();
  } else if (tabId === 'opponent') {
    renderOpponentReport();
  } else if (tabId === 'uploading') {
    renderUploadingTab();
  }
}

// ==========================================
// 2. OPPONENT TEAM MANAGEMENT
// ==========================================

/**
 * Initializes and populates the sidebar active opponent select dropdown.
 */
function initOpponentDropdown() {
  const selectEl = document.getElementById('opponentSelect');
  if (!selectEl) return;

  let opponents = getOpponents() || []; // Loaded from storage.js
  selectEl.innerHTML = '';

  if (opponents.length === 0) {
    const defaultTeam = "Ridgeview High";
    addOpponentToStorage(defaultTeam);
    opponents = [defaultTeam];
  }

  // Preserve active opponent prior to rebuild
  const active = getActiveOpponent();

  opponents.forEach(op => {
    const opt = document.createElement('option');
    opt.value = op;
    opt.textContent = op;
    if (op === active) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });

  // Ensure dropdown selection aligns with active opponent
  if (active && opponents.includes(active)) {
    selectEl.value = active;
  } else if (opponents.length > 0) {
    selectEl.value = opponents[0];
    setActiveOpponent(opponents[0]);
  }

  handleOpponentChange();
}

/**
 * Handles dropdown change event when switching active opponents.
 */
function handleOpponentChange() {
  const selectEl = document.getElementById('opponentSelect');
  if (!selectEl) return;

  const selected = selectEl.value;
  if (selected) {
    setActiveOpponent(selected);
  }

  // Update UI subheaders
  const loadedGamesSub = document.getElementById('loadedGamesSubheader');
  if (loadedGamesSub) loadedGamesSub.textContent = `For ${selected || 'Selected Team'}`;

  const rosterSub = document.getElementById('rosterSubheader');
  if (rosterSub) rosterSub.textContent = `Roster and handedness settings for ${selected || 'Selected Team'}.`;

  // Refresh visible tab
  renderUploadingTab();

  const oppView = document.getElementById('view-opponent');
  if (oppView && !oppView.classList.contains('hidden')) {
    renderOpponentReport();
  }

  const dashView = document.getElementById('view-dashboard');
  if (dashView && !dashView.classList.contains('hidden')) {
    renderDashboard();
  }
}

/**
 * Prompts user to add a new opponent team.
 */
function addOpponent() {
  const name = prompt("Enter new opponent team name:");
  if (name && name.trim()) {
    const cleanName = name.trim();
    addOpponentToStorage(cleanName);
    setActiveOpponent(cleanName);
    initOpponentDropdown();
  }
}

/**
 * Prompts user to rename the currently active opponent team.
 */
function renameOpponent() {
  const selectEl = document.getElementById('opponentSelect');
  if (!selectEl || !selectEl.value) return;

  const currentName = selectEl.value;
  const newName = prompt("Rename opponent team:", currentName);
  if (newName && newName.trim() && newName.trim() !== currentName) {
    const cleanName = newName.trim();
    renameOpponentInStorage(currentName, cleanName);
    setActiveOpponent(cleanName);
    initOpponentDropdown();
  }
}

// ==========================================
// 3. UPLOADING TAB & ROSTER MANAGEMENT
// ==========================================

/**
 * Renders loaded games list and roster table for active opponent.
 */
function renderUploadingTab() {
  const activeOpponent = getActiveOpponent();
  renderGamesList(activeOpponent);
  renderRosterTable(activeOpponent);
}

/**
 * Renders stored play-by-play logs for active opponent.
 */
function renderGamesList(opponentName) {
  const container = document.getElementById('gamesListContainer');
  if (!container) return;

  if (!opponentName) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">No opponent selected.</p>`;
    return;
  }

  const games = getOpponentGames(opponentName);
  if (games.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">No games saved for ${opponentName} yet.</p>`;
    return;
  }

  container.innerHTML = '';
  games.forEach((game) => {
    const item = document.createElement('div');
    item.className = "bg-slate-950 border border-slate-800 p-2.5 rounded-lg flex justify-between items-center text-xs";
    item.innerHTML = `
      <div class="truncate mr-2">
        <div class="font-bold text-slate-200 truncate">${game.notes || 'Game Log'}</div>
        <div class="text-[10px] text-slate-500">${game.date || 'Undated'}</div>
      </div>
      <button onclick="handleDeleteGame('${game.id}')" class="text-rose-400 hover:text-rose-300 text-[10px] px-2 py-1 rounded bg-rose-950/40 border border-rose-900/50 shrink-0">Delete</button>
    `;
    container.appendChild(item);
  });
}

/**
 * Saves input game log and auto-extracts roster entries.
 */
function handleSaveGameLog() {
  const activeOpponent = getActiveOpponent();
  if (!activeOpponent) {
    alert("Please select or add an opponent team first.");
    return;
  }

  const dateVal = document.getElementById('gameDateInput').value;
  const notesVal = document.getElementById('gameNotesInput').value;
  const rawText = document.getElementById('pbpInput').value;
  const statusEl = document.getElementById('uploadStatus');

  if (!rawText || !rawText.trim()) {
    if (statusEl) statusEl.textContent = "⚠️ Please paste play-by-play log text first.";
    return;
  }

  const gameObj = {
    id: Date.now().toString(),
    date: dateVal || new Date().toISOString().split('T')[0],
    notes: notesVal || 'Game Log',
    rawText: rawText.trim()
  };

  saveGameLog(activeOpponent, gameObj);

  // Auto-extract players and merge into saved roster
  const currentRoster = getOpponentRoster(activeOpponent);
  const parsed = parseGameLog(rawText, currentRoster);

  const rosterMap = {};
  currentRoster.forEach(p => { rosterMap[p.name.trim().toLowerCase()] = p; });

  // Merge extracted hitters
  Object.values(parsed.hitters).forEach(h => {
    const cleanNameKey = h.name.trim().toLowerCase();
    if (!rosterMap[cleanNameKey]) {
      currentRoster.push({
        name: h.name.trim(),
        number: h.number !== '--' ? h.number : '00',
        bats: h.bats || 'R',
        throws: h.throws || 'R',
        pos: h.pos || 'UT'
      });
      rosterMap[cleanNameKey] = true;
    }
  });

  // Merge extracted pitchers
  Object.values(parsed.pitchers).forEach(p => {
    const cleanNameKey = p.name.trim().toLowerCase();
    if (!rosterMap[cleanNameKey]) {
      currentRoster.push({
        name: p.name.trim(),
        number: p.number !== '--' ? p.number : '00',
        bats: 'R',
        throws: p.throws || 'R',
        pos: 'P'
      });
      rosterMap[cleanNameKey] = true;
    }
  });

  saveOpponentRoster(activeOpponent, currentRoster);

  // Reset form
  document.getElementById('pbpInput').value = '';
  document.getElementById('gameNotesInput').value = '';

  if (statusEl) {
    statusEl.textContent = "✅ Game log saved & roster updated!";
    setTimeout(() => { statusEl.textContent = ""; }, 3500);
  }

  renderUploadingTab();
}

/**
 * Removes a saved game log by ID.
 */
function handleDeleteGame(gameId) {
  const activeOpponent = getActiveOpponent();
  if (confirm("Are you sure you want to delete this game log?")) {
    deleteGameLog(activeOpponent, gameId);
    renderUploadingTab();
  }
}

/**
 * Renders opponent roster table for inline editing.
 */
function renderRosterTable(opponentName) {
  const tbody = document.getElementById('rosterTableBody');
  if (!tbody) return;

  if (!opponentName) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-500 italic">No opponent selected.</td></tr>`;
    return;
  }

  const roster = getOpponentRoster(opponentName);
  if (roster.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-500 italic">No roster entries found. Save a game log to auto-extract or add players manually.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  roster.forEach((player, idx) => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-950/50";
    tr.innerHTML = `
      <td class="p-2">
        <input type="text" value="${player.number || ''}" onchange="updateRosterPlayer(${idx}, 'number', this.value)" class="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-center text-xs text-slate-200">
      </td>
      <td class="p-2">
        <input type="text" value="${player.name || ''}" onchange="updateRosterPlayer(${idx}, 'name', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-semibold">
      </td>
      <td class="p-2">
        <select onchange="updateRosterPlayer(${idx}, 'bats', this.value)" class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-300">
          <option value="R" ${player.bats === 'R' ? 'selected' : ''}>R</option>
          <option value="L" ${player.bats === 'L' ? 'selected' : ''}>L</option>
          <option value="S" ${player.bats === 'S' ? 'selected' : ''}>S</option>
        </select>
      </td>
      <td class="p-2">
        <select onchange="updateRosterPlayer(${idx}, 'throws', this.value)" class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs text-slate-300">
          <option value="R" ${player.throws === 'R' ? 'selected' : ''}>R</option>
          <option value="L" ${player.throws === 'L' ? 'selected' : ''}>L</option>
        </select>
      </td>
      <td class="p-2">
        <input type="text" value="${player.pos || ''}" onchange="updateRosterPlayer(${idx}, 'pos', this.value)" class="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200">
      </td>
      <td class="p-2 text-center">
        <button onclick="removeRosterPlayer(${idx})" class="text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Updates individual roster field and saves to localStorage.
 */
function updateRosterPlayer(idx, field, value) {
  const activeOpponent = getActiveOpponent();
  const roster = getOpponentRoster(activeOpponent);
  if (roster[idx]) {
    roster[idx][field] = value;
    saveOpponentRoster(activeOpponent, roster);
  }
}

/**
 * Removes player entry from active opponent roster.
 */
function removeRosterPlayer(idx) {
  const activeOpponent = getActiveOpponent();
  const roster = getOpponentRoster(activeOpponent);
  roster.splice(idx, 1);
  saveOpponentRoster(activeOpponent, roster);
  renderRosterTable(activeOpponent);
}

/**
 * Adds a new blank player row to the active roster.
 */
function handleManualAddPlayer() {
  const activeOpponent = getActiveOpponent();
  if (!activeOpponent) return;
  const roster = getOpponentRoster(activeOpponent);
  roster.push({
    name: 'New Player',
    number: '00',
    bats: 'R',
    throws: 'R',
    pos: 'UT'
  });
  saveOpponentRoster(activeOpponent, roster);
  renderRosterTable(activeOpponent);
}

// ==========================================
// 4. SPRAY CHART GENERATOR
// ==========================================

/**
 * Generates interactive SVG baseball field spray chart with hit/out dots.
 * @param {Array} sprayList - Array of spray events [{ location, result, type }]
 * @returns {string} SVG String
 */
function generateSprayChartSvg(sprayList = []) {
  const locationCoordinates = {
    'left field': { x: 35, y: 30 },
    'left-center': { x: 60, y: 25 },
    'center field': { x: 100, y: 20 },
    'right-center': { x: 140, y: 25 },
    'right field': { x: 165, y: 30 },
    'third base': { x: 65, y: 75 },
    'shortstop': { x: 80, y: 60 },
    'second base': { x: 120, y: 60 },
    'first base': { x: 135, y: 75 },
    'pitcher': { x: 100, y: 80 },
    'catcher': { x: 100, y: 110 },
    'shallow left': { x: 50, y: 50 },
    'shallow right': { x: 150, y: 50 },
    'deep center': { x: 100, y: 12 }
  };

  let dotsSvg = '';
  sprayList.forEach((item, index) => {
    const locKey = item.location ? item.location.toLowerCase() : 'center field';
    let coords = locationCoordinates[locKey];

    if (!coords) {
      if (locKey.includes('left')) coords = locationCoordinates['left field'];
      else if (locKey.includes('right')) coords = locationCoordinates['right field'];
      else if (locKey.includes('short') || locKey.includes('ss')) coords = locationCoordinates['shortstop'];
      else if (locKey.includes('second') || locKey.includes('2b')) coords = locationCoordinates['second base'];
      else if (locKey.includes('third') || locKey.includes('3b')) coords = locationCoordinates['third base'];
      else if (locKey.includes('first') || locKey.includes('1b')) coords = locationCoordinates['first base'];
      else coords = locationCoordinates['center field'];
    }

    // Deterministic organic plot jitter using item properties and index
    const seed = (item.type || '').length + (item.result || '').length + index;
    const offsetX = (Math.sin(seed * 999) - 0.5) * 12;
    const offsetY = (Math.cos(seed * 999) - 0.5) * 12;

    const cx = Math.max(15, Math.min(185, coords.x + offsetX));
    const cy = Math.max(15, Math.min(115, coords.y + offsetY));

    const isHit = item.result === 'hit';
    const color = isHit ? '#34d399' : '#f87171'; // emerald-400 : rose-400

    dotsSvg += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${color}" opacity="0.85" stroke="#0f172a" stroke-width="0.75"><title>${item.type} to ${item.location || 'field'}</title></circle>`;
  });

  return `
    <svg viewBox="0 0 200 130" class="w-full max-w-[200px] h-auto drop-shadow">
      <!-- Outfield Grass Arc -->
      <path d="M 20 100 Q 100 -20 180 100 L 100 115 Z" fill="#022c22" stroke="#059669" stroke-width="1.5" />
      <!-- Infield Dirt Diamond -->
      <polygon points="100,110 65,80 100,50 135,80" fill="#1e1b18" stroke="#d97706" stroke-width="1" />
      <!-- Pitcher's Mound -->
      <circle cx="100" cy="80" r="4" fill="#d97706" />
      <!-- Home Plate -->
      <polygon points="100,110 96,113 96,116 104,116 104,113" fill="#ffffff" />
      <!-- Foul Lines -->
      <line x1="100" y1="110" x2="20" y2="100" stroke="#f59e0b" stroke-width="1" stroke-dasharray="2,2" />
      <line x1="100" y1="110" x2="180" y2="100" stroke="#f59e0b" stroke-width="1" stroke-dasharray="2,2" />
      <!-- Extracted Hit & Out Spray Dots -->
      ${dotsSvg}
    </svg>
  `;
}

// ==========================================
// 5. OPPONENT SCOUTING REPORT RENDERER
// ==========================================

/**
 * Aggregates all game logs for active opponent and renders Pitcher and Hitter cards.
 */
function renderOpponentReport() {
  const selectEl = document.getElementById('opponentSelect');
  const hitterContainer = document.getElementById('hitterCardsContainer');
  const pitcherContainer = document.getElementById('pitcherCardsContainer');
  const subheader = document.getElementById('opponentReportSubheader');

  if (!selectEl || !hitterContainer || !pitcherContainer) return;

  const activeOpponent = selectEl.value;
  if (subheader) subheader.innerText = `Aggregated scouting data for ${activeOpponent || 'Selected Team'}.`;

  if (!activeOpponent) {
    hitterContainer.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">No active opponent selected.</p>`;
    pitcherContainer.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">No active opponent selected.</p>`;
    return;
  }

  const games = getOpponentGames(activeOpponent);
  const roster = getOpponentRoster(activeOpponent);

  if (games.length === 0) {
    const emptyMsg = `<p class="text-xs text-slate-500 italic col-span-full">No saved games found for ${activeOpponent}. Upload logs in the Uploading tab.</p>`;
    hitterContainer.innerHTML = emptyMsg;
    pitcherContainer.innerHTML = emptyMsg;
    return;
  }

  // Aggregation containers
  const aggregatedHitters = {};
  const aggregatedPitchers = {};

  games.forEach(game => {
    const parsed = parseGameLog(game.rawText, roster);

    // Aggregate Hitters
    Object.values(parsed.hitters).forEach(hitter => {
      if (!aggregatedHitters[hitter.name]) {
        aggregatedHitters[hitter.name] = { ...hitter, spray: [...hitter.spray] };
      } else {
        const agg = aggregatedHitters[hitter.name];
        agg.pa += hitter.pa;
        agg.ab += hitter.ab;
        agg.hits += hitter.hits;
        agg.singles += hitter.singles;
        agg.doubles += hitter.doubles;
        agg.triples += hitter.triples;
        agg.hr += hitter.hr;
        agg.bb += hitter.bb;
        agg.so += hitter.so;
        agg.hbp += hitter.hbp;
        agg.spray = agg.spray.concat(hitter.spray);
      }
    });

    // Aggregate Pitchers
    Object.values(parsed.pitchers).forEach(pitcher => {
      if (!aggregatedPitchers[pitcher.name]) {
        aggregatedPitchers[pitcher.name] = { ...pitcher };
      } else {
        const agg = aggregatedPitchers[pitcher.name];
        agg.outs += pitcher.outs;
        agg.bf += pitcher.bf;
        agg.h += pitcher.h;
        agg.bb += pitcher.bb;
        agg.so += pitcher.so;
        agg.hr += pitcher.hr;
      }
    });
  });

  // --- RENDER PITCHERS ---
  const pitcherList = Object.values(aggregatedPitchers);
  if (pitcherList.length === 0) {
    pitcherContainer.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">No pitcher substitutions detected in logs (Tip: GC logs usually include "takes the mound" or "Pitching Change").</p>`;
  } else {
    pitcherContainer.innerHTML = '';
    pitcherList.forEach(p => {
      const ipDisplay = formatIP(p.outs);
      const ipDecimal = p.outs / 3;
      const whip = ipDecimal > 0 ? ((p.h + p.bb) / ipDecimal).toFixed(2) : '0.00';
      const kBbRatio = p.bb > 0 ? (p.so / p.bb).toFixed(1) : p.so.toFixed(1);

      const card = document.createElement('div');
      card.className = "bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col justify-between";
      card.innerHTML = `
        <div>
          <div class="flex justify-between items-start border-b border-slate-800 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-amber-400 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded">#${p.number}</span>
                <h3 class="text-base font-bold text-white">${p.name}</h3>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">Role: <span class="text-slate-200 font-semibold">Pitcher</span> | Throws: <span class="text-slate-200 font-semibold">${p.throws}</span></p>
            </div>
          </div>

          <!-- Key Pitcher Metrics -->
          <div class="grid grid-cols-3 gap-2 text-center my-3 py-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <div>
              <div class="text-[10px] text-slate-500 uppercase font-bold">IP</div>
              <div class="text-sm font-extrabold text-amber-400">${ipDisplay}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500 uppercase font-bold">WHIP</div>
              <div class="text-sm font-extrabold text-slate-200">${whip}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500 uppercase font-bold">K / BB</div>
              <div class="text-sm font-extrabold text-slate-200">${kBbRatio}</div>
            </div>
          </div>

          <!-- Pitching Line Breakdown -->
          <div class="text-[11px] text-slate-400 space-y-1">
            <div class="flex justify-between"><span>Batters Faced (BF):</span> <span class="font-bold text-slate-200">${p.bf}</span></div>
            <div class="flex justify-between"><span>Strikeouts (K):</span> <span class="font-bold text-emerald-400">${p.so}</span></div>
            <div class="flex justify-between"><span>Walks Allowed (BB):</span> <span class="font-bold text-rose-400">${p.bb}</span></div>
            <div class="flex justify-between"><span>Hits Allowed (H):</span> <span class="font-bold text-slate-200">${p.h} (${p.hr} HR)</span></div>
          </div>
        </div>
      `;
      pitcherContainer.appendChild(card);
    });
  }

  // --- RENDER HITTERS ---
  Object.values(aggregatedHitters).forEach(h => {
    h.avg = h.ab > 0 ? (h.hits / h.ab).toFixed(3).replace(/^0/, '') : '.000';
    h.obp = h.pa > 0 ? ((h.hits + h.bb + h.hbp) / h.pa).toFixed(3).replace(/^0/, '') : '.000';
    h.slg = h.ab > 0 ? ((h.singles + (h.doubles * 2) + (h.triples * 3) + (h.hr * 4)) / h.ab).toFixed(3).replace(/^0/, '') : '.000';
  });

  const hitterList = Object.values(aggregatedHitters);
  if (hitterList.length === 0) {
    hitterContainer.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">Could not extract hitter stats from current logs.</p>`;
  } else {
    hitterContainer.innerHTML = '';
    hitterList.forEach(hitter => {
      const card = document.createElement('div');
      card.className = "bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col justify-between";
      const spraySvg = generateSprayChartSvg(hitter.spray);

      card.innerHTML = `
        <div>
          <div class="flex justify-between items-start border-b border-slate-800 pb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded">#${hitter.number}</span>
                <h3 class="text-base font-bold text-white">${hitter.name}</h3>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">Pos: <span class="text-slate-200 font-semibold">${hitter.pos}</span> | Bats: <span class="text-slate-200 font-semibold">${hitter.bats}</span> | Throws: <span class="text-slate-200 font-semibold">${hitter.throws}</span></p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center my-3 py-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
            <div>
              <div class="text-[10px] text-slate-500 uppercase font-bold">AVG</div>
              <div class="text-sm font-extrabold text-emerald-400">${hitter.avg}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500 uppercase font-bold">OBP</div>
              <div class="text-sm font-extrabold text-slate-200">${hitter.obp}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500 uppercase font-bold">SLG</div>
              <div class="text-sm font-extrabold text-slate-200">${hitter.slg}</div>
            </div>
          </div>

          <div class="text-[11px] text-slate-400 space-y-1">
            <div class="flex justify-between"><span>Plate Appearances:</span> <span class="font-bold text-slate-200">${hitter.pa}</span></div>
            <div class="flex justify-between"><span>Hits (1B/2B/3B/HR):</span> <span class="font-bold text-slate-200">${hitter.hits} (${hitter.singles}/${hitter.doubles}/${hitter.triples}/${hitter.hr})</span></div>
            <div class="flex justify-between"><span>BB / SO:</span> <span class="font-bold text-slate-200">${hitter.bb} / ${hitter.so}</span></div>
          </div>
        </div>

        <div class="pt-2">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex justify-between">
            <span>Spray Chart</span>
            <span class="text-[9px] text-slate-500"><span class="text-emerald-400">●</span> Hit  <span class="text-rose-400">●</span> Out</span>
          </div>
          <div class="bg-slate-950 border border-slate-800 rounded-lg p-2 flex justify-center">
            ${spraySvg}
          </div>
        </div>
      `;
      hitterContainer.appendChild(card);
    });
  }
}

// ==========================================
// 6. PRE-GAME DASHBOARD CONTROLLER
// ==========================================

/**
 * Renders tactical callout cards, team totals, and the quick dugout cheat sheet.
 */
function renderDashboard() {
  const nameEl = document.getElementById('dashOpponentName');
  const badgeEl = document.getElementById('dashGameCountBadge');
  const calloutsGrid = document.getElementById('dashCalloutsGrid');
  const statsBar = document.getElementById('dashTeamStatsBar');
  const tbody = document.getElementById('dashCheatSheetTbody');

  if (!nameEl || !calloutsGrid || !tbody) return;

  const activeOpponent = getActiveOpponent();
  nameEl.textContent = activeOpponent || 'No Opponent Selected';

  if (!activeOpponent) {
    calloutsGrid.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">Select an opponent to view scouting dashboard.</p>`;
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">No opponent selected.</td></tr>`;
    return;
  }

  const games = getOpponentGames(activeOpponent);
  const roster = getOpponentRoster(activeOpponent);
  badgeEl.textContent = `${games.length} ${games.length === 1 ? 'Game' : 'Games'} Tracked`;

  if (games.length === 0) {
    calloutsGrid.innerHTML = `<div class="bg-slate-900 border border-slate-800 p-4 rounded-xl col-span-full text-center text-xs text-slate-500 italic">No game logs uploaded for ${activeOpponent} yet. Paste play-by-play text in the Uploading tab to view pre-game reports.</div>`;
    if (statsBar) statsBar.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">No game log data available.</td></tr>`;
    return;
  }

  // Aggregate stats across all games
  const hitters = {};
  const pitchers = {};

  games.forEach(game => {
    const parsed = parseGameLog(game.rawText, roster);

    Object.values(parsed.hitters).forEach(h => {
      if (!hitters[h.name]) hitters[h.name] = { ...h, spray: [...h.spray] };
      else {
        hitters[h.name].pa += h.pa;
        hitters[h.name].ab += h.ab;
        hitters[h.name].hits += h.hits;
        hitters[h.name].singles += h.singles;
        hitters[h.name].doubles += h.doubles;
        hitters[h.name].triples += h.triples;
        hitters[h.name].hr += h.hr;
        hitters[h.name].bb += h.bb;
        hitters[h.name].so += h.so;
        hitters[h.name].hbp += h.hbp;
        hitters[h.name].spray = hitters[h.name].spray.concat(h.spray);
      }
    });

    Object.values(parsed.pitchers).forEach(p => {
      if (!pitchers[p.name]) pitchers[p.name] = { ...p };
      else {
        pitchers[p.name].outs += p.outs;
        pitchers[p.name].bf += p.bf;
        pitchers[p.name].h += p.h;
        pitchers[p.name].bb += p.bb;
        pitchers[p.name].so += p.so;
        pitchers[p.name].hr += p.hr;
      }
    });
  });

  const hitterList = Object.values(hitters);
  const pitcherList = Object.values(pitchers);

  // Calculate slash lines
  hitterList.forEach(h => {
    h.avgNum = h.ab > 0 ? (h.hits / h.ab) : 0;
    h.obpNum = h.pa > 0 ? ((h.hits + h.bb + h.hbp) / h.pa) : 0;
    h.slgNum = h.ab > 0 ? ((h.singles + (h.doubles * 2) + (h.triples * 3) + (h.hr * 4)) / h.ab) : 0;
    h.opsNum = h.obpNum + h.slgNum;

    h.avg = h.avgNum.toFixed(3).replace(/^0/, '');
    h.obp = h.obpNum.toFixed(3).replace(/^0/, '');
    h.slg = h.slgNum.toFixed(3).replace(/^0/, '');
  });

  // --- 1. RENDER CALLOUT CARDS ---
  const topHitter = hitterList.length ? [...hitterList].sort((a, b) => b.opsNum - a.opsNum)[0] : null;
  const powerBat = hitterList.length ? [...hitterList].sort((a, b) => b.hr - a.hr || b.slgNum - a.slgNum)[0] : null;
  const acePitcher = pitcherList.length ? [...pitcherList].sort((a, b) => b.outs - a.outs || b.so - a.so)[0] : null;

  calloutsGrid.innerHTML = `
    <!-- Top Overall Threat -->
    <div class="bg-slate-900 border border-emerald-900/60 p-4 rounded-xl shadow-lg relative overflow-hidden">
      <div class="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-bl-lg border-b border-l border-emerald-800/40">
        🔥 Top Hitting Threat
      </div>
      <div class="text-[10px] text-slate-500 font-bold uppercase mb-1">Highest OPS</div>
      <div class="text-base font-bold text-white flex items-center gap-2">
        <span>#${topHitter ? topHitter.number : '00'}</span>
        <span>${topHitter ? topHitter.name : 'N/A'}</span>
      </div>
      <div class="mt-3 flex justify-between text-xs border-t border-slate-800/80 pt-2 text-slate-400">
        <span>AVG: <strong class="text-emerald-400">${topHitter ? topHitter.avg : '.000'}</strong></span>
        <span>OBP: <strong class="text-slate-200">${topHitter ? topHitter.obp : '.000'}</strong></span>
        <span>SLG: <strong class="text-slate-200">${topHitter ? topHitter.slg : '.000'}</strong></span>
      </div>
    </div>

    <!-- Power Threat -->
    <div class="bg-slate-900 border border-amber-900/60 p-4 rounded-xl shadow-lg relative overflow-hidden">
      <div class="absolute top-0 right-0 bg-amber-500/10 text-amber-400 font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-bl-lg border-b border-l border-amber-800/40">
        💥 Power Bat
      </div>
      <div class="text-[10px] text-slate-500 font-bold uppercase mb-1">HR & Extra Bases</div>
      <div class="text-base font-bold text-white flex items-center gap-2">
        <span>#${powerBat ? powerBat.number : '00'}</span>
        <span>${powerBat ? powerBat.name : 'N/A'}</span>
      </div>
      <div class="mt-3 flex justify-between text-xs border-t border-slate-800/80 pt-2 text-slate-400">
        <span>HRs: <strong class="text-amber-400">${powerBat ? powerBat.hr : 0}</strong></span>
        <span>2B/3B: <strong class="text-slate-200">${powerBat ? powerBat.doubles + powerBat.triples : 0}</strong></span>
        <span>SLG: <strong class="text-slate-200">${powerBat ? powerBat.slg : '.000'}</strong></span>
      </div>
    </div>

    <!-- Ace Pitcher -->
    <div class="bg-slate-900 border border-sky-900/60 p-4 rounded-xl shadow-lg relative overflow-hidden">
      <div class="absolute top-0 right-0 bg-sky-500/10 text-sky-400 font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-bl-lg border-b border-l border-sky-800/40">
        ⚾ Primary Arm
      </div>
      <div class="text-[10px] text-slate-500 font-bold uppercase mb-1">Most Work Done</div>
      <div class="text-base font-bold text-white flex items-center gap-2">
        <span>#${acePitcher ? acePitcher.number : '00'}</span>
        <span>${acePitcher ? acePitcher.name : 'N/A'}</span>
      </div>
      <div class="mt-3 flex justify-between text-xs border-t border-slate-800/80 pt-2 text-slate-400">
        <span>IP: <strong class="text-sky-400">${acePitcher ? formatIP(acePitcher.outs) : '0.0'}</strong></span>
        <span>K: <strong class="text-emerald-400">${acePitcher ? acePitcher.so : 0}</strong></span>
        <span>BB: <strong class="text-rose-400">${acePitcher ? acePitcher.bb : 0}</strong></span>
      </div>
    </div>
  `;

  // --- 2. RENDER TEAM STATS BAR ---
  const teamAB = hitterList.reduce((acc, h) => acc + h.ab, 0);
  const teamHits = hitterList.reduce((acc, h) => acc + h.hits, 0);
  const teamHR = hitterList.reduce((acc, h) => acc + h.hr, 0);
  const teamBB = hitterList.reduce((acc, h) => acc + h.bb, 0);
  const teamSO = hitterList.reduce((acc, h) => acc + h.so, 0);
  const teamAVG = teamAB > 0 ? (teamHits / teamAB).toFixed(3).replace(/^0/, '') : '.000';

  if (statsBar) {
    statsBar.innerHTML = `
      <div>
        <div class="text-[10px] text-slate-500 font-bold uppercase">Team Batting AVG</div>
        <div class="text-lg font-extrabold text-emerald-400">${teamAVG}</div>
      </div>
      <div>
        <div class="text-[10px] text-slate-500 font-bold uppercase">Total Hits</div>
        <div class="text-lg font-extrabold text-slate-200">${teamHits}</div>
      </div>
      <div>
        <div class="text-[10px] text-slate-500 font-bold uppercase">Home Runs</div>
        <div class="text-lg font-extrabold text-amber-400">${teamHR}</div>
      </div>
      <div>
        <div class="text-[10px] text-slate-500 font-bold uppercase">Walks (BB)</div>
        <div class="text-lg font-extrabold text-slate-200">${teamBB}</div>
      </div>
      <div>
        <div class="text-[10px] text-slate-500 font-bold uppercase">Strikeouts (K)</div>
        <div class="text-lg font-extrabold text-rose-400">${teamSO}</div>
      </div>
    `;
  }

  // --- 3. RENDER CHEAT SHEET TABLE ---
  tbody.innerHTML = '';
  hitterList.forEach(h => {
    let tendency = 'Balanced Field';
    let approach = 'Standard approach; attack with first-pitch strike.';

    if (h.so > h.bb * 2 && h.so >= 3) {
      approach = 'High K-risk: Challenge upstairs with high heat; break off-speed down.';
    } else if (h.bb > h.so && h.bb >= 3) {
      approach = 'High Discipline: Avoid nibbling; fill up zone early.';
    } else if (h.hr >= 1 || h.slgNum >= 0.500) {
      approach = 'Power Bat: Keep ball down; avoid middle-in mistakes.';
    }

    if (h.spray && h.spray.length > 0) {
      const pulls = h.spray.filter(s => (s.location || '').toLowerCase().includes('left')).length;
      const pushes = h.spray.filter(s => (s.location || '').toLowerCase().includes('right')).length;
      if (pulls > pushes + 1) tendency = 'Pull Heavy';
      else if (pushes > pulls + 1) tendency = 'Opposite Field';
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-950/60";
    tr.innerHTML = `
      <td class="p-2.5 font-bold text-amber-400">#${h.number}</td>
      <td class="p-2.5 font-bold text-white">${h.name}</td>
      <td class="p-2.5 text-slate-400">${h.pos}</td>
      <td class="p-2.5 text-slate-400">${h.bats}/${h.throws}</td>
      <td class="p-2.5 text-slate-200">${h.avg} / ${h.obp} / ${h.slg}</td>
      <td class="p-2.5 text-slate-400">${h.bb} / ${h.so}</td>
      <td class="p-2.5"><span class="bg-slate-950 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">${tendency}</span></td>
      <td class="p-2.5 text-slate-300 italic text-[11px]">${approach}</td>
    `;
    tbody.appendChild(tr);
  });
}
