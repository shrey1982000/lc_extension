document.addEventListener('DOMContentLoaded', function() {
  const authSection = document.getElementById('auth-section');
  const controlsSection = document.getElementById('controls-section');
  const statusSection = document.getElementById('status-section');
  const statusMessage = document.getElementById('status-message');
  const progressBar = document.getElementById('progress-bar');
  const usernameInput = document.getElementById('username-input');
  const authButton = document.getElementById('auth-button');
  const refreshButton = document.getElementById('refresh-button');
  const settingsButton = document.getElementById('settings-button');
  
  // Initialize the popup UI based on authentication status
  checkAuthStatus();
  
  // Check if the user is authenticated
  function checkAuthStatus() {
    chrome.storage.local.get(['isAuthenticated', 'leetCodeUsername'], (result) => {
      if (result.isAuthenticated && result.leetCodeUsername) {
        // User is authenticated, show controls
        authSection.classList.add('hidden');
        controlsSection.classList.remove('hidden');
        
        // Update status
        updateGoalStatus();
      } else {
        // User is not authenticated, show auth section
        authSection.classList.remove('hidden');
        controlsSection.classList.add('hidden');
        statusMessage.textContent = 'Please connect your LeetCode account to start tracking progress.';
      }
    });
  }
  
  // Update the goal status in the UI
  function updateGoalStatus() {
    chrome.runtime.sendMessage({ action: 'checkGoalStatus' }, (response) => {
      if (response.goalMet) {
        statusSection.className = 'status goal-met';
        statusMessage.textContent = `Goal met! You've solved ${response.solved}/${response.goal} problems today.`;
      } else {
        statusSection.className = 'status goal-not-met';
        statusMessage.textContent = `Progress: ${response.solved}/${response.goal} problems solved today.`;
      }
      
      // Update progress bar
      const progressPercentage = Math.min(100, (response.solved / response.goal) * 100);
      progressBar.style.width = `${progressPercentage}%`;
    });
  }
  
  // Handle authentication
  authButton.addEventListener('click', function() {
    const username = usernameInput.value.trim();
    
    if (!username) {
      alert('Please enter a valid LeetCode username');
      return;
    }
    
    statusMessage.textContent = 'Connecting to LeetCode...';
    
    chrome.runtime.sendMessage({ 
      action: 'authenticate',
      username: username 
    }, (response) => {
      if (response.success) {
        checkAuthStatus();
      } else {
        alert('Failed to authenticate. Please try again.');
      }
    });
  });
  
  // Handle refresh button
  refreshButton.addEventListener('click', function() {
    statusMessage.textContent = 'Refreshing progress...';
    
    chrome.runtime.sendMessage({ action: 'refreshProgress' }, () => {
      setTimeout(updateGoalStatus, 1000); // Give a moment for the background script to update
    });
  });
  
  // Handle settings button
  settingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});