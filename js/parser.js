/**
 * Tailored GameChanger Play-by-Play Parser (js/parser.js)
 */

function parseGameLog(rawText = '', roster = []) {
  console.log("=== STARTING GAME LOG PARSER ===");
  
  const result = {
    hitters: {},
    pitchers: {}
  };

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    console.warn("Parser received empty or invalid input.");
    return result;
  }

  const rawLines = rawText.split(/\r?\n/);
  let currentPitcherName = 'Unknown Pitcher';

  rawLines.forEach((line) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // 1. SKIP SYSTEM CLUTTER (Pitches, Out counts, Scores, Lines like "Single", "3 Outs")
    if (
      /^(Top|Bottom|End|\d+ Out|\d+ Outs|Ball \d|Strike \d|Foul|In play|BRDN|OKRD|Single|Double|Triple|Home Run|Strikeout|Fly Out|Ground Out|Line Out|Pop Out|Walk|Hit By Pitch|Dropped 3rd Strike|Fielder's Choice|Error|Sacrifice Bunt|Double Play)/i.test(cleanLine)
    ) {
      return;
    }

    // 2. DETECT PITCHING CHANGES
    // Example: "Lineup changed: M Teasley in at pitcher" or "Lineup changed: C Feagan in at pitcher"
    if (cleanLine.includes('in at pitcher') || cleanLine.includes('takes the mound')) {
      const pMatch = cleanLine.match(/Lineup changed:\s*([A-Za-z\s.\-]+?)\s*in at pitcher/i);
      if (pMatch && pMatch[1]) {
        currentPitcherName = pMatch[1].trim();
        ensurePitcher(result.pitchers, currentPitcherName);
        console.log(`Pitcher updated to: ${currentPitcherName}`);
      }
      return;
    }

    // 3. PROCESS HITTER EVENT SENTENCES
    // Look for standard play descriptions (e.g., "M Schroeffel singles on a line drive...", "W East is hit by pitch...")
    const eventRegex = /^([A-Z]\s+[A-Za-z'.\-]+|[A-Z][a-zA-z'.\-]+\s+[A-Z][a-zA-z'.\-]+)\s+(singles|doubles|triples|homers|strikes out|grounds|lines|flies|pops|walks|is hit by pitch|hits|bunts|out at)/i;
    
    const match = cleanLine.match(eventRegex);

    if (match) {
      const hitterName = match[1].trim();

      // Check if sentence specifies a explicit pitcher (e.g., "F Piper strikes out swinging, M Teasley pitching.")
      const pitcherOverrideMatch = cleanLine.match(/,\s*([A-Za-z\s.\-]+?)\s+pitching/i);
      const activePitcher = pitcherOverrideMatch ? pitcherOverrideMatch[1].trim() : currentPitcherName;

      const hitter = ensureHitter(result.hitters, hitterName, roster);
      const pitcher = ensurePitcher(result.pitchers, activePitcher);

      processEventLine(cleanLine, hitter, pitcher);
    }
  });

  console.log("=== PARSING COMPLETE ===");
  console.log("Hitters Found:", Object.keys(result.hitters));
  console.log("Pitchers Found:", Object.keys(result.pitchers));

  return result;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function ensureHitter(hitters, name, roster = []) {
  if (!hitters[name]) {
    const match = roster.find(r => r.name.toLowerCase() === name.toLowerCase()) || {};
    hitters[name] = {
      name: name,
      number: match.number || '00',
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
  if (text.includes('walks')) {
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
  } else if (text.includes('doubles')) {
    recordHit(hitter, pitcher, 'doubles', location, type);
  } else if (text.includes('triples')) {
    recordHit(hitter, pitcher, 'triples', location, type);
  } else if (text.includes('homers')) {
    recordHit(hitter, pitcher, 'hr', location, type);
  } else {
    // OUTS
    if (text.includes('strikes out')) {
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
  if (text.includes('ground ball') || text.includes('grounds out')) return 'Ground Ball';
  if (text.includes('pop fly') || text.includes('pops out')) return 'Pop Fly';
  if (text.includes('bunt')) return 'Bunt';
  return 'Contact';
}
