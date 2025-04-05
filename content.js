// --- START OF FILE content.js ---

// Keep track of processed comments and revealed comments
let processedComments = new Set();
let revealedCommentIds = new Set(); // Track comments user explicitly showed
let filterEnabled = false;
let hiddenCommentCount = 0;

// --- Constants ---
const DEBUG = true; // Set to false for production
const DEBOUNCE_DELAY = 500; // Milliseconds to wait after DOM changes before filtering

// CSS Classes for styling
const CSS_CLASSES = {
    hiddenComment: 'neomod-hidden-comment',
    placeholder: 'neomod-placeholder',
    showButton: 'neomod-show-button',
    contentWrapper: 'neomod-content-wrapper', // Added to wrap original content
};

// Updated Instagram-specific comment selectors (Keep maintaining this!)
const INSTAGRAM_COMMENT_SELECTORS = [
    // Primary selectors based on your previous list
    'div._a9zr',                // Main comment container
    'div._ab8w ._a9zr',        // Nested comment container
    'ul._a9z6 > li',           // Comment list items (check if still valid)
    'div[data-testid="post-comment-root"]', // More stable test IDs if available
    'div[role="article"] > div > div > ul > li', // Structure observed in some layouts

    // Fallbacks (potentially less reliable)
    'ul[role="log"] li[role="listitem"]',
    'article div ul > li',
    // Add more selectors as needed based on Instagram updates
];

// Keyword Categories for Classification
const KEYWORDS = {
    EXPLICIT: [
        'fuck', 'shit', 'asshole', 'dick', 'pussy', 'cock', 'bitch',
        'bastard', 'whore', 'slut', 'cunt', 'porn', 'xxx', 'nude', 'naked',
    ],
    SEVERE_TOXICITY: [
        'kill yourself', 'kys', 'die', 'suicide', 'rape', 'molest',
        'hang yourself', 'go die', 'drink bleach',
    ],
    INSULTS: [
        'stupid', 'idiot', 'ugly', 'hate', 'dumb', 'loser',
        'fat', 'pathetic', 'terrible', 'worst', 'horrible', 'moron', 'imbecile',
        'disgusting', 'trash', 'garbage',
    ],
    SPAM_PROMOTION: [
        'price', 'buy now', 'shop now', 'discount', 'free followers', 'check my profile',
        'dm me', 'link in bio', 'crypto', 'forex', 'promotion', 'giveaway',
        'earn money', 'follow back', 'click here',
    ],
    // Add more categories if needed (e.g., THREATS, IDENTITY_HATE)
};

// --- Utility Functions ---

function log(...args) {
    if (DEBUG) console.log("[neomod]", ...args);
}

// Debounce function to limit filter runs on rapid DOM changes
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- Core Logic ---

// Improved local classifier
function classifyCommentLocally(text) {
    const lowerText = text.toLowerCase().trim();
    if (!lowerText) return { classification: "NEUTRAL", score: 0, reason: "Empty" };

    // Check for severe toxicity first (highest priority)
    for (const term of KEYWORDS.SEVERE_TOXICITY) {
        // Use word boundaries (\b) to avoid partial matches (e.g., 'assess' containing 'ass')
        const regex = new RegExp(`\\b${term}\\b`, 'i'); // Case-insensitive
        if (regex.test(lowerText)) {
            return { classification: "NEGATIVE_SEVERE", score: 98, reason: `Matched severe term: ${term}` };
        }
    }

    // Check for explicit terms
    for (const term of KEYWORDS.EXPLICIT) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(lowerText)) {
            return { classification: "NEGATIVE_EXPLICIT", score: 90, reason: `Matched explicit term: ${term}` };
        }
    }

    // Check for insults
    let insultScore = 0;
    let matchedInsult = null;
    for (const term of KEYWORDS.INSULTS) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(lowerText)) {
            insultScore = 75; // Assign a base score for insults
            matchedInsult = term;
            break; // Stop after first insult match for this category
        }
    }
    if (insultScore > 0) {
        return { classification: "NEGATIVE_INSULT", score: insultScore, reason: `Matched insult: ${matchedInsult}` };
    }

    // Check for spam/promotion
    for (const term of KEYWORDS.SPAM_PROMOTION) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
         // Add check for common spam patterns like excessive caps or symbols
        const excessiveCaps = /[A-Z\s]{15,}/.test(text); // Check for long strings of caps/spaces
        const excessiveSymbols = /[^a-zA-Z0-9\s]{5,}/.test(text); // Check for sequences of non-alphanumeric chars

        if (regex.test(lowerText) || excessiveCaps || excessiveSymbols) {
            let reason = `Matched promo term: ${term}`;
            if (excessiveCaps) reason = 'Excessive capitalization';
            if (excessiveSymbols) reason = 'Excessive symbols';
            return { classification: "NEGATIVE_SPAM", score: 70, reason: reason };
        }
    }

    // If nothing matched, consider it neutral/positive
    // Lower score indicates less confidence it's *positive*, just that it's *not negative*
    return { classification: "NEUTRAL", score: 30, reason: "No negative keywords found" };
}

