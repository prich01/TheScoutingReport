/**
 * The Scouting Report - Complete Application Logic (app.js)
 */

// Application State
let appState = {
  opponents: ['Opponent Team A'],
  activeOpponent: 'Opponent Team A',
  rosters: {}, // { 'Opponent Team A': [ { number: '12', name: 'John Doe', bats: 'R', throws: 'R', pos: 'SS' } ] }
  gameLogs: {}  // { 'Opponent Team A': [ parsedGameLogObj1, ... ] }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage();
  initUI();
  switchTab('uploading'); // Default view
});

/* ==========================================
 * NAVIGATION & TAB SWITCHING
 * ========================================== */
function switchTab(tabId) {
  // Hide all tab views
  const views = document.querySelectorAll('.tab-view');
  views.forEach(view => view.classList.add('hidden'));

  // Show selected tab
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Update Nav Button active styles
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white');
    btn.classList.add('text-slate-400');
  });

  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-slate-800', 'text-white');
    activeBtn.classList.remove('text-slate-400');
  }
}

/* ==========================================
 * OPPONENT MANAGEMENT
 * ========================================== */
function populateOpponentDropdown() {
  const select = document.getElementById('opponentSelect');
  if (!select) return;

  select.innerHTML = '';
  appState.opponents.forEach(opp => {
    const opt = document.createElement('option');
    opt.value = opp;
    opt.textContent = opp;
    if (opp === appState.activeOpponent) opt.selected = true;
    select.appendChild(opt);
  });

  // Update headers across tabs
  const dashName = document.getElementById('dashOpponentName');
  if (dashName) dashName.textContent = appState.activeOpponent;

  renderRoster();
  renderSavedGames();
}

function handleOpponentChange() {
  const select = document.getElementById('opponentSelect');
  if (select) {
    appState.activeOpponent = select.value;
    saveStateToStorage();
    populateOpponentDropdown();
  }
}

function addOpponent() {
  const name = prompt("Enter new opponent team name:");
  if (!name || !name.trim()) return;

  const cleanName = name.trim();
  if (!appState.opponents.includes(cleanName)) {
    appState.opponents.push(cleanName);
  }
  appState.activeOpponent = cleanName;
  saveStateToStorage();
  populateOpponentDropdown();
}

function renameOpponent() {
  const oldName = appState.activeOpponent;
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (!newName || !newName.trim() || newName === oldName) return;

  const cleanName = newName.trim();
  const index = appState.opponents.indexOf(oldName);
  if (index !== -1) {
    appState.opponents[index] = cleanName;
  }

  // Migrate roster and logs to new key
  if (appState.rosters[oldName]) {
    appState.rosters[cleanName] = appState.rosters[oldName];
    delete appState.rosters[oldName];
  }
  if (appState.gameLogs[oldName]) {
    appState.gameLogs[cleanName] = appState.gameLogs[oldName];
    delete appState.gameLogs[oldName];
  }

  appState.activeOpponent = cleanName;
  saveStateToStorage();
  populateOpponentDropdown();
}

/* ==========================================
 * ROSTER MANAGEMENT
 * ========================================== */
