document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const usernameInput = document.getElementById('username');
  const dailyGoalInput = document.getElementById('daily-goal');
  const blockedSitesContainer = document.getElementById('blocked-sites');
  const newSiteInput = document.getElementById('new-site');
  const addSiteBtn = document.getElementById('add-site-btn');
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');
  
  // Load current settings
  loadSettings();
  
  // Add site button handler
  addSiteBtn.addEventListener('click', function() {
    addSite();
  });
  
  // New site input - add on Enter key
  newSiteInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addSite();
    }
  });
  
  // Save button handler
  saveBtn.addEventListener('click', function() {
    saveSettings();
  });
  
  // Load current settings from storage
  function loadSettings() {
    chrome.storage.local.get(['leetCodeUsername', 'dailyGoal', 'blockedSites'], (result) => {
      // Set username
      if (result.leetCodeUsername) {
        usernameInput.value = result.leetCodeUsername;
      }
      
      // Set daily goal
      if (result.dailyGoal) {
        dailyGoalInput.value = result.dailyGoal;
      } else {
        dailyGoalInput.value = 1; // Default value
      }
      
      // Set blocked sites
      if (result.blockedSites && result.blockedSites.length > 0) {
        renderBlockedSites(result.blockedSites);
      }
    });
  }
  
  // Render the list of blocked sites
  function renderBlockedSites(sites) {
    blockedSitesContainer.innerHTML = '';
    
    sites.forEach((site, index) => {
      const siteEntry = document.createElement('div');
      siteEntry.className = 'site-entry';
      siteEntry.innerHTML = `
        <input type="text" value="${site}" data-index="${index}">
        <button class="remove-site" data-index="${index}">Remove</button>
      `;
      blockedSitesContainer.appendChild(siteEntry);
      
      // Add event listener to the remove button
      siteEntry.querySelector('.remove-site').addEventListener('click', function() {
        const index = this.getAttribute('data-index');
        removeSite(index);
      });
    });
  }
  
  // Add a new site to the block list
  function addSite() {
    const newSite = newSiteInput.value.trim();
    
    if (!newSite) {
      showStatus('Please enter a valid domain', 'error');
      return;
    }
    
    // Normalize the domain (remove http://, https://, www.)
    let normalizedSite = newSite.toLowerCase();
    normalizedSite = normalizedSite.replace(/^(https?:\/\/)?(www\.)?/i, '');
    
    chrome.storage.local.get(['blockedSites'], (result) => {
      let sites = result.blockedSites || [];
      
      // Check if site already exists
      if (sites.includes(normalizedSite)) {
        showStatus('This site is already blocked', 'error');
        return;
      }
      
      sites.push(normalizedSite);
      renderBlockedSites(sites);
      newSiteInput.value = ''; // Clear the input
      showStatus('Site added to block list', 'success');
    });
  }
  
  // Remove a site from the block list
  function removeSite(index) {
    chrome.storage.local.get(['blockedSites'], (result) => {
      let sites = result.blockedSites || [];
      sites.splice(index, 1);
      renderBlockedSites(sites);
      showStatus('Site removed from block list', 'success');
    });
  }
  
  // Save all settings to storage
  function saveSettings() {
    const username = usernameInput.value.trim();
    const dailyGoal = parseInt(dailyGoalInput.value);
    const blockedSites = [];
    
    // Collect all blocked sites from inputs
    document.querySelectorAll('#blocked-sites input').forEach(input => {
      const site = input.value.trim();
      if (site) {
        let normalizedSite = site.toLowerCase();
        normalizedSite = normalizedSite.replace(/^(https?:\/\/)?(www\.)?/i, '');
        blockedSites.push(normalizedSite);
      }
    });
    
    // Validate inputs
    if (!username) {
      showStatus('Please enter a LeetCode username', 'error');
      return;
    }
    
    if (isNaN(dailyGoal) || dailyGoal < 1) {
      showStatus('Please enter a valid daily goal (minimum 1)', 'error');
      return;
    }
    
    // Save to storage
    chrome.storage.local.set({
      leetCodeUsername: username,
      dailyGoal: dailyGoal,
      blockedSites: blockedSites
    }, () => {
      showStatus('Settings saved successfully!', 'success');
      
      // Also update the last known solved count
      chrome.runtime.sendMessage({ action: 'refreshProgress' });
      
      // Close options page after 2 seconds
      setTimeout(() => {
        window.close();
      }, 2000);
    });
  }
  
  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusDiv.className = 'status';
      statusDiv.textContent = '';
    }, 3000);
  }
});