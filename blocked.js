// Initialize progress display
document.addEventListener('DOMContentLoaded', function() {
    chrome.runtime.sendMessage({ 
        action: 'checkGoalStatus' 
    }, (response) => {
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');

        if (response) {
            progressText.textContent = `Progress: ${response.solved}/${response.goal} problems solved today`;
            const progressPercentage = Math.min(100, (response.solved / response.goal) * 100);
            progressBar.style.width = `${progressPercentage}%`;
        } else {
            progressText.textContent = 'Unable to load progress. Please check your settings.';
        }
    });
});