function renderRoster() {
  const tbody = document.getElementById('rosterTableBody');
  if (!tbody) return;

  const currentRoster = appState.rosters[appState.activeOpponent] || [];
  tbody.innerHTML = '';

  if (currentRoster.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-500 italic">No players on roster yet. Process a game log or add players manually.</td></tr>`;
    return;
  }

  currentRoster.forEach((player, idx) => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800/50 hover:bg-slate-800/30";
    tr.innerHTML = `
      <td class="p-1.5 font-bold text-slate-300">#${player.number || '--'}</td>
      <td class="p-1.5 font-semibold text-white">${player.name}</td>
      <td class="p-1.5 text-slate-400">${player.bats || '-'}</td>
      <td class="p-1.5 text-slate-400">${player.throws || '-'}</td>
      <td class="p-1.5 text-slate-400">${player.pos || '-'}</td>
      <td class="p-1.5 text-center">
        <button onclick="removePlayer(${idx})" class="text-rose-400 hover:text-rose-300 font-bold">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleManualAddPlayer() {
  const name = prompt("Player Name:");
  if (!name || !name.trim()) return;

  const number = prompt("Jersey Number:") || "";
  const bats = prompt("Bats (R/L/S):") || "R";
  const throwsHand = prompt("Throws (R/L):") || "R";
  const pos = prompt("Primary Position:") || "";

  if (!appState.rosters[appState.activeOpponent]) {
    appState.rosters[appState.activeOpponent] = [];
  }

  appState.rosters[appState.activeOpponent].push({
    name: name.trim(),
    number: number.trim(),
    bats: bats.toUpperCase().trim(),
    throws: throwsHand.toUpperCase().trim(),
    pos: pos.toUpperCase().trim()
  });

  saveStateToStorage();
  renderRoster();
}

function removePlayer(index) {
  if (appState.rosters[appState.activeOpponent]) {
    appState.rosters[appState.activeOpponent].splice(index, 1);
    saveStateToStorage();
    renderRoster();
  }
}

/* ==========================================
 * GEMINI GAME LOG PROCESSING
 * ========================================== */
async function handleProcessGameLog() {
  const statusEl = document.getElementById('statusText');
  const rawText = document.getElementById('gameLogInput')?.value || '';
  let apiKey = document.getElementById('apiKeyInput')?.value.trim();

  if (!apiKey) {
    apiKey = localStorage.getItem('gemini_api_key');
  }

  if (!apiKey) {
    apiKey = prompt("Please enter your Gemini API Key:");
    if (apiKey) {
      apiKey = apiKey.trim();
      const apiKeyInput = document.getElementById('apiKeyInput');
      if (apiKeyInput) apiKeyInput.value = apiKey;
    }
  }

  if (!apiKey) {
    alert("An API key is required to process the game log.");
    return;
  }

  if (!rawText.trim()) {
    alert("Please paste a GameChanger game log into the text box first.");
    return;
  }

  localStorage.setItem('gemini_api_key', apiKey);
  if (statusEl) statusEl.innerText = " Analyzing game log with Gemini...";

  try {
    const parsedData = await parseGameLogWithGemini(rawText, apiKey);

    if (!parsedData) throw new Error("Gemini returned invalid or empty data.");

    // Store log under current opponent
    if (!appState.gameLogs[appState.activeOpponent]) {
      appState.gameLogs[appState.activeOpponent] = [];
    }
    
    const gameDate = document.getElementById('gameDateInput')?.value || new Date().toISOString().split('T')[0];
    const gameNotes = document.getElementById('gameNotesInput')?.value || 'Game Log';

    appState.gameLogs[appState.activeOpponent].push({
      date: gameDate,
      notes: gameNotes,
      data: parsedData
    });

    // Auto-update roster from parsed hitters/pitchers
    updateRosterFromParsedData(parsedData);

    saveStateToStorage();
    renderSavedGames();
    renderDashboard(parsedData);

    if (statusEl) statusEl.innerText = " Game log processed and saved successfully!";

  } catch (error) {
    console.error("Processing Error:", error);
    if (statusEl) statusEl.innerText = " Error processing game log.";
    alert("Failed to process game log. Check your API key and browser console (F12).");
  }
}

async function parseGameLogWithGemini(rawText, apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const promptText = `
You are an expert baseball play-by-play data analyst.
Analyze the following GameChanger text log and extract stats, team affiliations, and spray chart location data into a single valid JSON object.

RULES:
1. Determine Home and Away teams based on inning headers (Top = Away team batting / Home team pitching; Bottom = Home team batting / Away team pitching).
2. Track pitcher changes accurately across innings (including lineup changes, substitutions, and inline pitching notes).
3. For EVERY hitter, compute cumulative stats:
   - pa (plate appearances), ab (at-bats), hits, singles, doubles, triples, hr, bb (walks), so (strikeouts), hbp (hit by pitch)
4. For EVERY hitter, build a "spray" array capturing hit/out contact:
   - location MUST be one of: "left field", "left-center", "center field", "right-center", "right field", "shortstop", "third base", "second base", "first base", "pitcher", "catcher"
   - type MUST be one of: "Line Drive", "Fly Ball", "Ground Ball", "Pop Fly", "Bunt"
   - result MUST be either: "hit" or "out"
5. For EVERY pitcher, compute cumulative pitching stats:
   - bf (batters faced), outs (total outs recorded, e.g., 3 per full inning), h (hits allowed), bb (walks allowed), so (strikeouts), hr (home runs allowed)

JSON SCHEMA TO RETURN:
{
  "teams": { "home": "Team Name", "away": "Team Name" },
  "hitters": {
    "Player Name": {
      "name": "Player Name",
      "number": "00",
      "team": "Team Name",
      "pa": 0, "ab": 0, "hits": 0, "singles": 0, "doubles": 0, "triples": 0, "hr": 0, "bb": 0, "so": 0, "hbp": 0,
      "spray": [
        { "location": "left field", "type": "Line Drive", "result": "hit" }
      ]
    }
  },
  "pitchers": {
    "Pitcher Name": {
      "name": "Pitcher Name",
      "number": "00",
      "team": "Team Name",
      "bf": 0, "outs": 0, "h": 0, "bb": 0, "so": 0, "hr": 0
    }
  }
}

RAW PLAY-BY-PLAY LOG:
${rawText}
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJsonResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawJsonResponse);
}

