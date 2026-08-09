/**
 * The Scouting Report - Custom GameChanger Log Parser (js/parser.js)
 */

/**
 * Parses a GameChanger play-by-play log.
 * @param {string} rawText - Raw play-by-play text.
 * @param {string} opponentName - Selected opponent to filter stats for (optional).
 */
function parseGameLog(rawText, opponentName = '') {
  if (!rawText) return { stats: [], metadata: {} };

  const lines = rawText.split('\n');
  const playerMap = {};

  let currentBattingTeam = '';
  let currentInningHalf = ''; // 'TOP' or 'BOTTOM'

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Inning Headers (e.g., "Top 1st - Bearden Varsity Bulldogs", "Bottom 1st - Oak Ridge Varsity Wildcats")
    const headerMatch = trimmed.match(/^(Top|Bottom)\s+\d+(?:st|nd|rd|th)?\s*-\s*(.*)$/i);
    if (headerMatch) {
      currentInningHalf = headerMatch[1].toUpperCase();
      currentBattingTeam = headerMatch[2].trim();
      return;
    }

    // Ignore pitch counts, out markers, and noise
    if (isNoiseLine(trimmed)) return;

    // Parse the play line
    const playData = parsePlayLine(trimmed);
    if (!playData || !playData.playerName) return;

    const name = playData.playerName;

    // Optional team filtering: If opponentName is set, you can filter by team
    // (If no filtering is active, it will collect all players in the log)

    if (!playerMap[name]) {
      playerMap[name] = {
        name: name,
        number: '00',
        team: currentBattingTeam,
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
        sf: 0
      };
    }

    applyEventToStats(playerMap[name], playData.event);
  });

  const statsArray = Object.values(playerMap).map(p => calculateSlashLines(p));

  return {
    stats: statsArray,
    metadata: {
      date: new Date().toISOString().split('T')[0],
      totalPlayersParsed: statsArray.length
    }
  };
}

/**
 * Ignores count lines, score markers, and substitutions.
 */
function isNoiseLine(line) {
  const lower = line.toLowerCase();
  if (line.length < 3) return true;

  // Ignore lines like "1 Out", "BRDN 0 - OKRD 1", "Ball 1, Strike 1", "Lineup changed..."
  if (/^\d+\s+Outs?/i.test(line)) return true;
  if (/^[A-Z]{3,4}\s+\d+\s*-\s*[A-Z]{3,4}\s+\d+/i.test(line)) return true;
  if (lower.startsWith('ball ') || lower.startsWith('strike ') || lower.startsWith('foul') || lower.startsWith('in play') || lower.startsWith('pickoff')) return true;
  if (lower.startsWith('lineup changed') || lower.startsWith('courtesy runner')) return true;

  const headings = ['strikeout', 'single', 'double', 'triple', 'home run', 'ground out', 'fly out', 'line out', 'pop out', 'walk', 'hit by pitch', 'error', 'fielder\'s choice', 'dropped 3rd strike', 'sacrifice bunt'];
  if (headings.includes(lower)) return true;

  return false;
}

/**
 * Parses individual play lines from GameChanger logs.
 */
function parsePlayLine(line) {
  let clean = line.trim();

  // Pattern for "Name is hit by pitch" -> strip "is hit by pitch"
  if (/^([A-Z][a-zA-Z\.\'-]+(?:\s+[A-Z][a-zA-Z\.\'-]+)+)\s+is hit by pitch/i.test(clean)) {
    const match = clean.match(/^([A-Z][a-zA-Z\.\'-]+(?:\s+[A-Z][a-zA-Z\.\'-]+)+)/i);
    return { playerName: match[1].trim(), event: 'HBP' };
  }

  // General Pattern: [Player Name] [Action Verb] [Details]
  const playRegex = /^([A-Z][a-zA-Z\.\'-]+(?:\s+[A-Z][a-zA-Z\.\'-]+)+)\s+(singles|doubles|triples|homers|walks|strikes out|grounds|flies|lines|pops|bunts|reaches|sacrifices|out)\b/i;
  const match = clean.match(playRegex);

  if (!match) return null;

  const playerName = match[1].trim();
  const verb = match[2].toLowerCase();
  const lowerLine = clean.toLowerCase();

  let event = 'UNKNOWN';

  if (verb === 'singles') event = 'SINGLE';
  else if (verb === 'doubles') event = 'DOUBLE';
  else if (verb === 'triples') event = 'TRIPLE';
  else if (verb === 'homers') event = 'HR';
  else if (verb === 'walks') event = 'BB';
  else if (verb === 'strikes out') event = 'SO';
  else if (lowerLine.includes('grounds out') || lowerLine.includes('flies out') || lowerLine.includes('lines out') || lowerLine.includes('pops out') || lowerLine.includes('out at')) event = 'OUT';
  else if (lowerLine.includes('reaches on an error') || lowerLine.includes('error by')) event = 'ROE';
  else if (lowerLine.includes('sacrifices')) event = 'SAC';

  return { playerName: playerName, event: event };
}

/**
 * Updates stats counters based on parsed event.
 */
function applyEventToStats(player, event) {
  if (event === 'UNKNOWN') return;

  player.pa += 1;

  switch (event) {
    case 'SINGLE':
      player.ab += 1;
      player.hits += 1;
      player.singles += 1;
      break;
    case 'DOUBLE':
      player.ab += 1;
      player.hits += 1;
      player.doubles += 1;
      break;
    case 'TRIPLE':
      player.ab += 1;
      player.hits += 1;
      player.triples += 1;
      break;
    case 'HR':
      player.ab += 1;
      player.hits += 1;
      player.hr += 1;
      break;
    case 'BB':
      player.bb += 1;
      break;
    case 'HBP':
      player.hbp += 1;
      break;
    case 'SO':
      player.ab += 1;
      player.so += 1;
      break;
    case 'OUT':
    case 'ROE':
      player.ab += 1;
      break;
    case 'SAC':
      player.sf += 1; // Sacrifices don't count as AB
      break;
  }
}

/**
 * Calculates standard slash line stats.
 */
function calculateSlashLines(player) {
  const ab = player.ab || 0;
  const hits = player.hits || 0;
  const bb = player.bb || 0;
  const hbp = player.hbp || 0;
  const sf = player.sf || 0;

  const singles = player.singles || 0;
  const doubles = player.doubles || 0;
  const triples = player.triples || 0;
  const hr = player.hr || 0;

  const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4);

  const avg = ab > 0 ? (hits / ab) : 0;
  const obpDenominator = ab + bb + hbp + sf;
  const obp = obpDenominator > 0 ? ((hits + bb + hbp) / obpDenominator) : 0;
  const slg = ab > 0 ? (totalBases / ab) : 0;
  const ops = obp + slg;

  return {
    ...player,
    avg: avg.toFixed(3).replace(/^0/, ''),
    obp: obp.toFixed(3).replace(/^0/, ''),
    slg: slg.toFixed(3).replace(/^0/, ''),
    ops: ops.toFixed(3).replace(/^0/, ''),
    avgNum: avg,
    obpNum: obp,
    slgNum: slg,
    opsNum: ops
  };
}
