/**
 * Advanced GameChanger Parser with Team Filtering & Pitcher Tracking
 */

function parseGameLog(rawText = '', opponentName = '', roster = []) {
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
  
  let currentHalf = ''; // 'TOP' or 'BOTTOM'
  let topTeam = '';
  let bottomTeam = '';
  let currentPitcherName = 'Unknown Pitcher';

  rawLines.forEach((line) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // --- 1. TRACK INNING & TEAMS ---
    // Example: "Top 1st - Bearden Varsity Bulldogs"
    const inningMatch = cleanLine.match(/^(Top|Bottom)\s+\d+(?:st|nd|rd|th)?\s*-\s*(.+)/i);
    if (inningMatch) {
      currentHalf = inningMatch[1].toUpperCase();
      const teamName = inningMatch[2].trim();
      if (currentHalf === 'TOP') topTeam = teamName;
      if (currentHalf === 'BOTTOM') bottomTeam = teamName;
      return;
    }

    // --- 2. DETECT PITCHING CHANGES ---
    // Format A: "Lineup changed: M Adams in at pitcher"
    if (cleanLine.includes('in at pitcher')) {
      const pMatch = cleanLine.match(/Lineup changed:\s*([A-Za-z\s.\-]+?)\s*in at pitcher/i);
      if (pMatch && pMatch[1]) {
        currentPitcherName = pMatch[1].trim();
        ensurePitcher(result.pitchers, currentPitcherName);
        console.log(`[Pitcher Lineup Change]: ${currentPitcherName}`);
      }
      return;
    }

    // Format B: "E Frederick in for pitcher M Adams"
    if (cleanLine.includes('in for pitcher')) {
      const pMatch = cleanLine.match(/([A-Za-z\s.\-]+?)\s+in for pitcher/i);
      if (pMatch && pMatch[1]) {
        currentPitcherName = pMatch[1].trim();
        ensurePitcher(result.pitchers, currentPitcherName);
        console.log(`[Pitcher Substitution]: ${currentPitcherName}`);
      }
      return;
    }

    // --- 3. SKIP SYSTEM CLUTTER ---
    if (/^(Top|Bottom|End|\d+ Out|\d+ Outs|Ball \d|Strike \d|Foul|In play|BRDN|OKRD|Single|Double|Triple|Home Run|Strikeout|Fly Out|Ground Out|Line Out|Pop Out|Walk|Hit By Pitch|Dropped 3rd Strike|Fielder's Choice|Error|Sacrifice Bunt|Double Play)/i.test(cleanLine)) {
      return;
    }

    // --- 4. PROCESS PLAY SENTENCES ---
    // Example: "M Schroeffel singles on a line drive...", "F Piper strikes out swinging, M Teasley pitching."
    const eventRegex = /^([A-Z]\s+[A-Za-z'.\-]+|[A-Z][a-zA-Z'.\-]+\s+[A-Z][a-zA-Z'.\-]+)\s+(singles|doubles|triples|homers|strikes out|grounds|lines|flies|pops|walks|is hit by pitch|hits|bunts|out at)/i;
    const match = cleanLine.match(eventRegex);

    if (match) {
      const hitterName = match[1].trim();

      // Check for in-line pitcher tags: ", M Teasley pitching."
      const pitcherOverrideMatch = cleanLine.match(/,\s*([A-Za-z\s.\-]+?)\s+pitching/i);
      if (pitcherOverrideMatch && pitcherOverrideMatch[1]) {
        currentPitcherName = pitcherOverrideMatch[1].trim();
      }

      // OPTIONAL TEAM FILTER:
      // If an opponentName is specified (e.g. "Bearden"), only parse hitters when that team is at bat!
      const currentBattingTeam = (currentHalf === 'TOP') ? topTeam : bottomTeam;
      if (opponentName && currentBattingTeam && !currentBattingTeam.toLowerCase().includes(opponentName.toLowerCase())) {
        // Skip parsing hitters for the other team
        return;
      }

      const hitter = ensureHitter(result.hitters, hitterName, roster);
      const pitcher = ensurePitcher(result.pitchers, currentPitcherName);

      processEventLine(cleanLine, hitter, pitcher);
    }
  });

  console.log("=== PARSING COMPLETE ===");
  console.log("Extracted Opponent Hitters:", Object.keys(result.hitters));
  console.log("Extracted Pitchers:", Object.keys(result.pitchers));

  return result;
}

// ==========================================
// HELPERS
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
