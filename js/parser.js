/**
 * Universal GameChanger Play-by-Play Parser (js/parser.js)
 */

function parseGameLog(rawText = '', arg2 = [], arg3 = []) {
  console.log("=== STARTING GAME LOG PARSER ===");

  // Resilient Argument Handling (prevents crashes whether called with 2 or 3 args)
  let roster = [];
  let opponentName = '';

  if (Array.isArray(arg2)) {
    roster = arg2;
  } else if (typeof arg2 === 'string') {
    opponentName = arg2;
    if (Array.isArray(arg3)) roster = arg3;
  }

  const result = {
    hitters: {},
    pitchers: {}
  };

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    console.warn("Parser received empty or invalid text input.");
    return result;
  }

  const rawLines = rawText.split(/\r?\n/);
  let currentPitcherName = 'Unknown Pitcher';

  // Action verbs used by GameChanger to anchor play events
  const actionVerbsRegex = /\b(singles|doubles|triples|homers|homered|strikes out|struck out|grounds|flied|lines|lined|flies|pops|popped|walks|walked|is hit by pitch|hit by pitch|hits|bunts|sacrifices|out at|reaches)\b/i;

  rawLines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // --- 1. DETECT PITCHER CHANGES ---
    // Format A: "Lineup changed: M Teasley in at pitcher"
    if (cleanLine.includes('in at pitcher')) {
      const pMatch = cleanLine.match(/Lineup changed:\s*([A-Za-z\s.\-]+?)\s*in at pitcher/i);
      if (pMatch && pMatch[1]) {
        currentPitcherName = pMatch[1].trim();
        ensurePitcher(result.pitchers, currentPitcherName);
        console.log(`[Pitcher Lineup Change]: ${currentPitcherName}`);
      }
    }
    // Format B: "E Frederick in for pitcher M Adams"
    else if (cleanLine.includes('in for pitcher')) {
      const pMatch = cleanLine.match(/([A-Za-z\s.\-]+?)\s+in for pitcher/i);
      if (pMatch && pMatch[1]) {
        currentPitcherName = pMatch[1].trim();
        ensurePitcher(result.pitchers, currentPitcherName);
        console.log(`[Pitcher Substitution]: ${currentPitcherName}`);
      }
    }

    // --- 2. SKIP NON-EVENT LINES ---
    if (/^(Top|Bottom|End|\d+ Out|\d+ Outs|Ball \d|Strike \d|Foul|In play|BRDN|OKRD|Single|Double|Triple|Home Run|Strikeout|Fly Out|Ground Out|Line Out|Pop Out|Walk|Hit By Pitch|Dropped 3rd Strike|Fielder's Choice|Error|Sacrifice Bunt|Double Play)/i.test(cleanLine)) {
      return;
    }

    // --- 3. PROCESS HITTER EVENTS ---
    const verbMatch = cleanLine.match(actionVerbsRegex);

    if (verbMatch && verbMatch.index > 0) {
      // Everything before the action verb is the hitter's name/number
      const rawPlayerPart = cleanLine.substring(0, verbMatch.index).trim();
      const playerInfo = extractNameAndNumber(rawPlayerPart);

      if (!playerInfo.name) return;

      // Check for in-line pitcher tag: ", M Teasley pitching."
      const pitcherOverrideMatch = cleanLine.match(/,\s*([A-Za-z\s.\-]+?)\s+pitching/i);
      if (pitcherOverrideMatch && pitcherOverrideMatch[1]) {
        currentPitcherName = pitcherOverrideMatch[1].trim();
      }

      const hitter = ensureHitter(result.hitters, playerInfo.name, playerInfo.number, roster);
      const pitcher = ensurePitcher(result.pitchers, currentPitcherName);

      processEventLine(cleanLine, hitter, pitcher);
    }
  });

  console.log("=== PARSING COMPLETE ===");
  console.log("Extracted Hitters:", Object.keys(result.hitters));
  console.log("Extracted Pitchers:", Object.keys(result.pitchers));

  return result;
}

// ==========================================
// HELPERS
// ==========================================

function extractNameAndNumber(text) {
  // Strip trailing "was" (e.g. "W East was" -> "W East")
  let cleanText = text.replace(/\s+was$/i, '').trim();

  // Extract jersey number if present (e.g. "#12 John Smith" or "12 John Smith")
  const matchNum = cleanText.match(/^#?(\d+)\s+(.+)/);
  if (matchNum) {
    return { number: matchNum[1], name: matchNum[2].trim() };
  }

  return { number: '00', name: cleanText };
}

function ensureHitter(hitters, name, number, roster = []) {
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

function ensurePitcher(pitchers, name) {
  if (!pitchers[name]) {
    pitchers[name] = {
      name: name,
      number: '00',
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
  if (text.includes('walks') || text.includes('walked')) {
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

  if (text.includes('singles')) {
    recordHit(hitter, pitcher, 'singles', location, type);
  } else if (text.includes('doubled') || text.includes('doubles')) {
    recordHit(hitter, pitcher, 'doubles', location, type);
  } else if (text.includes('tripled') || text.includes('triples')) {
    recordHit(hitter, pitcher, 'triples', location, type);
  } else if (text.includes('homers') || text.includes('homered')) {
    recordHit(hitter, pitcher, 'hr', location, type);
  } else {
    // OUTS
    if (text.includes('strikes out') || text.includes('struck out')) {
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
  if (text.includes('left fielder') || text.includes('left field')) return 'left field';
  if (text.includes('right fielder') || text.includes('right field')) return 'right field';
  if (text.includes('center fielder') || text.includes('center field')) return 'center field';
  if (text.includes('shortstop')) return 'shortstop';
  if (text.includes('third baseman') || text.includes('third base')) return 'third base';
  if (text.includes('second baseman') || text.includes('second base')) return 'second base';
  if (text.includes('first baseman') || text.includes('first base')) return 'first base';
  if (text.includes('pitcher')) return 'pitcher';
  if (text.includes('catcher')) return 'catcher';
  return null;
}

function extractType(text) {
  if (text.includes('line drive')) return 'Line Drive';
  if (text.includes('fly ball') || text.includes('flies out')) return 'Fly Ball';
  if (text.includes('ground ball') || text.includes('grounds out') || text.includes('grounds into')) return 'Ground Ball';
  if (text.includes('pop fly') || text.includes('pops out')) return 'Pop Fly';
  if (text.includes('bunt')) return 'Bunt';
  return 'Contact';
}
