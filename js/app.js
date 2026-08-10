/**
 * GameChanger Play-by-Play Dashboard (app.js)
 * Powered by Gemini API for Structured Extraction
 */

document.addEventListener('DOMContentLoaded', () => {
  // Restore saved API Key if present
  const savedApiKey = localStorage.getItem('gemini_api_key');
  const apiKeyInput = document.getElementById('apiKeyInput');
  if (apiKeyInput && savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  // Bind Process Button
  const processBtn = document.getElementById('processBtn');
  if (processBtn) {
    processBtn.addEventListener('click', handleProcessGameLog);
  }

  // Load existing cached scouting data on startup if available
  const existingData = localStorage.getItem('scoutingData');
  if (existingData) {
    try {
      renderDashboard(JSON.parse(existingData));
    } catch (e) {
      console.warn("Could not render cached scouting data on startup.", e);
    }
  }
});

/**
 * Main Processing Handler
 */
async function handleProcessGameLog() {
  const statusEl = document.getElementById('statusText') || { innerText: () => {} };
  const rawText = document.getElementById('gameLogInput')?.value || '';
  
  // 1. Get API Key from input or localStorage
  let apiKey = document.getElementById('apiKeyInput')?.value.trim();
  if (!apiKey) {
    apiKey = localStorage.getItem('gemini_api_key');
  }

  if (!apiKey) {
    apiKey = prompt("Please enter your Gemini API Key:");
    if (apiKey) {
      apiKey = apiKey.trim();
      const apiKeyInput = document.getElementById('apiKeyInput');
      if (apiKeyInput) apiKeyInput.value = apiKey;
    }
  }

  if (!apiKey) {
    alert("An API key is required to process the game log.");
    return;
  }

  if (!rawText.trim()) {
    alert("Please paste a GameChanger game log into the text box first.");
    return;
  }

  // Save API key locally so user doesn't have to re-enter it every time
  localStorage.setItem('gemini_api_key', apiKey);

  // Update Status UI
  statusEl.innerText = " Analyzing game log with Gemini...";

  try {
    // 2. Call Gemini API
    const parsedData = await parseGameLogWithGemini(rawText, apiKey);

    if (!parsedData) {
      throw new Error("Gemini returned invalid or empty data.");
    }

    console.log("=== GEMINI PARSED SUCCESS ===", parsedData);

    // 3. Save clean output state
    localStorage.setItem('scoutingData', JSON.stringify(parsedData));

    // 4. Update UI Dashboard
    renderDashboard(parsedData);

    statusEl.innerText = " Game log processed and saved successfully!";

  } catch (error) {
    console.error("Processing Error:", error);
    statusEl.innerText = " Error processing game log. Check console for details.";
    alert("Failed to process game log. Make sure your API key is valid and check the browser console (F12).");
  }
}

/**
 * Gemini API Request Wrapper
 */
async function parseGameLogWithGemini(rawText, apiKey) {
  // Using gemini-2.5-flash for maximum speed and structured reliability
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const promptText = `
You are an expert baseball play-by-play data analyst.
Analyze the following GameChanger text log and extract stats, team affiliations, and spray chart location data into a single valid JSON object.

RULES:
1. Determine Home and Away teams based on inning headers (Top = Away team batting / Home team pitching; Bottom = Home team batting / Away team pitching).
2. Track pitcher changes accurately across innings (including lineup changes, substitutions, and inline pitching notes).
3. For EVERY hitter, compute cumulative stats:
   - pa (plate appearances), ab (at-bats), hits, singles, doubles, triples, hr, bb (walks), so (strikeouts), hbp (hit by pitch)
4. For EVERY hitter, build a "spray" array capturing hit/out contact:
   - location MUST be one of: "left field", "left-center", "center field", "right-center", "right field", "shortstop", "third base", "second base", "first base", "pitcher", "catcher"
   - type MUST be one of: "Line Drive", "Fly Ball", "Ground Ball", "Pop Fly", "Bunt"
   - result MUST be either: "hit" or "out"
5. For EVERY pitcher, compute cumulative pitching stats:
   - bf (batters faced), outs (total outs recorded, e.g., 3 per full inning), h (hits allowed), bb (walks allowed), so (strikeouts), hr (home runs allowed)

JSON SCHEMA TO RETURN:
{
  "teams": { "home": "Team Name", "away": "Team Name" },
  "hitters": {
    "Player Name": {
      "name": "Player Name",
      "number": "00",
      "team": "Team Name",
      "pa": 0, "ab": 0, "hits": 0, "singles": 0, "doubles": 0, "triples": 0, "hr": 0, "bb": 0, "so": 0, "hbp": 0,
      "spray": [
        { "location": "left field", "type": "Line Drive", "result": "hit" }
      ]
    }
  },
  "pitchers": {
    "Pitcher Name": {
      "name": "Pitcher Name",
      "number": "00",
      "team": "Team Name",
      "bf": 0, "outs": 0, "h": 0, "bb": 0, "so": 0, "hr": 0
    }
  }
}

RAW PLAY-BY-PLAY LOG:
${rawText}
  `;

  const requestBody = {
    contents: [
      {
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1 // Low temperature for high precision
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJsonResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawJsonResponse) {
    throw new Error("No text response generated from Gemini.");
  }

  return JSON.parse(rawJsonResponse);
}

/**
 * Placeholder/Existing Render Bridge Function
 * (Ensure this connects to your actual UI rendering logic)
 */
function renderDashboard(data) {
  if (!data) return;
  console.log("Rendering Dashboard with data:", data);
  
  // If your existing app uses custom update functions, trigger them here:
  if (typeof updateHittersUI === 'function') updateHittersUI(data.hitters);
  if (typeof updatePitchersUI === 'function') updatePitchersUI(data.pitchers);
  if (typeof updateSprayChart === 'function') updateSprayChart(data.hitters);
}
