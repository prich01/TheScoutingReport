/**
 * The Scouting Report - Main Controller (js/app.js)
 * Coordinates UI state, roster management, game uploads, and report rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
  refreshOpponentDropdown();
  setDefaultGameDate();
  renderGamesList();
  renderRosterTable();
});

/**
 * Sets default date input to today's date (YYYY-MM-DD).
 */
function setDefaultGameDate() {
  const dateInput = document.getElementById('gameDateInput');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

/**
 * Populates the sidebar opponent selector dropdown.
 */
function refreshOpponentDropdown(selectedName = null) {
  const selectEl = document.getElementById('opponentSelect');
  if (!selectEl) return;

  const appData = loadAppData();
  const opponentNames = Object.keys(appData.opponents);

  selectEl.innerHTML = '';
  opponentNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.innerText = name;
    if (selectedName && name === selectedName) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });

  renderGamesList();
  renderRosterTable();
}

/**
 * Handler for active opponent dropdown change event.
 */
function handleOpponentChange() {
  renderGamesList();
  renderRosterTable();

  // If currently on the opponent report view, re-render it
  const opponentView = document.getElementById('view-opponent');
  if (opponentView && !opponentView.classList.contains('hidden')) {
    renderOpponentReport();
  }
}

/**
 * Renders the list of saved games for the currently selected opponent.
 */
function renderGamesList() {
  const selectEl = document.getElementById('opponentSelect');
  const container = document.getElementById('gamesListContainer');
  const subheader = document.getElementById('loadedGamesSubheader');
  
  if (!selectEl || !container) return;

  const activeOpponent = selectEl.value;
  if (subheader) subheader.innerText = `For ${activeOpponent || 'Selected Team'}`;

  if (!activeOpponent) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">No opponent selected.</p>`;
    return;
  }

  const games = getOpponentGames(activeOpponent);

  if (games.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">No games saved for ${activeOpponent} yet.</p>`;
    return;
  }

  container.innerHTML = '';
  games.forEach(game => {
    const card = document.createElement('div');
    card.className = "bg-slate-950 border border-slate-800 rounded p-3 text-xs flex justify-between items-center group hover:border-slate-700 transition";
    card.innerHTML = `
      <div>
        <div class="font-bold text-slate-200">${game.notes}</div>
        <div class="text-[10px] text-slate-500">${game.date} • ${(game.rawText.length / 1000).toFixed(1)}KB</div>
      </div>
      <button onclick="handleDeleteGame('${game.id}')" class="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition" title="Delete Game">
        🗑️
      </button>
    `;
    container.appendChild(card);
  });
}

// --- ROSTER UI RENDERER & HANDLERS ---

/**
 * Renders the editable roster table for the active opponent.
 */
