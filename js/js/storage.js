/**
 * The Scouting Report - Storage Manager (js/storage.js)
 * Manages saving and loading opponent data and parsed games in browser localStorage.
 */

const STORAGE_KEY = 'scouting_report_data_v1';

/**
 * Default data structure if no saved data exists yet.
 */
function getDefaultData() {
  return {
    opponents: {
      "Ridgeview High": { games: [] },
      "Oak Creek": { games: [] }
    },
    selfTeam: { games: [] }
  };
}

/**
 * Loads the master data object from localStorage.
 */
function loadAppData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const defaultData = getDefaultData();
    saveAppData(defaultData);
    return defaultData;
  }
  try {
    return JSON.parse(raw);
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

/**
 * Retrieves saved games for a specific opponent.
 */
function getOpponentGames(opponentName) {
  const data = loadAppData();
  return data.opponents[opponentName]?.games || [];
}

/**
 * Saves a new raw GameChanger log to an opponent's history.
 */
function saveGameLog(opponentName, gameMetadata, rawText) {
  const data = loadAppData();

  if (!data.opponents[opponentName]) {
    data.opponents[opponentName] = { games: [] };
  }

  const newGame = {
    id: 'game_' + Date.now(),
    date: gameMetadata.date || new Date().toISOString().split('T')[0],
    notes: gameMetadata.notes || 'Regular Season Game',
    rawText: rawText,
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
