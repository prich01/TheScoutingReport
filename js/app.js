/**
 * The Scouting Report - Main Controller (js/app.js)
 * Manages tab switching navigation and active opponent selection.
 */

// --- TAB SWITCHING LOGIC ---
function switchTab(tabName) {
  // 1. Hide all tab view sections
  const allViews = document.querySelectorAll('.tab-view');
  allViews.forEach(view => {
    view.classList.add('hidden');
  });

  // 2. Remove 'active' state from all navigation buttons
  const allNavBtns = document.querySelectorAll('.nav-btn');
  allNavBtns.forEach(btn => {
    btn.classList.remove('active');
  });

  // 3. Show the requested view section
  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  } else {
    console.warn(`View section "view-${tabName}" not found.`);
  }

  // 4. Highlight the active navigation button
  const targetBtn = document.getElementById(`nav-${tabName}`);
  if (targetBtn) {
    targetBtn.classList.add('active');
  }
}

// --- OPPONENT MANAGEMENT LOGIC ---

/**
 * Prompts the user to add a new opponent team to the dropdown list.
 */
function addOpponent() {
  const opponentName = prompt("Enter new opponent team name:");
  
  if (opponentName && opponentName.trim() !== "") {
    const selectEl = document.getElementById('opponentSelect');
    
    // Create new <option> element
    const newOption = document.createElement('option');
    newOption.value = opponentName.trim();
    newOption.innerText = opponentName.trim();
    newOption.selected = true; // Automatically select the new team
    
    selectEl.appendChild(newOption);
  }
}

/**
 * Prompts the user to rename the currently selected opponent team.
 */
function renameOpponent() {
  const selectEl = document.getElementById('opponentSelect');
  const currentName = selectEl.value;
  
  if (!currentName) {
    alert("Please select or add an opponent first.");
    return;
  }
  
  const updatedName = prompt("Rename opponent team:", currentName);
  
  if (updatedName && updatedName.trim() !== "") {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    selectedOption.value = updatedName.trim();
    selectedOption.innerText = updatedName.trim();
  }
}
