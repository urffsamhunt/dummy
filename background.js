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
*/

//Take the captured HTML and log it.
function handleRawHtml(rawHtml) {
    console.log("Successfully captured raw HTML content from the page:");
    console.log(rawHtml); 
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


