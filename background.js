// LeetCode API endpoint to check solved problems
const LEETCODE_API_URL = 'https://leetcode.com/api/problems/all/';
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

// Default blocked sites
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'reddit.com'
];

// Initialize extension data
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedSites', 'dailyGoal', 'isAuthenticated', 'leetCodeUsername'], (result) => {
    // Set default values if not present
    if (!result.blockedSites) {
      chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    }
    
    if (!result.dailyGoal) {
      chrome.storage.local.set({ dailyGoal: 1 }); // Default: solve 1 problem per day
    }
    
    if (result.isAuthenticated === undefined) {
      chrome.storage.local.set({ isAuthenticated: false });
    }
    
    if (!result.leetCodeUsername) {
      chrome.storage.local.set({ leetCodeUsername: '' });
    }
    
    // Initialize today's problem count
    resetDailyCountIfNeeded();
  });
});

// Reset the daily count at the start of a new day
function resetDailyCountIfNeeded() {
  chrome.storage.local.get(['lastResetDate', 'problemsSolvedToday'], (result) => {
    const now = new Date();
    const today = now.toDateString();
    
    if (result.lastResetDate !== today) {
      chrome.storage.local.set({ 
        lastResetDate: today,
        problemsSolvedToday: 0
      });
    }
  });
}

// Check if the site should be blocked
function shouldBlockSite(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['blockedSites', 'problemsSolvedToday', 'dailyGoal', 'isAuthenticated'], (result) => {
      if (!result.isAuthenticated) {
        resolve(false); // Don't block if not authenticated
        return;
      }
      
      // If daily goal is met, don't block
      if (result.problemsSolvedToday >= result.dailyGoal) {
        resolve(false);
        return;
      }
      
      // Check if current URL contains any blocked site
      const shouldBlock = result.blockedSites.some(site => url.includes(site));
      resolve(shouldBlock);
    });
  });
}

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    shouldBlockSite(tab.url).then(block => {
      if (block) {
        chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
      }
    });
  }
});

// Check LeetCode problems solved
async function checkLeetCodeProgress(username) {
  try {
    // First, attempt to use the GraphQL API to get user profile info
    const userProfileQuery = {
      query: `
        query userProfile($username: String!) {
          matchedUser(username: $username) {
            submitStats {
              acSubmissionNum {
                count
                submissions
              }
            }
          }
        }
      `,
      variables: { username }
    };
    
    const profileResponse = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userProfileQuery)
    });
    
    if (!profileResponse.ok) {
      throw new Error('Failed to fetch LeetCode data');
    }
    
    const profileData = await profileResponse.json();
    
    // Fallback to the older API if GraphQL doesn't work
    if (!profileData.data?.matchedUser) {
      const response = await fetch(`${LEETCODE_API_URL}?username=${username}`);
      if (!response.ok) {
        throw new Error('Failed to fetch LeetCode data');
      }
      const data = await response.json();
      return data.num_solved || 0;
    }
    
    return profileData.data.matchedUser.submitStats.acSubmissionNum.count || 0;
  } catch (error) {
    console.error('Error checking LeetCode progress:', error);
    return 0;
  }
}

// Refresh LeetCode progress periodically
function updateLeetCodeProgress() {
  chrome.storage.local.get(['leetCodeUsername', 'lastKnownSolvedCount'], async (result) => {
    if (!result.leetCodeUsername) return;
    
    try {
      const currentSolvedCount = await checkLeetCodeProgress(result.leetCodeUsername);
      
      // If this is the first check, just store the count
      if (result.lastKnownSolvedCount === undefined) {
        chrome.storage.local.set({ lastKnownSolvedCount: currentSolvedCount });
        return;
      }
      
      // If more problems have been solved since last check
      if (currentSolvedCount > result.lastKnownSolvedCount) {
        const newProblemsSolved = currentSolvedCount - result.lastKnownSolvedCount;
        
        // Update the count of problems solved today
        chrome.storage.local.get(['problemsSolvedToday'], (data) => {
          chrome.storage.local.set({ 
            lastKnownSolvedCount: currentSolvedCount,
            problemsSolvedToday: data.problemsSolvedToday + newProblemsSolved
          });
        });
      } else {
        // Just update the last known count
        chrome.storage.local.set({ lastKnownSolvedCount: currentSolvedCount });
      }
    } catch (error) {
      console.error('Error updating LeetCode progress:', error);
    }
  });
}

// Check LeetCode progress every 5 minutes
setInterval(updateLeetCodeProgress, 5 * 60 * 1000);

// Also check when the extension starts
updateLeetCodeProgress();

// Reset daily count check at midnight
function scheduleNextDayReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow - now;
  
  setTimeout(() => {
    resetDailyCountIfNeeded();
    scheduleNextDayReset(); // Schedule the next day's reset
  }, timeUntilMidnight);
}

// Start the daily reset schedule
scheduleNextDayReset();

// Handle authentication with LeetCode
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'authenticate') {
    // Store the username and mark as authenticated
    chrome.storage.local.set({ 
      leetCodeUsername: message.username,
      isAuthenticated: true
    }, () => {
      // Initialize the last known solved count
      updateLeetCodeProgress();
      sendResponse({ success: true });
    });
    return true; // Indicate we'll send a response asynchronously
  }
  
  if (message.action === 'checkGoalStatus') {
    chrome.storage.local.get(['problemsSolvedToday', 'dailyGoal'], (result) => {
      sendResponse({
        goalMet: result.problemsSolvedToday >= result.dailyGoal,
        solved: result.problemsSolvedToday,
        goal: result.dailyGoal
      });
    });
    return true; // Indicate we'll send a response asynchronously
  }
  
  if (message.action === 'refreshProgress') {
    updateLeetCodeProgress();
    sendResponse({ success: true });
  }
  
  return false;
});