// Extract text (keep your robust logic, maybe minor refinements)
function extractCommentText(element) {
    // Prioritize specific text containers if they exist
    const specificTextNodes = element.querySelectorAll('div._a9zs span[dir="auto"], span[data-lexical-text="true"]');
    if (specificTextNodes.length > 0) {
        return Array.from(specificTextNodes).map(n => n.textContent).join(' ').trim();
    }

    // Fallback: Try getting all text content and removing known username elements
    // This requires identifying username selectors accurately
    const clone = element.cloneNode(true); // Clone to avoid modifying the live element yet
    const usernameSelectors = 'a[role="link"], h2, h3, strong'; // Adjust as needed
    clone.querySelectorAll(usernameSelectors).forEach(el => el.remove()); // Remove potential usernames

    // Remove timestamp if possible (often a 'time' element or specific class)
    clone.querySelectorAll('time, ._a9ze').forEach(el => el.remove()); // Adjust selectors

    return clone.textContent.trim().replace(/\s+/g, ' '); // Clean up whitespace
}


// Function to apply filtering styles
function hideCommentElement(element, commentId, reason) {
    if (element.classList.contains(CSS_CLASSES.hiddenComment)) {
        return; // Already hidden
    }

    log(`HIDING comment (ID: ${commentId}): ${reason}`);
    element.classList.add(CSS_CLASSES.hiddenComment);

    // Wrap original content if not already done
    let contentWrapper = element.querySelector(`.${CSS_CLASSES.contentWrapper}`);
    if (!contentWrapper) {
        contentWrapper = document.createElement('div');
        contentWrapper.classList.add(CSS_CLASSES.contentWrapper);
        // Move all direct children into the wrapper
        while (element.firstChild && !element.firstChild.isEqualNode(contentWrapper)) {
            // Avoid moving the placeholder if it somehow got added first
            if (!element.firstChild.classList || (!element.firstChild.classList.contains(CSS_CLASSES.placeholder))) {
                 contentWrapper.appendChild(element.firstChild);
            } else {
                // Should not happen ideally, but break if it does
                 break;
            }
        }
        element.insertBefore(contentWrapper, element.firstChild); // Add wrapper at the beginning
    }
    // Hide the wrapper
    contentWrapper.style.display = 'none';


    // Add placeholder and show button if they don't exist
    if (!element.querySelector(`.${CSS_CLASSES.placeholder}`)) {
        const placeholder = document.createElement('div');
        placeholder.className = CSS_CLASSES.placeholder;
        placeholder.textContent = '[neomod hid this comment] '; // Placeholder text

        const showButton = document.createElement('button');
        showButton.className = CSS_CLASSES.showButton;
        showButton.textContent = 'Show';
        showButton.dataset.commentId = commentId; // Store ID for the click handler

        placeholder.appendChild(showButton);
        // Insert placeholder after the (now hidden) content wrapper
        contentWrapper.parentNode.insertBefore(placeholder, contentWrapper.nextSibling);
    }

    // Increment counter only if it wasn't already hidden or revealed
    if (!processedComments.has(commentId) && !revealedCommentIds.has(commentId)) {
         hiddenCommentCount++;
    }
}

