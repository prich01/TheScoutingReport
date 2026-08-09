/**
 * The Scouting Report - Main Controller (js/app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  refreshOpponentDropdown();
  setDefaultGameDate();
  renderGamesList();
  renderRosterTable();
});

function setDefaultGameDate() {
  const dateInput = document.getElementById('gameDateInput');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

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

function handleOpponentChange() {
  renderGamesList();
  renderRosterTable();
}

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

function handleUpdateRoster(playerName, field, value) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent) {
    updateRosterPlayer(activeOpponent, playerName, { [field]: value });
  }
}

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

function handleDeleteRosterPlayer(playerName) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent && confirm(`Remove ${playerName} from roster?`)) {
    deleteRosterPlayer(activeOpponent, playerName);
    renderRosterTable();
  }
}

// --- SAVE GAME LOG HANDLER ---

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

function handleDeleteGame(gameId) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent && confirm("Are you sure you want to delete this game log?")) {
    deleteGameLog(activeOpponent, gameId);
    renderGamesList();
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.remove('hidden');

  const targetBtn = document.getElementById(`nav-${tabName}`);
  if (targetBtn) targetBtn.classList.add('active');
}

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
