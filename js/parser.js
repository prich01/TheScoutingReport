/**
 * Optimized GameChanger Play-by-Play Parser (js/parser.js)
 */

function parseGameLog(rawText = '', roster = []) {
  console.log("=== STARTING GAME LOG PARSER ===");
  
  const result = {
    hitters: {},
    pitchers: {}
  };

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    console.warn("Parser received empty or invalid text input.");
    return result;
  }

  // Normalize line breaks & split into individual lines
  const rawLines = rawText.split(/\r?\n/);
  console.log(`Total raw lines detected: ${rawLines.length}`);

  let currentPitcherName = 'Unknown Pitcher';

  rawLines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // Skip inning headers, counts, and pitch-by-pitch clutter
    if (/^(Top|Bottom|End|Inning|Ball|Strike|Foul|Out|\d+-\d+)/i.test(cleanLine)) {
      return;
    }

    // --- A. PITCHING CHANGE DETECTION ---
    if (/takes the mound|pitching change|enters to pitch|substitutes.*pitcher/i.test(cleanLine)) {
      const pInfo = extractPlayerInfo(cleanLine);
      if (pInfo.name) {
        currentPitcherName = pInfo.name;
        ensurePitcher(result.pitchers, currentPitcherName, pInfo.number);
        console.log(`[Line ${index}] Active Pitcher updated to: ${currentPitcherName}`);
      }
      return;
    }

    // --- B. HITTER / EVENT DETECTION ---
    // Look for key GameChanger outcome action words
    const isEvent = /(singled|doubled|tripled|homered|struck out|walked|hit by pitch|grounded|flied|lined|popped|reached on|out at)/i.test(cleanLine);

    if (isEvent) {
      const pInfo = extractPlayerInfo(cleanLine);
      if (!pInfo.name) return;

      const hitter = ensureHitter(result.hitters, pInfo.name, pInfo.number, roster);
      const pitcher = ensurePitcher(result.pitchers, currentPitcherName, '00');

      processEventLine(cleanLine, hitter, pitcher);
    }
  });

  console.log("=== PARSING COMPLETE ===");
  console.log("Extracted Hitters:", Object.keys(result.hitters));
  console.log("Extracted Pitchers:", Object.keys(result.pitchers));

  return result;
}

// ==========================================
// HELPER EXTRACTORS
// ==========================================

function extractPlayerInfo(line) {
  // Regex 1: Matches "#12 John Smith" or "#7 Smith"
  let match = line.match(/^#?(\d+)?\s*([A-Z][a-zA-Z'.\-]+(?:\s+[A-Z][a-zA-Z'.\-]+)+)/);
  if (match) {
    return { number: match[1] || '00', name: match[2].trim() };
  }

  // Regex 2: Matches single-name or initial format like "J. Smith" or "Smith" at start of line
  match = line.match(/^#?(\d+)?\s*([A-Z][a-zA-Z'.\-]+)/);
  if (match) {
    return { number: match[1] || '00', name: match[2].trim() };
  }

  return { number: '00', name: null };
}

function ensureHitter(hitters, name, number, roster) {
  if (!hitters[name]) {
    const match = roster.find(r => r.name.toLowerCase() === name.toLowerCase()) || {};
    hitters[name] = {
      name: name,
      number: number !== '00' ? number : (match.number || '00'),
      bats: match.bats || 'R',
      throws: match.throws || 'R',
      pos: match.pos || 'UT',
      pa: 0, ab: 0, hits: 0, singles: 0, doubles: 0, triples: 0, hr: 0, bb: 0, so: 0, hbp: 0,
      spray: []
    };
  }
  return hitters[name];
}

function ensurePitcher(pitchers, name, number) {
  if (!pitchers[name]) {
    pitchers[name] = {
      name: name,
      number: number || '00',
      throws: 'R',
      outs: 0, bf: 0, h: 0, bb: 0, so: 0, hr: 0
    };
  }
  return pitchers[name];
}

function processEventLine(line, hitter, pitcher) {
  const text = line.toLowerCase();
  hitter.pa += 1;
  pitcher.bf += 1;

  const location = extractLocation(text);
  const type = extractType(text);

  // WALKS / HBP
  if (text.includes('walked') || text.includes('base on balls')) {
    hitter.bb += 1;
    pitcher.bb += 1;
    return;
  }
  if (text.includes('hit by pitch')) {
    hitter.hbp += 1;
    return;
  }

  // AT-BATS
  hitter.ab += 1;

  if (text.includes('singled') || text.includes('single')) {
    recordHit(hitter, pitcher, 'singles', location, type);
  } else if (text.includes('doubled') || text.includes('double')) {
    recordHit(hitter, pitcher, 'doubles', location, type);
  } else if (text.includes('tripled') || text.includes('triple')) {
    recordHit(hitter, pitcher, 'triples', location, type);
  } else if (text.includes('homered') || text.includes('home run')) {
    recordHit(hitter, pitcher, 'hr', location, type);
  } else {
    // OUTS
    if (text.includes('struck out')) {
      hitter.so += 1;
      pitcher.so += 1;
    }
    pitcher.outs += 1;

    if (location) {
      hitter.spray.push({ location: location, result: 'out', type: type || 'out' });
    }
  }
}

function recordHit(hitter, pitcher, hitType, location, type) {
  hitter.hits += 1;
  hitter[hitType] += 1;
  pitcher.h += 1;
  if (hitType === 'hr') pitcher.hr += 1;

  hitter.spray.push({
    location: location || 'center field',
    result: 'hit',
    type: type || 'hit'
  });
}

function extractLocation(text) {
  if (text.includes('left-center')) return 'left-center';
  if (text.includes('right-center')) return 'right-center';
  if (text.includes('left field') || text.includes('to lf')) return 'left field';
  if (text.includes('right field') || text.includes('to rf')) return 'right field';
  if (text.includes('center field') || text.includes('to cf')) return 'center field';
  if (text.includes('shortstop') || text.includes('to ss')) return 'shortstop';
  if (text.includes('third base') || text.includes('to 3b')) return 'third base';
  if (text.includes('second base') || text.includes('to 2b')) return 'second base';
  if (text.includes('first base') || text.includes('to 1b')) return 'first base';
  if (text.includes('pitcher') || text.includes('to p')) return 'pitcher';
  if (text.includes('catcher') || text.includes('to c')) return 'catcher';
  return null;
}

function extractType(text) {
  if (text.includes('line drive')) return 'Line Drive';
  if (text.includes('fly ball')) return 'Fly Ball';
  if (text.includes('ground ball') || text.includes('grounder')) return 'Ground Ball';
  if (text.includes('pop fly') || text.includes('pop up')) return 'Pop Fly';
  if (text.includes('bunt')) return 'Bunt';
  return 'Contact';
}
