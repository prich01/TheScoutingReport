/**
 * The Scouting Report - GameChanger Log Parser (js/parser.js)
 */

function parseGameLog(rawText, opponentName = '') {
  if (!rawText) return { stats: [], metadata: {} };

  const lines = rawText.split('\n');
  const playerMap = {};

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || isHeaderOrNoiseLine(trimmed)) return;

    const playData = parsePlayLine(trimmed);
    if (!playData || !playData.playerName) return;

    const name = playData.playerName;

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
        rbis: 0
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

function isHeaderOrNoiseLine(line) {
  const lower = line.toLowerCase();
  if (line.length < 3) return true;
  
  const noise = [
    'gamechanger', 'lineup', 'pitching change', 'substitution',
    'ball', 'strike', 'foul', 'in play', 'top of', 'bottom of',
    'inning summary', 'half summary'
  ];
  return noise.some(kw => lower === kw || lower.startsWith('top of') || lower.startsWith('bottom of'));
}

function parsePlayLine(line) {
  // 1. Clean line of lead numbers or hashes
  let clean = line.replace(/^[\d#\.\s]+/, '').trim();

  // 2. Extract potential player name (Looks for "First Last" pattern at start of string)
  // Stops before action verbs or punctuation
  const nameMatch = clean.match(/^([A-Z][a-zA-Z\.\'-]+(?:\s+[A-Z][a-zA-Z\.\'-]+)+)/);
  if (!nameMatch) return null;

  let rawName = nameMatch[1].trim();

  // Strip trailing verbs if captured into the name string
  let cleanedName = rawName
    .replace(/\s+(is|was|singles|doubles|triples|homers|walks|strikes|grounds|flies|lines|pops|hit|bunts|reaches|sacrifices|out)$/i, '')
    .trim();

  if (cleanedName.length < 3) return null;

  // 3. Determine event type from the sentence
  const lowerLine = clean.toLowerCase();
  let event = 'UNKNOWN';

  if (lowerLine.includes('singles')) event = 'SINGLE';
  else if (lowerLine.includes('doubles')) event = 'DOUBLE';
  else if (lowerLine.includes('triples')) event = 'TRIPLE';
  else if (lowerLine.includes('homers') || lowerLine.includes('home run')) event = 'HR';
  else if (lowerLine.includes('walks') || lowerLine.includes('base on balls')) event = 'BB';
  else if (lowerLine.includes('hit by pitch')) event = 'HBP';
  else if (lowerLine.includes('strikes out') || lowerLine.includes('struck out')) event = 'SO';
  else if (lowerLine.includes('grounds out') || lowerLine.includes('flies out') || lowerLine.includes('lines out') || lowerLine.includes('pops out') || lowerLine.includes('out at')) event = 'OUT';
  else if (lowerLine.includes('reaches on an error') || lowerLine.includes('error by')) event = 'ROE';
  else if (lowerLine.includes('stolen base') || lowerLine.includes('steals')) event = 'SB';

  // Return parsed data if an action or player was found
  return { playerName: cleanedName, event: event };
}

function applyEventToStats(player, event) {
  if (event === 'UNKNOWN' || event === 'SB') return;

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
  }
}

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
