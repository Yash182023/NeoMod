# neomod - Instagram Comment Filter

![Version](https://img.shields.io/badge/version-1.0-blue)
![Platform](https://img.shields.io/badge/platform-Chrome-brightgreen)
![Status](https://img.shields.io/badge/status-Active-success)

**neomod** is a Chrome browser extension designed to automatically hide potentially toxic, explicit, hateful, or spammy comments while you browse Instagram. It aims to create a cleaner and less negative viewing experience by filtering comments locally within your browser.

## Problem

Instagram comment sections can sometimes be filled with unwanted negativity, spam, or explicit content. Manually scrolling past or ignoring these comments can be draining. neomod provides an automated way to filter out this noise.

## Features

*   **Automatic Filtering:** Scans comments on Instagram posts, reels, etc., as they load.
*   **Local Keyword-Based Classification:** Uses predefined lists of keywords and simple patterns to identify potentially inappropriate content (explicit language, severe toxicity, insults, spam).
*   **Client-Side Processing:** All filtering happens directly in your browser. **No comment data is sent to external servers.**
*   **Enable/Disable Toggle:** Easily turn the filter on or off via the extension popup.
*   **Comment Placeholders:** Hides filtered comments behind a placeholder (`[neomod hid this comment]`).
*   **"Show" Button:** Option to reveal individual hidden comments if you choose.
*   **Hidden Comment Count:** See how many comments have been hidden on the current page via the popup.
*   **Clean UI:** Simple popup interface for controlling the filter.

## How It Works

1.  **DOM Monitoring:** The extension's content script (`content.js`) runs on Instagram pages. It uses `MutationObserver` and periodic checks to detect when comments are added to the page.
2.  **Text Extraction:** It attempts to extract the text content from comment elements, trying to ignore usernames and timestamps.
3.  **Local Classification:** The extracted text is passed through a local function (`classifyCommentLocally`) which compares it against lists of negative keywords and patterns (defined in `content.js`).
4.  **Hiding Mechanism:** If a comment is classified as negative based on the rules and a confidence threshold, the script:
    *   Adds CSS classes (`content.css`) to the comment element.
    *   Hides the original comment content.
    *   Injects a placeholder div with a "Show" button.
5.  **User Interaction:** The popup (`popup.html`, `popup.js`) allows the user to toggle the filter state (saved using `chrome.storage.sync`) and view the number of hidden comments. Clicking the "Show" button reveals the original comment.

*Note: An earlier prototype explored using a server-side AI model (BERT), but the current version uses purely client-side JavaScript for speed, privacy, and simplicity.*

## Screenshots

*(Add screenshots here after creating them)*

*   `[Screenshot of the extension popup showing Filter ON and hidden count]`
*   `[Screenshot of an Instagram comment section with a comment hidden by neomod]`
*   `[Screenshot showing a hidden comment after clicking the "Show" button]`

## Installation

**Option 1: From Chrome Web Store (Recommended - *Link will be added when published*)**

1.  Visit the neomod page on the Chrome Web Store: `[Link to Chrome Web Store Page]`
2.  Click "Add to Chrome".
3.  Pin the extension icon to your toolbar for easy access.

**Option 2: Manual Installation (For Development/Testing)**

1.  Download or clone this repository to your local machine.
2.  Open Google Chrome.
3.  Go to `chrome://extensions/`.
4.  Enable "Developer mode" using the toggle switch in the top-right corner.
5.  Click the "Load unpacked" button.
6.  Navigate to the directory where you downloaded/cloned the repository and select the folder containing the `manifest.json` file.
7.  The extension should now be loaded. Pin the icon if desired.

## Usage

1.  Navigate to [www.instagram.com](https://www.instagram.com/).
2.  Click the neomod icon in your Chrome toolbar to open the popup.
3.  Use the toggle switch to turn filtering ON or OFF.
4.  Browse Instagram as usual. If the filter is ON, potentially negative comments will be automatically hidden.
5.  The popup will show the number of comments hidden on the current page view.
6.  If you want to see a specific hidden comment, click the "Show" button next to its placeholder.

## Limitations

*   **Selector Reliance:** The extension relies on specific CSS selectors and HTML structures used by Instagram to find comments. Instagram frequently updates its website, which **will break** the selectors, requiring updates to the extension (`INSTAGRAM_COMMENT_SELECTORS` in `content.js`).
*   **Keyword Accuracy:** Filtering is based on keywords and simple patterns. This means:
    *   **False Positives:** Legitimate comments containing certain words (e.g., "price" in a shopping context) might be hidden.
    *   **False Negatives:** The filter may miss cleverly disguised negativity, sarcasm, misspellings, or new slang.
*   **Language Focus:** The current keyword lists are primarily English-focused.
*   **Performance:** On pages with an extremely high number of comments, intensive DOM scanning *could* potentially impact browser performance slightly, though efforts like debouncing have been made to mitigate this.

## Future Ideas

*   Allow users to add custom block/allow keywords.
*   Refine classification logic further (e.g., basic sentiment analysis using a small JS library, though this adds complexity).
*   Explore more robust ways to identify comment elements less prone to breaking.
*   (Long-term/Optional) Revisit server-side AI classification as a potential "Pro" feature if user demand and resources allow.
