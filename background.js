// Initialize extension state on installation
chrome.runtime.onInstalled.addListener(() => {
    console.log("neomod extension installed");
    chrome.storage.sync.set({ filterEnabled: false });
});

// Listen for tab updates to refresh content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('instagram.com')) {
        // Check if filtering is enabled
        chrome.storage.sync.get("filterEnabled", function(data) {
            if (data.filterEnabled) {
                // Wait a moment for Instagram to load its content
                setTimeout(() => {
                    // Notify content script to run filtering
                    chrome.tabs.sendMessage(tabId, { action: "runFilter" }).catch(err => {
                        // If content script isn't ready, it's ok
                        console.log("Content script may not be ready yet");
                    });
                }, 2000);
            }
        });
    }
});

// Handle URL changes within Instagram (SPA navigation)
chrome.webNavigation?.onHistoryStateUpdated?.addListener((details) => {
    if (details.url.includes('instagram.com')) {
        chrome.storage.sync.get("filterEnabled", function(data) {
            if (data.filterEnabled) {
                // Wait for content to load after navigation
                setTimeout(() => {
                    chrome.tabs.sendMessage(details.tabId, { action: "runFilter" }).catch(err => {
                        console.log("Could not send message on navigation:", err);
                    });
                }, 1500);
            }
        });
    }
}, { url: [{ hostContains: 'instagram.com' }] });

// Keep the service worker alive
function keepAlive() {
    console.log("neomod background service worker still active");
    setTimeout(keepAlive, 20000); // Every 20 seconds
}

// Start keep-alive
keepAlive();