// Function to reveal a hidden comment
function showCommentElement(element, commentId) {
    log(`REVEALING comment (ID: ${commentId})`);
    revealedCommentIds.add(commentId); // Mark as intentionally revealed
    element.classList.remove(CSS_CLASSES.hiddenComment);

    const placeholder = element.querySelector(`.${CSS_CLASSES.placeholder}`);
    if (placeholder) placeholder.remove();

    const contentWrapper = element.querySelector(`.${CSS_CLASSES.contentWrapper}`);
    if (contentWrapper) contentWrapper.style.display = ''; // Restore display

    // We decrement count only if it was previously considered hidden
    // This logic might need refinement depending on exact counting needs
    hiddenCommentCount = Math.max(0, hiddenCommentCount - 1);
    updatePopupCounter(); // Update counter in popup
}

// Send message to popup to update counter
function updatePopupCounter() {
    chrome.runtime.sendMessage({
        action: "updateCounter",
        count: hiddenCommentCount
    }).catch(err => {
        // Ignore errors if popup is not open
        if (err.message !== "Could not establish connection. Receiving end does not exist.") {
           log("Error sending message to popup:", err);
        }
    });
}


// Main function to find and filter comments
function filterComments() {
    if (!filterEnabled) return;

    log("Scanning for comments...");
    let commentsFound = false;
    let totalProcessedInRun = 0;
    hiddenCommentCount = 0; // Reset count for this scan pass
    revealedCommentIds.clear(); // Reset revealed state for this scan

    INSTAGRAM_COMMENT_SELECTORS.forEach(selector => {
        const commentElements = document.querySelectorAll(selector);

        if (commentElements.length > 0) {
            commentsFound = true;
            log(`Found ${commentElements.length} potential comments using selector: ${selector}`);

            Array.from(commentElements).forEach(el => {
                // Basic check if it looks like a comment structure
                if (el.textContent.trim().length < 5 || el.closest(`.${CSS_CLASSES.hiddenComment}`)) {
                    // Skip very short elements or those already part of a hidden structure
                    return;
                }

                 // Generate a more unique ID - consider hashing for better uniqueness
                const potentialText = extractCommentText(el).substring(0, 50);
                // Attempt to get a username or some unique part
                const userLink = el.querySelector('a[role="link"]');
                const usernamePart = userLink ? userLink.getAttribute('href') : 'unknown';
                const commentId = `${usernamePart}_${potentialText}`.replace(/[^a-zA-Z0-9_]/g, ''); // Create a basic ID


                // Skip if already processed OR explicitly revealed by user in this session
                if (processedComments.has(commentId) || revealedCommentIds.has(commentId)) {
                     // If it was hidden before but not revealed in *this* pass, ensure it's styled hidden
                     if (processedComments.has(commentId) && !revealedCommentIds.has(commentId) && !el.classList.contains(CSS_CLASSES.hiddenComment)) {
                         // This case handles re-hiding if the DOM somehow reset its state
                         // but we still have it marked as processed and hidden.
                         // Re-apply hiding without re-classifying
                         // hideCommentElement(el, commentId, "Re-hiding previously filtered comment");
                         // Let's simplify: if processed and not revealed, assume it *should* be hidden if negative
                         // This requires re-classification check if we don't store the result
                     } else if (el.classList.contains(CSS_CLASSES.hiddenComment)) {
                         hiddenCommentCount++; // Count previously hidden ones still in DOM
                     }
                     return;
                }


                const commentText = extractCommentText(el);

                if (commentText.length > 5) { // Basic length check
                    const result = classifyCommentLocally(commentText);
                    log(`Classifying (ID: ${commentId}): "${commentText.substring(0, 50)}..." -> ${result.classification} (${result.score}) | Reason: ${result.reason}`);

                    if (result.classification.startsWith("NEGATIVE_") && result.score >= 70) { // Threshold
                       hideCommentElement(el, commentId, result.reason);
                    } else {
                       // Mark as processed even if allowed
                       log(`ALLOWED comment (ID: ${commentId})`);
                    }
                    processedComments.add(commentId); // Mark as processed
                    totalProcessedInRun++;
                }
            });
        }
    });

    if (!commentsFound) {
        log("No comment elements found using current selectors.");
    } else {
        log(`Finished scan. Processed ${totalProcessedInRun} new comments. Total hidden count: ${hiddenCommentCount}`);
        updatePopupCounter(); // Update popup with final count for this pass
    }
}

