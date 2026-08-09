/**
 * The Scouting Report - GameChanger Log Parser (js/parser.js)
 * Cleans player names, tracks half-innings to separate teams, and calculates stats.
 */

/**
 * Main function to parse a raw GameChanger play-by-play text log.
 * @param {string} rawText - The raw pasted log text.
 * @param {string} opponentName - The name of the opponent team to filter for (optional).
 */
function parseGameLog(rawText, opponentName = '') {
  if (!rawText) return { stats: [], metadata: {} };

  const lines = rawText.split('\n');
  const playerMap = {};
  
  let currentInning = 1;
  let currentHalf = 'TOP'; // 'TOP' or 'BOTTOM'
  let currentBattingTeam = '';

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Inning Headers (e.g. "Top of 1st - Ridgeview High", "Bottom of 2nd", etc.)
    const inningMatch = trimmed.match(/(Top|Bottom)\s+of\s+(\d+)(?:st|nd|rd|th)?(?:\s*-\s*(.*))?/i);
    if (inningMatch) {
      currentHalf = inningMatch[1].toUpperCase();
      currentInning = parseInt(inningMatch[2], 10);
      if (inningMatch[3]) {
        currentBattingTeam = inningMatch[3].trim();
      }
      return;
    }

    // Filter out generic GameChanger header lines
    if (isHeaderOrNoiseLine(trimmed)) return;

    // Extract player name and action from play-by-play lines
    const playData = parsePlayLine(trimmed);
    if (!playData || !playData.playerName) return;

    const name = playData.playerName;

    // Initialize player stats if not existing
    if (!playerMap[name]) {
      playerMap[name] = {
        name: name,
        number: '00',
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
        sf: 0,
        rbis: 0,
        outsRecorded: 0
      };
    }

    // Apply parsed event to stats
    applyEventToStats(playerMap[name], playData.event);
  });

  // Calculate final slash lines (AVG / OBP / SLG)
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
 * Helper to identify and ignore non-play text lines.
 */
function isHeaderOrNoiseLine(line) {
  const noise = [
    'gamechanger', 'lineup', 'pitching change', 'substitution',
    'ball', 'strike', 'foul', 'in play', 'top of', 'bottom of'
  ];
  const lower = line.toLowerCase();
  if (line.length < 5) return true;
  return noise.some(kw => lower === kw);
}

/**
 * Extracts cleaned player name and event type from a play-by-play sentence.
 */
function parsePlayLine(line) {
  // Regex to strip trailing action verbs that GameChanger attaches to names
  // e.g. "J Webb is hit by pitch" -> Name: "J Webb", Action: "hit by pitch"
  const cleanLine = line.replace(/^[\d#\s]+/, ''); // strip lead numbers

  // Common pattern: [Name] [Action Verb] [Result]
  const verbRegex = /^([A-Z][a-zA-Z\s\.\'-]+?)\s+(is|singles|doubles|triples|homers|walks|strikes|grounds|flies|lines|pops|hit|bunts|reaches|sacrifices|out)\b/i;
  const match = cleanLine.match(verbRegex);

  if (!match) return null;

  let name = match[1].trim();

  // Clean remaining unwanted trailing words from player name
  name = name.replace(/\s+(is|was|has)$/i, '').trim();

  // Basic validation on clean name
  if (name.length < 3 || name.toLowerCase().includes('top of') || name.toLowerCase().includes('bottom of')) {
    return null;
  }

  const fullSentence = cleanLine.toLowerCase();
  let event = 'UNKNOWN';

  if (fullSentence.includes('singles')) event = 'SINGLE';
  else if (fullSentence.includes('doubles')) event = 'DOUBLE';
  else if (fullSentence.includes('triples')) event = 'TRIPLE';
  else if (fullSentence.includes('homers') || fullSentence.includes('home run')) event = 'HR';
  else if (fullSentence.includes('walks') || fullSentence.includes('base on balls')) event = 'BB';
  else if (fullSentence.includes('hit by pitch')) event = 'HBP';
  else if (fullSentence.includes('strikes out')) event = 'SO';
  else if (fullSentence.includes('grounds out') || fullSentence.includes('flies out') || fullSentence.includes('lines out') || fullSentence.includes('pops out')) event = 'OUT';
  else if (fullSentence.includes('reaches on an error')) event = 'ROE';

  return { playerName: name, event: event };
}

/**
 * Updates numerical stat counters based on the event type.
 */
function applyEventToStats(player, event) {
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
    default:
      // If event was unrecognized, subtract PA to avoid inflating PA count
      player.pa -= 1;
      break;
  }
}

/**
 * Calculates standard baseball slash line statistics.
 */
function calculateSlashLines(player) {
  const ab = player.ab || 0;
  const hits = player.hits || 0;
  const bb = player.bb || 0;
  const hbp = player.hbp || 0;
  const sf = player.sf || 0;
  const pa = player.pa || (ab + bb + hbp + sf);

  const singles = player.singles || 0;
  const doubles = player.doubles || 0;
  const triples = player.triples || 0;
  const hr = player.hr || 0;

  const totalBases = singles + (doubles * 2) + (triples * 3) + (hr * 4);

  // Batting Average (AVG)
  const avg = ab > 0 ? (hits / ab) : 0;

  // On-Base Percentage (OBP)
  const obpDenominator = ab + bb + hbp + sf;
  const obp = obpDenominator > 0 ? ((hits + bb + hbp) / obpDenominator) : 0;

  // Slugging Percentage (SLG)
  const slg = ab > 0 ? (totalBases / ab) : 0;

  // On-Base Plus Slugging (OPS)
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
