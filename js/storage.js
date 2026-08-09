/**
 * The Scouting Report - Storage Manager (js/storage.js)
 * Manages saving and loading opponent data, parsed games, and rosters in browser localStorage.
 */

const STORAGE_KEY = 'scouting_report_data_v1';

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
    // Ensure roster arrays exist for legacy saved data
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
    data.opponents[opponentName] = { games: [], roster: [] };
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

  // Auto-scan raw log for player names and add missing ones to roster
  autoExtractAndAddRosterPlayers(opponentName, rawText);

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
 * Updates or adds a specific player in an opponent's roster.
 */
function updateRosterPlayer(opponentName, playerName, updatedFields) {
  const data = loadAppData();
  if (!data.opponents[opponentName]) return;

  const roster = data.opponents[opponentName].roster;
  const existingIdx = roster.findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());

  if (existingIdx !== -1) {
    roster[existingIdx] = { ...roster[existingIdx], ...updatedFields };
  } else {
    roster.push({
      name: playerName,
      number: updatedFields.number || '',
      bats: updatedFields.bats || 'R',
      throws: updatedFields.throws || 'R',
      pos: updatedFields.pos || 'UT'
    });
  }

  saveAppData(data);
}

/**
 * Removes a player from the roster.
 */
function deleteRosterPlayer(opponentName, playerName) {
  const data = loadAppData();
  if (data.opponents[opponentName]) {
    data.opponents[opponentName].roster = data.opponents[opponentName].roster.filter(
      p => p.name.toLowerCase() !== playerName.toLowerCase()
    );
    saveAppData(data);
  }
}

/**
 * Basic scanner that extracts candidate player names from GameChanger logs and adds them if missing.
 */
function autoExtractAndAddRosterPlayers(opponentName, rawText) {
  const data = loadAppData();
  if (!data.opponents[opponentName]) return;

  const roster = data.opponents[opponentName].roster;
  const existingNames = new Set(roster.map(p => p.name.toLowerCase()));

  // Quick scanner: looks for common GameChanger line patterns (e.g., "John Smith singled", "J. Smith pitched")
  const lines = rawText.split('\n');
  const foundNames = new Set();

  const namePattern = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/g;

  lines.forEach(line => {
    let match;
    while ((match = namePattern.exec(line)) !== null) {
      const candidate = match[1].trim();
      // Filter out non-player keywords common in PBP text
      const ignoreKeywords = ['Top Of', 'Bottom Of', 'Inning', 'Ball', 'Strike', 'Foul', 'In Play', 'GameChanger', 'Out', 'Single', 'Double', 'Triple', 'Home Run'];
      if (!ignoreKeywords.some(kw => candidate.toLowerCase().includes(kw.toLowerCase())) && candidate.length > 3) {
        foundNames.add(candidate);
      }
    }
  });

  foundNames.forEach(name => {
    if (!existingNames.has(name.toLowerCase())) {
      roster.push({
        name: name,
        number: '',
        bats: 'R',
        throws: 'R',
        pos: 'UT'
      });
    }
  });

  saveAppData(data);
}