// Debounced version of the filter function
const debouncedFilterComments = debounce(filterComments, DEBOUNCE_DELAY);

// --- Initialization and Event Listeners ---

log("Content script loaded and initializing...");

// Listener for popup messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.filterEnabled !== undefined) {
        const changed = filterEnabled !== message.filterEnabled;
        filterEnabled = message.filterEnabled;
        log(`Filter state received from popup: ${filterEnabled}`);
        if (changed) {
            processedComments.clear(); // Clear cache when state changes
            revealedCommentIds.clear();
            hiddenCommentCount = 0;
            if (filterEnabled) {
                filterComments(); // Run immediately if enabled
            } else {
                // If disabling, reveal all hidden comments
                document.querySelectorAll(`.${CSS_CLASSES.hiddenComment}`).forEach(el => {
                     const placeholder = el.querySelector(`.${CSS_CLASSES.placeholder}`);
                     const commentId = placeholder?.querySelector('button')?.dataset.commentId || 'unknown';
                     showCommentElement(el, commentId); // Use show logic to clean up
                });
                updatePopupCounter(); // Reset counter in popup
            }
        }
        sendResponse({ status: "Filter state updated" });
    } else if (message.action === "runFilter") {
        log("Received request to run filter");
        filterComments(); // Run immediately on request
        sendResponse({ status: "Filter run initiated" });
    } else if (message.action === "requestCount") {
        // Send the current count immediately if requested
        sendResponse({ action: "updateCounter", count: hiddenCommentCount });
    }
    return true; // Keep message channel open for asynchronous response
});


// Initial state from storage
chrome.storage.sync.get("filterEnabled", function (data) {
    filterEnabled = !!data.filterEnabled;
    log("Initial filter state from storage:", filterEnabled);
    if (filterEnabled) {
        // Run initial scan after a short delay for page load
        setTimeout(filterComments, 1500);
    }
});

// Setup MutationObserver
const observerConfig = { childList: true, subtree: true };
const observer = new MutationObserver(mutations => {
    // Check if the mutations likely added comment elements
    // This is a heuristic - might trigger unnecessarily or miss some cases
    const relevantMutation = mutations.some(mutation => {
        if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) return false;
        // Check if added nodes *could* be comments based on structure or selectors
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if the node itself matches or contains matching elements
                 if (INSTAGRAM_COMMENT_SELECTORS.some(sel => node.matches(sel) || node.querySelector(sel))) {
                     return true;
                 }
            }
        }
        return false;
    });


    if (filterEnabled && relevantMutation) {
        log("Relevant DOM changes detected, debouncing filter run...");
        debouncedFilterComments();
    }
});

// Start observing the document body
observer.observe(document.body, observerConfig);

// Event delegation for the "Show" button
document.body.addEventListener('click', (event) => {
    if (event.target.classList.contains(CSS_CLASSES.showButton)) {
        const button = event.target;
        const commentElement = button.closest(`.${CSS_CLASSES.hiddenComment}`); // Find the parent hidden comment
        const commentId = button.dataset.commentId;
        if (commentElement && commentId) {
            showCommentElement(commentElement, commentId);
        } else {
            log("Error: Could not find parent comment element for show button.");
        }
    }
});


// Periodic check as a fallback (e.g., every 10 seconds)
// Useful if MutationObserver misses something complex
setInterval(() => {
    if (filterEnabled) {
        log("Performing periodic fallback scan...");
        filterComments();
    }
}, 10000); // 10 seconds

log("neomod comment filter initialized.");

// Optional: Run selector diagnostics after initial load
// setTimeout(diagnoseSelectors, 7000);
function diagnoseSelectors() {
    log("--- Selector Diagnostics ---");
    INSTAGRAM_COMMENT_SELECTORS.forEach(selector => {
        try {
            const count = document.querySelectorAll(selector).length;
            log(`Selector "${selector}" found ${count} elements.`);
            // if (count > 0) {
            //     const sample = document.querySelector(selector);
            //     log(`  Sample HTML: ${sample.outerHTML.substring(0, 150)}...`);
            // }
        } catch (e) {
            log(`Selector "${selector}" caused an error: ${e.message}`);
        }
    });
    log("--- End Diagnostics ---");
}
// --- END OF FILE content.js ---