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
  
  
  checkAuthStatus();
  
  
  function checkAuthStatus() {
    chrome.storage.local.get(['isAuthenticated', 'leetCodeUsername'], (result) => {
      if (result.isAuthenticated && result.leetCodeUsername) {
        
        authSection.classList.add('hidden');
        controlsSection.classList.remove('hidden');
        
        
        updateGoalStatus();
      } else {
        
        authSection.classList.remove('hidden');
        controlsSection.classList.add('hidden');
        statusMessage.textContent = 'Please connect your LeetCode account to start tracking progress.';
      }
    });
  }
  
  
  function updateGoalStatus() {
    chrome.runtime.sendMessage({ action: 'checkGoalStatus' }, (response) => {
      if (response.goalMet) {
        statusSection.className = 'status goal-met';
        statusMessage.textContent = `Goal met! You've solved ${response.solved}/${response.goal} problems today.`;
      } else {
        statusSection.className = 'status goal-not-met';
        statusMessage.textContent = `Progress: ${response.solved}/${response.goal} problems solved today.`;
      }
      
    
      const progressPercentage = Math.min(100, (response.solved / response.goal) * 100);
      progressBar.style.width = `${progressPercentage}%`;
    });
  }
  
  
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
  
  
  refreshButton.addEventListener('click', function() {
    statusMessage.textContent = 'Refreshing progress...';
    
    chrome.runtime.sendMessage({ action: 'refreshProgress' }, () => {
      setTimeout(updateGoalStatus, 1000); 
    });
  });
  
  
  settingsButton.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});