/**
 * The Scouting Report - GameChanger Play-by-Play Parser (js/parser.js)
 * Parses raw GameChanger text logs into structured stats and spray chart data.
 */

/**
 * Main entry point: Parses raw text for an opponent and merges with their saved roster.
 * @param {string} rawText - Raw text log from GameChanger
 * @param {Array} roster - Roster array for the opponent from localStorage
 * @returns {Object} Structured data containing hitters and pitchers
 */
function parseGameLog(rawText, roster = []) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Map roster for fast lookup by name (case-insensitive)
  const rosterMap = {};
  roster.forEach(p => {
    rosterMap[p.name.toLowerCase()] = p;
  });

  const hitters = {};
  const pitchers = {};

  // Regular expressions for key events
  const hitRegex = /(singled|doubled|tripled|homered)\s+(?:to|into|over)\s+([a-z\s]+)/i;
  const outRegex = /(grounded out|flied out|lined out|popped out)\s+(?:to|into)\s+([a-z\s]+)/i;
  const strikeoutRegex = /(struck out looking|struck out swinging|struck out)/i;
  const walkRegex = /(walked|intent walk|hit by pitch)/i;

  let currentInning = 'Top 1';

  lines.forEach(line => {
    // Track inning switches
    if (/^(top|bottom)\s+\d+/i.test(line)) {
      currentInning = line;
      return;
    }

    // Process At-Bats: Look for standard "Player Name [action]" lines
    // Example: "John Smith singled to center field."
    const tokens = line.split(' ');
    if (tokens.length < 3) return;

    // Detect player name candidate at start of sentence
    const playAction = line.toLowerCase();

    // Check for Hits
    const hitMatch = line.match(hitRegex);
    if (hitMatch) {
      const playerName = extractPlayerName(line, hitMatch[0]);
      if (playerName) {
        initHitter(hitters, playerName, rosterMap);
        const hitType = hitMatch[1].toLowerCase();
        const location = cleanLocation(hitMatch[2]);

        hitters[playerName].pa++;
        hitters[playerName].ab++;
        hitters[playerName].hits++;
        if (hitType === 'singled') hitters[playerName].singles++;
        if (hitType === 'doubled') hitters[playerName].doubles++;
        if (hitType === 'tripled') hitters[playerName].triples++;
        if (hitType === 'homered') hitters[playerName].hr++;

        hitters[playerName].spray.push({
          type: hitType,
          location: location,
          result: 'hit',
          text: line
        });
      }
      return;
    }

    // Check for Fielded Outs
    const outMatch = line.match(outRegex);
    if (outMatch) {
      const playerName = extractPlayerName(line, outMatch[0]);
      if (playerName) {
        initHitter(hitters, playerName, rosterMap);
        const outType = outMatch[1].toLowerCase();
        const location = cleanLocation(outMatch[2]);

        hitters[playerName].pa++;
        hitters[playerName].ab++;

        hitters[playerName].spray.push({
          type: outType,
          location: location,
          result: 'out',
          text: line
        });
      }
      return;
    }

    // Check for Strikeouts
    const kMatch = line.match(strikeoutRegex);
    if (kMatch) {
      const playerName = extractPlayerName(line, kMatch[0]);
      if (playerName) {
        initHitter(hitters, playerName, rosterMap);
        hitters[playerName].pa++;
        hitters[playerName].ab++;
        hitters[playerName].so++;
      }
      return;
    }

    // Check for Walks / HBP
    const bbMatch = line.match(walkRegex);
    if (bbMatch) {
      const playerName = extractPlayerName(line, bbMatch[0]);
      if (playerName) {
        initHitter(hitters, playerName, rosterMap);
        hitters[playerName].pa++;
        if (line.toLowerCase().includes('hit by pitch')) {
          hitters[playerName].hbp++;
        } else {
          hitters[playerName].bb++;
        }
      }
      return;
    }
  });

  // Calculate final averages & percentages for each hitter
  Object.keys(hitters).forEach(name => {
    const h = hitters[name];
    h.avg = h.ab > 0 ? (h.hits / h.ab).toFixed(3) : '.000';
    h.obp = h.pa > 0 ? ((h.hits + h.bb + h.hbp) / h.pa).toFixed(3) : '.000';
    h.slg = h.ab > 0 ? ((h.singles + (h.doubles * 2) + (h.triples * 3) + (h.hr * 4)) / h.ab).toFixed(3) : '.000';
  });

  return { hitters, pitchers };
}

/**
 * Extracts player name appearing before the play outcome text.
 */
function extractPlayerName(line, matchedAction) {
  const actionIdx = line.indexOf(matchedAction);
  if (actionIdx <= 0) return null;
  const rawName = line.substring(0, actionIdx).trim();
  // Basic sanity check on name length
  return rawName.length > 2 && rawName.length < 30 ? rawName : null;
}

/**
 * Cleans up field location strings (e.g., "left field", "shortstop", "shallow right").
 */
function cleanLocation(locStr) {
  if (!locStr) return 'center field';
  let cleaned = locStr.toLowerCase().replace(/[\.\,\;]/g, '').trim();
  // Cut off extra clause words if present (e.g. "center field for out 2")
  if (cleaned.includes(' for ')) {
    cleaned = cleaned.split(' for ')[0];
  }
  return cleaned;
}

/**
 * Initializes a hitter object if not already present.
 */
function initHitter(hitters, name, rosterMap) {
  if (!hitters[name]) {
    const rosterInfo = rosterMap[name.toLowerCase()] || {};
    hitters[name] = {
      name: name,
      number: rosterInfo.number || '--',
      bats: rosterInfo.bats || 'R',
      throws: rosterInfo.throws || 'R',
      pos: rosterInfo.pos || 'UT',
      pa: 0,
      ab: 0,
      hits: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      hr: 0,
      bb: 0,
      so: 0,
      hbp: 0,
      avg: '.000',
      obp: '.000',
      slg: '.000',
      spray: []
    };
  }
}
