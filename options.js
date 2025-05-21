document.addEventListener('DOMContentLoaded', function() {
  
  const usernameInput = document.getElementById('username');
  const dailyGoalInput = document.getElementById('daily-goal');
  const blockedSitesContainer = document.getElementById('blocked-sites');
  const newSiteInput = document.getElementById('new-site');
  const addSiteBtn = document.getElementById('add-site-btn');
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');
  
  
  loadSettings();
  
  
  addSiteBtn.addEventListener('click', function() {
    addSite();
  });
  
  
  newSiteInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addSite();
    }
  });
  
  
  saveBtn.addEventListener('click', function() {
    saveSettings();
  });
  
  
  function loadSettings() {
    chrome.storage.local.get(['leetCodeUsername', 'dailyGoal', 'blockedSites'], (result) => {
      
      if (result.leetCodeUsername) {
        usernameInput.value = result.leetCodeUsername;
      }
      
      
      if (result.dailyGoal) {
        dailyGoalInput.value = result.dailyGoal;
      } else {
        dailyGoalInput.value = 1; // Default value
      }
      
      
      if (result.blockedSites && result.blockedSites.length > 0) {
        renderBlockedSites(result.blockedSites);
      }
    });
  }
  
  
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
      
      
      siteEntry.querySelector('.remove-site').addEventListener('click', function() {
        const index = this.getAttribute('data-index');
        removeSite(index);
      });
    });
  }
  
  
  function addSite() {
    const newSite = newSiteInput.value.trim();
    
    if (!newSite) {
      showStatus('Please enter a valid domain', 'error');
      return;
    }
    
    let normalizedSite = newSite.toLowerCase();
    normalizedSite = normalizedSite.replace(/^(https?:\/\/)?(www\.)?/i, '');
    
    chrome.storage.local.get(['blockedSites'], (result) => {
      let sites = result.blockedSites || [];
      
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
    function removeSite(index) {
    chrome.storage.local.get(['blockedSites'], (result) => {
      let sites = result.blockedSites || [];
      sites.splice(index, 1);
      renderBlockedSites(sites);
      showStatus('Site removed from block list', 'success');
    });
  }
  
  
  function saveSettings() {
    const username = usernameInput.value.trim();
    const dailyGoal = parseInt(dailyGoalInput.value);
    const blockedSites = [];
    
    
    document.querySelectorAll('#blocked-sites input').forEach(input => {
      const site = input.value.trim();
      if (site) {
        let normalizedSite = site.toLowerCase();
        normalizedSite = normalizedSite.replace(/^(https?:\/\/)?(www\.)?/i, '');
        blockedSites.push(normalizedSite);
      }
    });
    
    
    if (!username) {
      showStatus('Please enter a LeetCode username', 'error');
      return;
    }
    
    if (isNaN(dailyGoal) || dailyGoal < 1) {
      showStatus('Please enter a valid daily goal (minimum 1)', 'error');
      return;
    }
    
    
    chrome.storage.local.set({
      leetCodeUsername: username,
      dailyGoal: dailyGoal,
      blockedSites: blockedSites
    }, () => {
      showStatus('Settings saved successfully!', 'success');
      
      
      chrome.runtime.sendMessage({ action: 'refreshProgress' });
      
      
      setTimeout(() => {
        window.close();
      }, 2000);
    });
  }
  
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    
    
    setTimeout(() => {
      statusDiv.className = 'status';
      statusDiv.textContent = '';
    }, 3000);
  }
});