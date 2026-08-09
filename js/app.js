/**
 * The Scouting Report - Main Controller (js/app.js)
 */

// Initialize app data on page load
document.addEventListener('DOMContentLoaded', () => {
  refreshOpponentDropdown();
  setDefaultGameDate();
  renderGamesList();
});

// Sets the upload date input to today's date
function setDefaultGameDate() {
  const dateInput = document.getElementById('gameDateInput');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

// Populate Opponent Dropdown from storage.js
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
}

// Triggered when changing opponent in sidebar dropdown
function handleOpponentChange() {
  renderGamesList();
}

// Renders saved games for the active opponent
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

// Saves pasted GameChanger log to active opponent
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

  // Clear text area & notify user
  document.getElementById('pbpInput').value = '';
  document.getElementById('gameNotesInput').value = '';
  if (statusEl) {
    statusEl.innerText = "✓ Game saved successfully!";
    setTimeout(() => { statusEl.innerText = ""; }, 3000);
  }

  renderGamesList();
}

// Deletes a game log
function handleDeleteGame(gameId) {
  const selectEl = document.getElementById('opponentSelect');
  const activeOpponent = selectEl ? selectEl.value : null;

  if (activeOpponent && confirm("Are you sure you want to delete this game log?")) {
    deleteGameLog(activeOpponent, gameId);
    renderGamesList();
  }
}

// Tab navigation handler
function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) targetView.classList.remove('hidden');

  const targetBtn = document.getElementById(`nav-${tabName}`);
  if (targetBtn) targetBtn.classList.add('active');
}

// Add new opponent
function addOpponent() {
  const name = prompt("Enter new opponent team name:");
  if (name && name.trim()) {
    const trimmed = name.trim();
    const data = loadAppData();
    if (!data.opponents[trimmed]) {
      data.opponents[trimmed] = { games: [] };
      saveAppData(data);
    }
    refreshOpponentDropdown(trimmed);
  }
}

// Rename active opponent
function renameOpponent() {
  const selectEl = document.getElementById('opponentSelect');
  const current = selectEl ? selectEl.value : null;
  if (!current) return;

  const newName = prompt("Rename opponent team:", current);
  if (newName && newName.trim() && newName.trim() !== current) {
    const trimmed = newName.trim();
    const data = loadAppData();

    data.opponents[trimmed] = data.opponents[current] || { games: [] };
    delete data.opponents[current];
    
    saveAppData(data);
    refreshOpponentDropdown(trimmed);
  }
}
