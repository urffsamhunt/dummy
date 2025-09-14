// browser.browserAction.onClicked.addListener(() => {
//   browser.tabs.create({
//     url: browser.runtime.getURL("popup/index_popup.html")
//   });
// });


// This listener triggers automatically whenever a tab finishes loading.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // We only act when a page has completely loaded and has a web URL.
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        console.log(`Page loaded: ${tab.url}. Requesting HTML...`);
        
        // Ask the content script on that tab to send us its HTML content.
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


