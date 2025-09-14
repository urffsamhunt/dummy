// browser.browserAction.onClicked.addListener(() => {
//   browser.tabs.create({
//     url: browser.runtime.getURL("popup/index_popup.html")
//   });
// });

// --- State Management ---
let activeTabId = null;
let activeTabSanitizedHtml = '';
const SERVER_URL = 'http://localhost:3000'; // IMPORTANT: Replace with the server's URL and port. But it has to be replaced by our deployed server URL in production.

// When a tab finishes loading, get its sanitized HTML.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We only act when a page has completely loaded and has a web URL.
    if (tabId === activeTabId && changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        requestSanitizedHtml(tabId);
    }});

    // When the user switches to a different tab, update the active tab ID and get its HTML.
browser.tabs.onActivated.addListener(activeInfo => {
    activeTabId = activeInfo.tabId;
    requestSanitizedHtml(activeTabId);
});

/**
 * Asks the content script of a given tab for its sanitized HTML content.
 * @param {number} tabId The ID of the tab to request HTML from.
 */
function requestSanitizedHtml(tabId) {
    if (!tabId) return;
    browser.tabs.sendMessage(tabId, { action: "getSanitizedPageHtml" })
        .then(response => {
            if (response && response.html) {
                console.log(`Successfully updated HTML context for tab ${tabId}.`);
                activeTabSanitizedHtml = response.html;
            }
        })
        .catch(error => console.error(`Could not get HTML from content script for tab ${tabId}: ${error}`));
}
        
/*        // Ask the content script on that tab to send us its HTML content.
        browser.tabs.sendMessage(tabId, { action: "getPageHtml" })
            .then(response => {
                if (response && response.html) {
                    handleRawHtml(response.html);
                }
            })
            .catch(error => console.error(`Could not get HTML from content script: ${error}`));
    }
});

//Take the captured HTML and log it.
function handleRawHtml(rawHtml) {
    console.log("Successfully captured raw HTML content from the page:");
    console.log(rawHtml); 
}
*/


/**
 * This is the main entry point to be called from our UI (e.g., popup.js).
 * It takes the user's transcribed text, sends it to the backend with context, and handles the response.
 * @param {string} promptText The transcribed text from the user's voice command.
 */
async function processUserCommand(promptText) {
    if (!activeTabId || !activeTabSanitizedHtml) {
        console.error("No active tab or page context available.");
        speakText("I'm sorry, I don't have the context of the page yet. Please wait a moment and try again.");
        return;
    }

    console.log(`Processing command: "${promptText}"`);
    try {
        const response = await fetch(`${SERVER_URL}/process-command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userPrompt: promptText,
                pageHtmlContext: activeTabSanitizedHtml
            })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();

        if (result.type === 'action') {
            // Send the executable command to the active content script
            browser.tabs.sendMessage(activeTabId, result.command);
        } else if (result.type === 'clarification') {
            // Speak the clarifying question back to the user
            speakText(result.question);
        }

    } catch (error) {
        console.error('Error in processUserCommand:', error);
        speakText("I'm sorry, I encountered an error trying to process your command.");
    }
}
/**
 * Sends text to our backend's TTS endpoint to be converted to speech.
 * @param {string} text The text to be spoken.
 */
async function speakText(text) {
    try {
        await fetch(`${SERVER_URL}/generate-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        // NOTE: This assumes our client-side UI is set up to play the audio
        // that this endpoint generates and saves (e.g., out.wav).
    } catch (error) {
        console.error('Failed to call TTS endpoint:', error);
    }
}

//handling actions requested by the Content Script
browser.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'search') {
        performSearch(message.query);
    } else if (message.action === 'addBookmark') {
        addBookmark(sender.tab);
    }
});
function performSearch(query) {
    browser.tabs.create({
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
    });
}
function addBookmark(tab) {
    if (tab && tab.url) {
        browser.bookmarks.create({
            title: tab.title || 'New Bookmark',
            url: tab.url
        });
    }
}


