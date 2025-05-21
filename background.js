
const LEETCODE_API_URL = 'https://leetcode.com/api/problems/all/';
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'reddit.com'
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedSites', 'dailyGoal', 'isAuthenticated', 'leetCodeUsername'], (result) => {
    if (!result.blockedSites) {
      chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    }
    
    if (!result.dailyGoal) {
      chrome.storage.local.set({ dailyGoal: 1 }); 
    }
    
    if (result.isAuthenticated === undefined) {
      chrome.storage.local.set({ isAuthenticated: false });
    }
    
    if (!result.leetCodeUsername) {
      chrome.storage.local.set({ leetCodeUsername: '' });
    }
    
    resetDailyCountIfNeeded();
  });
});

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
function shouldBlockSite(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['blockedSites', 'problemsSolvedToday', 'dailyGoal', 'isAuthenticated'], (result) => {
      if (!result.isAuthenticated) {
        resolve(false);
        return;
      }
      
      if (result.problemsSolvedToday >= result.dailyGoal) {
        resolve(false);
        return;
      }
      
      const shouldBlock = result.blockedSites.some(site => url.includes(site));
      resolve(shouldBlock);
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    shouldBlockSite(tab.url).then(block => {
      if (block) {
        chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
      }
    });
  }
});

async function checkLeetCodeProgress(username) {
  try {
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

function updateLeetCodeProgress() {
  chrome.storage.local.get(['leetCodeUsername', 'lastKnownSolvedCount'], async (result) => {
    if (!result.leetCodeUsername) return;
    
    try {
      const currentSolvedCount = await checkLeetCodeProgress(result.leetCodeUsername);
      
      if (result.lastKnownSolvedCount === undefined) {
        chrome.storage.local.set({ lastKnownSolvedCount: currentSolvedCount });
        return;
      }
      
      if (currentSolvedCount > result.lastKnownSolvedCount) {
        const newProblemsSolved = currentSolvedCount - result.lastKnownSolvedCount;
        
        chrome.storage.local.get(['problemsSolvedToday'], (data) => {
          chrome.storage.local.set({ 
            lastKnownSolvedCount: currentSolvedCount,
            problemsSolvedToday: data.problemsSolvedToday + newProblemsSolved
          });
        });
      } else {

        chrome.storage.local.set({ lastKnownSolvedCount: currentSolvedCount });
      }
    } catch (error) {
      console.error('Error updating LeetCode progress:', error);
    }
  });
}

setInterval(updateLeetCodeProgress, 5 * 60 * 1000);

updateLeetCodeProgress();
function scheduleNextDayReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow - now;
  
  setTimeout(() => {
    resetDailyCountIfNeeded();
    scheduleNextDayReset();
  }, timeUntilMidnight);
}

scheduleNextDayReset();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'authenticate') {
    chrome.storage.local.set({ 
      leetCodeUsername: message.username,
      isAuthenticated: true
    }, () => {
      updateLeetCodeProgress();
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'checkGoalStatus') {
    chrome.storage.local.get(['problemsSolvedToday', 'dailyGoal'], (result) => {
      sendResponse({
        goalMet: result.problemsSolvedToday >= result.dailyGoal,
        solved: result.problemsSolvedToday,
        goal: result.dailyGoal
      });
    });
    return true; 
  }
  
  if (message.action === 'refreshProgress') {
    updateLeetCodeProgress();
    sendResponse({ success: true });
  }
  
  return false;
});