function updateRosterFromParsedData(parsedData) {
  if (!appState.rosters[appState.activeOpponent]) {
    appState.rosters[appState.activeOpponent] = [];
  }
  const roster = appState.rosters[appState.activeOpponent];

  if (parsedData.hitters) {
    Object.values(parsedData.hitters).forEach(hitter => {
      if (!roster.some(p => p.name.toLowerCase() === hitter.name.toLowerCase())) {
        roster.push({
          name: hitter.name,
          number: hitter.number || '',
          bats: 'R',
          throws: 'R',
          pos: 'DH'
        });
      }
    });
  }
  renderRoster();
}

function renderSavedGames() {
  const container = document.getElementById('gamesListContainer');
  if (!container) return;

  const logs = appState.gameLogs[appState.activeOpponent] || [];
  container.innerHTML = '';

  if (logs.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic">No saved game logs for ${appState.activeOpponent}.</p>`;
    return;
  }

  logs.forEach((log, idx) => {
    const div = document.createElement('div');
    div.className = "bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center text-xs";
    div.innerHTML = `
      <div>
        <span class="font-bold text-white">${log.date}</span>
        <span class="text-slate-400 ml-2">${log.notes}</span>
      </div>
      <button onclick="deleteGameLog(${idx})" class="text-rose-400 hover:text-rose-300 font-bold px-2">Delete</button>
    `;
    container.appendChild(div);
  });
}

function deleteGameLog(idx) {
  if (appState.gameLogs[appState.activeOpponent]) {
    appState.gameLogs[appState.activeOpponent].splice(idx, 1);
    saveStateToStorage();
    renderSavedGames();
  }
}

/* ==========================================
 * DASHBOARD RENDERING
 * ========================================== */
function renderDashboard(parsedData) {
  console.log("Dashboard updating with parsed data:", parsedData);
  const badge = document.getElementById('dashGameCountBadge');
  if (badge) {
    const count = (appState.gameLogs[appState.activeOpponent] || []).length;
    badge.textContent = `${count} Game${count === 1 ? '' : 's'} Tracked`;
  }
}

/* ==========================================
 * STORAGE HELPERS
 * ========================================== */
function saveStateToStorage() {
  localStorage.setItem('scouting_app_state', JSON.stringify(appState));
}

function loadStateFromStorage() {
  const saved = localStorage.getItem('scouting_app_state');
  if (saved) {
    try {
      appState = JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved state", e);
    }
  }

  const savedApiKey = localStorage.getItem('gemini_api_key');
  const apiKeyInput = document.getElementById('apiKeyInput');
  if (apiKeyInput && savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }
}

function initUI() {
  populateOpponentDropdown();
  const processBtn = document.getElementById('processBtn');
  if (processBtn) {
    processBtn.addEventListener('click', handleProcessGameLog);
  }
}