function renderRosterTable() {
  const selectEl = document.getElementById('opponentSelect');
  const tbody = document.getElementById('rosterTableBody');
  const subheader = document.getElementById('rosterSubheader');

  if (!selectEl || !tbody) return;

  const activeOpponent = selectEl.value;
  if (subheader) subheader.innerText = `Roster details for ${activeOpponent || 'Selected Team'}. Auto-saves on edit.`;

  if (!activeOpponent) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No opponent selected.</td></tr>`;
    return;
  }

  const roster = getOpponentRoster(activeOpponent);

  if (roster.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No roster players found. Upload a game log above or click "+ Add Player".</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  roster.forEach(player => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-950/50 transition";

    tr.innerHTML = `
      <td class="p-2">
        <input type="text" value="${player.number || ''}" placeholder="#" 
               onchange="handleUpdateRoster('${player.name}', 'number', this.value)"
               class="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs text-center font-bold text-emerald-400 focus:outline-none focus:border-emerald-500">
      </td>
      <td class="p-2 font-semibold text-slate-200">
        ${player.name}
      </td>
      <td class="p-2">
        <select onchange="handleUpdateRoster('${player.name}', 'bats', this.value)" 
                class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500">
          <option value="R" ${player.bats === 'R' ? 'selected' : ''}>Right (R)</option>
          <option value="L" ${player.bats === 'L' ? 'selected' : ''}>Left (L)</option>
          <option value="S" ${player.bats === 'S' ? 'selected' : ''}>Switch (S)</option>
        </select>
      </td>
      <td class="p-2">
        <select onchange="handleUpdateRoster('${player.name}', 'throws', this.value)" 
                class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500">
          <option value="R" ${player.throws === 'R' ? 'selected' : ''}>Right (R)</option>
          <option value="L" ${player.throws === 'L' ? 'selected' : ''}>Left (L)</option>
        </select>
      </td>
      <td class="p-2">
        <select onchange="handleUpdateRoster('${player.name}', 'pos', this.value)" 
                class="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-emerald-500">
          <option value="P" ${player.pos === 'P' ? 'selected' : ''}>P - Pitcher</option>
          <option value="C" ${player.pos === 'C' ? 'selected' : ''}>C - Catcher</option>
          <option value="1B" ${player.pos === '1B' ? 'selected' : ''}>1B - First Base</option>
          <option value="2B" ${player.pos === '2B' ? 'selected' : ''}>2B - Second Base</option>
          <option value="3B" ${player.pos === '3B' ? 'selected' : ''}>3B - Third Base</option>
          <option value="SS" ${player.pos === 'SS' ? 'selected' : ''}>SS - Shortstop</option>
          <option value="LF" ${player.pos === 'LF' ? 'selected' : ''}>LF - Left Field</option>
          <option value="CF" ${player.pos === 'CF' ? 'selected' : ''}>CF - Center Field</option>
          <option value="RF" ${player.pos === 'RF' ? 'selected' : ''}>RF - Right Field</option>
          <option value="DH" ${player.pos === 'DH' ? 'selected' : ''}>DH - Desig. Hitter</option>
          <option value="UT" ${player.pos === 'UT' ? 'selected' : ''}>UT - Utility</option>
        </select>
      </td>
      <td class="p-2 text-center">
        <button onclick="handleDeleteRosterPlayer('${player.name}')" class="text-slate-600 hover:text-rose-400 p-1" title="Delete Player">
          🗑️
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Updates a specific player's roster details upon inline input edit.
 */
function handleUpdateRoster(playerName, field, value) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent) {
    updateRosterPlayer(activeOpponent, playerName, { [field]: value });
  }
}

/**
 * Prompts user to manually add a player to the current opponent's roster.
 */
function handleManualAddPlayer() {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (!activeOpponent) {
    alert("Please select an opponent team first.");
    return;
  }

  const name = prompt("Enter player full name:");
  if (name && name.trim()) {
    updateRosterPlayer(activeOpponent, name.trim(), { number: '', bats: 'R', throws: 'R', pos: 'UT' });
    renderRosterTable();
  }
}

/**
 * Prompts user and deletes a player from the active roster.
 */
function handleDeleteRosterPlayer(playerName) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent && confirm(`Remove ${playerName} from roster?`)) {
    deleteRosterPlayer(activeOpponent, playerName);
    renderRosterTable();
  }
}

// --- SAVE GAME LOG HANDLER ---

/**
 * Saves a new GameChanger log to local storage and auto-extracts roster names.
 */
function handleSaveGameLog() {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;
  const rawText = document.getElementById('pbpInput').value;
  const dateVal = document.getElementById('gameDateInput').value;
  const notesVal = document.getElementById('gameNotesInput').value;
  const statusEl = document.getElementById('uploadStatus');

  if (!activeOpponent) {
    alert("Please select or add an opponent team first.");
    return;
  }

  if (!rawText.trim()) {
    alert("Please paste GameChanger play-by-play text before saving.");
    return;
  }

  const metadata = {
    date: dateVal,
    notes: notesVal.trim() || `Game on ${dateVal}`
  };

  saveGameLog(activeOpponent, metadata, rawText);

  document.getElementById('pbpInput').value = '';
  document.getElementById('gameNotesInput').value = '';
  if (statusEl) {
    statusEl.innerText = "✓ Game saved & roster extracted!";
    setTimeout(() => { statusEl.innerText = ""; }, 3000);
  }

  renderGamesList();
  renderRosterTable();
}

