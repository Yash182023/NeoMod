// --- START OF FILE popup.js ---

const toggleCheckbox = document.getElementById("toggleFilter");
const statusText = document.getElementById("status");
const hiddenCountText = document.getElementById("hidden-count");
const filterModeText = document.getElementById("filter-mode"); // Added

function updateStatus(enabled) {
    statusText.textContent = enabled ? "Filtering: ON" : "Filtering: OFF";
    // Maybe change color too
    statusText.style.color = enabled ? '#2ecc71' : '#e74c3c';
}

// Check current state and request count on popup load
window.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get("filterEnabled", function(data) {
        const isEnabled = data.filterEnabled || false;
        toggleCheckbox.checked = isEnabled;
        updateStatus(isEnabled);
        filterModeText.textContent = "Mode: Local Keywords"; // Update mode text

        // Request the current count from the active tab's content script
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0] && tabs[0].id && tabs[0].url && tabs[0].url.includes("instagram.com")) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "requestCount" })
                    .then(response => {
                        if (response && response.action === "updateCounter") {
                            hiddenCountText.textContent = `Hidden on page: ${response.count}`;
                        }
                    })
                    .catch(err => {
                         console.log("Could not request count from content script:", err.message);
                         hiddenCountText.textContent = "Hidden on page: N/A";
                    });
            } else {
                 hiddenCountText.textContent = "Hidden on page: N/A";
            }
        });
    });
});

// Listen for toggle clicks
toggleCheckbox.addEventListener("click", function () {
    const newState = toggleCheckbox.checked;

    chrome.storage.sync.set({ filterEnabled: newState }, function () {
        updateStatus(newState);

        // Send message to active Instagram tab immediately
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0] && tabs[0].id && tabs[0].url && tabs[0].url.includes("instagram.com")) {
                chrome.tabs.sendMessage(tabs[0].id, { filterEnabled: newState })
                    .then(response => console.log("Sent filter state to content script:", response))
                    .catch(err => console.log("Could not send message to content script:", err.message));
            } else {
                console.log("Not on an active Instagram tab.");
            }
        });
    });
});

// Listen for count updates from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateCounter") {
        console.log("Popup received count update:", message.count);
        hiddenCountText.textContent = `Hidden on page: ${message.count}`;
        // No need to send response back here
    }
    // Return true if you might send an async response (not needed here)
    // return true;
});

// --- END OF FILE popup.js ---