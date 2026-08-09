/**
 * The Scouting Report - GameChanger Play-by-Play Parser (js/parser.js)
 * Parses raw GameChanger text logs into structured hitter and pitcher stats.
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
  const pitchingChangeRegex = /(?:pitching change:|takes the mound|now pitching:?)\s*([a-z\s]+)/i;

  let activePitcher = null;

  lines.forEach(line => {
    const lineLower = line.toLowerCase();

    // Check for pitching changes
    const pitchMatch = line.match(pitchingChangeRegex);
    if (pitchMatch) {
      const candidateName = pitchMatch[1].replace(/replaces.*/i, '').trim();
      if (candidateName.length > 2) {
        activePitcher = candidateName;
        initPitcher(pitchers, activePitcher, rosterMap);
      }
    }

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

        // Credit to active pitcher if tracked
        if (activePitcher) {
          initPitcher(pitchers, activePitcher, rosterMap);
          pitchers[activePitcher].bf++;
          pitchers[activePitcher].h++;
          if (hitType === 'homered') pitchers[activePitcher].hr++;
        }
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

        // Credit out and batter faced to active pitcher
        if (activePitcher) {
          initPitcher(pitchers, activePitcher, rosterMap);
          pitchers[activePitcher].bf++;
          pitchers[activePitcher].outs++;
        }
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

        if (activePitcher) {
          initPitcher(pitchers, activePitcher, rosterMap);
          pitchers[activePitcher].bf++;
          pitchers[activePitcher].outs++;
          pitchers[activePitcher].so++;
        }
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
        if (lineLower.includes('hit by pitch')) {
          hitters[playerName].hbp++;
        } else {
          hitters[playerName].bb++;
        }

        if (activePitcher) {
          initPitcher(pitchers, activePitcher, rosterMap);
          pitchers[activePitcher].bf++;
          pitchers[activePitcher].bb++;
        }
      }
      return;
    }
  });

  // Post-process Hitter Stats
  Object.keys(hitters).forEach(name => {
    const h = hitters[name];
    h.avg = h.ab > 0 ? (h.hits / h.ab).toFixed(3) : '.000';
    h.obp = h.pa > 0 ? ((h.hits + h.bb + h.hbp) / h.pa).toFixed(3) : '.000';
    h.slg = h.ab > 0 ? ((h.singles + (h.doubles * 2) + (h.triples * 3) + (h.hr * 4)) / h.ab).toFixed(3) : '.000';
  });

  // Post-process Pitcher Stats
  Object.keys(pitchers).forEach(name => {
    const p = pitchers[name];
    const fullInnings = Math.floor(p.outs / 3);
    const remOuts = p.outs % 3;
    p.ipDisplay = `${fullInnings}.${remOuts}`;
    p.ipDecimal = p.outs / 3;
    
    // WHIP = (Walks + Hits) / Innings Pitched
    p.whip = p.ipDecimal > 0 ? ((p.h + p.bb) / p.ipDecimal).toFixed(2) : '0.00';
    
    // Strikeout to Walk Ratio
    p.kBbRatio = p.bb > 0 ? (p.so / p.bb).toFixed(1) : p.so.toFixed(1);
  });

  return { hitters, pitchers };
}

function extractPlayerName(line, matchedAction) {
  const actionIdx = line.indexOf(matchedAction);
  if (actionIdx <= 0) return null;
  const rawName = line.substring(0, actionIdx).trim();
  return rawName.length > 2 && rawName.length < 30 ? rawName : null;
}

function cleanLocation(locStr) {
  if (!locStr) return 'center field';
  let cleaned = locStr.toLowerCase().replace(/[\.\,\;]/g, '').trim();
  if (cleaned.includes(' for ')) {
    cleaned = cleaned.split(' for ')[0];
  }
  return cleaned;
}

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

function initPitcher(pitchers, name, rosterMap) {
  if (!pitchers[name]) {
    const rosterInfo = rosterMap[name.toLowerCase()] || {};
    pitchers[name] = {
      name: name,
      number: rosterInfo.number || '--',
      throws: rosterInfo.throws || 'R',
      pos: 'P',
      outs: 0,
      bf: 0,
      h: 0,
      bb: 0,
      so: 0,
      hr: 0,
      ipDisplay: '0.0',
      whip: '0.00',
      kBbRatio: '0.0'
    };
  }
}