/**
 * Deletes a game log.
 */
function handleDeleteGame(gameId) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent && confirm("Are you sure you want to delete this game log?")) {
    deleteGameLog(activeOpponent, gameId);
    renderGamesList();
  }
}

// --- OPPONENT SCOUTING REPORT RENDERER ---

/**
 * Aggregates all game logs for the active opponent and renders hitter cards with spray charts.
 */
function renderOpponentReport() {
  const selectEl = document.getElementById('opponentSelect');
  const container = document.getElementById('hitterCardsContainer');
  const subheader = document.getElementById('opponentReportSubheader');

  if (!selectEl || !container) return;

  const activeOpponent = selectEl.value;
  if (subheader) subheader.innerText = `Aggregated scouting data for ${activeOpponent || 'Selected Team'}.`;

  if (!activeOpponent) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">No active opponent selected.</p>`;
    return;
  }

  const games = getOpponentGames(activeOpponent);
  const roster = getOpponentRoster(activeOpponent);

  if (games.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">No saved games found for ${activeOpponent}. Upload game logs in the Uploading tab to generate reports.</p>`;
    return;
  }

  // Aggregate stats across all saved games
  const aggregatedHitters = {};

  games.forEach(game => {
    const parsed = parseGameLog(game.rawText, roster);
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
  });

  // Re-calculate percentages post-aggregation
  Object.values(aggregatedHitters).forEach(h => {
    h.avg = h.ab > 0 ? (h.hits / h.ab).toFixed(3).replace(/^0/, '') : '.000';
    h.obp = h.pa > 0 ? ((h.hits + h.bb + h.hbp) / h.pa).toFixed(3).replace(/^0/, '') : '.000';
    h.slg = h.ab > 0 ? ((h.singles + (h.doubles * 2) + (h.triples * 3) + (h.hr * 4)) / h.ab).toFixed(3).replace(/^0/, '') : '.000';
  });

  const hitterList = Object.values(aggregatedHitters);

  if (hitterList.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full">Could not extract player stats from current logs.</p>`;
    return;
  }

  container.innerHTML = '';
  hitterList.forEach(hitter => {
    const card = document.createElement('div');
    card.className = "bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col justify-between";

    // Generate SVG spray chart points
    const spraySvg = generateSprayChartSvg(hitter.spray);

    card.innerHTML = `
      <div>
        <!-- Header: Name, Number & Handedness -->
        <div class="flex justify-between items-start border-b border-slate-800 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded">#${hitter.number}</span>
              <h3 class="text-base font-bold text-white">${hitter.name}</h3>
            </div>
            <p class="text-[11px] text-slate-400 mt-1">Pos: <span class="text-slate-200 font-semibold">${hitter.pos}</span> | Bats: <span class="text-slate-200 font-semibold">${hitter.bats}</span> | Throws: <span class="text-slate-200 font-semibold">${hitter.throws}</span></p>
          </div>
        </div>

        <!-- Slash Line Stats -->
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

        <!-- Counting Stats Breakdown -->
        <div class="text-[11px] text-slate-400 space-y-1">
          <div class="flex justify-between"><span>Plate Appearances:</span> <span class="font-bold text-slate-200">${hitter.pa}</span></div>
          <div class="flex justify-between"><span>Hits (1B/2B/3B/HR):</span> <span class="font-bold text-slate-200">${hitter.hits} (${hitter.singles}/${hitter.doubles}/${hitter.triples}/${hitter.hr})</span></div>
          <div class="flex justify-between"><span>BB / SO:</span> <span class="font-bold text-slate-200">${hitter.bb} / ${hitter.so}</span></div>
        </div>
      </div>

      <!-- Spray Chart Visual -->
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

    container.appendChild(card);
  });
}

/**
 * Generates an SVG Field Diagram with plotted hit/out locations.
 */
function generateSprayChartSvg(sprayEvents) {
  let dotsSvg = '';

  sprayEvents.forEach(evt => {
    const loc = (evt.location || '').toLowerCase();
    let x = 75;
    let y = 60; // Default center field

    // Map common field location names to SVG coordinates
    if (loc.includes('left field') || loc.includes('lf')) { x = 35; y = 40; }
    else if (loc.includes('center field') || loc.includes('cf')) { x = 75; y = 25; }
    else if (loc.includes('right field') || loc.includes('rf')) { x = 115; y = 40; }
    else if (loc.includes('shortstop') || loc.includes('ss')) { x = 55; y = 75; }
    else if (loc.includes('second base') || loc.includes('2b')) { x = 95; y = 75; }
    else if (loc.includes('third base') || loc.includes('3b')) { x = 40; y = 95; }
    else if (loc.includes('first base') || loc.includes('1b')) { x = 110; y = 95; }
    else if (loc.includes('pitcher') || loc.includes('p')) { x = 75; y = 90; }

    // Add small random jitter so overlapping hits don't stack perfectly on top of each other
    x += (Math.random() * 8 - 4);
    y += (Math.random() * 8 - 4);

    const color = evt.result === 'hit' ? '#34d399' : '#f87171'; // Green for hit, Red for out
    dotsSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}" opacity="0.85" stroke="#0f172a" stroke-width="0.5" />`;
  });

  return `
    <svg width="150" height="130" viewBox="0 0 150 130" class="overflow-visible">
      <!-- Outfield Fence Arc -->
      <path d="M 15 80 Q 75 -5 135 80" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="2 2" />
      <!-- Foul Lines & Infield Diamond -->
      <path d="M 75 120 L 15 80 L 75 40 L 135 80 Z" fill="#0f172a" stroke="#334155" stroke-width="1" />
      <path d="M 75 120 L 75 95 L 55 75 L 75 55 L 95 75 Z" fill="#1e293b" stroke="#475569" stroke-width="1" />
      <!-- Home Plate Marker -->
      <polygon points="75,122 72,118 78,118" fill="#e2e8f0" />
      <!-- Plotted Spray Dots -->
      ${dotsSvg}
    </svg>
  `;
}

