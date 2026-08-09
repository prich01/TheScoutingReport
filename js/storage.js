/**
 * The Scouting Report - Storage Manager (js/storage.js)
 * Manages saving and loading opponent data, parsed games, and rosters in browser localStorage.
 */

const STORAGE_KEY = 'scouting_report_data_v1';
const STORAGE_KEY_ACTIVE = 'scouting_active_opponent';

/**
 * Default data structure if no saved data exists yet.
 */
function getDefaultData() {
  return {
    opponents: {
      "Ridgeview High": { games: [], roster: [] },
      "Oak Creek": { games: [], roster: [] }
    },
    selfTeam: { games: [], roster: [] }
  };
}

/**
 * Loads the master data object from localStorage and ensures missing keys are safely initialized.
 */
function loadAppData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  let data;
  if (!raw) {
    data = getDefaultData();
    saveAppData(data);
    return data;
  }
  try {
    data = JSON.parse(raw);
    // Ensure roster and games arrays exist for legacy saved data
    Object.keys(data.opponents || {}).forEach(op => {
      if (!data.opponents[op].roster) data.opponents[op].roster = [];
      if (!data.opponents[op].games) data.opponents[op].games = [];
    });
    return data;
  } catch (e) {
    console.error("Error reading stored data, reverting to defaults:", e);
    return getDefaultData();
  }
}

/**
 * Saves the master data object to localStorage.
 */
function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- OPPONENT MANAGEMENT FUNCTIONS ---

/**
 * Gets an array of all opponent team names.
 */
function getOpponents() {
  const data = loadAppData();
  return Object.keys(data.opponents || {});
}

/**
 * Adds a new opponent team if it doesn't already exist.
 */
function addOpponentToStorage(name) {
  if (!name || !name.trim()) return false;
  const data = loadAppData();
  const trimmedName = name.trim();

  if (!data.opponents[trimmedName]) {
    data.opponents[trimmedName] = { games: [], roster: [] };
    saveAppData(data);
    return true;
  }
  return false;
}

/**
 * Renames an existing opponent team and moves all associated games and roster data.
 */
function renameOpponentInStorage(oldName, newName) {
  if (!oldName || !newName || !newName.trim() || oldName === newName) return false;
  const data = loadAppData();
  const trimmedNew = newName.trim();

  if (data.opponents[oldName] && !data.opponents[trimmedNew]) {
    data.opponents[trimmedNew] = data.opponents[oldName];
    delete data.opponents[oldName];
    saveAppData(data);
    return true;
  }
  return false;
}

/**
 * Deletes an opponent and all associated data.
 */
function deleteOpponent(name) {
  const data = loadAppData();
  if (data.opponents[name]) {
    delete data.opponents[name];
    saveAppData(data);
    
    // Clear active opponent if deleted
    if (getActiveOpponent() === name) {
      const remaining = getOpponents();
      setActiveOpponent(remaining.length > 0 ? remaining[0] : '');
    }
  }
}

/**
 * Gets currently active selected opponent.
 */
function getActiveOpponent() {
  return localStorage.getItem(STORAGE_KEY_ACTIVE) || getOpponents()[0] || '';
}

/**
 * Sets currently active selected opponent.
 */
function setActiveOpponent(name) {
  localStorage.setItem(STORAGE_KEY_ACTIVE, name);
}

// --- GAME LOG FUNCTIONS ---

/**
 * Retrieves saved games for a specific opponent.
 */
function getOpponentGames(opponentName) {
  const data = loadAppData();
  return data.opponents[opponentName]?.games || [];
}

/**
 * Saves a game object to an opponent's history.
 */
function saveGameLog(opponentName, gameObj) {
  const data = loadAppData();

  if (!data.opponents[opponentName]) {
    data.opponents[opponentName] = { games: [], roster: [] };
  }

  const newGame = {
    id: gameObj.id || ('game_' + Date.now()),
    date: gameObj.date || new Date().toISOString().split('T')[0],
    notes: gameObj.notes || 'Regular Season Game',
    rawText: gameObj.rawText || '',
    timestamp: new Date().toISOString()
  };

  data.opponents[opponentName].games.push(newGame);
  saveAppData(data);
  return newGame;
}

/**
 * Deletes a game log by ID for a given opponent.
 */
function deleteGameLog(opponentName, gameId) {
  const data = loadAppData();
  if (data.opponents[opponentName]) {
    data.opponents[opponentName].games = data.opponents[opponentName].games.filter(g => g.id !== gameId);
    saveAppData(data);
  }
}

// --- ROSTER MANAGEMENT FUNCTIONS ---

/**
 * Gets the roster for an opponent.
 */
function getOpponentRoster(opponentName) {
  const data = loadAppData();
  return data.opponents[opponentName]?.roster || [];
}

/**
 * Replaces or saves the entire roster array for an opponent.
 */
function saveOpponentRoster(opponentName, rosterArray) {
  const data = loadAppData();
  if (!data.opponents[opponentName]) {
    data.opponents[opponentName] = { games: [], roster: [] };
  }
  data.opponents[opponentName].roster = rosterArray;
  saveAppData(data);
}