// --- GENERAL NAVIGATION & OPPONENT MANAGEMENT ---

/**
 * Switches between main views/tabs in the application.
 */
function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.remove('hidden');

  const targetBtn = document.getElementById(`nav-${tabName}`);
  if (targetBtn) targetBtn.classList.add('active');

  // Trigger auto-render when switching to Opponent Reports
  if (tabName === 'opponent') {
    renderOpponentReport();
  }
}

/**
 * Adds a new opponent team name.
 */
function addOpponent() {
  const name = prompt("Enter new opponent team name:");
  if (name && name.trim()) {
    const trimmed = name.trim();
    const data = loadAppData();
    if (!data.opponents[trimmed]) {
      data.opponents[trimmed] = { games: [], roster: [] };
      saveAppData(data);
    }
    refreshOpponentDropdown(trimmed);
  }
}

/**
 * Renames the active opponent team.
 */
function renameOpponent() {
  const selectEl = document.getElementById('opponentSelect');
  const current = selectEl ? selectEl.value : null;
  if (!current) return;

  const newName = prompt("Rename opponent team:", current);
  if (newName && newName.trim() && newName.trim() !== current) {
    const trimmed = newName.trim();
    const data = loadAppData();

    data.opponents[trimmed] = data.opponents[current] || { games: [], roster: [] };
    delete data.opponents[current];
    
    saveAppData(data);
    refreshOpponentDropdown(trimmed);
  }
}
